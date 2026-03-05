# Vaultcare OS Docs — Index (Start Here)

> Canonical docs entrypoint (human + system friendly).  
> Naming: **English + kebab-case**. Vault root must contain **directories only**.

---

## 0) 30-second orientation

- **Where to start (always):**
  - Current state: `docs/status/current-status.md`
  - Handover (single file): `docs/handover.md`
  - Process registry: `docs/process-registry.md`
- **Governance (new):**
  - SSOT map: `docs/governance/ssot-map.md`
  - Governance completion snapshot: `docs/governance/governance-completion-snapshot-2026-03-05.md`
  - Cross-IDE executor v1: `docs/governance/cross-ide-executor-v1.md`
  - Weekly governance cadence: `docs/governance/weekly-30min-governance-template.md`
  - First-week review template: `docs/governance/first-week-review-template.md`
  - First-week baseline (v1): `docs/governance/first-week-review-2026-W10-v1.md`
  - Templates: `docs/templates/brief-template.md`, `docs/templates/decision-record-template.md`, `docs/templates/deprecation-template.md`
- **Truth sources (do not duplicate status elsewhere):**
  - Process truth (business-flow-function mapping): `docs/process-registry.md`
  - System functional truth table: `docs/quality/system-functional-matrix.md`
  - Product module spec: `docs/modules/products/spec.md`
  - Business + architecture overview: `docs/context/overview.md`
- **Temporary files (gitignored):**
  - Put any throwaway references/screenshots/dumps under: `tmp/`

---

## 1) Repo map (what lives where)

### Code
- Backend (Django/DRF): `backend/`
- Frontend (React/Vite): `frontend/`

### Docs (keep stable docs small)
- Status: `docs/status/`
- Context (merged): `docs/context/`
- Modules (by business name): `docs/modules/`
- Quality (tests/matrix): `docs/quality/`
- Flywheel (metrics/reports/index): `docs/flywheel/`
- Roundtable knowledge base: `docs/roundtable/`
- Reference (accounts/dev): `docs/reference/`
- Plans: `docs/plans/`
  - Unified development backlog: `docs/plans/development-backlog.md`

### Scripts
- Dev helpers: `scripts/dev/`

### Temp (NOT in git)
- Scratch space: `tmp/`

---

## 2) New session SOP (for an AI agent or a new human)

1. Read `docs/status/current-status.md`
2. Read `docs/handover.md`
3. Read `docs/process-registry.md` for flow mapping
4. For module work, jump to `docs/modules/<module>/index.md`

---

## 3) Roundtable knowledge base (experts + sessions + consensus)

> `docs/roundtable/` 为全局智库的 Junction，与工作区根 `docs/roundtable/` 共享内容。

- **Experts (virtual expert cards):** `docs/roundtable/experts/`
- **Session notes:** `docs/roundtable/sessions/`
- **Cross-session consensus:** `docs/roundtable/consensus.md`
- **意图指南（新会话必读）:** `docs/roundtable/INTENTS-GUIDE.md`
- **飞轮索引（指标/周报入口）:** `docs/flywheel/index.md`

Rule: session notes are a **memory pool**; only `consensus.md` is allowed to state “final decisions”.

