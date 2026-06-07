;; Stacks Quest Agent v1
;; Non-custodial crypto agent with daily check-in fee system
;; Deployer: SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N

(define-constant CONTRACT-OWNER tx-sender)
(define-constant CHECKIN-FEE    u1000)      ;; 0.001 STX in microSTX
(define-constant STREAK-BONUS-7  u2000)     ;; 0.002 STX bonus pool at 7 days
(define-constant STREAK-BONUS-30 u10000)    ;; 0.01 STX bonus pool at 30 days
(define-constant FEE-TREASURY-PCT u50)      ;; 50% to treasury
(define-constant FEE-POOL-PCT     u50)      ;; 50% to reward pool

;; Errors
(define-constant ERR-NOT-OWNER        (err u100))
(define-constant ERR-ALREADY-CHECKIN  (err u101))
(define-constant ERR-INSUFFICIENT-FEE (err u102))
(define-constant ERR-NO-STREAK        (err u103))
(define-constant ERR-ALREADY-CLAIMED  (err u104))
(define-constant ERR-NOTHING-TO-CLAIM (err u105))

;; Token contracts
(define-constant B2S   'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.b2s-token-v4)
(define-constant USDCX 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx)
(define-constant SBTC  'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token)

;; ---------------------------------------------------------
;; DATA
;; ---------------------------------------------------------

;; Daily check-in per user
(define-map checkins
  { user: principal, day: uint }
  {
    checked-in: bool,
    timestamp:  uint,
    fee-paid:   uint,
  })

;; User streak data
(define-map streaks
  { user: principal }
  {
    current-streak: uint,
    best-streak:    uint,
    last-checkin:   uint,    ;; day id
    total-checkins: uint,
    pending-reward: uint,    ;; STX in microSTX
    claimed-total:  uint,
  })

;; Global stats
(define-data-var total-checkins    uint u0)
(define-data-var total-fees-collected uint u0)
(define-data-var reward-pool       uint u0)
(define-data-var treasury          uint u0)

;; Agent action log (last 100 actions per user via map)
(define-map agent-actions
  { user: principal, nonce: uint }
  {
    action-type: (string-ascii 20),  ;; "swap" | "bridge" | "checkin" | "query"
    amount:      uint,
    token-in:    (string-ascii 10),
    token-out:   (string-ascii 10),
    status:      (string-ascii 10),  ;; "pending" | "done" | "failed"
    block:       uint,
  })

(define-map user-nonces { user: principal } { nonce: uint })

;; ---------------------------------------------------------
;; READ-ONLY
;; ---------------------------------------------------------

(define-read-only (get-current-day)
  (/ stacks-block-height u144))

(define-read-only (has-checked-in-today (user principal))
  (is-some (map-get? checkins { user: user, day: (get-current-day) })))

(define-read-only (get-streak (user principal))
  (default-to
    { current-streak: u0, best-streak: u0, last-checkin: u0, total-checkins: u0, pending-reward: u0, claimed-total: u0 }
    (map-get? streaks { user: user })))

(define-read-only (get-global-stats)
  {
    total-checkins:     (var-get total-checkins),
    total-fees:         (var-get total-fees-collected),
    reward-pool:        (var-get reward-pool),
    treasury:           (var-get treasury),
    current-day:        (get-current-day),
  })

(define-read-only (get-checkin-fee) CHECKIN-FEE)

(define-read-only (get-user-actions (user principal))
  (let ((nonce-data (default-to { nonce: u0 } (map-get? user-nonces { user: user }))))
    (get nonce nonce-data)))

;; ---------------------------------------------------------
;; DAILY CHECK-IN
;; ---------------------------------------------------------

(define-public (daily-checkin)
  (let (
    (user    tx-sender)
    (today   (get-current-day))
    (streak  (get-streak user))
  )
    ;; Validations
    (asserts! (not (has-checked-in-today user)) ERR-ALREADY-CHECKIN)

    ;; Collect fee
    (try! (stx-transfer? CHECKIN-FEE user (as-contract tx-sender)))

    ;; Split fee: 50% treasury, 50% reward pool
    (let (
      (to-treasury (/ (* CHECKIN-FEE FEE-TREASURY-PCT) u100))
      (to-pool     (/ (* CHECKIN-FEE FEE-POOL-PCT) u100))
    )
      (var-set treasury          (+ (var-get treasury) to-treasury))
      (var-set reward-pool       (+ (var-get reward-pool) to-pool))
      (var-set total-fees-collected (+ (var-get total-fees-collected) CHECKIN-FEE))
      (var-set total-checkins    (+ (var-get total-checkins) u1))

      ;; Calculate new streak
      (let (
        (is-consecutive (is-eq (get last-checkin streak) (- today u1)))
        (new-streak     (if is-consecutive (+ (get current-streak streak) u1) u1))
        (best-streak    (if (> new-streak (get best-streak streak)) new-streak (get best-streak streak)))
        ;; Streak bonuses added to pending reward
        (bonus          (if (is-eq (mod new-streak u30) u0) STREAK-BONUS-30
                        (if (is-eq (mod new-streak u7)  u0) STREAK-BONUS-7
                        u0)))
      )
        ;; Record check-in
        (map-set checkins { user: user, day: today }
          { checked-in: true, timestamp: stacks-block-height, fee-paid: CHECKIN-FEE })

        ;; Update streak
        (map-set streaks { user: user }
          (merge streak {
            current-streak: new-streak,
            best-streak:    best-streak,
            last-checkin:   today,
            total-checkins: (+ (get total-checkins streak) u1),
            pending-reward: (+ (get pending-reward streak) to-pool bonus),
          }))

        (ok {
          streak:  new-streak,
          bonus:   bonus,
          day:     today,
          fee:     CHECKIN-FEE,
        })))))

;; ---------------------------------------------------------
;; CLAIM STREAK REWARDS
;; ---------------------------------------------------------

(define-public (claim-streak-reward)
  (let (
    (user   tx-sender)
    (streak (get-streak user))
    (amount (get pending-reward streak))
  )
    (asserts! (> amount u0) ERR-NOTHING-TO-CLAIM)

    ;; Deduct from pool
    (var-set reward-pool (- (var-get reward-pool) (min amount (var-get reward-pool))))

    ;; Update streak record
    (map-set streaks { user: user }
      (merge streak {
        pending-reward: u0,
        claimed-total:  (+ (get claimed-total streak) amount),
      }))

    ;; Pay out
    (as-contract (stx-transfer? amount tx-sender user))))

;; ---------------------------------------------------------
;; LOG AGENT ACTION (called by frontend after tx broadcast)
;; ---------------------------------------------------------

(define-public (log-action
  (action-type (string-ascii 20))
  (amount      uint)
  (token-in    (string-ascii 10))
  (token-out   (string-ascii 10)))
  (let (
    (user       tx-sender)
    (nonce-data (default-to { nonce: u0 } (map-get? user-nonces { user: user })))
    (nonce      (get nonce nonce-data))
  )
    (map-set agent-actions { user: user, nonce: nonce }
      {
        action-type: action-type,
        amount:      amount,
        token-in:    token-in,
        token-out:   token-out,
        status:      "done",
        block:       stacks-block-height,
      })
    (map-set user-nonces { user: user } { nonce: (+ nonce u1) })
    (ok nonce)))

;; ---------------------------------------------------------
;; ADMIN
;; ---------------------------------------------------------

(define-public (withdraw-treasury (amount uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (<= amount (var-get treasury))   ERR-INSUFFICIENT-FEE)
    (var-set treasury (- (var-get treasury) amount))
    (as-contract (stx-transfer? amount tx-sender CONTRACT-OWNER))))
