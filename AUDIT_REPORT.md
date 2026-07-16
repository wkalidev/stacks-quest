# Audit complet — Stacks Quest — 2026-07-16

Audit code + sécurité de tout le repo (app Next.js, routes API, contrats Clarity/Solidity, SDK npm, README).
**Round 1+2 commit et push** (`1a8da3a`). **Round 3 (section 1ter) pas encore commit** — en
attente de ton feu vert, comme convenu.

---

## 1. Corrigé et vérifié

### SDK npm cassé (CRITIQUE)
`package.json` pointait `main`/`types` vers `./sdk/index.js` mais le build (`npm run build:sdk`) sortait dans `sdk-src/sdk/` — un dossier qui n'existe pas à la racine. Résultat : **`npm install @wkalidev/stacks-quest-sdk` + `import` échoue à 100%**, personne ne peut utiliser le package publié. En plus, sans champ `files`, `npm publish` aurait shippé **tout le repo** (127 fichiers, 1.5 Mo — contrats, typechain, scripts, assets) au lieu du SDK seul.

Corrigé :
- `sdk-src/tsconfig.json` : `outDir` pointe maintenant vers `../sdk` (racine du repo), conforme à ce que `package.json` attendait déjà.
- `package.json` : ajout de `"files"` (n'embarque que `sdk/`, `sdk-src/index.ts`, `README.md`) + script `prepublishOnly` qui rebuild avant publish. Version bump 1.1.0 → 1.1.1.
- Anciens fichiers de build orphelins retirés du suivi git (`sdk-src/sdk/*`).
- **Vérifié** : `npm pack --dry-run` → 6 fichiers / 19.8 Ko (au lieu de 127 fichiers / 1.5 Mo). `require('./sdk/index.js')` testé en live, toutes les méthodes répondent correctement.

### SDK/MCP — `getPlayerStats()` ne marchait jamais (HAUTE)
Le SDK appelle `/api/player?address=...&chain=...` — **cette route n'existait pas du tout**. Toujours un 404 silencieux → `null`. Idem côté MCP : l'outil payant `get_player_stats` (1 USDC) appelait une fonction de contrat inexistante (`get-user-stats`) avec un argument mal encodé — l'utilisateur payait 1 USDC pour toujours recevoir un message générique "could not fetch".

Corrigé :
- Nouvelle route `app/api/player/route.ts` : Stacks entièrement fonctionnel (lecture on-chain réelle via `get-streak` / `has-checked-in-today`, décodage Clarity correct), Base/Celo via `eth_call` direct sur `QuestCheckIn.getStreak(address)`.
- `app/api/mcp/route.ts` : `get_player_stats` appelle maintenant la vraie fonction (`get-streak`) avec un principal correctement sérialisé, et décode le résultat en JSON lisible.
- Nouveau helper partagé `app/lib/stacksRead.ts` (encodage principal + décodage CV via `@stacks/transactions`, déjà une dépendance).
- **Vérifié hors-ligne** : round-trip encode/decode Clarity testé avec des valeurs connues (uint, bool, tuple) — sortie conforme à `cvToJSON`.
- **Non testable en live** : ce sandbox n'a pas d'accès réseau sortant vers l'API Hiro ni les RPC Base/Celo (voir section 4). Le code suit exactement le pattern déjà utilisé ailleurs dans le repo — recommande un test réel avant merge.

### x402 — bypass trivial du paiement (CRITIQUE → durci)
`/api/mcp` acceptait **n'importe quelle chaîne non-vide** comme header `X-Payment` pour débloquer les outils payants. Accès gratuit garanti aux 3 outils premium.

Corrigé : `isPaymentPayloadValid()` — décode le header, vérifie `scheme=exact`, `network=base`, destinataire = `PAYMENT_ADDRESS`, montant ≥ prix, fenêtre `validAfter`/`validBefore` non expirée, présence d'une signature au bon format. **Testé avec 8 cas** (payload valide, garbage, ancien bypass, mauvais destinataire, montant trop bas, expiré, signature manquante, mauvais network) — tous passent comme attendu.

⚠️ **Ce n'est pas une vérification complète.** Ça ne vérifie ni la signature EIP-3009 ni le règlement on-chain réel — il faut un facilitator x402 (`/verify` + `/settle`, voir https://x402.org) pour ça. Voir section 1ter — c'est maintenant branché (round 3).

### Bug de decimals mort mais réel
`hooks/useContractCall.ts` (`callPlay`, actuellement inutilisé dans l'UI — `game/page.tsx` a sa propre implémentation correcte) multipliait tous les tokens par `1_000_000` sans distinction. Aurait sous-évalué les mises en sBTC (8 décimales) de 100x si jamais branché. Corrigé avec une table de décimales par token.

### Bruit CRLF / hygiène git
6 fichiers (`app/agent/page.tsx`, `app/api/swap/route.ts`, `components/SwapCard.tsx`, 3 SVG) avaient un diff de 1125 lignes qui était **100% des changements de fin de ligne** (CRLF/LF), zéro changement de contenu réel (vérifié avec `git diff -w`). Restaurés proprement + ajout d'un `.gitattributes` (`* text=auto eol=lf`) pour que ça ne revienne pas.

`contracts/artifacts/`, `contracts/cache/`, `typechain-types/`, `.claude/` n'étaient pas dans `.gitignore` — un `git add .` les aurait committés (40+ fichiers générés). Ajoutés au `.gitignore`.

README : l'exemple SDK déclarait `const puzzle` trois fois dans le même scope (erreur de compilation si copié-collé tel quel). Corrigé.

---

## 1bis. Corrigé — deuxième passe ("corrige tous les bugs possible")

### Onglet "Withdraw" de l'agent — 100% cassé (HAUTE, raté au premier passage)
`app/agent/page.tsx` avait un onglet "OUT" qui appelait `withdraw-treasury` sur
`stacks-quest-agent-v3` — **cette fonction n'existe pas sur ce contrat** (elle n'existe que
sur l'ancien v2, jamais déployé comme contrat actif). En plus, v3 envoie déjà les frais de
check-in directement au owner à chaque `daily-checkin` — il n'y a même pas de treasury à
retirer. Chaque clic sur "Withdraw" aurait fait échouer la transaction et gaspillé du gas.
**Supprimé entièrement** (onglet, state, fonction `doWithdraw`) — vérifié : plus aucune
référence à "withdraw" dans le fichier, syntaxe TSX validée.

### `QuestGame.sol` — ETH perdu si envoyé par erreur avec un pari ERC-20
`_validateAndReceiveBet` ne rejetait pas un `msg.value` non-nul sur la branche ERC-20 — un
utilisateur qui envoyait de l'ETH/CELO par erreur avec un pari en token le perdait
définitivement (récupérable seulement par le owner). Ajouté `if (msg.value != 0) revert
InvalidBet()` sur cette branche. **Fix appliqué uniquement dans le code source** — le contrat
déjà déployé sur Base/Celo n'est pas patché rétroactivement (impossible, non-upgradeable) ;
ça s'applique au prochain redeploy.

### Contrats legacy retirés
`contracts/stacks-quest.clar` (v1) et `contracts/stacks-quest-agent-v2.clar` — jamais
référencés par l'app active, `stacks-quest-agent-v2` retiré de `Clarinet.toml`. Je n'ai pas
pu supprimer les fichiers physiquement (restriction de ce sandbox), donc ils sont réduits à
un stub "DEPRECATED" — un `rm` normal chez toi finira le ménage.

### `npm audit fix` (sans --force)
Exécuté — **aucun changement appliqué** : les 58 vulnérabilités restantes nécessitent
toutes un downgrade de `@stacks/connect` ou un bump majeur de `hardhat`. Confirme que je
n'ai pas pu faire de fix non-breaking ; le point reste ouvert (voir section 2).

---

## 1ter. Round 3 — "allons-y" (facilitator x402, test force-fix, drafts contrats)

Ce round est parti du feu vert général pour avancer sur les points restés ouverts. **Rien
n'a été redéployé, rien n'a touché aux contrats déjà en prod** — voir le détail par point.

### x402 — facilitator réel branché (code)
`app/api/mcp/route.ts` : ajout de `facilitatorVerifyAndSettle()`, appelée après la
validation structurelle pour chaque outil premium. Elle appelle un vrai facilitator x402
(`POST /verify` puis `POST /settle`) — donc désormais il faut une signature EIP-3009
valide **et** un règlement effectif on-chain sur Base pour débloquer un outil payant, pas
juste un header bien formé.

- URL configurable via `X402_FACILITATOR_URL` (défaut : le facilitator public de référence
  `https://x402.org/facilitator`), clé optionnelle via `X402_FACILITATOR_API_KEY`.
- `X402_STRICT_FACILITATOR=false` par défaut : si le facilitator est injoignable (panne,
  timeout), on retombe sur la validation structurelle seule plutôt que de bloquer tout le
  trafic premium. Passe à `true` une fois un facilitator de prod fiable et financé branché.
- **Non testable en live ici** (toujours pas d'accès réseau sortant vers x402.org dans ce
  sandbox) — vérifié uniquement en syntaxe/types (`ts.transpileModule`, 0 diagnostic).
  **Il faut tester avec un vrai paiement signé avant de compter dessus en prod.**
- Documenté dans `SECURITY.md` et `.env.example`.

### `npm audit fix --force` — testé pour de vrai, confirmé non viable
Contrairement au round précédent (où je m'étais arrêté à la lecture du plan), j'ai cette
fois exécuté `--force` pour de vrai, dans un dossier avec sauvegarde de `package.json` /
`package-lock.json`. Résultat : **npm n'a rien pu appliquer** (0 diff sur les deux
fichiers, 58 vulnérabilités inchangées) — sa propre résolution de dépendances proposait
entre autres de **rétrograder Next.js de 16.2.6 à 9.3.3** (7 versions majeures en arrière,
casserait tout le App Router) pour satisfaire les contraintes de peer-deps d'un vieux
`@stacks/connect`/`hardhat-toolbox`. Confirme qu'il n'y a pas de fix automatique sûr ; un
vrai fix demanderait de traiter chaque dépendance individuellement, à la main, avec tests —
je ne l'ai pas fait sans ton feu vert explicite vu le risque de casser la connexion wallet
en prod. Aucun fichier changé par cette tentative.

### Draft — contrat v3 commit-reveal (puzzle answer)
Nouveau fichier `contracts/stacks-quest-v3-draft.clar` — **brouillon, non déployé, non
compilé (`clarinet` indisponible dans ce sandbox), non audité, non branché à l'app**.
Implémente le schéma qui corrige la faille CRITIQUE de la section 2 :
- `create-puzzle` prend un `answer-hash (buff 32)` (= `sha256(to-consensus-buff?(answer) ++ salt)`
  calculé hors-chaîne) au lieu de `answer uint` en clair.
- `play` ne détermine plus `won` immédiatement (le contrat ne connaît pas encore la
  réponse) — enregistre juste guess/bet.
- `reveal-answer` prend `answer` + `salt`, revérifie le hash on-chain, rejette
  (`ERR-BAD-REVEAL`) si ça ne correspond pas — et ne peut être appelé qu'après la fermeture
  du jeu (`end-block`).
- Nouvelle étape `register-win` : chaque gagnant doit s'enregistrer dans une fenêtre fixe
  après le reveal pour être compté dans le partage de pool (Clarity ne peut pas itérer sur
  toutes les tentatives d'un coup, donc chaque gagnant déclenche son propre comptage).
  `claim-reward` n'est payable qu'une fois cette fenêtre fermée, pour un calcul stable.
- Vérification de syntaxe faite (comptage de parenthèses équilibré, 0 négatif) mais **pas
  équivalent à `clarinet check`** — à lancer chez toi avant toute autre étape.
- Questions ouvertes laissées en commentaire dans le fichier (que faire si le owner ne
  révèle jamais, valeurs de fenêtre à choisir, migration des pools v2 → v3).

### Draft — B2S token v5, faucet plafonné
Nouveau fichier `contracts/b2s-token-v5-draft.clar` — même statut (brouillon, non déployé).
Corrige la faille CRITIQUE du faucet illimité :
- Budget global (`FAUCET-BUDGET`, placeholder 50M B2S) — une fois épuisé, le faucet
  s'arrête pour tout le monde, peu importe le nombre de wallets sybil créés.
- Plafond par adresse (`MAX-CLAIMS-PER-ADDRESS`, placeholder 30) — n'élimine pas le sybil
  mais force à créer des wallets frais en continu plutôt que de laisser un seul wallet
  farmer indéfiniment.
- Même rate-limit quotidien qu'en v4 (inchangé).
- Valeurs `FAUCET-BUDGET`/`MAX-CLAIMS-PER-ADDRESS` sont des placeholders — à fixer selon la
  tokenomics réelle voulue.

---

## 2. Trouvé, documenté, **PAS corrigé** — nécessite ta décision

### CRITIQUE — La réponse du puzzle est publique on-chain
`stacks-quest.clar`, `stacks-quest-v2.clar` **et** `QuestGame.sol` stockent `answer` en clair dans une map/struct **publique**. N'importe qui peut lire `get-today-puzzle()` / `puzzles(dayId)` juste après que le owner poste le puzzle — bien avant `reveal-answer()` — et soumettre une réponse garantie correcte. Ça vide la pool de récompenses du jour.

**Impossible à corriger sur les contrats déjà déployés** (ni Clarity ni Solidity ici ne sont upgradeables). Il faut un v3 avec un schéma commit-reveal (stocker `hash(answer+salt)`, révéler `answer+salt` seulement à `reveal-answer`, vérifier le hash à `claim-reward`) et migrer les pools. J'ai ajouté un commentaire `SECURITY NOTE` directement dans le code source aux 3 endroits concernés pour que ça ne se reperde pas, et documenté dans `SECURITY.md`. **En attendant : ne pas seed de grosses reward pools.**

**Mise à jour round 3** : brouillon écrit — `contracts/stacks-quest-v3-draft.clar` (voir
section 1ter). Non déployé, non compilé, non audité. Reste à toi de le faire réviser,
compiler (`clarinet check`), tester et éventuellement déployer.

### CRITIQUE — Faucet B2S mintable à l'infini (sybil)
`b2s-token-v4.clar` → `claim-daily-reward` : n'importe quelle adresse peut mint 5 B2S par "jour" (bucket de block-height), sans limite de wallets. Les adresses Stacks sont gratuites à générer → un attaquant peut diluer l'offre à volonté pour le coût de quelques frais de transaction. Même limitation : contrat déjà déployé, non upgradeable, nécessite un v5. Commentaire ajouté dans le code + `SECURITY.md`.

**Mise à jour round 3** : brouillon écrit — `contracts/b2s-token-v5-draft.clar` (voir
section 1ter). Budget de faucet global + plafond par adresse. Non déployé, non compilé,
non audité, valeurs placeholder à ajuster selon ta tokenomics.

### Dépendances npm — 21 vulnérabilités (prod), 58 avec les devDeps
Principalement dans la chaîne WalletConnect/viem/ws de `@stacks/connect` et le toolchain hardhat (solc/tmp/undici). `npm audit fix --force` réglerait ça mais **downgrade `@stacks/connect` en 8.1.9** (breaking change sur le flow de connexion wallet) ou **bump hardhat en 3.x** (breaking) — testé pour de vrai en round 3 (voir section 1ter), npm n'a pu rien appliquer proprement. Détail complet dispo si tu veux que je creuse une option non-breaking, dépendance par dépendance.

### Code mort à nettoyer (pas de risque, juste du clutter)
`contracts/stacks-quest.clar` (v1, pas dans `Clarinet.toml`) et `stacks-quest-agent-v2.clar` (superseded par v3, toujours dans `Clarinet.toml` mais jamais utilisé par l'app) — réduits à des stubs "DEPRECATED", à toi de voir si tu veux les supprimer pour de vrai.

Le contrat `QuestGame.sol` accepte un `play()` en ERC-20 sans rejeter un `msg.value` accidentel — un utilisateur qui envoie de l'ETH par erreur avec un pari ERC-20 le perd (récupérable seulement par le owner via retrait d'urgence). Pas un exploit, juste un piège UX. Fix appliqué au code source (round 1bis) mais pas au contrat déjà déployé.

---

## 3. Vérifié — aucun problème trouvé

- `.env` / `.env.local` contiennent de vraies clés (`STACKS_PRIVATE_KEY`, `EVM_PRIVATE_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`) — **jamais committées** (historique git complet passé au crible, aucune trace). Bien dans `.gitignore`. Gardez-les hors de tout partage.
- SSRF sur `/api/hiro` : whitelist de préfixes correcte, pas de bypass trouvé.
- Validation d'adresse Stacks (`^SP[A-Z0-9]{1,40}$`) et EVM (`^0x[0-9a-fA-F]{40}$`) cohérente partout où c'est utilisé.
- Rate limiting sur `/api/agent` fonctionne (in-memory, limite connue et déjà documentée dans SECURITY.md).
- Contrats Solidity (`QuestGame.sol`, `QuestCheckIn.sol`) : `ReentrancyGuard` bien posé sur toutes les fonctions qui bougent des fonds, pattern checks-effects-interactions respecté, pas d'overflow (Solidity 0.8+).

---

## 4. Limites de cet environnement sandbox

- **Pas d'accès réseau sortant** vers l'API Hiro, les RPC Base/Celo, le facilitator x402, ou le registre de compilateurs Solidity — je n'ai pas pu tester en live `/api/player`, la version durcie de `/api/mcp` (facilitator inclus), ni lancer `clarinet check` sur les deux nouveaux drafts. J'ai vérifié tout ce qui pouvait l'être hors-ligne (encodage/décodage Clarity, logique x402, chargement du SDK compilé, équilibrage des parenthèses des drafts Clarity).
- `next build` et `tsc --noEmit` sur tout le projet plantent par manque de mémoire dans ce sandbox (confirmé de nouveau en round 3 : `next build` a échoué ici sur un `EAI_AGAIN` en tentant de télécharger le binaire SWC — réseau instable/absent selon les appels). J'ai fait des checks de syntaxe/types ciblés sur chaque fichier touché (tous propres) mais **il faut lancer `npm run build` chez toi/en CI avant de merger** — ce que tu as déjà fait avec succès pour le round 1+2.
- `clarinet` n'est pas installé dans ce sandbox — impossible de faire tourner `clarinet check` sur les deux drafts Clarity. Vérification de repli : comptage programmatique des parenthèses (équilibré, 0 négatif) — pas un vrai contrôle de types/traits Clarity, juste un garde-fou syntaxique minimal.
- Écritures de fichiers occasionnellement tronquées par un souci de synchronisation du dossier monté — systématiquement re-vérifiées (taille en octets + fin de fichier + recompte de parenthèses/diagnostics TS) après chaque écriture critique de ce round.

---

## 5. Fichiers modifiés — round 1+2 (commit `1a8da3a`, déjà push)

```
 .gitignore                       |  +8
 .gitattributes                   |  nouveau
 README.md                        |  ~12
 SECURITY.md                      |  +31
 app/api/mcp/route.ts             |  +65 -20
 app/api/player/route.ts          |  nouveau
 app/lib/stacksRead.ts            |  nouveau
 contracts/b2s-token-v4.clar      |  +6 (commentaire)
 contracts/solidity/QuestGame.sol |  +6 (commentaire) + fix msg.value orphelin (ERC-20 branch)
 contracts/stacks-quest-v2.clar   |  +6 (commentaire)
 hooks/useContractCall.ts         |  +10
 package.json                     |  +8 (main/types/files/version)
 sdk-src/tsconfig.json            |  outDir fix
 sdk-src/sdk/*                    |  retiré du suivi git (déplacé vers /sdk, gitignored comme prévu à l'origine)
 app/agent/page.tsx               |  onglet Withdraw cassé supprimé
 Clarinet.toml                    |  agent-v2 retiré du projet actif
 contracts/stacks-quest.clar          |  réduit à un stub deprecated
 contracts/stacks-quest-agent-v2.clar |  idem
```

## 5bis. Fichiers modifiés — round 3 (pas encore commit)

```
 app/api/mcp/route.ts                 |  +~80 (facilitatorVerifyAndSettle + wiring dans le gate premium)
 SECURITY.md                          |  section x402 réécrite, ligne facilitator-key ajoutée
 .env.example                         |  +7 (X402_FACILITATOR_URL / _API_KEY / _STRICT)
 AUDIT_REPORT.md                      |  ce fichier
 contracts/stacks-quest-v3-draft.clar |  nouveau — draft commit-reveal, non déployé
 contracts/b2s-token-v5-draft.clar    |  nouveau — draft faucet plafonné, non déployé
```

---

## Round 1+2 : commit fait

Commit `1a8da3a` "fix: sdk packaging, player stats endpoint, x402 hardening, dead code
cleanup" — poussé sur `origin/main`, `git status` propre côté serveur. Tout ce qui était
listé dans les sections 1 et 1bis est en prod.

## Ce qu'il te reste à trancher — round 3

1. **Facilitator x402 de prod.** Le code appelle maintenant `https://x402.org/facilitator`
   (le facilitator public de référence) par défaut. Pour de la vraie revenue en prod tu
   voudras probablement un facilitator dédié (ex. Coinbase CDP) — configure
   `X402_FACILITATOR_URL` / `X402_FACILITATOR_API_KEY` le moment venu. **À tester avec un
   vrai paiement signé avant de faire confiance à ce gate pour de l'argent réel** — je n'ai
   pas pu le tester en live ici (pas d'accès réseau sortant dans ce sandbox).
2. `npm audit fix --force` — confirmé, testé pour de vrai cette fois : aucun fix automatique
   sûr n'existe (npm proposait de casser Next.js). Reste ouvert seulement si tu veux que je
   traite les dépendances une par une, manuellement, dans une branche à part.
3. **Les deux drafts de contrats** (`stacks-quest-v3-draft.clar`, `b2s-token-v5-draft.clar`)
   ne sont ni compilés (`clarinet check` à lancer chez toi), ni audités, ni déployés. Avant
   d'y toucher pour de vrai : fais-les relire, choisis les vraies valeurs de tokenomics
   (fenêtres de blocs, budget de faucet, plafond par adresse), teste sur devnet/testnet, et
   fais auditer avant tout déploiement mainnet touchant de vrais fonds. Le déploiement
   lui-même n'est pas quelque chose que je peux faire depuis cet environnement (il faudrait
   ta clé privée de déploiement, que je n'ai pas et ne dois pas avoir).

Dis-moi quand tu veux avancer sur l'un de ces trois points, ou si tu veux que je committe
ce round 3 (facilitator + drafts + doc) dès maintenant.
