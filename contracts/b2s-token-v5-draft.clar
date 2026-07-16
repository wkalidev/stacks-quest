;; ============================================================================
;; DRAFT — B2S Token v5 — Capped Faucet
;; ============================================================================
;; STATUS: DRAFT / NOT DEPLOYED / NOT WIRED INTO THE APP.
;; Fixes the CRITICAL flaw documented in SECURITY.md and in the SECURITY NOTE
;; comment on `claim-daily-reward` in b2s-token-v4.clar: that contract lets any
;; address mint 5 B2S once per ~day with NO cap and NO cost beyond a tx fee.
;; Stacks addresses are free to generate, so an attacker can script arbitrarily
;; many wallets and mint B2S near-indefinitely, diluting the token's supply.
;;
;; This draft has NOT been:
;;   - compiled/checked with `clarinet check` (do that before anything else)
;;   - unit tested
;;   - audited
;;   - deployed anywhere
;;   - wired into app/, hooks/, or any API route
;;
;; WHAT CHANGED vs b2s-token-v4.clar
;; -----------------------------------
;; 1. `claim-daily-reward` now checks a GLOBAL running total (`faucet-minted`)
;;    against a fixed `FAUCET-BUDGET` — once the budget is exhausted, the
;;    faucet stops minting entirely (ERR-FAUCET-EXHAUSTED), regardless of how
;;    many fresh wallets an attacker creates. This bounds worst-case dilution
;;    to a number the owner explicitly chooses at deploy time instead of
;;    "unbounded".
;; 2. `claim-daily-reward` also checks a PER-ADDRESS lifetime cap
;;    (`MAX-CLAIMS-PER-ADDRESS`) so a single wallet can't sit there claiming
;;    forever even while budget remains — this doesn't stop sybils (new
;;    wallets are free) but it does force an attacker to keep minting fresh
;;    addresses rather than looping one address forever, which is a real
;;    (if small) cost increase and makes on-chain sybil activity more visible
;;    (many low-activity addresses each claiming exactly MAX times).
;; 3. Same u144-block (~1 day) per-address rate limit as v4, unchanged.
;;
;; OPEN QUESTIONS FOR WHOEVER PICKS THIS UP:
;;   - FAUCET-BUDGET and MAX-CLAIMS-PER-ADDRESS below are placeholders — pick
;;     real values based on target tokenomics (% of total supply you're
;;     willing to give away via the faucet).
;;   - This still does not stop sybil attacks outright, only bounds the damage
;;     and raises the cost. A real proof-of-personhood check, or tying claims
;;     to actual quest-game participation (e.g. require a minimum streak via
;;     contract-call? into stacks-quest-agent-v3), would be a stronger fix if
;;     the faucet is meant to reward real players rather than be a generic tap.
;;   - Consider whether the faucet should exist at all vs. rewards being paid
;;     directly by the quest game contract from its own budget.
;;   - Get this professionally audited before it ever touches real funds.
;; ============================================================================

(define-fungible-token b2s-token u1000000000000000)

(define-constant o tx-sender)
(define-constant e1 (err u100)) ;; not owner
(define-constant e2 (err u101)) ;; not token sender
(define-constant e4 (err u103)) ;; zero amount
(define-constant e5 (err u104)) ;; already claimed this bucket
(define-constant e6 (err u105)) ;; faucet budget exhausted
(define-constant e7 (err u106)) ;; per-address lifetime claim cap reached

;; Placeholders — pick real values before deploying.
;; 50,000,000 B2S (5% of the 1B hard cap) ever mintable via the faucet.
(define-constant FAUCET-BUDGET u50000000000000)
;; 5 B2S per claim (unchanged from v4).
(define-constant CLAIM-AMOUNT u5000000)
;; Max lifetime claims per address (30 claims * 5 B2S = 150 B2S per wallet max).
(define-constant MAX-CLAIMS-PER-ADDRESS u30)

(define-data-var tn (string-ascii 32) "Base2Stacks Token")
(define-data-var ts (string-ascii 10) "B2S")
(define-data-var tu (optional (string-utf8 256)) (some u"https://base2stacks-tracker.vercel.app/token.json"))

;; daily-claim bucket lock (unchanged mechanism from v4)
(define-map dc { t: principal, d: uint } { c: bool })
;; NEW: per-address lifetime claim counter
(define-map claim-count { t: principal } { n: uint })
;; NEW: cumulative amount minted via the faucet, checked against FAUCET-BUDGET
(define-data-var faucet-minted uint u0)

(define-read-only (get-name) (ok (var-get tn)))
(define-read-only (get-symbol) (ok (var-get ts)))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (a principal)) (ok (ft-get-balance b2s-token a)))
(define-read-only (get-total-supply) (ok (ft-get-supply b2s-token)))
(define-read-only (get-token-uri) (ok (var-get tu)))
(define-read-only (get-faucet-remaining) (ok (- FAUCET-BUDGET (var-get faucet-minted))))
(define-read-only (get-claim-count (a principal))
  (ok (get n (default-to { n: u0 } (map-get? claim-count { t: a })))))

(define-public (set-token-uri (u (optional (string-utf8 256))))
  (begin (asserts! (is-eq tx-sender o) e1) (var-set tu u) (ok true)))

(define-public (transfer (a uint) (s principal) (r principal) (m (optional (buff 34))))
  (begin (asserts! (is-eq tx-sender s) e2) (asserts! (> a u0) e4) (try! (ft-transfer? b2s-token a s r)) (ok true)))

(define-public (mint (a uint) (r principal))
  (begin (asserts! (is-eq tx-sender o) e1) (ft-mint? b2s-token a r)))

(define-public (claim-daily-reward)
  (let (
    (c tx-sender)
    (d (/ block-height u144))
    (already-minted (var-get faucet-minted))
    (prior-claims (get n (default-to { n: u0 } (map-get? claim-count { t: c }))))
  )
    (asserts! (is-none (map-get? dc { t: c, d: d }))                     e5)
    (asserts! (<= (+ already-minted CLAIM-AMOUNT) FAUCET-BUDGET)         e6)
    (asserts! (< prior-claims MAX-CLAIMS-PER-ADDRESS)                    e7)

    (map-set dc { t: c, d: d } { c: true })
    (map-set claim-count { t: c } { n: (+ prior-claims u1) })
    (var-set faucet-minted (+ already-minted CLAIM-AMOUNT))

    (try! (ft-mint? b2s-token CLAIM-AMOUNT c))
    (ok true)))

(begin (try! (ft-mint? b2s-token u400000000000000 o)))
