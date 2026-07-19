<div align="center">

<!-- BANNER SCREENSHOT — drag-and-drop your hero/app image into the GitHub editor and paste the generated asset URL into src="" below -->
<img width="2880" alt="Sanctum Pool" src="" />

<img src="https://img.shields.io/badge/Stellar-Soroban-7B2FBE?style=for-the-badge" />
<img src="https://img.shields.io/badge/Rust-no__std-red?style=for-the-badge" />
<img src="https://img.shields.io/badge/Circom-2.0-2E7D32?style=for-the-badge" />
<img src="https://img.shields.io/badge/snarkjs-Groth16%20BN254-informational?style=for-the-badge" />
<img src="https://img.shields.io/badge/Vite-JavaScript-646CFF?style=for-the-badge" />
<img src="https://img.shields.io/badge/Status-Live%20on%20Testnet-brightgreen?style=for-the-badge" />

# Sanctum Pool

> **Compliant Privacy Pool for Real-World Value Transfer on Stellar Soroban**
>
> Deposit a fixed-denomination asset, withdraw to a **fresh, unlinkable address** — but only if your deposit belongs to a compliance-approved **association set (ASP)** — with a **view key** that discloses a single transaction to an auditor and nothing else. Every withdrawal is gated by an on-chain **Groth16 / BN254** zero-knowledge proof generated **in the browser**.

</div>

---

## Live Demo

| Surface | URL |
|---|---|
| **Frontend (Vercel)** | https://sanctum-pool-nine.vercel.app/ |
| **Operator / ASP API (Render)** | https://sanctum-pool-uuhl.onrender.com |
| **Verifier — Stellar Expert** | https://stellar.expert/explorer/testnet/contract/CAHBSVRPU4QRWPAUERYHEVOLL376Y7V4HPMQ6XNYF527ZLQD2NTEGNUZ |
| **Pool — Stellar Expert** | https://stellar.expert/explorer/testnet/contract/CCDQ2BSPSUH7P2J7PK2E7Z6XLVFVTXYZVIPBUS42U22WMD2NMM7MUJCP |
| **Demo Video** | _Not available_ |

---

## Table of Contents

