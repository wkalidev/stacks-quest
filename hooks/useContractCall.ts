// hooks/useContractCall.ts - Xverse compatible via @stacks/connect
'use client'

const CONTRACT_ADDRESS = 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const CONTRACT_NAME    = 'stacks-quest-v3'

// token IDs match the contract: 0=STX, 1=B2S, 2=USDCx, 3=sBTC — sBTC uses 8 decimals, rest use 6.
// (Previously this hardcoded a 1e6 multiplier for every token, which would have understated
// sBTC bets by 100x had this function ever been wired up to the UI.)
const TOKEN_DECIMALS: Record<number, number> = { 0: 6, 1: 6, 2: 6, 3: 8 }

export async function callPlay(
  guess:     number,
  betAmount: number,
  token:     number,
  onFinish:  (txid: string) => void,
  onCancel:  () => void,
) {
  try {
    const { openContractCall } = await import('@stacks/connect')
    const stacks = await import('@stacks/transactions')

    const toHex = (cv: any): string => {
      const r = (stacks.serializeCV as any)(cv)
      return Array.from(r as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('')
    }

    const decimals = TOKEN_DECIMALS[token] ?? 6
    const betMicro = Math.round(betAmount * 10 ** decimals)

    await openContractCall({
      contractAddress:   CONTRACT_ADDRESS,
      contractName:      CONTRACT_NAME,
      functionName:      'play',
      functionArgs:      [
        stacks.uintCV(guess),
        stacks.uintCV(betMicro),
        stacks.uintCV(token),
      ],
      postConditionMode: stacks.PostConditionMode.Allow,
      network:           'mainnet' as any,
      onFinish:          (data: any) => {
        const txid = data?.txId || data?.txid
        if (txid) onFinish(txid)
        else onCancel()
      },
      onCancel:          () => onCancel(),
    })
  } catch (e: any) {
    console.error('[callPlay]', e?.message || e)
    onCancel()
  }
}

export async function callContractFunction(
  contractName: string,
  functionName: string,
  functionArgs: any[],
  onFinish:     (txid: string) => void,
  onCancel:     () => void,
) {
  try {
    const { openContractCall } = await import('@stacks/connect')
    const stacks = await import('@stacks/transactions')

    await openContractCall({
      contractAddress:   CONTRACT_ADDRESS,
      contractName,
      functionName,
      functionArgs,
      postConditionMode: stacks.PostConditionMode.Allow,
      network:           'mainnet' as any,
      onFinish:          (data: any) => {
        const txid = data?.txId || data?.txid
        if (txid) onFinish(txid)
        else onCancel()
      },
      onCancel:          () => onCancel(),
    })
  } catch (e: any) {
    console.error('[callContractFunction]', e?.message || e)
    onCancel()
  }
}

// NOTE: the old checkResult() (polled a `won`/`lost` smart_contract_log event)
// was removed 2026-07-17. It only worked against stacks-quest-v2, which
// determined win/loss synchronously inside `play`. v3 is commit-reveal —
// `play` emits no such event, the answer isn't known on-chain until the
// owner calls `reveal-answer`, and correctness is checked via the
// `is-correct-guess` read-only function after that (see useQuest.ts's
// getPuzzleByDay/getAttempt/checkIsCorrect + game/page.tsx's status flow).
// It was confirmed unused (no imports anywhere) before removal.