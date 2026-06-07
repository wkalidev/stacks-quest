;; Stacks Quest Agent v3
;; Daily check-in fee system - NO as-contract
;; Deployer: SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N

(define-constant CONTRACT-OWNER tx-sender)
(define-constant CHECKIN-FEE u1000)
(define-constant STREAK-BONUS-7 u2000)
(define-constant STREAK-BONUS-30 u10000)

(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-ALREADY-CHECKIN (err u101))
(define-constant ERR-NOTHING-TO-CLAIM (err u105))
(define-constant ERR-INSUFFICIENT (err u106))

(define-map checkins
  { user: principal, day: uint }
  { checked-in: bool, timestamp: uint })

(define-map streaks
  { user: principal }
  { current-streak: uint, best-streak: uint, last-checkin: uint, total-checkins: uint })

(define-data-var total-checkins uint u0)
(define-data-var total-fees uint u0)

(define-map agent-actions
  { user: principal, nonce: uint }
  { action-type: (string-ascii 20), amount: uint, token-in: (string-ascii 10), token-out: (string-ascii 10), block: uint })

(define-map user-nonces { user: principal } { nonce: uint })

(define-read-only (get-current-day)
  (/ stacks-block-height u144))

(define-read-only (has-checked-in-today (user principal))
  (is-some (map-get? checkins { user: user, day: (get-current-day) })))

(define-read-only (get-streak (user principal))
  (default-to
    { current-streak: u0, best-streak: u0, last-checkin: u0, total-checkins: u0 }
    (map-get? streaks { user: user })))

(define-read-only (get-global-stats)
  { total-checkins: (var-get total-checkins), total-fees: (var-get total-fees), current-day: (get-current-day) })

(define-read-only (get-checkin-fee) CHECKIN-FEE)

(define-public (daily-checkin)
  (let (
    (today (get-current-day))
    (streak (get-streak tx-sender))
  )
    (asserts! (not (has-checked-in-today tx-sender)) ERR-ALREADY-CHECKIN)
    ;; Fee goes directly to CONTRACT-OWNER treasury wallet
    (try! (stx-transfer? CHECKIN-FEE tx-sender CONTRACT-OWNER))
    (let (
      (is-consecutive (is-eq (get last-checkin streak) (- today u1)))
      (new-streak (if is-consecutive (+ (get current-streak streak) u1) u1))
      (best (if (> new-streak (get best-streak streak)) new-streak (get best-streak streak)))
    )
      (var-set total-fees (+ (var-get total-fees) CHECKIN-FEE))
      (var-set total-checkins (+ (var-get total-checkins) u1))
      (map-set checkins { user: tx-sender, day: today }
        { checked-in: true, timestamp: stacks-block-height })
      (map-set streaks { user: tx-sender }
        { current-streak: new-streak, best-streak: best, last-checkin: today, total-checkins: (+ (get total-checkins streak) u1) })
      (ok { streak: new-streak, day: today, fee: CHECKIN-FEE }))))

(define-public (log-action
  (action-type (string-ascii 20))
  (amount uint)
  (token-in (string-ascii 10))
  (token-out (string-ascii 10)))
  (let (
    (nonce-data (default-to { nonce: u0 } (map-get? user-nonces { user: tx-sender })))
    (nonce (get nonce nonce-data))
  )
    (map-set agent-actions { user: tx-sender, nonce: nonce }
      { action-type: action-type, amount: amount, token-in: token-in, token-out: token-out, block: stacks-block-height })
    (map-set user-nonces { user: tx-sender } { nonce: (+ nonce u1) })
    (ok nonce)))
