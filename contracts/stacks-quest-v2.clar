;; Stacks Quest v2 - Daily On-Chain Puzzle Game (Multi-Token)
;; Deployer: SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N
;; Supports: STX, $B2S, USDCx, sBTC - separate pools per token
;; FIXES:
;;   - B2S token address changed from relative (.b2s-token-v4)
;;     to absolute ('SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.b2s-token-v4)
;;   - All block-height references replaced with stacks-block-height (post-Nakamoto)

(define-constant CONTRACT-OWNER tx-sender)

;; Errors
(define-constant ERR-NOT-OWNER        (err u100))
(define-constant ERR-ALREADY-PLAYED  (err u101))
(define-constant ERR-GAME-CLOSED     (err u102))
(define-constant ERR-INVALID-GUESS   (err u103))
(define-constant ERR-NO-GAME-TODAY   (err u104))
(define-constant ERR-ALREADY-CLAIMED (err u105))
(define-constant ERR-NOT-WINNER      (err u106))
(define-constant ERR-INVALID-BET     (err u107))
(define-constant ERR-INVALID-TOKEN   (err u108))

;; Token identifiers
(define-constant TOKEN-STX   u0)
(define-constant TOKEN-B2S   u1)
(define-constant TOKEN-USDCX u2)
(define-constant TOKEN-SBTC  u3)

;; FIX: Token contracts - absolute addresses
(define-constant B2S   .b2s-token-v4)
(define-constant USDCX 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx)
(define-constant SBTC  'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token)

;; Bet limits per token
;; STX:   1 - 100 STX   (6 decimals)
(define-constant MIN-BET-STX   u1000000)
(define-constant MAX-BET-STX   u100000000)
;; B2S:   1 - 100 B2S   (6 decimals)
(define-constant MIN-BET-B2S   u1000000)
(define-constant MAX-BET-B2S   u100000000)
;; USDCx: 1 - 100 USDC  (6 decimals)
(define-constant MIN-BET-USDCX u1000000)
(define-constant MAX-BET-USDCX u100000000)
;; sBTC:  0.00001 - 0.001 sBTC (8 decimals)
(define-constant MIN-BET-SBTC  u1000)
(define-constant MAX-BET-SBTC  u100000)

(define-constant BLOCKS-PER-DAY u144)

;; ---------------------------------------------------------
;; DATA MAPS
;; ---------------------------------------------------------

;; Daily puzzle - one per day-id
(define-map puzzles
  { day-id: uint }
  {
    puzzle-type:       (string-ascii 20),
    answer:            uint,
    tolerance:         uint,
    ;; Reward pools per token
    reward-pool-stx:   uint,
    reward-pool-b2s:   uint,
    reward-pool-usdcx: uint,
    reward-pool-sbtc:  uint,
    ;; Bets per token
    total-bets-stx:    uint,
    total-bets-b2s:    uint,
    total-bets-usdcx:  uint,
    total-bets-sbtc:   uint,
    ;; Winners per token
    winners-stx:       uint,
    winners-b2s:       uint,
    winners-usdcx:     uint,
    winners-sbtc:      uint,
    revealed:          bool,
    start-block:       uint,
    end-block:         uint,
  }
)

;; Player attempts - one per player per day
(define-map attempts
  { day-id: uint, player: principal }
  {
    guess:     uint,
    bet:       uint,
    token:     uint,   ;; TOKEN-STX | TOKEN-B2S | TOKEN-USDCX | TOKEN-SBTC
    won:       bool,
    claimed:   bool,
    timestamp: uint,
  }
)

;; Player lifetime stats
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

;; Global stats
(define-data-var total-games-played uint u0)
(define-data-var current-day-id     uint u0)

;; ---------------------------------------------------------
;; READ-ONLY
;; ---------------------------------------------------------

;; FIX: stacks-block-height (post-Nakamoto)
(define-read-only (get-current-day)
  (/ stacks-block-height BLOCKS-PER-DAY))

(define-read-only (get-puzzle (day-id uint))
  (map-get? puzzles { day-id: day-id }))

(define-read-only (get-today-puzzle)
  (map-get? puzzles { day-id: (get-current-day) }))

(define-read-only (get-attempt (day-id uint) (player principal))
  (map-get? attempts { day-id: day-id, player: player }))

(define-read-only (get-player-stats (player principal))
  (default-to
    { total-played: u0, total-won: u0, best-streak: u0, current-streak: u0, last-played: u0 }
    (map-get? player-stats { player: player })))

(define-read-only (has-played-today (player principal))
  (is-some (map-get? attempts { day-id: (get-current-day), player: player })))

(define-read-only (get-global-stats)
  {
    total-games: (var-get total-games-played),
    current-day: (get-current-day),
  })

(define-read-only (is-valid-token (token uint))
  (or
    (is-eq token TOKEN-STX)
    (is-eq token TOKEN-B2S)
    (is-eq token TOKEN-USDCX)
    (is-eq token TOKEN-SBTC)))

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

;; Transfer tokens from sender to contract
(define-private (transfer-in (amount uint) (sender principal) (token uint))
  (if (is-eq token TOKEN-STX)
    (stx-transfer? amount sender (as-contract tx-sender))
  (if (is-eq token TOKEN-B2S)
    (contract-call? B2S transfer amount sender (as-contract tx-sender) none)
  (if (is-eq token TOKEN-USDCX)
    (contract-call? USDCX transfer amount sender (as-contract tx-sender) none)
    ;; TOKEN-SBTC
    (contract-call? SBTC transfer amount sender (as-contract tx-sender) none)
  ))))

;; Transfer tokens from contract to recipient
(define-private (transfer-out (amount uint) (recipient principal) (token uint))
  (if (is-eq token TOKEN-STX)
    (as-contract (stx-transfer? amount tx-sender recipient))
  (if (is-eq token TOKEN-B2S)
    (as-contract (contract-call? B2S transfer amount tx-sender recipient none))
  (if (is-eq token TOKEN-USDCX)
    (as-contract (contract-call? USDCX transfer amount tx-sender recipient none))
    ;; TOKEN-SBTC
    (as-contract (contract-call? SBTC transfer amount tx-sender recipient none))
  ))))

;; Get reward pool for a given token from puzzle
(define-private (get-pool
  (puzzle {
    puzzle-type: (string-ascii 20), answer: uint, tolerance: uint,
    reward-pool-stx: uint, reward-pool-b2s: uint, reward-pool-usdcx: uint, reward-pool-sbtc: uint,
    total-bets-stx: uint, total-bets-b2s: uint, total-bets-usdcx: uint, total-bets-sbtc: uint,
    winners-stx: uint, winners-b2s: uint, winners-usdcx: uint, winners-sbtc: uint,
    revealed: bool, start-block: uint, end-block: uint
  })
  (token uint))
  (if (is-eq token TOKEN-STX)   (get reward-pool-stx puzzle)
  (if (is-eq token TOKEN-B2S)   (get reward-pool-b2s puzzle)
  (if (is-eq token TOKEN-USDCX) (get reward-pool-usdcx puzzle)
  (get reward-pool-sbtc puzzle)))))

;; Get winners count for a given token from puzzle
(define-private (get-winners
  (puzzle {
    puzzle-type: (string-ascii 20), answer: uint, tolerance: uint,
    reward-pool-stx: uint, reward-pool-b2s: uint, reward-pool-usdcx: uint, reward-pool-sbtc: uint,
    total-bets-stx: uint, total-bets-b2s: uint, total-bets-usdcx: uint, total-bets-sbtc: uint,
    winners-stx: uint, winners-b2s: uint, winners-usdcx: uint, winners-sbtc: uint,
    revealed: bool, start-block: uint, end-block: uint
  })
  (token uint))
  (if (is-eq token TOKEN-STX)   (get winners-stx puzzle)
  (if (is-eq token TOKEN-B2S)   (get winners-b2s puzzle)
  (if (is-eq token TOKEN-USDCX) (get winners-usdcx puzzle)
  (get winners-sbtc puzzle)))))

;; ---------------------------------------------------------
;; OWNER FUNCTIONS
;; ---------------------------------------------------------

(define-public (create-puzzle
  (puzzle-type (string-ascii 20))
  (answer      uint)
  (tolerance   uint)
  (pool-stx    uint)
  (pool-b2s    uint)
  (pool-usdcx  uint)
  (pool-sbtc   uint))
  (let ((day-id (get-current-day)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (is-none (map-get? puzzles { day-id: day-id })) ERR-GAME-CLOSED)

    ;; Seed reward pools from owner
    (and (> pool-stx u0)   (try! (stx-transfer? pool-stx tx-sender (as-contract tx-sender))))
    (and (> pool-b2s u0)   (try! (contract-call? B2S transfer pool-b2s tx-sender (as-contract tx-sender) none)))
    (and (> pool-usdcx u0) (try! (contract-call? USDCX transfer pool-usdcx tx-sender (as-contract tx-sender) none)))
    (and (> pool-sbtc u0)  (try! (contract-call? SBTC transfer pool-sbtc tx-sender (as-contract tx-sender) none)))

    (map-set puzzles { day-id: day-id }
      {
        puzzle-type:       puzzle-type,
        answer:            answer,
        tolerance:         tolerance,
        reward-pool-stx:   pool-stx,
        reward-pool-b2s:   pool-b2s,
        reward-pool-usdcx: pool-usdcx,
        reward-pool-sbtc:  pool-sbtc,
        total-bets-stx:    u0,
        total-bets-b2s:    u0,
        total-bets-usdcx:  u0,
        total-bets-sbtc:   u0,
        winners-stx:       u0,
        winners-b2s:       u0,
        winners-usdcx:     u0,
        winners-sbtc:      u0,
        revealed:          false,
        start-block:       stacks-block-height,
        end-block:         (+ stacks-block-height BLOCKS-PER-DAY),
      })
    (var-set current-day-id day-id)
    (ok day-id)))

(define-public (reveal-answer (day-id uint))
  (let ((puzzle (unwrap! (map-get? puzzles { day-id: day-id }) ERR-NO-GAME-TODAY)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (map-set puzzles { day-id: day-id }
      (merge puzzle { revealed: true }))
    (ok true)))

;; ---------------------------------------------------------
;; PLAYER FUNCTIONS
;; ---------------------------------------------------------

;; Play: submit a guess with a bet in the token of your choice
;; token: 0=STX, 1=B2S, 2=USDCx, 3=sBTC
(define-public (play (guess uint) (bet uint) (token uint))
  (let (
    (day-id (get-current-day))
    (puzzle (unwrap! (map-get? puzzles { day-id: day-id }) ERR-NO-GAME-TODAY))
    (player tx-sender)
    (stats  (get-player-stats tx-sender))
  )
    ;; Validations
    (asserts! (is-valid-token token)                         ERR-INVALID-TOKEN)
    (asserts! (not (has-played-today player))                ERR-ALREADY-PLAYED)
    (asserts! (< stacks-block-height (get end-block puzzle)) ERR-GAME-CLOSED)
    (asserts! (>= bet (get-min-bet token))                   ERR-INVALID-BET)
    (asserts! (<= bet (get-max-bet token))                   ERR-INVALID-BET)

    ;; Transfer bet to contract
    (try! (transfer-in bet player token))

    ;; Check if correct
    (let ((won (is-correct-guess guess (get answer puzzle) (get tolerance puzzle))))

      ;; Record attempt
      (map-set attempts { day-id: day-id, player: player }
        {
          guess:     guess,
          bet:       bet,
          token:     token,
          won:       won,
          claimed:   false,
          timestamp: stacks-block-height,
        })

      ;; Update puzzle stats for the right token pool
      (map-set puzzles { day-id: day-id }
        (if (is-eq token TOKEN-STX)
          (merge puzzle {
            total-bets-stx: (+ (get total-bets-stx puzzle) bet),
            winners-stx:    (if won (+ (get winners-stx puzzle) u1) (get winners-stx puzzle)),
          })
        (if (is-eq token TOKEN-B2S)
          (merge puzzle {
            total-bets-b2s: (+ (get total-bets-b2s puzzle) bet),
            winners-b2s:    (if won (+ (get winners-b2s puzzle) u1) (get winners-b2s puzzle)),
          })
        (if (is-eq token TOKEN-USDCX)
          (merge puzzle {
            total-bets-usdcx: (+ (get total-bets-usdcx puzzle) bet),
            winners-usdcx:    (if won (+ (get winners-usdcx puzzle) u1) (get winners-usdcx puzzle)),
          })
          ;; TOKEN-SBTC
          (merge puzzle {
            total-bets-sbtc: (+ (get total-bets-sbtc puzzle) bet),
            winners-sbtc:    (if won (+ (get winners-sbtc puzzle) u1) (get winners-sbtc puzzle)),
          })
        ))))

      ;; Update player stats
      (map-set player-stats { player: player }
        (merge stats {
          total-played:   (+ (get total-played stats) u1),
          total-won:      (if won (+ (get total-won stats) u1) (get total-won stats)),
          current-streak: (if won (+ (get current-streak stats) u1) u0),
          best-streak:    (if (and won (> (+ (get current-streak stats) u1) (get best-streak stats)))
                            (+ (get current-streak stats) u1)
                            (get best-streak stats)),
          last-played:    day-id,
        }))

      (var-set total-games-played (+ (var-get total-games-played) u1))

      (ok { won: won, day-id: day-id, token: token }))))

;; Claim reward after winning - paid in the same token used to bet
(define-public (claim-reward (day-id uint))
  (let (
    (puzzle  (unwrap! (map-get? puzzles { day-id: day-id }) ERR-NO-GAME-TODAY))
    (attempt (unwrap! (map-get? attempts { day-id: day-id, player: tx-sender }) ERR-NOT-WINNER))
    (player  tx-sender)
    (token   (get token attempt))
  )
    (asserts! (get won attempt)           ERR-NOT-WINNER)
    (asserts! (not (get claimed attempt)) ERR-ALREADY-CLAIMED)
    (asserts! (get revealed puzzle)       ERR-GAME-CLOSED)

    (let (
      (winners    (get-winners puzzle token))
      (pool-share (/ (get-pool puzzle token) (if (> winners u0) winners u1)))
      (payout     (+ (get bet attempt) pool-share))
    )
      ;; Mark claimed
      (map-set attempts { day-id: day-id, player: player }
        (merge attempt { claimed: true }))

      ;; Transfer payout in the same token
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
