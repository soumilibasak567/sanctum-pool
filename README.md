<div align="center">

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

## Live Links

| Surface | URL / Status |
|---|---|
| **Verifier contract (Stellar Expert)** | https://stellar.expert/explorer/testnet/contract/CAHBSVRPU4QRWPAUERYHEVOLL376Y7V4HPMQ6XNYF527ZLQD2NTEGNUZ |
| **Pool contract (Stellar Expert)** | https://stellar.expert/explorer/testnet/contract/CCDQ2BSPSUH7P2J7PK2E7Z6XLVFVTXYZVIPBUS42U22WMD2NMM7MUJCP |
| **Frontend (web dApp)** | Runs locally via `npm run dev` — *no public deployment configured* |
| **Operator / ASP API** | Runs locally on `http://localhost:8787` — *no public deployment configured* |
| **Demo video** | *Not available* |

> The smart contracts are **live on Stellar Testnet** (addresses in §10, verified transactions in §11). The web dApp and the operator/ASP service are run locally — this repository ships **no hosting, deployment, or CI/CD configuration**.

---

## Table of Contents

1. [What This Is](#1-what-this-is)
2. [The RWA Problem & Solution](#2-the-rwa-problem--solution)
3. [Architecture](#3-architecture)
4. [Component Responsibilities](#4-component-responsibilities)
5. [Project Structure](#5-project-structure)
6. [Asset Lifecycle & Ownership Model](#6-asset-lifecycle--ownership-model)
7. [Zero-Knowledge Layer](#7-zero-knowledge-layer)
8. [Smart Contracts](#8-smart-contracts)
9. [Contract Deployment Addresses](#9-contract-deployment-addresses)
10. [Verified On-Chain Transactions](#10-verified-on-chain-transactions)
11. [Frontend](#11-frontend)
12. [Operator & ASP Service](#12-operator--asp-service)
13. [Technology Stack](#13-technology-stack)
14. [Installation](#14-installation)
15. [Environment Variables](#15-environment-variables)
16. [Smart Contract Deployment Guide](#16-smart-contract-deployment-guide)
17. [Testing](#17-testing)
18. [CI/CD Pipeline](#18-cicd-pipeline)
19. [Security Model](#19-security-model)
20. [Troubleshooting](#20-troubleshooting)
21. [Screenshots](#21-screenshots)
22. [Roadmap](#22-roadmap)

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

Pure mixers get sanctioned because a criminal's tainted funds are indistinguishable from an honest user's. Fully transparent chains offer zero financial privacy — a large transfer is visible forever. Sanctum Pool fills the gap: **private, compliant, and auditable settlement**.

---

## 2. The RWA Problem & Solution

**The problem.** Moving real-world value on a public chain — payroll, supplier payments, treasury operations, settlement between institutions — exposes counterparties, amounts, and timing to everyone, permanently. That transparency is a dealbreaker for real money movement. Plain privacy tools solve confidentiality but remove the compliance controls regulated entities require, so they get banned.

**The solution.** Sanctum Pool settles a real on-chain asset (a fixed denomination of a Stellar token) while keeping the **link between payer and payee private**, and simultaneously enforces **compliance membership** and **selective auditability**:

| Requirement for real-world value transfer | How Sanctum Pool satisfies it |
|---|---|
| Confidentiality of counterparties/linkage | Deposit → withdraw are unlinkable across the anonymity set |
| Compliance gating (no tainted funds) | Withdrawal requires ASP-approved membership, proven in-circuit |
| Auditability on demand | View-key selective disclosure of exactly one transaction |
| Self-custody | Ownership is a client-side secret note; no custodian holds funds |
| On-chain settlement finality | Funds custodied and released by the Soroban pool contract |

> **Scope note (verifiable):** the settlement asset in this deployment is the **native XLM SAC** at a single fixed denomination (0.1 XLM). Multi-asset support, variable amounts, and tokenized-RWA instruments are **not implemented** — see §22 Roadmap. This README does not claim otherwise.

---

## 3. Architecture

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
│               OPERATOR / ASP SERVICE (Node HTTP :8787)           │
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

---

## 4. Component Responsibilities

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

---

## 5. Project Structure

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
├── operator/                        # Off-chain operator (admin key holder)
│   ├── operator.mjs                 # HTTP service: /approve, /asp-path
│   ├── soroban.js  merkle.js        # Tx builders + Merkle helpers
│   ├── poseidon.js  config.js       # Poseidon + deployed contract config
│   └── package.json
│
├── web/                             # Vite browser dApp
│   ├── index.html  vite.config.js
│   ├── src/app.js                   # dApp controller (Deposit/Withdraw/Pool/Auditor)
│   ├── src/home.js  icons.js  styles.css
│   ├── src/config.js                # Deployed contract IDs + pool params
│   ├── src/lib/                     # prove.js, soroban.js, toSoroban.js, wallet.js, notes.js
│   ├── src/polyfills.js
│   └── scripts/                     # sync-circuits.mjs, operator.mjs
│
├── scripts/                         # build_circuit.sh, setup_circuit.sh, e2e.sh
├── deployments/                     # verifier_testnet.txt, pool_testnet.txt (deployed IDs)
├── Cargo.toml  Cargo.lock           # Rust workspace
├── LICENSE  NOTICE                  # MIT + third-party attribution
└── README.md                        # This file
```

---

## 6. Asset Lifecycle & Ownership Model

Ownership of pooled value is represented by a **secret note** held client-side — the note is the *only* way to withdraw. There is no account, no custodian, and no server-side copy.

```
DEPOSIT ──▶ APPROVE ──▶ WITHDRAW ──▶ AUDIT (on demand)
```

1. **Deposit.** The user creates a note locally and posts only its commitment. The pool contract pulls one denomination via `token::transfer` and stores the commitment plus the view-key-encrypted note (`deposit(from, commitment, enc_note)`).
2. **Approve.** The ASP screens the deposit's label, adds it to the approved set, and the operator posts the new state root and ASP root (`update_root`, `update_asp_root`).
3. **Withdraw.** In the browser, the user proves — without revealing which deposit is theirs — that the commitment is in the state root, the label is in the ASP root, the nullifier is fresh, and the recipient is bound. Funds move to a fresh address (`withdraw(...)`).
4. **Audit.** Given one disclosure key, an auditor pulls the encrypted note from chain (`get_enc_note`), decrypts exactly that transaction, and checks it recomputes the on-chain commitment — learning nothing else.

### Note scheme (fixed denomination)

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

---

## 7. Zero-Knowledge Layer

### Circuit

One Groth16 circuit (Circom 2.0.0, BN254 curve), Merkle depth **20**:

| Circuit | Purpose | Constraints* |
|---|---|---|
| `withdraw` | Proves state-tree membership **and** ASP-set membership of the note, derives a fresh `nullifierHash`, and binds `recipient` | ~22,855 non-linear+linear |

\* From `snarkjs r1cs info` on the compiled circuit: 213 template instances, 10,807 non-linear + 12,048 linear constraints (22,855 total), 5 public inputs + 1 public output, 83 private inputs.

The withdrawal proves, in one proof, revealing nothing about which deposit or which approved label is yours:

1. **State membership** — the commitment is a leaf under `root`.
2. **Compliance membership** — the `label` is a leaf under `aspRoot`.
3. **No double-spend** — a correctly derived `nullifierHash` is revealed.
4. **Recipient binding** — `recipient` is constrained into the proof (anti-front-running).

If a deposit is **not** in the approved set, the circuit cannot produce a satisfying witness — non-approved funds provably cannot withdraw. (Verified: a "denied" witness fails to generate; see §17.)

### On-chain public-signal reconstruction

`SanctumPool::withdraw` never trusts caller-supplied signals for the sensitive fields. It reconstructs them and passes them to the verifier:

```
signals = [ nullifier_hash, root, asp_root,
            recipient_field,          // derived ON-CHAIN from `recipient`
            cfg.denom_field,          // fixed denomination
            cfg.scope ]               // pool/asset domain separator
```

`recipient_field` is `SHA-256(strkey)` truncated to the top 31 bytes (a value `< 2^248 < p`). The client derives the identical field, so a mempool front-runner who swaps the payout address produces a different field and the proof no longer verifies.

### BN254 wire encoding (Stellar-specific)

`tools/circom2soroban` (and its JS port `web/src/lib/toSoroban.js`) serialize snarkjs output into the byte layout the `bn254` host functions expect:

| Type | Format | Size |
|---|---|---|
| G1 point | `be(x) ‖ be(y)` | 64 bytes |
| G2 point | Fp2 coordinates **imaginary-part first** (`be(c1) ‖ be(c0)`, EIP-197) | 128 bytes |
| Fr scalar | `be(scalar)` | 32 bytes |

**Verifying-key bytes** (`set_vk`): `alpha(G1) ‖ beta(G2) ‖ gamma(G2) ‖ delta(G2) ‖ be_u32(ic_len) ‖ ic[](G1)`.
**Proof bytes:** `a(G1) ‖ b(G2) ‖ c(G1)`.
**Public-signal bytes:** `be_u32(len) ‖ be32(sig₀) ‖ be32(sig₁) ‖ …`.

> snarkjs emits G2 as `[c0, c1]`; the converter swaps to `c1, c0`. Getting this wrong makes every pairing fail silently.

### Groth16 verification equation

```
e(−A, B) · e(alpha, beta) · e(vk_x, gamma) · e(C, delta) == 1

where  vk_x = IC[0] + Σᵢ sigᵢ · IC[i+1]
```

Implemented in `contracts/verifier/src/lib.rs` with `bn.g1_mul`, `bn.g1_add`, and `bn.pairing_check` over the four `vp1`/`vp2` point pairs.

### Trusted setup

The repository ships committed, matching keys in `circuits/keys/`. To regenerate your own (BN254 / bn128, `POWER=15` because the circuit has ~22.8k constraints):

```bash
scripts/build_circuit.sh withdraw          # compile → r1cs + wasm witness generator
POWER=15 scripts/setup_circuit.sh withdraw # powersoftau + groth16 setup + export vk
cp circuits/build/withdraw_final.zkey   circuits/keys/withdraw_final.zkey
cp circuits/build/verification_key.json circuits/keys/withdraw_vk.json
```

---

## 8. Smart Contracts

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

## 9. Contract Deployment Addresses

**Network:** Stellar Testnet · **Deployed:** 2026-07-19

| Contract | Address |
|---|---|
| **Verifier** (Groth16 / BN254) | `CAHBSVRPU4QRWPAUERYHEVOLL376Y7V4HPMQ6XNYF527ZLQD2NTEGNUZ` |
| **Pool** | `CCDQ2BSPSUH7P2J7PK2E7Z6XLVFVTXYZVIPBUS42U22WMD2NMM7MUJCP` |

**Supporting addresses:**

| | Address |
|---|---|
| Token — native XLM SAC (testnet) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |
| Admin / deployer | `GBV5U2ZAQX7Y6WYHRARGPGMU42GQESRAAJIC56ZBEBCHRRAQENVXXUVQ` |

Contract IDs are wired into `web/src/config.js`, `operator/config.js`, and recorded in [`deployments/`](deployments/). Pool parameters: `denom_amount = 1_000_000` stroops (**0.1 XLM**), `denom_field = 1_000_000`, `scope = 1`.

> [View pool on Stellar Expert →](https://stellar.expert/explorer/testnet/contract/CCDQ2BSPSUH7P2J7PK2E7Z6XLVFVTXYZVIPBUS42U22WMD2NMM7MUJCP)

---

## 10. Verified On-Chain Transactions

All transactions below were submitted by this repository's deploy + end-to-end run against the addresses in §9 (Stellar Testnet).

### Deployment & initialization

| Step | Transaction Hash |
|---|---|
| Verifier `init` | `fcb3b650364a0e8b602f61943891317e7f97c5248be6765714ed8be862bc4adb` |
| Verifier `set_vk` | `41b1214c7ce09c40628cb7feb0dcf205c5aa15bf36e5fc901cb01277d17b4c25` |
| Pool `init` | `572b0829f648d57cd82abef5ffe556bc2faab710cd01c5e73611f939f189ba23` |

### Full E2E: deposit → approve → withdraw

| Step | Transaction Hash | Effect |
|---|---|---|
| `deposit` | `776234aef496d4b2c05ae2eb14c1b729c19352f4b410067faa5802c6cb8a2c26` | 0.1 XLM → pool; commitment + enc-note stored |
| `update_root` | `0f2d6d013494f321eb5a3ec77904babfb0db1f374b4603c8e0c24dd515586c3d` | state root posted |
| `update_asp_root` | `73b6f27e62efbddfff7855bc2b179427854fc141d3af1822cb947ad24687fb24` | ASP root posted |
| **`withdraw`** | `dee4f00b789780804aed6448e15206434b034388b8df9eb0d6d51d33a7dd6335` | **on-chain proof verified; 0.1 XLM → fresh recipient** |

The `deposit` and `withdraw` transactions emit `transfer` events on the native SAC (`GBV5U2ZA… → pool` on deposit, `pool → GAOOFLJP…` on withdraw), confirming custody and payout.

### Enforcement observed live

| Check | Result |
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

## 11. Frontend

**Stack:** Vite · vanilla JavaScript (no framework) · Stellar Wallets Kit v2.5 (Freighter) · `@stellar/stellar-sdk` v16 · snarkjs (in-browser Groth16) · GSAP + Lenis (landing motion).

### Views

| View | Description |
|---|---|
| `home` | Landing page: what the pool does, how it works, ZK proof band, CTA |
| `deposit` | Create a note, back it up, sign the deposit; auto-notifies the ASP |
| `withdraw` | Generate the ZK proof **in-browser**, then sign the withdrawal |
| `pool` | Pool & compliance status (total deposits, roots) |
| `auditor` | Selective disclosure: decrypt one note and verify it against chain |

### Layout

```
┌──────────────────────────────────────────────────┐
│  Header  (brand · wallet connect / address)       │
├──────────────────────────────────────────────────┤
│  Nav tabs:  Deposit · Withdraw · Pool · Auditor    │
├──────────────────────────────────────────────────┤
│  Active view                                       │
│   Deposit  → note backup + sign                    │
│   Withdraw → proof-step progress + sign            │
│   Pool     → deposits / roots status               │
│   Auditor  → disclosure-key reveal + verification   │
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

The ASP operator endpoint defaults to `http://localhost:8787` and is overridable at build time with `VITE_OPERATOR` (`web/src/app.js`).

Circuit artifacts (`withdraw.wasm`, `withdraw_final.zkey`, `withdraw_vk.json`) are copied into `web/public/circuits/` automatically before `dev`/`build` by `web/scripts/sync-circuits.mjs`.

---

## 12. Operator & ASP Service

Two off-chain, admin-side pieces keep the admin key off the browser and maintain the association set.

### Operator HTTP API (`operator/operator.mjs`)

Node's built-in `http` server (no framework, no database; the approved-label set is kept **in memory** on purpose, so run one persistent process).

| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Service status: `{ service, admin, approved }` |
| `POST` | `/approve` | Body `{ label }` → posts state root + approves label + posts ASP root → `{ ok, stateRoot, aspRoot }` |
| `GET` | `/asp-path?label=` | Returns `{ aspRoot, aspPathElements, aspPathIndices }` for the browser's withdraw witness |

It signs `update_root` / `update_asp_root` with the admin key and derives both Merkle trees (depth 20) from on-chain commitments and the approved-label set.

> **Compliance screening is mocked:** the demo operator **auto-approves every label**. The enforcement mechanism (in-circuit ASP membership) is real; only the approve/deny *decision source* is stubbed.

### ASP curator CLI (`asp-service/curator.js`)

Maintains the approved-label set (`asp-service/approved.json`) and computes its Merkle root — used by `scripts/e2e.sh` (`node asp-service/curator.js approve <label>`).

---

## 13. Technology Stack

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
| Wallet | Stellar Wallets Kit v2.5 (Freighter) |
| Client SDK | `@stellar/stellar-sdk` v16 |
| Client crypto | `@noble/curves`, `@noble/ciphers`, `@noble/hashes`, `circomlibjs` (X25519 + XChaCha20 view keys) |
| Operator / ASP | Node.js ≥ 18 (built-in `http`; no database) |
| CLI tooling | Bash scripts, Stellar CLI |
| Package manager | npm (per-package; no workspaces) |
| Hosting / CI | **None configured** (run locally) |

---

## 14. Installation

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
git clone <your-fork-url> sanctum-pool
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

### Run the dApp locally

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

## 15. Environment Variables

This repository ships **no `.env` / `.env.example` files** and no secrets are committed. Configuration is via a small set of process/env variables and the checked-in `config.js` contract IDs.

### Operator (`operator/operator.mjs`)

```env
SANCTUM_SECRET=S...        # admin secret key — NEVER commit; falls back to `stellar keys show sanctum`
PORT=8787                  # host-provided port (default 8787)
ALLOW_ORIGIN=*             # optional comma-separated CORS allowlist (default "*")
```

### Web dApp (build-time, `web/`)

```env
VITE_OPERATOR=http://localhost:8787   # ASP operator endpoint (defaults to localhost)
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

> **Never expose the admin secret key.** `SANCTUM_SECRET` and any `stellar keys ... --secret` output must stay out of the repo, the browser, and logs.

---

## 16. Smart Contract Deployment Guide

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

Copy the new `verifier` / `pool` IDs into `web/src/config.js` and `operator/config.js`.

### One-command end-to-end

`scripts/e2e.sh` performs steps 3–4 **and** the full flow (approved deposit → withdrawal → auditor disclosure → denied deposit), writing the new IDs to `deployments/`. It requires a funded identity named `sanctum` and the compiled circuit build.

### Gotchas

| Issue | Fix |
|---|---|
| `circom` compiles nothing / syntax errors | An old `circom` 0.5.x shadows 2.x on PATH — use `~/.cargo/bin/circom` or reorder PATH |
| `set_vk` fails to parse | The converter expects the committed `withdraw_vk.json`; VK bytes are **hex** |
| Proof verifies off-chain but not on-chain | G2 must be imaginary-part-first (`be(c1)‖be(c0)`) — see §7 |
| `UnknownRoot` / `UnknownAspRoot` on withdraw | Post `update_root` / `update_asp_root` first (operator `POST /approve`) |

---

## 17. Testing

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

## 18. CI/CD Pipeline

> **Verifiable state:** this repository ships **no CI/CD configuration** — there is no `.github/workflows/` directory and no hosting/deploy config (Vercel, Netlify, Railway, Render, etc.). Building, testing, and deployment are performed manually with the commands in §14–§17.

If you want continuous integration, a minimal pipeline would run:

```
cargo build --target wasm32v1-none --release      # contracts
cargo build -p circom2soroban --release           # tool
scripts/build_circuit.sh withdraw                 # circuit
(cd web && npm ci && npm run build)               # frontend build
scripts/e2e.sh                                     # on-chain integration (needs a funded key)
```

Continuous deployment is intentionally **not** included — the project is designed to be cloned and run locally, and any deploy step would require the admin secret, which must never live in CI without a securely-scoped secret store.

---

## 19. Security Model

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
- No automated test suite or CI (see §17–§18).

---

## 20. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `circom` errors on `withdraw.circom` | Old `circom` 0.5.x on PATH | Install circom 2.x and use `~/.cargo/bin/circom` |
| `[sync-circuits] missing …` warning | Circuit not built | Run `scripts/build_circuit.sh withdraw` before `web` dev/build |
| Withdraw → `UnknownRoot` / `UnknownAspRoot` | Roots not posted for this deposit | Start the operator and `POST /approve` (or run `scripts/e2e.sh`) |
| Withdraw → `InvalidProof` on-chain but OK off-chain | G2 byte order | Ensure imaginary-first `be(c1)‖be(c0)` encoding (§7) |
| Withdraw → `NullifierAlreadySpent` | Note already withdrawn | Each note is single-use by design |
| Operator exits immediately | No admin key | Set `SANCTUM_SECRET` or ensure `stellar keys show sanctum` works |
| Browser can't reach the ASP | Wrong endpoint / CORS | Set `VITE_OPERATOR`; set operator `ALLOW_ORIGIN` |
| `label not approved` from `/asp-path` | Label not yet approved | Call `POST /approve` for that label first |

---

## 21. Screenshots

> **Not yet captured.** No screenshots or demo recording are included in this repository. Run the dApp locally (§14) to view the Deposit / Withdraw / Pool / Auditor terminal. This section is a placeholder to be filled once captures are available — no third-party images are used.

---

## 22. Roadmap

- Compute the state-tree root **on-chain** with the native Poseidon host function (fully trustless tree — removes the admin sequencer).
- Decentralize the ASP and integrate a real screening/AML decision source in place of the mocked auto-approve.
- **Multi-asset and variable amounts** (JoinSplit/UTXO-style notes) — toward general tokenized-RWA settlement.
- Automated test suite (Rust contract tests + JS unit tests) and optional CI.
- Third-party security audit before any non-testnet use.

---

## License

MIT — see [`LICENSE`](LICENSE). Portions of the Groth16 verifier and the snarkjs→Soroban converter are adapted from [CircomStellar](https://github.com/jamesbachini/CircomStellar) (MIT); design references include the Privacy Pools whitepaper, 0xbow privacy-pools-core, Nethermind's stellar-private-payments, and Railgun/Zcash viewing keys. See [`NOTICE`](NOTICE).

---

<div align="center">
  <sub>Built on Stellar Soroban · Groth16 over native BN254 · Private, compliant, auditable settlement</sub>
</div>
