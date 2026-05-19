;; Stacks Quest - Daily On-Chain Puzzle Game
;; Deployer: SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N
;; Players guess real Stacks blockchain data, bet $B2S, earn NFT badges

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-OWNER        (err u100))
(define-constant ERR-ALREADY-PLAYED  (err u101))
(define-constant ERR-GAME-CLOSED     (err u102))
(define-constant ERR-INVALID-GUESS   (err u103))
(define-constant ERR-NO-GAME-TODAY   (err u104))
(define-constant ERR-ALREADY-CLAIMED (err u105))
(define-constant ERR-NOT-WINNER      (err u106))
(define-constant ERR-INVALID-BET     (err u107))

(define-constant MIN-BET   u1000000)   ;; 1 $B2S minimum
(define-constant MAX-BET   u100000000) ;; 100 $B2S maximum
(define-constant BLOCKS-PER-DAY u144)  ;; ~1 day in blocks

;; $B2S token contract
(define-constant B2S .b2s-token-v4)

;; ---------------------------------------------------------
;; DATA MAPS
;; ---------------------------------------------------------

;; Daily puzzle - one per day-id (stacks-block-height / 144)
(define-map puzzles
  { day-id: uint }
  {
    puzzle-type:  (string-ascii 20), ;; "stacks-block-height" | "tx-count" | "stx-price" | "stakers"
    answer:       uint,              ;; correct answer (set by oracle/owner)
    tolerance:    uint,              ;; accepted margin (e.g. 5% for price)
    reward-pool:  uint,              ;; total $B2S in pool
    total-bets:   uint,              ;; total bets placed
    winners:      uint,              ;; number of winners
    revealed:     bool,              ;; answer revealed?
    start-block:  uint,              ;; puzzle start
    end-block:    uint,              ;; puzzle end (start + 144)
  }
)

;; Player attempts - one per player per day
(define-map attempts
  { day-id: uint, player: principal }
  {
    guess:       uint,  ;; player's guess
    bet:         uint,  ;; $B2S bet amount
    tries:       uint,  ;; number of tries used (max 3)
    won:         bool,  ;; did they win?
    claimed:     bool,  ;; did they claim reward?
    timestamp:   uint,  ;; block when played
  }
)

;; Player stats - lifetime stats
(define-map player-stats
  { player: principal }
  {
    total-played:  uint,
    total-won:     uint,
    total-earned:  uint,
    best-streak:   uint,
    current-streak: uint,
    last-played:   uint,  ;; day-id of last game
  }
)

;; Daily leaderboard - top winners per day
(define-map daily-winners
  { day-id: uint, rank: uint }
  { player: principal, payout: uint }
)

;; Global stats
(define-data-var total-games-played uint u0)
(define-data-var total-rewards-paid  uint u0)
(define-data-var current-day-id      uint u0)

;; ---------------------------------------------------------
;; READ-ONLY FUNCTIONS
;; ---------------------------------------------------------

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
    { total-played: u0, total-won: u0, total-earned: u0,
      best-streak: u0, current-streak: u0, last-played: u0 }
    (map-get? player-stats { player: player })))

(define-read-only (has-played-today (player principal))
  (is-some (map-get? attempts { day-id: (get-current-day), player: player })))

(define-read-only (get-global-stats)
  {
    total-games:   (var-get total-games-played),
    total-rewards: (var-get total-rewards-paid),
    current-day:   (get-current-day),
  })

;; Check if guess is within tolerance
(define-read-only (is-correct-guess (guess uint) (answer uint) (tolerance uint))
  (let (
    (diff (if (>= guess answer) (- guess answer) (- answer guess)))
    (max-diff (/ (* answer tolerance) u100))
  )
    (<= diff max-diff)))

;; ---------------------------------------------------------
;; OWNER FUNCTIONS
;; ---------------------------------------------------------

