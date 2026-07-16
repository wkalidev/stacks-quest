;; ============================================================================
;; DRAFT — Stacks Quest v3 — Commit-Reveal Puzzle Answers
;; ============================================================================
;; STATUS: DRAFT / NOT DEPLOYED / NOT WIRED INTO THE APP.
;; This file exists to fix the CRITICAL flaw documented in SECURITY.md
;; ("Known Game-Design Limitation — Puzzle Answers Are Public On-Chain") and in
;; the SECURITY NOTE comments on `create-puzzle` in stacks-quest.clar /
;; stacks-quest-v2.clar: the current live contracts store `answer` in a public
;; map, readable by anyone the instant the owner posts the puzzle — long before
;; `reveal-answer` — letting anyone submit a guaranteed-correct guess and drain
;; the day's reward pool.
;;
;; This draft has NOT been:
;;   - compiled/checked with `clarinet check` (do that before anything else)
;;   - unit tested
;;   - audited
;;   - deployed anywhere (mainnet, testnet, or devnet)
;;   - wired into app/, hooks/, or any API route
;; Treat it as a starting point for a real v3, not a drop-in replacement.
;;
;; WHAT CHANGED vs stacks-quest-v2.clar
;; -------------------------------------
;; 1. `create-puzzle` takes `answer-hash (buff 32)` instead of `answer uint`.
;;    The owner computes `answer-hash = sha256(to-consensus-buff?(answer) ++ salt)`
;;    OFF-CHAIN before calling this, keeping `answer` and `salt` secret.
;;    Nothing in the `puzzles` map reveals the answer while the game is open.
;; 2. `play` no longer determines `won` immediately (the contract doesn't know
;;    the answer yet) — it just records the guess/bet.
;; 3. `reveal-answer` now takes the real `answer` + `salt`, re-derives the hash
;;    on-chain, and REJECTS the call (ERR-BAD-REVEAL) if it doesn't match the
;;    committed `answer-hash`. Only after this succeeds does `answer` become
;;    known on-chain. This can only happen after `end-block` — the game must
;;    already be closed to new guesses before the answer can be revealed.
;; 4. New `register-win` step: once revealed, each player who guessed correctly
;;    must call `register-win` during a fixed registration window to be counted
;;    in that token's `winners` tally. This exists because Clarity has no way to
;;    iterate over all attempts for a day-id to compute "won" for everyone in
;;    one transaction — someone has to trigger it, so each winner triggers their
;;    own registration (cheap, one map-set). `claim-reward` is only callable
;;    after the registration window closes, so the pool-per-winner math in
;;    `claim-reward` is stable (winners count can't change mid-payout).
;; 5. Losers still don't get a bet refund (unchanged from v2 economics) — bets
;;    from non-winners simply remain in the contract, exactly as in v2.
;;
;; OPEN QUESTIONS FOR WHOEVER PICKS THIS UP:
;;   - What happens if the owner never calls `reveal-answer` (griefing /
;;     forgetting)? Right now bets are stuck forever. Consider a timeout after
;;     which players can reclaim their own bet if `revealed` is still false
;;     N blocks after `end-block`.
;;   - REGISTER-WINDOW-BLOCKS below is a placeholder (144 blocks / ~1 day) —
;;     pick a real value.
;;   - Migrating existing v2 reward-pool balances / in-flight puzzles to this
;;     contract is a separate, manual, one-time operation — not covered here.
;;   - Get this professionally audited before it ever touches real funds.
;; ============================================================================

(define-constant CONTRACT-OWNER tx-sender)

;; Errors
(define-constant ERR-NOT-OWNER        (err u100))
(define-constant ERR-ALREADY-PLAYED   (err u101))
(define-constant ERR-GAME-CLOSED      (err u102))
(define-constant ERR-INVALID-GUESS    (err u103))
(define-constant ERR-NO-GAME-TODAY    (err u104))
(define-constant ERR-ALREADY-CLAIMED  (err u105))
(define-constant ERR-NOT-WINNER       (err u106))
(define-constant ERR-INVALID-BET      (err u107))
(define-constant ERR-INVALID-TOKEN    (err u108))
(define-constant ERR-BAD-REVEAL       (err u109)) ;; sha256(answer+salt) didn't match answer-hash
(define-constant ERR-NOT-REVEALED     (err u110)) ;; reveal-answer hasn't happened yet
(define-constant ERR-ALREADY-REVEALED (err u111))
(define-constant ERR-REGISTER-CLOSED  (err u112)) ;; registration window over
(define-constant ERR-REGISTER-OPEN    (err u113)) ;; claim attempted before registration window closes
(define-constant ERR-NOT-CORRECT      (err u114)) ;; register-win called with a wrong guess
(define-constant ERR-ALREADY-REGISTERED (err u115))

;; Token identifiers
(define-constant TOKEN-STX   u0)
(define-constant TOKEN-B2S   u1)
(define-constant TOKEN-USDCX u2)
(define-constant TOKEN-SBTC  u3)

(define-constant B2S   .b2s-token-v4)
(define-constant USDCX 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx)
(define-constant SBTC  'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token)

(define-constant MIN-BET-STX   u1000000)
(define-constant MAX-BET-STX   u100000000)
(define-constant MIN-BET-B2S   u1000000)
(define-constant MAX-BET-B2S   u100000000)
(define-constant MIN-BET-USDCX u1000000)
(define-constant MAX-BET-USDCX u100000000)
(define-constant MIN-BET-SBTC  u1000)
(define-constant MAX-BET-SBTC  u100000)

(define-constant BLOCKS-PER-DAY u144)
;; Placeholder — pick a real value before deploying. Window (in blocks) after
;; `reveal-answer` during which winners must call `register-win` to be counted.
(define-constant REGISTER-WINDOW-BLOCKS u144)

;; ---------------------------------------------------------
;; DATA MAPS
;; ---------------------------------------------------------

(define-map puzzles
  { day-id: uint }
  {
    puzzle-type:        (string-ascii 20),
    answer-hash:         (buff 32),   ;; sha256(to-consensus-buff?(answer) ++ salt) — set at create-puzzle
    answer:              (optional uint), ;; only set once reveal-answer succeeds
    tolerance:           uint,
    reward-pool-stx:     uint,
    reward-pool-b2s:     uint,
    reward-pool-usdcx:   uint,
    reward-pool-sbtc:    uint,
    total-bets-stx:      uint,
    total-bets-b2s:       uint,
    total-bets-usdcx:    uint,
    total-bets-sbtc:     uint,
    winners-stx:         uint,
    winners-b2s:          uint,
    winners-usdcx:       uint,
    winners-sbtc:        uint,
    revealed:            bool,
    start-block:         uint,
    end-block:           uint,        ;; guesses close after this block
    register-close-block: uint,       ;; set at reveal time = reveal-block + REGISTER-WINDOW-BLOCKS
  }
)

(define-map attempts
  { day-id: uint, player: principal }
  {
    guess:      uint,
    bet:        uint,
    token:      uint,
    registered: bool,   ;; true once register-win has been called successfully
    claimed:    bool,
    timestamp:  uint,
  }
)

(define-map player-stats
  { player: principal }
  {
    total-played:   uint,
    total-won:      uint,
    best-streak:    uint,
    current-streak: uint,
    last-played:    uint,
  }
)

(define-data-var total-games-played uint u0)
(define-data-var current-day-id     uint u0)

;; ---------------------------------------------------------
;; READ-ONLY
;; ---------------------------------------------------------

(define-read-only (get-current-day)
  (/ stacks-block-height BLOCKS-PER-DAY))

(define-read-only (get-puzzle (day-id uint))
  (map-get? puzzles { day-id: day-id }))

(define-read-only (get-today-puzzle)
  (map-get? puzzles { day-id: (get-current-day) }))

;; NOTE: before reveal, `answer` is `none` and `answer-hash` is a commitment
;; only — this read-only call is now safe to expose publicly during the game.
(define-read-only (get-attempt (day-id uint) (player principal))
  (map-get? attempts { day-id: day-id, player: player }))

(define-read-only (get-player-stats (player principal))
  (default-to
    { total-played: u0, total-won: u0, best-streak: u0, current-streak: u0, last-played: u0 }
    (map-get? player-stats { player: player })))

(define-read-only (has-played-today (player principal))
  (is-some (map-get? attempts { day-id: (get-current-day), player: player })))

(define-read-only (is-valid-token (token uint))
  (or (is-eq token TOKEN-STX) (is-eq token TOKEN-B2S) (is-eq token TOKEN-USDCX) (is-eq token TOKEN-SBTC)))

(define-read-only (is-correct-guess (guess uint) (answer uint) (tolerance uint))
  (let (
    (diff     (if (>= guess answer) (- guess answer) (- answer guess)))
    (max-diff (/ (* answer tolerance) u100))
  )
    (<= diff max-diff)))

;; ---------------------------------------------------------
;; PRIVATE HELPERS
;; ---------------------------------------------------------

(define-private (get-min-bet (token uint))
  (if (is-eq token TOKEN-STX)   MIN-BET-STX
  (if (is-eq token TOKEN-B2S)   MIN-BET-B2S
  (if (is-eq token TOKEN-USDCX) MIN-BET-USDCX
  MIN-BET-SBTC))))

(define-private (get-max-bet (token uint))
  (if (is-eq token TOKEN-STX)   MAX-BET-STX
  (if (is-eq token TOKEN-B2S)   MAX-BET-B2S
  (if (is-eq token TOKEN-USDCX) MAX-BET-USDCX
  MAX-BET-SBTC))))

(define-private (transfer-in (amount uint) (sender principal) (token uint))
  (if (is-eq token TOKEN-STX)
    (stx-transfer? amount sender (as-contract tx-sender))
  (if (is-eq token TOKEN-B2S)
    (contract-call? B2S transfer amount sender (as-contract tx-sender) none)
  (if (is-eq token TOKEN-USDCX)
    (contract-call? USDCX transfer amount sender (as-contract tx-sender) none)
    (contract-call? SBTC transfer amount sender (as-contract tx-sender) none)
  ))))

(define-private (transfer-out (amount uint) (recipient principal) (token uint))
  (if (is-eq token TOKEN-STX)
    (as-contract (stx-transfer? amount tx-sender recipient))
  (if (is-eq token TOKEN-B2S)
    (as-contract (contract-call? B2S transfer amount tx-sender recipient none))
  (if (is-eq token TOKEN-USDCX)
    (as-contract (contract-call? USDCX transfer amount tx-sender recipient none))
    (as-contract (contract-call? SBTC transfer amount tx-sender recipient none))
  ))))

;; ---------------------------------------------------------
;; OWNER FUNCTIONS
;; ---------------------------------------------------------

;; `answer-hash` must be computed OFF-CHAIN as:
;;   sha256( to-consensus-buff?(answer) ++ salt )
;; where `salt` is a fresh random (buff 32) kept secret until reveal-answer.
;; Neither `answer` nor `salt` should ever be submitted or logged anywhere
;; before the game closes.
(define-public (create-puzzle
  (puzzle-type (string-ascii 20))
  (answer-hash (buff 32))
  (tolerance   uint)
  (pool-stx    uint)
  (pool-b2s    uint)
  (pool-usdcx  uint)
  (pool-sbtc   uint))
  (let ((day-id (get-current-day)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (is-none (map-get? puzzles { day-id: day-id })) ERR-GAME-CLOSED)

    (and (> pool-stx u0)   (try! (stx-transfer? pool-stx tx-sender (as-contract tx-sender))))
    (and (> pool-b2s u0)   (try! (contract-call? B2S transfer pool-b2s tx-sender (as-contract tx-sender) none)))
    (and (> pool-usdcx u0) (try! (contract-call? USDCX transfer pool-usdcx tx-sender (as-contract tx-sender) none)))
    (and (> pool-sbtc u0)  (try! (contract-call? SBTC transfer pool-sbtc tx-sender (as-contract tx-sender) none)))

    (map-set puzzles { day-id: day-id }
      {
        puzzle-type:          puzzle-type,
        answer-hash:           answer-hash,
        answer:                none,
        tolerance:             tolerance,
        reward-pool-stx:       pool-stx,
        reward-pool-b2s:       pool-b2s,
        reward-pool-usdcx:     pool-usdcx,
        reward-pool-sbtc:      pool-sbtc,
        total-bets-stx:        u0,
        total-bets-b2s:        u0,
        total-bets-usdcx:      u0,
        total-bets-sbtc:       u0,
        winners-stx:           u0,
        winners-b2s:           u0,
        winners-usdcx:         u0,
        winners-sbtc:          u0,
        revealed:              false,
        start-block:           stacks-block-height,
        end-block:             (+ stacks-block-height BLOCKS-PER-DAY),
        register-close-block:  u0, ;; set at reveal time
      })
    (var-set current-day-id day-id)
    (ok day-id)))

;; Reveals the answer by proving it against the commitment made at create-puzzle
;; time. Can only be called after the game window closes (end-block), so the
;; answer is never known on-chain while guesses are still being accepted.
(define-public (reveal-answer (day-id uint) (answer uint) (salt (buff 32)))
  (let (
    (puzzle       (unwrap! (map-get? puzzles { day-id: day-id }) ERR-NO-GAME-TODAY))
    (answer-buff  (unwrap-panic (to-consensus-buff? answer)))
    (computed-hash (sha256 (concat answer-buff salt)))
  )
    (asserts! (is-eq tx-sender CONTRACT-OWNER)         ERR-NOT-OWNER)
    (asserts! (>= stacks-block-height (get end-block puzzle)) ERR-GAME-CLOSED)
    (asserts! (not (get revealed puzzle))              ERR-ALREADY-REVEALED)
    (asserts! (is-eq computed-hash (get answer-hash puzzle)) ERR-BAD-REVEAL)

    (map-set puzzles { day-id: day-id }
      (merge puzzle {
        answer:               (some answer),
        revealed:              true,
        register-close-block: (+ stacks-block-height REGISTER-WINDOW-BLOCKS),
      }))
    (ok true)))

;; ---------------------------------------------------------
;; PLAYER FUNCTIONS
;; ---------------------------------------------------------

;; Play: submit a guess with a bet. `won` is intentionally NOT determined here
;; — the contract doesn't know the answer yet (it only has a hash commitment).
(define-public (play (guess uint) (bet uint) (token uint))
  (let (
    (day-id (get-current-day))
    (puzzle (unwrap! (map-get? puzzles { day-id: day-id }) ERR-NO-GAME-TODAY))
    (player tx-sender)
    (stats  (get-player-stats tx-sender))
  )
    (asserts! (is-valid-token token)                         ERR-INVALID-TOKEN)
    (asserts! (not (has-played-today player))                ERR-ALREADY-PLAYED)
    (asserts! (< stacks-block-height (get end-block puzzle)) ERR-GAME-CLOSED)
    (asserts! (>= bet (get-min-bet token))                   ERR-INVALID-BET)
    (asserts! (<= bet (get-max-bet token))                   ERR-INVALID-BET)

    (try! (transfer-in bet player token))

    (map-set attempts { day-id: day-id, player: player }
      {
        guess:      guess,
        bet:        bet,
        token:      token,
        registered: false,
        claimed:    false,
        timestamp:  stacks-block-height,
      })

    (map-set puzzles { day-id: day-id }
      (if (is-eq token TOKEN-STX)
        (merge puzzle { total-bets-stx:   (+ (get total-bets-stx puzzle) bet) })
      (if (is-eq token TOKEN-B2S)
        (merge puzzle { total-bets-b2s:   (+ (get total-bets-b2s puzzle) bet) })
      (if (is-eq token TOKEN-USDCX)
        (merge puzzle { total-bets-usdcx: (+ (get total-bets-usdcx puzzle) bet) })
        (merge puzzle { total-bets-sbtc:  (+ (get total-bets-sbtc puzzle) bet) })
      ))))

    (map-set player-stats { player: player }
      (merge stats {
        total-played: (+ (get total-played stats) u1),
        last-played:  day-id,
      }))

    (var-set total-games-played (+ (var-get total-games-played) u1))

    (ok { day-id: day-id, token: token })))

;; Must be called by each correct guesser, after reveal-answer and before
;; register-close-block, to be counted in that token's winner pool. This is
;; what makes the pro-rata pool split in claim-reward possible without Clarity
;; needing to iterate over every attempt for the day.
(define-public (register-win (day-id uint))
  (let (
    (puzzle  (unwrap! (map-get? puzzles { day-id: day-id }) ERR-NO-GAME-TODAY))
    (attempt (unwrap! (map-get? attempts { day-id: day-id, player: tx-sender }) ERR-NOT-WINNER))
    (answer  (unwrap! (get answer puzzle) ERR-NOT-REVEALED))
    (token   (get token attempt))
  )
    (asserts! (get revealed puzzle)                                    ERR-NOT-REVEALED)
    (asserts! (< stacks-block-height (get register-close-block puzzle)) ERR-REGISTER-CLOSED)
    (asserts! (not (get registered attempt))                           ERR-ALREADY-REGISTERED)
    (asserts! (is-correct-guess (get guess attempt) answer (get tolerance puzzle)) ERR-NOT-CORRECT)

    (map-set attempts { day-id: day-id, player: tx-sender }
      (merge attempt { registered: true }))

    (map-set puzzles { day-id: day-id }
      (if (is-eq token TOKEN-STX)
        (merge puzzle { winners-stx:   (+ (get winners-stx puzzle) u1) })
      (if (is-eq token TOKEN-B2S)
        (merge puzzle { winners-b2s:   (+ (get winners-b2s puzzle) u1) })
      (if (is-eq token TOKEN-USDCX)
        (merge puzzle { winners-usdcx: (+ (get winners-usdcx puzzle) u1) })
        (merge puzzle { winners-sbtc:  (+ (get winners-sbtc puzzle) u1) })
      ))))

    (let (
      (stats (get-player-stats tx-sender))
      (new-streak (+ (get current-streak stats) u1))
    )
      (map-set player-stats { player: tx-sender }
        (merge stats {
          total-won:      (+ (get total-won stats) u1),
          current-streak: new-streak,
          best-streak:    (if (> new-streak (get best-streak stats)) new-streak (get best-streak stats)),
        })))

    (ok true)))

;; Claim reward — only callable after the registration window closes, so the
;; winners-<token> count used for the pro-rata split is final.
(define-public (claim-reward (day-id uint))
  (let (
    (puzzle  (unwrap! (map-get? puzzles { day-id: day-id }) ERR-NO-GAME-TODAY))
    (attempt (unwrap! (map-get? attempts { day-id: day-id, player: tx-sender }) ERR-NOT-WINNER))
    (player  tx-sender)
    (token   (get token attempt))
  )
    (asserts! (get registered attempt)                                  ERR-NOT-WINNER)
    (asserts! (not (get claimed attempt))                               ERR-ALREADY-CLAIMED)
    (asserts! (>= stacks-block-height (get register-close-block puzzle)) ERR-REGISTER-OPEN)

    (let (
      (winners (if (is-eq token TOKEN-STX)   (get winners-stx puzzle)
                (if (is-eq token TOKEN-B2S)   (get winners-b2s puzzle)
                (if (is-eq token TOKEN-USDCX) (get winners-usdcx puzzle)
                (get winners-sbtc puzzle)))))
      (pool    (if (is-eq token TOKEN-STX)   (get reward-pool-stx puzzle)
                (if (is-eq token TOKEN-B2S)   (get reward-pool-b2s puzzle)
                (if (is-eq token TOKEN-USDCX) (get reward-pool-usdcx puzzle)
                (get reward-pool-sbtc puzzle)))))
      (pool-share (/ pool (if (> winners u0) winners u1)))
      (payout     (+ (get bet attempt) pool-share))
    )
      (map-set attempts { day-id: day-id, player: player }
        (merge attempt { claimed: true }))

      (try! (transfer-out payout player token))

      (ok { payout: payout, token: token }))))

;; ---------------------------------------------------------
;; EMERGENCY
;; ---------------------------------------------------------

(define-public (withdraw-emergency (amount uint) (token uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (is-valid-token token)           ERR-INVALID-TOKEN)
    (transfer-out amount CONTRACT-OWNER token)))
