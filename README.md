# QuantaGuard — PQ-Ready Smart Accounts & QUBO Useful-Work Board for QMS

**QMS Builder Program — Cohort I application prototype.**
A working, deployed prototype on **QMS Testnet (chainId 19480)**, not a slide deck:
three contracts live on-chain, 10 passing Foundry tests, three live demo transactions, and a no-build web UI.

> **One-liner:** QuantaGuard gives QMS users a smart-account wallet that is ready for the
> post-quantum era *today* — guardian recovery anchored to a PQ key commitment, bounded
> session keys for AI agents, and a job board that turns QUBO optimisation problems
> (the useful work QMS is built around) into a payable on-chain market.

---

## The problem

1. **Wallets are the weakest link in a post-quantum chain.** QMS is building PQ finality and
   PQ accounts, but users onboarding *today* still use plain ECDSA EOAs: lose the key, lose
   everything; no recovery, no delegation, no spending policy.
2. **AI agents need wallets, but not *your* wallet.** An autonomous agent needs a key that can
   spend a little, only at approved contracts, only until Tuesday — not the master key.
3. **Useful work needs an application layer.** QUBO solvers (portfolio optimisation, logistics,
   scheduling) need a place where a client can lock a reward, post a problem, and pay the best
   solution — the demand side of a PoUW ecosystem.

QuantaGuard addresses all three in one account system on QMS.

## Why QMS only

| QMS property | How QuantaGuard uses it |
|---|---|
| **PoUW / QUBO demand** | `QUBOJobBoard` is a native market for QUBO jobs — the workload QMS validators/solvers exist to serve. On EVM-generic chains this is an orphan feature; on QMS it is the ecosystem's core demand loop. |
| **PQ roadmap (accounts in v1)** | Guardian identity is anchored to an ML-DSA / SLH-DSA public-key **hash commitment** with a pluggable `IPQVerifier` interface — the exact seam where QMS v1 PQ accounts plug in. |
| **PQ finality (v1)** | Recovery uses a conservative timelock + confirmations today, designed to tighten once finality guarantees land. |
| **EVM compatibility today** | Solidity / Foundry work unmodified on QMS v0.1 — so the product ships now and deepens with each QMS release instead of waiting for them. |

This does not make sense to deploy on Ethereum or a generic L2: the QUBO board's solvers and the
PQ verifier are QMS-native roadmap items.

## Honest staging — what works today vs. what plugs in later

**Live on QMS v0.1 testnet today (verified below):**
- ECDSA-owned smart accounts via a CREATE2 factory (counterfactual addresses)
- Guardian recovery: registry-linked guardian proposes a new owner; it executes after a
  configurable delay (default 48 h) unless the owner cancels
- AI-agent session keys with on-chain policy: expiry + cumulative spend limit + optional
  single allowed target; revocable by the owner
- QUBO job board: lock reward → submit solution hash + objective score → lowest score wins
  and is paid; cancel-with-refund before any submission; reentrancy-guarded settlement
- PQ guardian **commitments** anchored on-chain (`keccak256` of an ML-DSA/SLH-DSA public key)

**Integration points, deliberately not faked:**
- **PQ signatures are NOT live on QMS v0.1.** Guardians act via ECDSA today; the commitment is
  the anchor. When QMS ships PQ accounts, a concrete ML-DSA verifier implements `IPQVerifier`
  and guardians prove control of the committed PQ key. No code in this repo claims otherwise.
- **QUBO scores are claimed, not verified on-chain (v0.1).** `QUBOJobBoard.settle` trusts the
  best claimed score. The v2 integration point is a verifier / PoUW hook that checks a solution
  against the problem instance before payment — the board's interface already isolates that step.
- **No finality layer yet** → the UI and docs rely on confirmations, and recovery delays are
  sized conservatively. No blob transactions are used (unsupported on this testnet).

## Architecture