;; Create a new daily puzzle (called by owner/oracle each day)
(define-public (create-puzzle
  (puzzle-type  (string-ascii 20))
  (answer       uint)
  (tolerance    uint)
  (reward-pool  uint))
  (let ((day-id (get-current-day)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (is-none (map-get? puzzles { day-id: day-id })) ERR-GAME-CLOSED)

    ;; Transfer reward pool from owner to contract
    (try! (contract-call? B2S transfer reward-pool tx-sender (as-contract tx-sender) none))

    (map-set puzzles { day-id: day-id }
      {
        puzzle-type:  puzzle-type,
        answer:       answer,
        tolerance:    tolerance,
        reward-pool:  reward-pool,
        total-bets:   u0,
        winners:      u0,
        revealed:     false,
        start-block:  stacks-block-height,
        end-block:    (+ stacks-block-height BLOCKS-PER-DAY),
      })
    (var-set current-day-id day-id)
    (ok day-id)))

;; Reveal the answer and close the puzzle
(define-public (reveal-answer (day-id uint))
  (let ((puzzle (unwrap! (map-get? puzzles { day-id: day-id }) ERR-NO-GAME-TODAY)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (map-set puzzles { day-id: day-id }
      (merge puzzle { revealed: true }))
    (ok true)))

;; ---------------------------------------------------------
;; PLAYER FUNCTIONS
;; ---------------------------------------------------------

;; Place a bet and submit a guess
(define-public (play (guess uint) (bet uint))
  (let (
    (day-id  (get-current-day))
    (puzzle  (unwrap! (map-get? puzzles { day-id: day-id }) ERR-NO-GAME-TODAY))
    (player  tx-sender)
    (stats   (get-player-stats player))
  )
    ;; Validations
    (asserts! (not (has-played-today player))           ERR-ALREADY-PLAYED)
    (asserts! (< stacks-block-height (get end-block puzzle))   ERR-GAME-CLOSED)
    (asserts! (>= bet MIN-BET)                          ERR-INVALID-BET)
    (asserts! (<= bet MAX-BET)                          ERR-INVALID-BET)

    ;; Transfer bet to contract
    (try! (contract-call? B2S transfer bet player (as-contract tx-sender) none))

    ;; Check if guess is correct
    (let ((won (is-correct-guess guess (get answer puzzle) (get tolerance puzzle))))

      ;; Record attempt
      (map-set attempts { day-id: day-id, player: player }
        {
          guess:     guess,
          bet:       bet,
          tries:     u1,
          won:       won,
          claimed:   false,
          timestamp: stacks-block-height,
        })

      ;; Update puzzle stats
      (map-set puzzles { day-id: day-id }
        (merge puzzle {
          total-bets: (+ (get total-bets puzzle) bet),
          winners:    (if won (+ (get winners puzzle) u1) (get winners puzzle)),
        }))

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

      ;; Increment global counter
      (var-set total-games-played (+ (var-get total-games-played) u1))

      (ok { won: won, day-id: day-id }))))

;; Claim reward after winning
(define-public (claim-reward (day-id uint))
  (let (
    (puzzle  (unwrap! (map-get? puzzles { day-id: day-id }) ERR-NO-GAME-TODAY))
    (attempt (unwrap! (map-get? attempts { day-id: day-id, player: tx-sender }) ERR-NOT-WINNER))
    (player  tx-sender)
  )
    (asserts! (get won attempt)     ERR-NOT-WINNER)
    (asserts! (not (get claimed attempt)) ERR-ALREADY-CLAIMED)
    (asserts! (get revealed puzzle) ERR-GAME-CLOSED)

    ;; Calculate payout: bet returned + share of reward pool
    (let (
      (winners    (get winners puzzle))
      (pool-share (/ (get reward-pool puzzle) (if (> winners u0) winners u1)))
      (payout     (+ (get bet attempt) pool-share))
      (stats      (get-player-stats player))
    )
      ;; Mark as claimed
      (map-set attempts { day-id: day-id, player: player }
        (merge attempt { claimed: true }))

      ;; Update earned stats
      (map-set player-stats { player: player }
        (merge stats { total-earned: (+ (get total-earned stats) payout) }))

      ;; Transfer payout
      (try! (as-contract (contract-call? B2S transfer payout tx-sender player none)))

      ;; Update global stats
      (var-set total-rewards-paid (+ (var-get total-rewards-paid) payout))

      (ok payout))))

;; ---------------------------------------------------------
;; EMERGENCY
;; ---------------------------------------------------------

(define-public (withdraw-emergency (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (as-contract (contract-call? B2S transfer amount tx-sender CONTRACT-OWNER none))))
