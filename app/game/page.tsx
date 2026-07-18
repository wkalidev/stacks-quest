'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useWallet } from '../../hooks/useWallet'
import { useQuest } from '../../hooks/useQuest'
import { callContractFunction } from '../../hooks/useContractCall'
import ChainSelector from '../../components/ChainSelector'
import LangPicker from '../../components/LangPicker'
import { CHAINS, ChainId } from '../lib/chains'
import { useLang } from '../../hooks/useLang'
import Link from 'next/link'

// v3 uses a commit-reveal design: `play` only records a guess/bet, it never
// tells you if you won. The real result only exists on-chain after the owner
// calls `reveal-answer` (post game window), at which point players call
// `register-win` (if correct) and then `claim-reward`. This status machine
// mirrors that lifecycle instead of pretending to know the outcome up front.
type PuzzleStatus =
  | 'idle'
  | 'checking'
  | 'pending-reveal'
  | 'incorrect'
  | 'correct-unregistered'
  | 'registering'
  | 'registered-unclaimed'
  | 'claiming'
  | 'claimed'
  | 'check-failed'

export default function GamePage() {
  const { mounted, isConnected, address, connect } = useWallet()
  const {
    getTodayPuzzle, hasPlayedToday, getPlayerStats,
    getCurrentDay, getPuzzleByDay, getAttempt, checkIsCorrect,
  } = useQuest()
  const { lang, setLang, t } = useLang()

  const [puzzle, setPuzzle]         = useState<any>(null)
  const [guess, setGuess]           = useState('')
  const [bet, setBet]               = useState('10')
  const [selectedToken, setToken]   = useState('STX')
  const [loading, setLoading]       = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [played, setPlayed]         = useState(false)
  const [dayId, setDayId]           = useState<number | null>(null)
  const [puzzleStatus, setPuzzleStatus] = useState<PuzzleStatus>('idle')
  // null = unknown/still checking (never blocks play - a transient read
  // failure shouldn't stop someone from playing). true = confirmed a puzzle
  // exists on-chain for today. false = confirmed there is none yet (owner
  // hasn't called create-puzzle for today's day-id) - this is the only value
  // that actually blocks submission, since we've proven play() would revert
  // with ERR-NO-GAME-TODAY.
  const [puzzleLive, setPuzzleLive] = useState<boolean | null>(null)
  const [stats, setStats]           = useState<any>(null)
  const [txId, setTxId]             = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [checkedInToday, setCheckedInToday] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [selectedChain, setSelectedChain] = useState<ChainId>('stacks')

  const currentChain = CHAINS[selectedChain]
  const chainTokens  = currentChain.tokens as unknown as { symbol: string; label: string; decimals: number; color: string; native: boolean; address: string | null }[]

  const puzzleNumber = Math.floor(Date.now() / 86400000)

  useEffect(() => { loadPuzzle() }, [])

  useEffect(() => {
    if (isConnected && address) {
      checkPlayed()
      loadStats()
      loadCheckinStatus()
      checkOnChainPuzzleLive()
    }
  }, [isConnected, address])

  useEffect(() => {
    if (played && dayId !== null && address) checkPuzzleStatus(dayId)
  }, [played, dayId, address])

  if (!mounted) return null

  function handleChainChange(chain: ChainId) {
    setSelectedChain(chain)
    setToken(CHAINS[chain].tokens[0].symbol)
    setPuzzle(null)
    setGuess('')
    setBet('10')
  }

  async function loadPuzzle() {
    setLoading(true)
    try {
      const data = await getTodayPuzzle()
      setPuzzle(data)
    } catch {
      setPuzzle({ question: 'What is the current Stacks block height?', type: 'block-height' })
    }
    setLoading(false)
  }

  async function checkPlayed() {
    if (!address) return
    const todayKey = new Date().toISOString().slice(0, 10)
    try {
      const storedDayId = localStorage.getItem(`sq_dayid_${address}_${todayKey}`)
      if (localStorage.getItem(`sq_played_${address}_${todayKey}`)) {
        setPlayed(true)
        if (storedDayId !== null) setDayId(Number(storedDayId))
        return
      }
    } catch {}
    const r = await hasPlayedToday(address)
    setPlayed(!!r)
  }

  // Walks the on-chain commit-reveal state for the day the player played and
  // sets the UI status accordingly. Never guesses - only shows what's
  // actually provable on-chain right now.
  //
  // IMPORTANT: getPuzzleByDay/getAttempt/checkIsCorrect throw on a read
  // failure (network/CORS/etc.) rather than returning null, specifically so
  // this can tell "we checked and there's genuinely nothing there yet" apart
  // from "the check itself failed". Collapsing both into the same fallback
  // used to show a false "already played, come back tomorrow" when the
  // real answer was "we don't know, try again" - see AUDIT notes 2026-07-17.
  async function checkPuzzleStatus(id: number) {
    if (!address) return
    setPuzzleStatus('checking')
    try {
      const puzzleInfo = await getPuzzleByDay(id, address)
      if (!puzzleInfo) { setPuzzleStatus('idle'); return } // genuinely no puzzle for this day
      if (!puzzleInfo.revealed || puzzleInfo.answer === null) {
        setPuzzleStatus('pending-reveal')
        return
      }
      const attempt = await getAttempt(id, address)
      if (!attempt) { setPuzzleStatus('idle'); return } // genuinely no attempt recorded
      if (attempt.claimed) { setPuzzleStatus('claimed'); return }
      if (attempt.registered) { setPuzzleStatus('registered-unclaimed'); return }
      const correct = await checkIsCorrect(attempt.guess, puzzleInfo.answer, puzzleInfo.tolerance, address)
      setPuzzleStatus(correct ? 'correct-unregistered' : 'incorrect')
    } catch (e) {
      // The check itself failed (network, CORS, API hiccup) - NOT the same
      // as "nothing to see here". Surface it honestly with a retry instead
      // of silently claiming the player is done for the day.
      console.error('[game] checkPuzzleStatus failed:', e)
      setPuzzleStatus('check-failed')
    }
  }

  // Proactively checks whether today's puzzle actually exists on-chain
  // BEFORE letting anyone submit a guess. play() itself already enforces
  // this (reverts ERR-NO-GAME-TODAY / u104 if the owner hasn't called
  // create-puzzle for today's day-id yet), but that check only happens
  // after the player already paid a network fee for a doomed transaction -
  // this hit real users twice in prod. Left as `null` (not blocking) on any
  // read failure - we only want to block on a *confirmed* absence, never on
  // "we're not sure".
  async function checkOnChainPuzzleLive() {
    if (!address) return
    try {
      const day = await getCurrentDay(address)
      if (day === null) return // read failed upstream, already logged there
      const info = await getPuzzleByDay(day, address)
      setPuzzleLive(info !== null)
    } catch (e) {
      console.error('[game] checkOnChainPuzzleLive failed:', e)
      // leave as unknown rather than falsely blocking play on a transient hiccup
    }
  }

  async function handleRegisterWin() {
    if (!address || dayId === null) return
    setPuzzleStatus('registering')
    const { uintCV } = await import('@stacks/transactions')
    callContractFunction(
      'stacks-quest-v3',
      'register-win',
      [uintCV(dayId)],
      () => checkPuzzleStatus(dayId),
      () => setPuzzleStatus('correct-unregistered'),
    )
  }

  async function handleClaimReward() {
    if (!address || dayId === null) return
    setPuzzleStatus('claiming')
    const { uintCV } = await import('@stacks/transactions')
    callContractFunction(
      'stacks-quest-v3',
      'claim-reward',
      [uintCV(dayId)],
      () => checkPuzzleStatus(dayId),
      () => setPuzzleStatus('registered-unclaimed'),
    )
  }

  async function loadStats() {
    if (!address) return
    const s = await getPlayerStats(address)
    setStats(s)
  }

  function loadCheckinStatus() {
    if (!address) return
    try {
      const s = localStorage.getItem(`sq_streak_${address}`)
      if (s) {
        const d = JSON.parse(s)
        const today = Math.floor(Date.now() / (144 * 10 * 60 * 1000))
        setCheckedInToday(d.last_checkin_day === today)
      }
    } catch {}
  }

  async function handleCheckIn() {
    if (!isConnected || !address || checkedInToday || checkingIn) return
    setCheckingIn(true)
    try {
      const { openContractCall } = await import('@stacks/connect')
      const stacks = await import('@stacks/transactions')
      await openContractCall({
        contractAddress: 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N',
        contractName: 'stacks-quest-agent-v3',
        functionName: 'daily-checkin',
        functionArgs: [],
        postConditionMode: stacks.PostConditionMode.Allow,
        network: 'mainnet' as any,
        onFinish: () => {
          const today = Math.floor(Date.now() / (144 * 10 * 60 * 1000))
          try {
            const s = localStorage.getItem(`sq_streak_${address}`)
            const d = s ? JSON.parse(s) : { current_streak: 0, best_streak: 0, total_checkins: 0 }
            const ns = {
              current_streak: (d.current_streak || 0) + 1,
              best_streak: Math.max(d.best_streak || 0, (d.current_streak || 0) + 1),
              total_checkins: (d.total_checkins || 0) + 1,
              last_checkin_day: today,
            }
            localStorage.setItem(`sq_streak_${address}`, JSON.stringify(ns))
            setStats((prev: any) => ({ ...(prev || {}), streak: ns.current_streak, total: ns.total_checkins }))
          } catch {}
          setCheckedInToday(true)
          setCheckingIn(false)
        },
        onCancel: () => setCheckingIn(false),
      })
    } catch {
      setCheckingIn(false)
    }
  }

  async function submitGuess() {
    if (!isConnected || !address || !guess || submitting) return
    if (puzzleLive === false) {
      setError('No puzzle is live today yet. The owner needs to create one first — check back soon.')
      return
    }
    const guessNum = parseInt(guess)
    if (isNaN(guessNum) || guessNum <= 0) { setError('Invalid guess'); return }
    const betNum = parseFloat(bet)
    if (isNaN(betNum) || betNum <= 0) { setError('Invalid bet'); return }

    setSubmitting(true)
    setError(null)

    try {
      // Capture which puzzle day-id this guess belongs to before opening the
      // wallet popup, so we can poll the right day's on-chain state later
      // regardless of what "today" is by the time it gets checked.
      const currentDay = await getCurrentDay(address)

      // Re-verify a puzzle exists RIGHT NOW, not just trust the `puzzleLive`
      // state from whenever the page first loaded. That state is only set
      // once (on mount / wallet connect) and never refreshed - a player who
      // leaves /game open across a day-id boundary, or simply loads it well
      // before submitting, can otherwise still fire a play() call that's
      // doomed to revert with ERR-NO-GAME-TODAY. This hit a real player in
      // prod (2026-07-18) despite the mount-time check passing earlier.
      // Fails open on a read error (unknown != confirmed-absent) - the
      // contract itself is still the final authority either way.
      if (currentDay !== null) {
        try {
          const freshPuzzle = await getPuzzleByDay(currentDay, address)
          if (!freshPuzzle) {
            setPuzzleLive(false)
            setError('No puzzle is live today yet. The owner needs to create one first — check back soon.')
            setSubmitting(false)
            return
          }
          setPuzzleLive(true)
        } catch (e) {
          console.error('[game] fresh puzzle-live re-check failed, proceeding anyway:', e)
        }
      }

      const { openContractCall } = await import('@stacks/connect')
      const stacks = await import('@stacks/transactions')

      const CONTRACT = 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
      // token IDs match the contract: 0=STX, 1=B2S, 2=USDCx, 3=sBTC
      const TOKEN_IDS: Record<string, number> = { STX: 0, B2S: 1, USDCX: 2, SBTC: 3 }
      const tokenInfo = chainTokens.find(t => t.symbol === selectedToken)!
      const betMicro = Math.floor(betNum * Math.pow(10, tokenInfo.decimals))
      const tokenId = TOKEN_IDS[selectedToken] ?? 0

      const functionArgs = [
        stacks.uintCV(guessNum),
        stacks.uintCV(betMicro),
        stacks.uintCV(tokenId),
      ]

      const functionName = 'play'

      await openContractCall({
        contractAddress: CONTRACT,
        contractName: 'stacks-quest-v3',
        functionName,
        functionArgs,
        postConditionMode: stacks.PostConditionMode.Allow,
        network: 'mainnet' as any,
        onFinish: (data: any) => {
          const tx = data?.txId || data?.txid
          if (tx) {
            setTxId(tx)
            setPlayed(true)
            try {
              const todayKey = new Date().toISOString().slice(0, 10)
              localStorage.setItem(`sq_played_${address}_${todayKey}`, '1')
              if (currentDay !== null) {
                localStorage.setItem(`sq_dayid_${address}_${todayKey}`, String(currentDay))
                setDayId(currentDay)
              }
            } catch {}
            // The contract doesn't know the answer yet either - `reveal-answer`
            // runs later, so all we can honestly say right now is "submitted".
            setPuzzleStatus('pending-reveal')
          }
          setSubmitting(false)
        },
        onCancel: () => setSubmitting(false),
      })
    } catch {
      setError('Transaction failed. Please try again.')
      setSubmitting(false)
    }
  }

  function generateShareText() {
    return `🏆 Stacks Quest Daily #${puzzleNumber}\n🔥 Streak: ${stats?.streak || 0} days\n👉 stacks-quest-ten.vercel.app\n#StacksQuest #Bitcoin #Stacks`
  }

  const token = chainTokens.find(t => t.symbol === selectedToken) ?? chainTokens[0]
  const isChainLive = !!currentChain.contracts.game

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0014 0%, #000a1f 50%, #0a0800 100%)', color: '#fff', fontFamily: "'Inter','Segoe UI',sans-serif", padding: '20px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0, background: 'linear-gradient(90deg, #9945FF, #0052FF, #FCBA27, #35D07F)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Stacks Quest</h1>
            <p style={{ color: '#555', fontSize: 11, margin: '2px 0 0' }}>Daily Puzzle #{puzzleNumber}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <LangPicker lang={lang} onChange={setLang} />
            <Link href="/agent" style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(153,69,255,0.1)', border: '1px solid rgba(153,69,255,0.3)', color: '#9945ff', fontSize: 11, textDecoration: 'none' }}>
              🤖 Agent
            </Link>
            {isConnected ? (
              <div style={{ padding: '6px 12px', borderRadius: 6, background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', color: '#00ff9f', fontSize: 11 }}>
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>
            ) : (
              <button onClick={connect} style={{ padding: '6px 12px', borderRadius: 6, background: '#9945ff', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontFamily: 'monospace' }}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
            {[
              { label: 'STREAK',      value: `${stats.streak || 0} days` },
              { label: 'TOTAL PLAYS', value: stats.total || 0 },
              { label: 'WINS',        value: stats.wins || 0 },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '10px 12px' }}>
                <p style={{ color: '#666', fontSize: 9, margin: '0 0 2px', letterSpacing: '0.1em' }}>{s.label}</p>
                <p style={{ color: '#9945ff', fontSize: 16, fontWeight: 700, margin: 0 }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Chain selector */}
        <div style={{ marginBottom: 16 }}>
          <ChainSelector selected={selectedChain} onChange={handleChainChange} />
        </div>

        {/* Puzzle card */}
        <div style={{ background: 'rgba(153,69,255,0.05)', border: '1px solid rgba(153,69,255,0.3)', borderLeft: '3px solid #9945FF', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          {loading ? (
            <p style={{ color: '#444', fontSize: 13 }}>Loading today&apos;s puzzle...</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ background: 'rgba(153,69,255,0.15)', border: '1px solid rgba(153,69,255,0.3)', color: '#9945ff', fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 700 }}>{t.dailyPuzzle}</span>
                <span style={{ color: '#333', fontSize: 10 }}>{t.oneGuess}</span>
              </div>
              <p style={{ fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.5, margin: '0 0 16px' }}>
                {puzzle?.question || 'What is the current Stacks block height?'}
              </p>
              {puzzle?.hint && (
                <p style={{ color: '#9945ff', fontSize: 11, margin: '6px 0 0', opacity: 0.8 }}>💡 {puzzle.hint}</p>
              )}
              <p style={{ color: '#555', fontSize: 11, margin: '6px 0 0' }}>Hot/warm/cold hints after your guess</p>
            </>
          )}
        </div>

        {/* Daily check-in */}
        {isConnected && !checkedInToday && (
          <div style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ color: '#ffd700', fontWeight: 700, margin: '0 0 2px', fontSize: 13 }}>🔥 {t.checkIn}</p>
              <p style={{ color: '#555', fontSize: 11, margin: 0 }}>{t.checkInSub}</p>
            </div>
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              style={{ padding: '8px 14px', background: '#ffd700', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: checkingIn ? 'wait' : 'pointer', fontFamily: 'monospace' }}
            >
              {checkingIn ? '...' : t.checkInBtn}
            </button>
          </div>
        )}

        {/* Already played - shows real on-chain commit-reveal status, never a guess */}
        {played && (
          <div style={{ background: 'rgba(153,69,255,0.05)', border: '1px solid rgba(153,69,255,0.2)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            {(puzzleStatus === 'idle' || puzzleStatus === 'checking') && (
              <p style={{ color: '#9945ff', margin: 0, fontSize: 13 }}>
                {puzzleStatus === 'checking' ? 'Checking result…' : `✓ ${t.alreadyPlayed}`}
              </p>
            )}

            {puzzleStatus === 'check-failed' && (
              <>
                <p style={{ color: '#ff9944', fontWeight: 700, margin: '0 0 6px', fontSize: 13 }}>
                  ⚠️ Couldn&apos;t check your result right now.
                </p>
                <p style={{ color: '#555', fontSize: 12, margin: '0 0 10px' }}>
                  You&apos;ve played today — this is just a network hiccup checking the on-chain status, not a lost entry.
                </p>
                <button
                  onClick={() => dayId !== null && checkPuzzleStatus(dayId)}
                  style={{ padding: '8px 14px', background: 'rgba(255,153,68,0.15)', border: '1px solid rgba(255,153,68,0.4)', color: '#ff9944', borderRadius: 8, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'monospace' }}
                >
                  Retry
                </button>
              </>
            )}

            {puzzleStatus === 'pending-reveal' && (
              <>
                <p style={{ color: '#9945ff', fontWeight: 700, margin: '0 0 6px', fontSize: 13 }}>✓ {t.alreadyPlayed}</p>
                <p style={{ color: '#555', fontSize: 12, margin: 0 }}>
                  The answer hasn&apos;t been revealed yet. Check back after today&apos;s window closes to see if you won.
                </p>
              </>
            )}

            {puzzleStatus === 'incorrect' && (
              <p style={{ color: '#888', margin: 0, fontSize: 13 }}>
                ❄️ Not this time — the answer was revealed and your guess wasn&apos;t within range. Come back tomorrow!
              </p>
            )}

            {puzzleStatus === 'correct-unregistered' && (
              <>
                <p style={{ color: '#00ff9f', fontWeight: 700, margin: '0 0 8px', fontSize: 13 }}>
                  🎉 You got it! Register your win to claim your share of the pool.
                </p>
                <button
                  onClick={handleRegisterWin}
                  style={{ padding: '10px 16px', background: '#00ff9f', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'monospace' }}
                >
                  Register Win
                </button>
              </>
            )}

            {puzzleStatus === 'registering' && (
              <p style={{ color: '#9945ff', margin: 0, fontSize: 13 }}>Registering your win…</p>
            )}

            {puzzleStatus === 'registered-unclaimed' && (
              <>
                <p style={{ color: '#00ff9f', fontWeight: 700, margin: '0 0 8px', fontSize: 13 }}>
                  ✓ Win registered. Once the registration window closes, claim your reward.
                </p>
                <button
                  onClick={handleClaimReward}
                  style={{ padding: '10px 16px', background: '#00ff9f', color: '#000', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'monospace' }}
                >
                  Claim Reward
                </button>
              </>
            )}

            {puzzleStatus === 'claiming' && (
              <p style={{ color: '#9945ff', margin: 0, fontSize: 13 }}>Claiming your reward…</p>
            )}

            {puzzleStatus === 'claimed' && (
              <>
                <p style={{ color: '#00ff9f', fontWeight: 700, margin: '0 0 8px', fontSize: 13 }}>🏆 Reward claimed!</p>
                <a
                  href={`https://warpcast.com/~/compose?text=${encodeURIComponent(generateShareText())}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-block', padding: '8px 16px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', borderRadius: 8, fontSize: 12, textDecoration: 'none', fontWeight: 700 }}
                >
                  🟣 Share on Farcaster
                </a>
              </>
            )}
          </div>
        )}

        {/* Coming Soon for non-live chains */}
        {!isChainLive && (
          <div style={{ background: 'rgba(153,69,255,0.05)', border: '1px solid rgba(153,69,255,0.2)', borderRadius: 12, padding: 20, marginBottom: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 28, margin: '0 0 8px' }}>{currentChain.icon}</p>
            <p style={{ color: currentChain.color, fontWeight: 700, fontSize: 16, margin: '0 0 6px' }}>{currentChain.label} — Coming Soon</p>
            <p style={{ color: '#555', fontSize: 12, margin: 0 }}>Contracts deploying. Stacks is live now.</p>
          </div>
        )}

        {/* No puzzle live yet - confirmed on-chain, blocks submission before
            anyone can burn a network fee on a doomed play() call */}
        {isChainLive && !played && isConnected && puzzleLive === false && selectedChain === 'stacks' && (
          <div style={{ background: 'rgba(255,153,68,0.05)', border: '1px solid rgba(255,153,68,0.25)', borderRadius: 12, padding: 24, marginBottom: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 24, margin: '0 0 8px' }}>⏳</p>
            <p style={{ color: '#ff9944', fontWeight: 700, fontSize: 14, margin: '0 0 6px' }}>No puzzle live right now</p>
            <p style={{ color: '#555', fontSize: 12, margin: 0 }}>Today&apos;s puzzle hasn&apos;t been created yet. Check back soon!</p>
          </div>
        )}

        {/* Submit form */}
        {isChainLive && !played && isConnected && !(puzzleLive === false && selectedChain === 'stacks') && (
          <div style={{ background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <p style={{ color: '#555', fontSize: 11, margin: '0 0 16px', letterSpacing: '0.1em' }}>{t.yourGuess}</p>

            <input
              type="number"
              value={guess}
              onChange={e => setGuess(e.target.value)}
              placeholder="Enter your answer..."
              style={{ width: '100%', padding: '12px', background: '#080810', border: '1px solid #222', borderRadius: 8, color: '#fff', fontSize: 16, fontFamily: 'monospace', marginBottom: 12, boxSizing: 'border-box' }}
            />

            <p style={{ color: '#555', fontSize: 11, margin: '0 0 8px', letterSpacing: '0.1em' }}>{t.tokenBet}</p>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {chainTokens.map(t => (
                <button
                  key={t.symbol}
                  onClick={() => setToken(t.symbol)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace',
                    background: selectedToken === t.symbol ? t.color : 'transparent',
                    color: selectedToken === t.symbol ? '#000' : t.color,
                    border: `1px solid ${t.color}44`,
                  }}
                >{t.label}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['1', '10', '50', '100'].map(v => (
                <button
                  key={v}
                  onClick={() => setBet(v)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'monospace',
                    background: bet === v ? 'linear-gradient(90deg, #9945FF44, #0052FF44)' : 'transparent',
                    color: bet === v ? '#9945ff' : '#555',
                    border: `1px solid ${bet === v ? '#9945FF' : '#222'}`,
                  }}
                >{v} {token.symbol === 'SBTC' ? 'sBTC' : selectedToken}</button>
              ))}
            </div>

            {error && <p style={{ color: '#ff4444', fontSize: 12, marginBottom: 8 }}>{error}</p>}

            <button
              onClick={submitGuess}
              disabled={submitting || !guess}
              style={{
                width: '100%', padding: '16px', borderRadius: 12, fontSize: 16, fontWeight: 900,
                background: submitting || !guess ? '#1a1a2e' : 'linear-gradient(90deg, #9945FF, #0052FF)',
                color: submitting || !guess ? '#444' : '#fff',
                border: 'none', cursor: submitting || !guess ? 'not-allowed' : 'pointer',
                fontFamily: 'monospace', letterSpacing: '0.05em',
                boxShadow: submitting || !guess ? 'none' : '0 4px 20px rgba(153,69,255,0.4)',
              }}
            >
              {submitting ? t.submitting : `▶ ${bet} ${selectedToken} — ${t.submit}`}
            </button>

            <p style={{ color: '#333', fontSize: 10, textAlign: 'center', marginTop: 8 }}>
              Winners split the reward pool · 1 guess per day
            </p>
          </div>
        )}

        {/* Connect prompt */}
        {isChainLive && !isConnected && (
          <div style={{ background: '#0f0f1a', border: '1px solid #1a1a2e', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 16 }}>
            <p style={{ color: '#555', marginBottom: 16 }}>{t.connectPrompt}</p>
            <button
              onClick={connect}
              style={{ padding: '12px 24px', borderRadius: 10, background: 'linear-gradient(90deg, #9945FF, #0052FF)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: 'monospace', boxShadow: '0 4px 20px rgba(153,69,255,0.4)' }}
            >
              {t.connect}
            </button>
          </div>
        )}

        {/* How it works */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ color: '#555', fontSize: 10, letterSpacing: '0.1em', margin: '0 0 12px' }}>{t.howItWorks}</p>
          {[
            ['1', 'Guess real blockchain data (block height, price, tx count)', '#9945FF'],
            ['2', 'Bet STX, $B2S, USDCx or sBTC (1-100 tokens)', '#0052FF'],
            ['3', 'Correct guesses win a share of the daily reward pool', '#FCBA27'],
            ['4', 'Hot / warm / cold hints after your guess', '#35D07F'],
            ['5', 'Check in daily to build your streak and earn bonus rewards', '#9945FF'],
          ].map(([n, t, c]) => (
            <div key={n} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
              <span style={{ color: c as string, fontWeight: 900, minWidth: 14, fontSize: 14 }}>{n}.</span>
              <span style={{ color: '#888', fontSize: 12 }}>{t}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, paddingTop: 16, borderTop: '1px solid #111' }}>
          <Link href="/agent" style={{ color: '#9945ff', fontSize: 12, textDecoration: 'none' }}>🤖 DeFi Agent</Link>
          <a href="https://base2stacks-tracker.vercel.app" style={{ color: '#555', fontSize: 12 }}>🌉 Bridge</a>
          <a href="https://github.com/wkalidev/stacks-quest" style={{ color: '#555', fontSize: 12 }}>GitHub</a>
        </div>
      </div>
    </main>
  )
}