```
                        ┌────────────────────────────┐
                        │     PQGuardianRegistry     │
                        │ account → {pqCommitment,   │
                        │  guardian (ECDSA today),   │
                        │  active} + IPQVerifier (v1)│
                        └─────────────▲──────────────┘
                                      │ isGuardian()
┌──────────────┐  CREATE2   ┌─────────┴──────────────┐        ┌────────────────────┐
│ QuantaGuard  │──────────▶ │   QuantaGuardAccount   │        │    QUBOJobBoard    │
│   Factory    │  predictable│  owner (ECDSA)         │        │ postJob (lock QMS) │
└──────────────┘  address    │  execute()             │        │ submitSolution     │
                             │  session keys: expiry, │        │ settle → best      │
                             │   spendLimit, target   │        │  (lowest) solver   │
                             │  recovery: propose →   │        │ cancel → refund    │
                             │   48h delay → execute  │        └────────────────────┘
                             └────────────────────────┘
        Users / AI agents ────┘            QMS Testnet · chainId 19480 · Prague EVM
```

**Contracts**
- `src/PQGuardianRegistry.sol` — PQ guardian commitments per account; register / update / revoke.
- `src/QuantaGuardAccount.sol` — the smart account: owner execution, policy-bound session keys,
  timelocked guardian recovery.
- `src/QuantaGuardFactory.sol` — CREATE2 factory; `getAddress(owner, salt)` predicts the account.
- `src/QUBOJobBoard.sol` — the useful-work job market described above.

## Live deployment — QMS Testnet

RPC `https://rpc.testnet.qms.finance` · Explorer https://testnet.qmsscan.io · Deployer `0x2CB42Ea495979426C9BaeD1Ddac15c62715b8E75`
Machine-readable copy: [`deployments/qms-testnet.json`](deployments/qms-testnet.json).
All addresses verified by `eth_getCode` via RPC (non-empty runtime code, sizes in the JSON).