1. [What This Is](#1-what-this-is)
2. [Architecture](#2-architecture)
3. [Zero-Knowledge Layer](#3-zero-knowledge-layer)
4. [Smart Contracts](#4-smart-contracts)
5. [Contract Deployment Addresses](#5-contract-deployment-addresses)
6. [Verified On-Chain Transactions](#6-verified-on-chain-transactions)
7. [Frontend](#7-frontend)
8. [Operator & ASP Service](#8-operator--asp-service)
9. [Technology Stack](#9-technology-stack)
10. [Installation](#10-installation)
11. [Environment Variables](#11-environment-variables)
12. [Smart Contract Deployment Guide](#12-smart-contract-deployment-guide)
13. [Testing](#13-testing)
14. [CI/CD Pipeline](#14-cicd-pipeline)
15. [Event Streaming Architecture](#15-event-streaming-architecture)
16. [Security Model](#16-security-model)
17. [Troubleshooting](#17-troubleshooting)
18. [Screenshots](#18-screenshots)
19. [Git History](#19-git-history)
20. [User Feedback Implementation](#20-user-feedback-implementation)

---

## 1. What This Is

Sanctum Pool is a **shielded pool** on Stellar Soroban where:

- Deposits post only a **Poseidon commitment** — the depositor, future recipient, and linkage stay hidden
- Withdrawals are authorized by a **real Groth16 proof over BN254**, verified **on-chain** with Stellar's native `bn254` host functions (Protocol 25/26) — not a stub
- A withdrawal is only possible if the deposit's label is in a **compliance-approved association set** (ASP) — enforced *inside the circuit*, so non-approved funds provably cannot exit privately
- A **view key** lets the depositor disclose exactly one transaction to an auditor, who verifies it against the on-chain commitment while learning nothing about any other transaction
- The zero-knowledge proof is generated **entirely in the browser** — the note secret never leaves the device

This is not a plain mixer. It is **privacy with provable innocence**: private like a mixer, but bad actors are excluded and any single transaction is selectively auditable.

### Why "provable innocence"?

Pure mixers get sanctioned because a criminal's tainted funds are indistinguishable from an honest user's. Fully transparent chains offer zero financial privacy — a large transfer is visible forever. Sanctum Pool fills the gap: **private, compliant, and auditable settlement** of real on-chain value (payroll, supplier payments, treasury movement, institutional settlement) without exposing counterparties, amounts, and timing to everyone forever.

> **Scope note (verifiable):** the settlement asset in this deployment is the **native XLM SAC** at a single fixed denomination (0.1 XLM). Multi-asset support, variable amounts, and tokenized-RWA instruments are **not implemented** — see §20. This README does not claim otherwise.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        USER'S BROWSER                            │
│                                                                   │
│  Vite + vanilla JS dApp          snarkjs WASM Proof Engine        │
│  ┌─────────────────────┐        ┌─────────────────────────────┐   │
│  │ Deposit / Withdraw  │──────▶ │  Groth16 withdraw proof     │   │
│  │ Pool / Auditor views│        │  (state + ASP membership,   │   │
│  │ Stellar Wallets Kit │        │   nullifier, recipient)     │   │
│  └──────────┬──────────┘        │  Note secret STAYS HERE     │   │
│             │                   └──────────────┬──────────────┘   │
│             │ commitment / proof / signals      │                 │
└─────────────┼───────────────────────────────────┼─────────────────┘
              │                                   │
              ▼                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│               OPERATOR / ASP SERVICE (Node HTTP · Render)        │
│                                                                   │
│  POST /approve  → derive state root + approve label + ASP root    │
│  GET  /asp-path → Merkle path for the browser's withdraw witness  │
│  Holds the admin key OFF the browser; posts roots on-chain        │
└──────────────────────────┬───────────────────────────────────────┘
                          │  update_root / update_asp_root (admin-signed)
                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                   SOROBAN SMART CONTRACTS                        │
│                                                                   │
│   SanctumPool ─────────────────▶ Groth16VerifierContract          │
│   (commitments, roots,            (BN254 pairing_check over the    │
│    nullifiers, encrypted notes,    installed verifying key)       │
│    fund custody)                                                  │
│        │                                                          │
│        ▼                                                          │
│   token::Client  (native XLM SAC — deposit in / withdraw out)     │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Language | Responsibility |
|---|---|---|
| `circuits/` | Circom 2.0 + snarkjs | `withdraw.circom` (dual Merkle membership + nullifier + recipient binding), `merkle.circom` (Poseidon Merkle); Groth16 over BN254 |
| `contracts/verifier/` | Rust / Soroban | On-chain Groth16 verification via `env.crypto().bn254()` (`g1_mul`, `g1_add`, `pairing_check`); admin-gated verifying key |
| `contracts/pool/` | Rust / Soroban | Deposits, commitment list, recent state/ASP roots, nullifier set, on-chain encrypted-note anchoring, recipient binding, fund custody |
| `tools/circom2soroban/` | Rust | Converts snarkjs Groth16 JSON (vk / proof / public) into the exact BN254 byte layout the verifier expects |
| `client/` | JavaScript (Node) | Note generation, Poseidon Merkle trees, witness input, view-key encryption, auditor reveal (also reused by the web dApp) |
| `asp-service/` | JavaScript (Node) | ASP curator CLI: maintains the approved-label set and computes its Merkle root |
| `operator/` | JavaScript (Node) | HTTP service that holds the admin key, posts state/ASP roots on-chain, and serves ASP Merkle paths |
| `web/` | Vite + vanilla JS | Browser dApp: Deposit / Withdraw / Pool / Auditor, in-browser proving, wallet signing |
| `scripts/` | Bash | Circuit build, trusted setup, and full end-to-end demo on testnet |

### Project Structure

```
sanctum-pool/
├── circuits/                        # Circom 2.0 circuits + committed keys
│   ├── withdraw.circom              # Withdraw proof: dual membership + nullifier + recipient
│   ├── merkle.circom                # Poseidon Merkle proof (HashLeftRight, DualMux, MerkleProof)
│   ├── keys/                        # Committed proving/verification keys
│   │   ├── withdraw_final.zkey      # Groth16 proving key
│   │   └── withdraw_vk.json         # Verifying key (exported to Soroban bytes for set_vk)
│   └── test/multiplier2.circom      # Minimal sample circuit
│
├── contracts/                       # Soroban contracts — Rust, Cargo workspace
│   ├── verifier/src/lib.rs          # Groth16VerifierContract (BN254 pairing_check)
│   └── pool/src/lib.rs              # SanctumPool (deposits, withdrawals, roots, custody)
│
├── tools/circom2soroban/src/main.rs # snarkjs JSON → BN254 byte-layout converter
│
├── client/src/                      # Shared JS crypto/tooling (CLI + web)
│   ├── note.js                      # Fixed-denomination note scheme
│   ├── poseidon.js  field.js        # Poseidon hashing + field helpers
│   ├── merkle.js                    # Poseidon Merkle tree
│   ├── withdrawInput.js             # Builds the circuit witness input
│   ├── genWithdrawInput.js          # CLI: write withdraw_input.json + withdraw_meta.json
│   ├── viewkey.js                   # X25519 + XChaCha20 view-key encryption
│   ├── auditor.js  auditorReveal.js # Selective disclosure verification
│   └── address.js                   # Recipient → field-element derivation (matches on-chain)
│
├── asp-service/                     # ASP curator CLI
│   └── curator.js                   # approve <label> → approved.json + Merkle root
│
├── operator/                        # Off-chain operator (admin key holder) — deployed on Render
│   ├── operator.mjs                 # HTTP service: /, /approve, /asp-path
│   ├── soroban.js  merkle.js        # Tx builders + Merkle helpers
│   ├── poseidon.js  config.js       # Poseidon + deployed contract config
│   └── package.json
│
├── web/                             # Vite browser dApp — deployed on Vercel
│   ├── index.html  vite.config.js  vercel.json
│   ├── src/app.js                   # dApp controller (Deposit/Withdraw/Pool/Auditor/Wallet)
│   ├── src/wallet-panel.js          # Freighter wallet panel (detect/connect/balance/send)
│   ├── src/home.js  icons.js  styles.css
│   ├── src/config.js                # Deployed contract IDs + pool params
│   ├── src/lib/                     # prove.js, soroban.js, toSoroban.js, wallet.js, notes.js,
│   │                                #   stellar-wallet.js, stellar-sdk.js, wallet-store.js
│   └── scripts/                     # sync-circuits.mjs
│
├── scripts/                         # build_circuit.sh, setup_circuit.sh, e2e.sh
├── deployments/                     # verifier_testnet.txt, pool_testnet.txt (deployed IDs)
├── .github/workflows/               # ci.yml + deploy.yml (contract → Render → Vercel) + keepalive.yml
├── Cargo.toml  Cargo.lock           # Rust workspace
├── LICENSE  NOTICE                  # MIT + third-party attribution
└── README.md                        # This file
```

---

## 3. Zero-Knowledge Layer

### Note scheme (fixed denomination)

Ownership of pooled value is a **secret note** held client-side — the note is the *only* way to withdraw. There is no account, no custodian, and no server-side copy.

```
precommitment = Poseidon(nullifier, secret)
label         = Poseidon(scope, nonce)
commitment    = Poseidon(amount, label, precommitment)   // leaf in the state tree
nullifierHash = Poseidon(nullifier)                       // public, prevents double-spend
```

Public signals (order fixed by the circuit and reconstructed on-chain):

```
[ nullifierHash, root, aspRoot, recipient, amount, scope ]
```

### Circuit Overview

One Groth16 circuit (Circom 2.0.0, BN254 curve), Merkle depth **20**:

| Circuit | Purpose | Constraints |
|---|---|---|
| `withdraw` | Proves state-tree membership **and** ASP-set membership of the note, derives a fresh `nullifierHash`, and binds `recipient` | ~22,855 (10,807 non-linear + 12,048 linear) |

From `snarkjs r1cs info`: 213 template instances, 22,855 total constraints, 5 public inputs + 1 public output, 83 private inputs.

The withdrawal proves, in one proof, revealing nothing about which deposit or which approved label is yours:

1. **State membership** — the commitment is a leaf under `root`.
2. **Compliance membership** — the `label` is a leaf under `aspRoot`.
3. **No double-spend** — a correctly derived `nullifierHash` is revealed.
4. **Recipient binding** — `recipient` is constrained into the proof (anti-front-running).

If a deposit is **not** in the approved set, the circuit cannot produce a satisfying witness — non-approved funds provably cannot withdraw. (Verified: a "denied" witness fails to generate; see §13.)

### On-Chain Public-Signal Reconstruction

`SanctumPool::withdraw` never trusts caller-supplied signals for the sensitive fields. It reconstructs them and passes them to the verifier:

```
signals = [ nullifier_hash, root, asp_root,
            recipient_field,          // derived ON-CHAIN from `recipient`
            cfg.denom_field,          // fixed denomination
            cfg.scope ]               // pool/asset domain separator
```

`recipient_field` is `SHA-256(strkey)` truncated to the top 31 bytes (a value `< 2^248 < p`). The client derives the identical field, so a mempool front-runner who swaps the payout address produces a different field and the proof no longer verifies.

### BN254 Wire Encoding (Stellar-specific)

`tools/circom2soroban` (and its JS port `web/src/lib/toSoroban.js`) serialize snarkjs output into the byte layout the `bn254` host functions expect:

| Type | Format | Size |
|---|---|---|
| G1 point | `be(x) ‖ be(y)` | 64 bytes |
| G2 point | Fp2 coordinates **imaginary-part first** (`be(c1) ‖ be(c0)`, EIP-197) | 128 bytes |
| Fr scalar | `be(scalar)` | 32 bytes |

**Verifying-key bytes** (`set_vk`): `alpha(G1) ‖ beta(G2) ‖ gamma(G2) ‖ delta(G2) ‖ be_u32(ic_len) ‖ ic[](G1)`.
**Proof bytes:** `a(G1) ‖ b(G2) ‖ c(G1)`.
**Public-signal bytes:** `be_u32(len) ‖ be32(sig₀) ‖ be32(sig₁) ‖ …`.

> snarkjs emits G2 as `[c0, c1]`; the converter swaps to `c1, c0`. Getting this wrong makes every pairing fail silently — the hardest bug in the project.

### Groth16 Verification Equation

```
e(−A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1

where  vk_x = IC[0] + Σᵢ sigᵢ · IC[i+1]
```

Implemented in `contracts/verifier/src/lib.rs` with `bn.g1_mul`, `bn.g1_add`, and `bn.pairing_check` over the four `vp1`/`vp2` point pairs.

### Trusted Setup

The repository ships committed, matching keys in `circuits/keys/`. To regenerate your own (BN254 / bn128, `POWER=15` because the circuit has ~22.8k constraints):

```bash
scripts/build_circuit.sh withdraw          # compile → r1cs + wasm witness generator
POWER=15 scripts/setup_circuit.sh withdraw # powersoftau + groth16 setup + export vk
cp circuits/build/withdraw_final.zkey   circuits/keys/withdraw_final.zkey
cp circuits/build/verification_key.json circuits/keys/withdraw_vk.json
```

---

## 4. Smart Contracts

Rust, `#![no_std]`, `soroban-sdk = "25.1.0"`, built for `wasm32v1-none`.

### Groth16VerifierContract (`contracts/verifier/`)

On-chain Groth16 verification over BN254. Stores a single admin-installed verifying key.

```rust
pub fn init(env: Env, admin: Address) -> Result<(), VerifierError>
pub fn set_vk(env: Env, vk_bytes: Bytes) -> Result<(), VerifierError>   // admin-only
pub fn verify(env: Env, proof_bytes: Bytes, pub_signals_bytes: Bytes)
    -> Result<bool, VerifierError>
```

- `init` — one-time; records the admin allowed to install the verifying key.
- `set_vk` — `admin.require_auth()`; parses the VK before storing so malformed keys fail fast. An attacker who could swap the VK could make the verifier accept forged proofs.
- `verify` — parses VK + proof + public signals, computes `vk_x`, and returns `bn254().pairing_check(...)`.

Errors: `MalformedVerifyingKey`, `VerificationKeyNotSet`, `MalformedProof`, `MalformedPublicSignals`, `AlreadyInitialized`, `NotInitialized`.

### SanctumPool (`contracts/pool/`)

The shielded pool: custody, commitments, roots, nullifiers, encrypted notes.

```rust
pub fn init(env, verifier: Address, token: Address, admin: Address,
            denom_amount: i128, denom_field: U256, scope: U256) -> Result<(), PoolError>
pub fn deposit(env, from: Address, commitment: U256, enc_note: Bytes) -> Result<u32, PoolError>
pub fn get_enc_note(env, commitment: U256) -> Bytes
pub fn update_root(env, root: U256) -> Result<(), PoolError>          // admin-only
pub fn is_known_root(env, root: U256) -> bool
pub fn update_asp_root(env, asp_root: U256) -> Result<(), PoolError>  // admin-only
pub fn is_known_asp_root(env, asp_root: U256) -> bool
pub fn is_spent(env, nullifier_hash: U256) -> bool
pub fn commitments(env) -> Vec<U256>
pub fn recipient_field(env, recipient: Address) -> U256
pub fn withdraw(env, proof_bytes: Bytes, nullifier_hash: U256,
                root: U256, asp_root: U256, recipient: Address) -> Result<(), PoolError>
```

`withdraw` flow: check `root` is known → check `asp_root` is known → check nullifier unspent → derive `recipient_field` on-chain → reconstruct public signals → `invoke_contract(verifier, "verify", ...)` → mark nullifier spent → `token::transfer` payout.

**Events:** `deposit(index) → commitment`, `root → root`, `asproot → asp_root`, `withdraw → nullifier_hash`.
**Errors:** `AlreadyInitialized`, `NotInitialized`, `UnknownRoot`, `NullifierAlreadySpent`, `InvalidProof`, `WrongAmount`, `WrongScope`, `UnknownAspRoot`.
**Recent-roots window:** the last 30 state roots and 30 ASP roots are accepted.

---

## 5. Contract Deployment Addresses

**Network:** Stellar Testnet · **Deployed:** 2026-07-19

| Contract | Address |
|---|---|
| **Verifier** (Groth16 / BN254) | `CAHBSVRPU4QRWPAUERYHEVOLL376Y7V4HPMQ6XNYF527ZLQD2NTEGNUZ` |
| **Pool** | `CCDQ2BSPSUH7P2J7PK2E7Z6XLVFVTXYZVIPBUS42U22WMD2NMM7MUJCP` |

**Supporting addresses:**

| | Address |
|---|---|
| Token — native XLM SAC (testnet) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Admin / operator | `GA3VYCWXPQS3IM776Q43CWNZOUPJO4OGWMO4TQAVWQHMIXNFBFSQVAWJ` |

Contract IDs are wired into `web/src/config.js`, `operator/config.js`, and recorded in [`deployments/`](deployments/). Pool parameters: `denom_amount = 1_000_000` stroops (**0.1 XLM**), `denom_field = 1_000_000`, `scope = 1`.

> [View pool on Stellar Expert →](https://stellar.expert/explorer/testnet/contract/CCDQ2BSPSUH7P2J7PK2E7Z6XLVFVTXYZVIPBUS42U22WMD2NMM7MUJCP)

---

## 6. Verified On-Chain Transactions

All transactions below were submitted by this repository's deploy + end-to-end run against the addresses in §5 (Stellar Testnet).

### Deployment & initialization

| Step | Transaction Hash |
|---|---|
| Verifier `init` | `fcb3b650364a0e8b602f61943891317e7f97c5248be6765714ed8be862bc4adb` |
| Verifier `set_vk` | `41b1214c7ce09c40628cb7feb0dcf205c5aa15bf36e5fc901cb01277d17b4c25` |
| Pool `init` (redeployed) | `06086e3f3326d9d15ef1c59ac64deb517ea674ffcd3f631edc029408ffa3e379` |

### Full E2E: deposit → approve → withdraw

| Step | Transaction Hash | Effect |
|---|---|---|
| `deposit` | `776234aef496d4b2c05ae2eb14c1b729c19352f4b410067faa5802c6cb8a2c26` | 0.1 XLM → pool; commitment + enc-note stored |
| `update_root` | `0f2d6d013494f321eb5a3ec77904babfb0db1f374b4603c8e0c24dd515586c3d` | state root posted |
| `update_asp_root` | `73b6f27e62efbddfff7855bc2b179427854fc141d3af1822cb947ad24687fb24` | ASP root posted |
| **`withdraw`** | `dee4f00b789780804aed6448e15206434b034388b8df9eb0d6d51d33a7dd6335` | **on-chain proof verified; 0.1 XLM → fresh recipient** |

The `deposit` and `withdraw` transactions emit `transfer` events on the native SAC, confirming custody and payout.

> **Note:** the deposit→withdraw hashes above were captured on the original pool instance (identical contract code, same verifier). The redeployed pool in §5 starts with empty state — re-run `scripts/e2e.sh` to reproduce the full flow against it.

### Enforcement observed live

| Attack / Check | Result |
|---|---|
| Withdraw with a mismatched payout address (`recipient = admin`) | **Rejected** — recipient bound on-chain; proof no longer verifies |
| Auditor selective disclosure | Decrypted note recomputes the on-chain commitment ✅ |
| Denied deposit (label not in ASP) | Witness generation **fails** — cannot build a valid proof |

### Invoke the verifier directly

```bash
stellar contract invoke \
  --id CAHBSVRPU4QRWPAUERYHEVOLL376Y7V4HPMQ6XNYF527ZLQD2NTEGNUZ \
  --source sanctum --network testnet \
  -- verify \
  --proof_bytes <hex> \
  --pub_signals_bytes <hex>
# → true for a valid proof; flip one byte → false
```

---

## 7. Frontend

**Stack:** Vite · vanilla JavaScript (no framework) · Stellar Wallets Kit v2.5 (Freighter) · `@stellar/stellar-sdk` v16 · `@stellar/freighter-api` v6 · snarkjs (in-browser Groth16) · GSAP + Lenis (landing motion). **Hosted on Vercel**, fully mobile-responsive.

### Views

| View | Route | Description |
|---|---|---|
| `home` | `/` | Landing page: what the pool does, how it works, ZK proof band, CTA |
| `deposit` | `/#deposit` | Create a note, back it up, sign the deposit; auto-notifies the ASP |
| `withdraw` | `/#withdraw` | Generate the ZK proof **in-browser**, then sign the withdrawal |
| `pool` | `/#pool` | Pool & compliance status (total deposits, roots) |
| `auditor` | `/#auditor` | Selective disclosure: decrypt one note and verify it against chain |
| `wallet` | `/#wallet` | Freighter demo: detect → connect → balance → send XLM → tx hash |

### Layout

```
┌──────────────────────────────────────────────────┐
│  Header  (brand · wallet connect / address)       │
├──────────────────────────────────────────────────┤
│  Nav tabs:  Deposit · Withdraw · Pool · Auditor ·  │
│             Wallet   (scrollable row on mobile)    │
├──────────────────────────────────────────────────┤
│  Active view                                       │
│   Deposit  → note backup + sign                    │
│   Withdraw → proof-step progress + sign            │
│   Pool     → deposits / roots status               │
│   Auditor  → disclosure-key reveal + verification   │
│   Wallet   → connect + balance + send form         │
└──────────────────────────────────────────────────┘
```

### Integration files (`web/src/lib/`)

| File | Responsibility |
|---|---|
| `soroban.js` | Reads via `simulateTransaction`; writes via prepare → wallet-sign → submit. `RPC_URL = https://soroban-testnet.stellar.org`, `NETWORK = TESTNET` |
| `prove.js` | `snarkjs.fullProve` in the browser (wasm + zkey served from `public/circuits/`) |
| `toSoroban.js` | JS port of `circom2soroban` — proof/vk/public → BN254 bytes |
| `wallet.js` | Stellar Wallets Kit v2.5 — connect + `signTransaction` |
| `notes.js` | Local (localStorage) note store — the note is the only way to withdraw |
| `stellar-wallet.js` | `@stellar/freighter-api` wrappers: `detectFreighter`, `connectWallet`, `signTx` |
| `stellar-sdk.js` | Horizon balance fetch + payment-XDR build + submit for the Wallet view |
| `wallet-store.js` | Observable wallet store (`connect`, `disconnect`, `refreshBalance`, `sendXlm`) |

The ASP operator endpoint defaults to `http://localhost:8787` and is overridden at build time with `VITE_OPERATOR` (set to the Render URL in production). Circuit artifacts (`withdraw.wasm`, `withdraw_final.zkey`, `withdraw_vk.json`) are copied into `web/public/circuits/` automatically before `dev`/`build` by `web/scripts/sync-circuits.mjs`.

---

## 8. Operator & ASP Service

Two off-chain, admin-side pieces keep the admin key off the browser and maintain the association set. The operator is **deployed on Render**.

### Operator HTTP API (`operator/operator.mjs`)

Node's built-in `http` server (no framework, no database; the approved-label set is kept **in memory** on purpose, so run one persistent process).

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Service status / health: `{ service, admin, approved }` |
| `POST` | `/approve` | Body `{ label }` → posts state root + approves label + posts ASP root → `{ ok, stateRoot, aspRoot }` |
| `GET` | `/asp-path?label=` | Returns `{ aspRoot, aspPathElements, aspPathIndices }` for the browser's withdraw witness |

It signs `update_root` / `update_asp_root` with the admin key and derives both Merkle trees (depth 20) from on-chain commitments and the approved-label set. On Render's free tier the instance sleeps after ~15 min idle; the `keepalive` workflow (§14) pings `GET /` every ~10 min to beat cold starts.

> **Compliance screening is mocked:** the demo operator **auto-approves every label**. The enforcement mechanism (in-circuit ASP membership) is real; only the approve/deny *decision source* is stubbed.

### ASP curator CLI (`asp-service/curator.js`)

Maintains the approved-label set (`asp-service/approved.json`) and computes its Merkle root — used by `scripts/e2e.sh` (`node asp-service/curator.js approve <label>`).

---

## 9. Technology Stack

| Layer | Technology |
|---|---|
| Blockchain | Stellar Soroban (Testnet) |
| Contract language | Rust (`#![no_std]`, `soroban-sdk = "25.1.0"`) |
| Build target | `wasm32v1-none` |
| ZK proof system | Groth16 / BN254 via Stellar native `bn254` host functions |
| Circuit language | Circom 2.0.0 (`circomlib` Poseidon) |
| Proof library | snarkjs |
| Byte conversion | `circom2soroban` (Rust) + `toSoroban.js` (JS port) |
| Frontend | Vite + vanilla JavaScript |
| Wallet | Stellar Wallets Kit v2.5 + `@stellar/freighter-api` v6 |
| Client SDK | `@stellar/stellar-sdk` v16 |
| Client crypto | `@noble/curves`, `@noble/ciphers`, `@noble/hashes`, `circomlibjs` (X25519 + XChaCha20 view keys) |
| Operator / ASP | Node.js ≥ 18 (built-in `http`; no database) |
| Package manager | npm (per-package; no workspaces) |
| CI/CD | GitHub Actions |
| Frontend hosting | Vercel |
| Operator hosting | Render |

---

## 10. Installation

### Prerequisites

```bash
rustup target add wasm32v1-none
# Stellar CLI (v22+):
cargo install --locked stellar-cli
# circom 2.x (an older 0.5.x on PATH will NOT compile these circuits):
cargo install --git https://github.com/iden3/circom circom
# Node.js 18+
```

### Clone + install

```bash
git clone https://github.com/soumilibasak567/sanctum-pool.git
cd sanctum-pool
npm install
(cd client && npm install)
(cd web && npm install)
(cd operator && npm install)
(cd asp-service && npm install)
```

### Build the circuit + contracts

```bash
# circuit (produces the witness-generator wasm; keys are already committed)
scripts/build_circuit.sh withdraw
cp circuits/keys/withdraw_final.zkey circuits/build/withdraw_final.zkey

# contracts + byte-conversion tool
stellar contract build
cargo build -p circom2soroban --release
```

### Run development

```bash
# Terminal 1 — operator / ASP service (holds the admin key off the browser)
SANCTUM_SECRET=$(stellar keys show sanctum) node operator/operator.mjs
# → Sanctum operator on :8787

# Terminal 2 — web dApp
cd web && npm run dev
# → http://localhost:5173  (Vite default)
```

You also need a Freighter wallet set to **Testnet** and funded via Friendbot.

---

## 11. Environment Variables

Contract addresses are **not** stored in env — they are hardcoded in committed `config.js` files. Env variables only wire services together (operator key, operator URL, CORS) and the CD secrets below.

### `operator/.env` (Render)

```env
SANCTUM_SECRET=S...        # admin secret key — NEVER commit; falls back to `stellar keys show sanctum`
PORT=8787                  # host-provided port (Render injects its own — do not set there)
ALLOW_ORIGIN=*             # optional comma-separated CORS allowlist (set to the Vercel URL)
```

### `web/.env` (Vercel — build-time)

```env
VITE_OPERATOR=https://sanctum-pool-uuhl.onrender.com   # ASP operator endpoint
```

### Checked-in configuration (not secret)

`web/src/config.js` and `operator/config.js` hold the deployed contract IDs and pool params:

```js
export const CONFIG = {
  verifier: "CAHBSVRPU4QRWPAUERYHEVOLL376Y7V4HPMQ6XNYF527ZLQD2NTEGNUZ",
  pool:     "CCDQ2BSPSUH7P2J7PK2E7Z6XLVFVTXYZVIPBUS42U22WMD2NMM7MUJCP",
  token:    "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", // native XLM SAC
  denomAmount: 1000000n,  // stroops per note (0.1 XLM)
  denomLabel: "0.1 XLM",
  scope: 1n,
  explorerTx: (h) => `https://stellar.expert/explorer/testnet/tx/${h}`,
};
```

### GitHub Secrets / Variables (CD)

| Kind | Name | Value |
|---|---|---|
| Secret | `SANCTUM_SECRET` | Admin secret (only if you want auto pool redeploy on push) |
| Secret | `RENDER_API_KEY` | Render API key |
| Secret | `RENDER_SERVICE_ID` | Operator's Render service ID |
| Secret | `VERCEL_TOKEN` | Vercel deployment token |
| Variable | `VERCEL_ORG_ID` | Vercel org/team ID |
| Variable | `VERCEL_PROJECT_ID` | Vercel project ID |
| Variable | `OPERATOR_URL` | Operator URL (defaults to the Render URL) |

> **Never expose the admin secret key.** `SANCTUM_SECRET` and any `stellar keys ... --secret` output must stay out of the repo, the browser, and logs.

---

## 12. Smart Contract Deployment Guide

### 1. Create + fund a dedicated testnet identity

```bash
stellar keys generate sanctum --network testnet --fund
export STELLAR_ACCOUNT=sanctum
ADMIN=$(stellar keys address sanctum)
```

### 2. Build

```bash
stellar contract build                       # → target/wasm32v1-none/release/*.wasm
cargo build -p circom2soroban --release       # → target/release/circom2soroban
```

### 3. Deploy + initialize the verifier

```bash
VERIFIER=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/sanctum_verifier.wasm --network testnet)

stellar contract invoke --id "$VERIFIER" --network testnet -- init --admin "$ADMIN"
stellar contract invoke --id "$VERIFIER" --network testnet -- \
  set_vk --vk_bytes "$(./target/release/circom2soroban vk circuits/keys/withdraw_vk.json)"
echo "$VERIFIER" > deployments/verifier_testnet.txt
```

### 4. Deploy + initialize the pool

```bash
stellar contract asset deploy --asset native --network testnet || true
TOKEN=$(stellar contract id asset --asset native --network testnet)

POOL=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/sanctum_pool.wasm --network testnet)
echo "$POOL" > deployments/pool_testnet.txt

stellar contract invoke --id "$POOL" --network testnet -- init \
  --verifier "$VERIFIER" --token "$TOKEN" --admin "$ADMIN" \
  --denom_amount 1000000 --denom_field 1000000 --scope 1
```

### 5. Wire the new IDs

Copy the new `verifier` / `pool` IDs into `web/src/config.js` and `operator/config.js`. (The CD pipeline in §14 does this automatically when it redeploys the pool.)

### One-command end-to-end

`scripts/e2e.sh` performs steps 3–4 **and** the full flow (approved deposit → withdrawal → auditor disclosure → denied deposit), writing the new IDs to `deployments/`. It requires a funded identity named `sanctum` and the compiled circuit build.

### Gotchas

| Issue | Fix |
|---|---|
| `circom` compiles nothing / syntax errors | An old `circom` 0.5.x shadows 2.x on PATH — use `~/.cargo/bin/circom` or reorder PATH |
| `set_vk` fails to parse | The converter expects the committed `withdraw_vk.json`; VK bytes are **hex** |
| Proof verifies off-chain but not on-chain | G2 must be imaginary-part-first (`be(c1)‖be(c0)`) — see §3 |
| `UnknownRoot` / `UnknownAspRoot` on withdraw | Post `update_root` / `update_asp_root` first (operator `POST /approve`) |

---

## 13. Testing

> **Verifiable state:** this repository contains **no automated unit-test suite** — there are no Rust `#[test]` modules in `contracts/` and no JS test runner configured. Verification is done by the **on-chain end-to-end script** below, which this repo has run successfully against the live Testnet deployment.

### End-to-end (on-chain) — `scripts/e2e.sh`

Runs the complete protocol on testnet and asserts each stage:

```bash
scripts/e2e.sh
```

| Stage | Assertion |
|---|---|
| Approved private payment | deposit → approve → withdraw succeeds; recipient balance increases by 0.1 XLM |
| Front-running attempt | withdraw with a different payout address is **rejected** (recipient bound on-chain) |
| Auditor selective disclosure | decrypted note recomputes the on-chain commitment |
| Denied deposit | a non-approved label **cannot** generate a valid witness |

### Off-chain proof sanity check

```bash
node circuits/build/withdraw_js/generate_witness.js \
  circuits/build/withdraw_js/withdraw.wasm circuits/build/withdraw_input.json circuits/build/withdraw.wtns
npx snarkjs groth16 prove circuits/keys/withdraw_final.zkey \
  circuits/build/withdraw.wtns circuits/build/proof.json circuits/build/public.json
npx snarkjs groth16 verify circuits/keys/withdraw_vk.json \
  circuits/build/public.json circuits/build/proof.json
# → [INFO] snarkJS: OK!
```

---

## 14. CI/CD Pipeline

Three GitHub Actions workflows in `.github/workflows/`.

### CI (`ci.yml`) — every push + PR

```yaml
jobs:
  contracts:   # build the two contract crates for wasm32v1-none, upload wasm artifacts
  frontend:    # install client + web deps, Vite build (catches cross-package resolution bugs)
  operator:    # npm ci + node --check operator.mjs
```

#### Contracts Job

```yaml
- uses: dtolnay/rust-toolchain@stable
  with:
    targets: wasm32v1-none
- uses: Swatinem/rust-cache@v2
# Build only the contract crates — the workspace also has a native tool crate
# that must NOT be built for the wasm target.
- run: cargo build --target wasm32v1-none --release -p sanctum-verifier -p sanctum-pool
```

#### Frontend Job

```yaml
# web imports shared crypto from ../../client/src, so client deps must be
# installed for those imports to resolve.
- run: npm ci                 # working-directory: client
- run: npm ci                 # working-directory: web
- run: npm run build          # working-directory: web  (env: VITE_OPERATOR)
```

### CD (`deploy.yml`) — push to `main` + manual dispatch

```yaml
jobs:
  deploy-contract:   # opt-in (needs SANCTUM_SECRET, skips otherwise)
    - cargo build --target wasm32v1-none --release -p sanctum-verifier -p sanctum-pool
    - stellar contract deploy sanctum_pool.wasm  (reuses existing verifier + native token)
    - stellar contract invoke ... init
    - commit the new pool address back into config.js + deployments (with [skip ci])

  deploy-operator:   # needs [deploy-contract]
    - POST https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys   (Render redeploy)

  deploy-frontend:   # needs [deploy-contract, deploy-operator]
    - npx vercel deploy --prod --token $VERCEL_TOKEN -b VITE_OPERATOR=<operator url>
```

Every CD job **skips gracefully** when its secrets are unset (logs a `::warning::`, exits 0), so a missing secret never fails the pipeline. Unlike an env-var-driven app, the operator/frontend read contract IDs from committed `config.js`, so `deploy-contract` rewrites and commits those files instead of pushing env vars downstream.

### Keepalive (`keepalive.yml`) — every ~10 min

```yaml
on:
  schedule:
    - cron: "*/10 * * * *"
# curl the operator's GET / health endpoint so Render's free tier never
# fully sleeps (≈15 min idle window) between visitors.
```

---

## 15. Event Streaming Architecture

### On-Chain Events

| Contract | Topic | Data | When |
|---|---|---|---|
| SanctumPool | `Symbol("deposit")` | `(index) → commitment` | Deposit accepted |
| SanctumPool | `Symbol("root")` | `root` | State root posted |
| SanctumPool | `Symbol("asproot")` | `asp_root` | ASP root posted |
| SanctumPool | `Symbol("withdraw")` | `nullifier_hash` | Withdrawal settled |

### Frontend Reads (via `simulateTransaction`)

The dApp derives live state by simulating read views rather than submitting transactions:

```js
// Pool view — total deposits from the on-chain commitment list
const commits = await getCommitments(CONFIG.pool);   // pool.commitments()
countUp($("s-deposits"), commits.length);

// Withdraw witness — the operator serves the ASP Merkle path
GET  {VITE_OPERATOR}/asp-path?label=<label>          // { aspRoot, aspPathElements, aspPathIndices }

// Root freshness before a withdrawal
pool.is_known_root(root)  ·  pool.is_known_asp_root(asp_root)  ·  pool.is_spent(nullifier_hash)
```

### Operator Root Sequencing

On `POST /approve` the operator rebuilds both depth-20 Merkle trees from on-chain commitments and the approved-label set, then signs `update_root` / `update_asp_root` with the admin key. State advances off-chain and is anchored on-chain by the admin sequencer (see §16 for the trust note).

---

## 16. Security Model

### What is enforced on-chain / in-circuit

| Claim | Where | Mechanism |
|---|---|---|
| Withdrawal is authorized by a valid proof | `verifier::verify` | BN254 `pairing_check` over the installed VK |
| Note is in the state tree | `withdraw.circom` | Poseidon Merkle membership under `root` |
| Deposit is compliance-approved | `withdraw.circom` | Poseidon Merkle membership under `aspRoot` |
| No double-spend | `pool::withdraw` | Nullifier set marks `nullifier_hash` spent |
| Payout can't be redirected | `pool::withdraw` | `recipient_field` derived on-chain must match the proof |
| VK can't be swapped for a forging key | `verifier::set_vk` | `admin.require_auth()` |
| Pool can't be hijacked at init | `pool::init` | `admin.require_auth()` |

### What the operator / admin cannot do

- Forge a withdrawal proof (verification is on-chain, VK is admin-locked)
- Redirect a withdrawal (recipient is bound into the proof)
- Spend a note (the note secret never leaves the user's browser)
- Double-spend (nullifier set is persistent)

### Known limitations (verifiable, disclosed)

- **ASP screening is mocked** — the operator auto-approves every label; only the decision source is stubbed, not the enforcement.
- **State/ASP roots are admin-posted** ("sequencer") rather than recomputed on-chain. Anyone can re-derive and check them; on-chain Poseidon root computation is future work.
- **Single asset, single fixed denomination** (0.1 XLM), single trusted ASP authority, **Testnet only**, **unaudited**.
- No automated test suite (see §13).

---

## 17. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `circom` errors on `withdraw.circom` | Old `circom` 0.5.x on PATH | Install circom 2.x and use `~/.cargo/bin/circom` |
| `[sync-circuits] missing …` warning | Circuit not built | Run `scripts/build_circuit.sh withdraw` before `web` dev/build |
| Vercel build: `Rollup failed to resolve @noble/...` | client deps not installed | `web/vercel.json` installs `../client` deps — keep Root Directory = `web` |
| Withdraw → `UnknownRoot` / `UnknownAspRoot` | Roots not posted for this deposit | Start the operator and `POST /approve` (or run `scripts/e2e.sh`) |
| Withdraw → `InvalidProof` on-chain but OK off-chain | G2 byte order | Ensure imaginary-first `be(c1)‖be(c0)` encoding (§3) |
| Withdraw → `NullifierAlreadySpent` | Note already withdrawn | Each note is single-use by design |
| Operator exits immediately | No admin key | Set `SANCTUM_SECRET` or ensure `stellar keys show sanctum` works |
| Browser can't reach the ASP | Wrong endpoint / CORS | Set `VITE_OPERATOR`; set operator `ALLOW_ORIGIN` |
| First request to operator is slow | Render free-tier cold start | The `keepalive` workflow keeps it warm; first hit after idle takes ~30s |

---

## 18. Screenshots

### App — Desktop

> Deposit / Withdraw / Pool / Auditor / Wallet terminal at the Vercel deployment.

<!-- SCREENSHOT: drag-and-drop the desktop image into the GitHub editor and paste its asset URL into src="" -->
<img width="2880" alt="Sanctum Pool — desktop" src="" />

### Mobile Responsive UI

> Header wraps to brand + wallet over a scrollable tab row; panels collapse to a single column.

<div align="center">
  <!-- SCREENSHOT: drag-and-drop the mobile image here and paste its asset URL into src="" -->
  <img width="280" alt="Sanctum Pool — mobile responsive" src="" />
</div>

### CI/CD Pipeline Running

> GitHub Actions — CI (contracts + frontend + operator) and CD (contract → Render → Vercel) all green.

<!-- SCREENSHOT: drag-and-drop the Actions run image here and paste its asset URL into src="" -->
<img width="2857" alt="Sanctum Pool — CI/CD pipeline" src="" />

---

## 19. Git History

Meaningful commits with a logical development progression:

| # | Commit | Description |
|---|---|---|
| 1 | `chore: root cargo + npm workspace manifests` | Project scaffold |
| 2 | `feat(circuits): merkle inclusion template` | Poseidon Merkle proof template |
| 3 | `feat(circuits): withdraw groth16 circuit` | Dual-membership + nullifier + recipient circuit |
| 4 | `chore(circuits): commit production proving/verifying keys` | Trusted-setup keys committed |
| 5 | `feat(contracts): groth16 bn254 verifier contract` | On-chain `pairing_check` verifier |
| 6 | `feat(contracts): privacy pool contract` | Deposits, roots, nullifiers, custody |
| 7 | `feat(tools): circom2soroban byte serializer` | snarkjs JSON → BN254 bytes |
| 8 | `feat(client): note commitment + address derivation` | Note scheme + recipient field |
| 9 | `feat(client): view keys and auditor reveal` | X25519 + XChaCha20 selective disclosure |
| 10 | `feat(operator): ASP root sequencer service` | Admin-key HTTP operator |
| 11 | `feat(web): deposit/withdraw/pool/auditor app` | Vite dApp + in-browser proving |
| 12 | `chore(deployments): testnet contract addresses` | First live deployment |
| 13 | `feat(web): Freighter wallet panel (detect/connect/balance/send)` | Wallet view |
| 14 | `chore(deployments): redeploy pool with new admin, update contract id` | Pool redeploy |
| 15 | `fix(web): install client deps on Vercel so shared modules resolve` | Vercel build fix |
| 16 | `style(web): make the app and landing mobile responsive` | Mobile layout |
| 17 | `ci: add CI + CD + keepalive workflows (modeled on aether)` | GitHub Actions pipeline |

---

## 20. User Feedback Implementation

Each row maps a specific request/issue raised while building and shipping the app to the fix delivered for it.

| # | Feedback | Implementation | Commit |
|---|---|---|---|
| 1 | Wallet balance is visible in Freighter, but there's no way to detect/connect Freighter and send XLM from inside the app with a confirmed tx hash. | Added `lib/stellar-wallet.js` (Freighter detect/connect/sign), `lib/stellar-sdk.js` (Horizon balance + build/submit payment), an observable `wallet-store.js`, and a self-contained `wallet-panel.js` (`/#wallet`) with loading states and a stellar.expert tx-hash banner. | [`3717a24`](https://github.com/soumilibasak567/sanctum-pool/commit/3717a24) |
| 2 | The pool needed to be re-owned by a fresh admin account and reflected everywhere. | Redeployed the pool on testnet with the new admin, then updated `web/src/config.js`, `operator/config.js`, `deployments/`, and README to the new address. | [`cb0aff1`](https://github.com/soumilibasak567/sanctum-pool/commit/cb0aff1) |
| 3 | The Vercel build failed with `Rollup failed to resolve "@noble/hashes/sha2.js"` — the frontend imports shared crypto from `../../client/src`, whose deps are never installed when Root Directory is `web`. | Added `web/vercel.json` with an install command that also installs the `client` package's deps, so the shared modules resolve on Vercel exactly as they do locally. | [`a21f6ad`](https://github.com/soumilibasak567/sanctum-pool/commit/a21f6ad) |
| 4 | The frontend was unusable on a phone — the header (brand + five tabs + wallet) overflowed and panels were cramped. | Header wraps into two rows with a horizontally scrollable tab strip; tiles/forms collapse to one column; toasts span the viewport; the landing grids reflow. Verified at 375px with zero horizontal overflow. | [`65d6e40`](https://github.com/soumilibasak567/sanctum-pool/commit/65d6e40) |
| 5 | The project had no CI/CD — contract build, frontend, operator, and deploys were all manual. | Added CI (contracts + frontend + operator), CD (contract → Render → Vercel with graceful skips), and a keepalive workflow to beat Render cold starts. | [`3b3d013`](https://github.com/soumilibasak567/sanctum-pool/commit/3b3d013) |

---

## License

MIT — see [`LICENSE`](LICENSE). Portions of the Groth16 verifier and the snarkjs→Soroban converter are adapted from [CircomStellar](https://github.com/jamesbachini/CircomStellar) (MIT); design references include the Privacy Pools whitepaper, 0xbow privacy-pools-core, Nethermind's stellar-private-payments, and Railgun/Zcash viewing keys. See [`NOTICE`](NOTICE).

---

<div align="center">
  <sub>Built on Stellar Soroban · Groth16 over native BN254 · Private, compliant, auditable settlement</sub>
</div>