| Contract | Address | Deploy tx |
|---|---|---|
| PQGuardianRegistry | [0x3F7548239BF586094E236357dFd41BFcB45a2480](https://testnet.qmsscan.io/address/0x3F7548239BF586094E236357dFd41BFcB45a2480) | [0xac70a6…ddd28](https://testnet.qmsscan.io/tx/0xac70a6e5336b00b429b0195145bd33c41818ce972d684e7312d92b4be11ddd28) |
| QuantaGuardFactory | [0x82AECF6465D12b5Fe56A4063ccBA0A6c1112d5e5](https://testnet.qmsscan.io/address/0x82AECF6465D12b5Fe56A4063ccBA0A6c1112d5e5) | [0x65c84f…ed11e](https://testnet.qmsscan.io/tx/0x65c84fbbbeebb95fc017e8ec0f74e2e2fea5cc2403f74d11c6d6765a5dfed11e) |
| QUBOJobBoard | [0xe6DbA5D0b3504Fc9c94CA4bB3d60Fe03c0F71C77](https://testnet.qmsscan.io/address/0xe6DbA5D0b3504Fc9c94CA4bB3d60Fe03c0F71C77) | [0xb2af48…aa34e](https://testnet.qmsscan.io/tx/0xb2af487a95150bf97060737cefe5ce0f983f780f3d808326dba466e4f61aa34e) |

**Live demo transactions (from the deployer):**

| # | Action | Result | Tx |
|---|---|---|---|
| 1 | Create account via factory (salt `0x…01`) | Account [0xf14E3681b156dB426c05bC0168d39E753Ee1eBDD](https://testnet.qmsscan.io/address/0xf14E3681b156dB426c05bC0168d39E753Ee1eBDD) — exactly the CREATE2-predicted address | [0xb907ed…961b](https://testnet.qmsscan.io/tx/0xb907eda9c270a045491307aedac5325d5889f7ba731b1c28ce944c1a2f00961b) |
| 2 | Register PQ guardian commitment via the account | `guardianOf(account)` reads back guardian + commitment `0x3a4a8d…5193`, active = true | [0xadacd6…fbf](https://testnet.qmsscan.io/tx/0xadacd6025e0cae4fac47e16c198dcb61913479903116e8e9e41613b3039d1fbf) |
| 3 | Post QUBO job, 0.1 QMS locked | Job **#1**, board balance 0.1 QMS, deadline 2026-11-23 17:14 UTC | [0x6f2b27…9da5f](https://testnet.qmsscan.io/tx/0x6f2b27fbd1f88a42c7dc7cefd239ea8c1a724621854b7240e5ec730a3389da5f) |

Demo PQ commitment preimage (a placeholder, **not** a real PQ key):
`keccak256("QuantaGuard DEMO ML-DSA-65 public key placeholder - NOT a real PQ key - QMS Builder Cohort I")`
= `0x3a4a8d1b8440e784f52a0aa64908483e8cc6bae4025f48871f805339dbc95193`

> ⚠️ The current QMS testnet resets around early December (per the Builder Program notes):
> these addresses live on the pre-reset testnet and will be redeployed after the reset —
> `script/Deploy.s.sol` makes that a one-command job.

## Worked example — a 4-asset portfolio QUBO

Demo job #1 posts the hash of this instance (preimage string is in `deployments/qms-testnet.json`):

- Assets `[BTC, ETH, QMS, USDC]`, choose `x ∈ {0,1}⁴` with `Σx = 2` (pick exactly 2).
- Minimise `f(x) = −returnᵀx + 0.5 · xᵀ Cov x + λ(Σx − 2)²`, `λ = 0.5`.
- QUBO matrix `Q` (upper form used for scoring):

```
Q = [[-0.12,  0.02,  0.01,  0.00],
     [ 0.02, -0.18,  0.03,  0.00],
     [ 0.01,  0.03, -0.25,  0.01],
     [ 0.00,  0.00,  0.01, -0.02]]
```

- Problem hash: `keccak256(canonical instance string)` = `0x8484cf0eaeacb90944700075542cade1dff63328c51a49401681340a85c82f5b`
- A solver evaluates candidate selections off-chain (e.g. `x = [0,1,1,0]` → ETH+QMS),
  submits `keccak256(solution)` + its objective score; the **lowest** score wins the 0.1 QMS.

## Run it

```bash
export PATH=$HOME/.foundry/bin:$PATH   # forge/cast
forge install   # forge-std
forge test      # 10 tests — see below
forge script script/Deploy.s.sol:Deploy --rpc-url https://rpc.testnet.qms.finance --broadcast --private-key "$PK"
```

Open `web/index.html` in any browser (no build step): connect a wallet, add QMS Testnet
(chainId 19480, one click), create an account, register a guardian, post a job.

**Tests (all passing):** factory creates account at the predicted CREATE2 address · owner
execute · session key within limit works · over-limit reverts · target restriction + revocation ·
full guardian recovery flow (propose → too-early revert → warp 48 h → owner rotates) ·
owner-cancel recovery · registry register/revoke · job post/submit/settle pays only the best
solver · cancel refunds the poster.

## 90-day roadmap

- **Days 0–30 — Harden the account.** ERC-4337 `validateUserOp` adapter + bundler/paymaster
  integration on QMS testnet; multi-guardian (2-of-n) recovery; session-key policies extended
  with per-target value caps and method allowlists; redeploy after the December testnet reset.
- **Days 31–60 — Real solvers, real verification.** Reference QUBO solver (simulated annealing)
  + off-chain objective recomputation service; dispute window on `QUBOJobBoard` so a claimed
  score can be challenged before settlement; portfolio/logistics problem templates.
- **Days 61–90 — v1 readiness.** ML-DSA verifier implementation behind `IPQVerifier` the moment
  QMS v1 PQ account specs are available (test vectors first, mainnet claims never before the
  chain supports them); security review of the account + board; public demo: an AI agent with a
  session key autonomously bidding on and solving QUBO jobs within its on-chain budget.

## Team / applicant

Built and deployed by **andi_phy** — solo builder, Indonesia.
Production bot/automation work across EVM and Solana ecosystems (live trading/competition
bots, wallet infrastructure, testnet automation on 15+ networks) and smart-contract security
research. Contact: `mardotillah.088@gmail.com` · X: [@andi_phy](https://x.com/andi_phy) ·
Discord: `7capital` ·
Deployer wallet: `0x2CB42Ea495979426C9BaeD1Ddac15c62715b8E75`.

*Testnet only. No real funds. PQ signature support is a roadmap integration point, as documented above — nothing in this repository claims it is live today.*
