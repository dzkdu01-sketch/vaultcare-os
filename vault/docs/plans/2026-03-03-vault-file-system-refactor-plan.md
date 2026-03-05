# Vault File System Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor `d:/cursor/vault` into a module-oriented, kebab-case, root-zero-files structure with fewer docs, a single clear entrypoint, a minimal handover set, a gitignored temporary area, and a roundtable knowledge base.

**Architecture:** Keep code layout (`backend/`, `frontend/`) intact. Restructure documentation into `docs/` subfolders (status/context/modules/roundtable/reference/quality/plans) with a single entry `docs/index.md` and a single handover `docs/handover.md`. Ensure `vault/` root contains directories only. Add directory-scoped `.gitignore` files (no root `.gitignore`) and add a gitignored `tmp/` area.

**Tech Stack:** Markdown docs, PowerShell filesystem ops, Cursor refactoring via global search/replace.

---

### Task 1: Create target directories (no root files)

**Files:**
- Create: `d:/cursor/vault/docs/status/`
- Create: `d:/cursor/vault/docs/context/`
- Create: `d:/cursor/vault/docs/modules/products/`
- Create: `d:/cursor/vault/docs/roundtable/experts/`
- Create: `d:/cursor/vault/docs/roundtable/sessions/`
- Create: `d:/cursor/vault/docs/reference/`
- Create: `d:/cursor/vault/docs/quality/`
- Create: `d:/cursor/vault/scripts/dev/`
- Create: `d:/cursor/vault/tmp/`

**Step 1:** Create directories with `New-Item -ItemType Directory -Force`.

---

### Task 2: Build the minimal doc set (reduce docs count)

**Files:**
- Create: `d:/cursor/vault/docs/index.md`
- Create: `d:/cursor/vault/docs/handover.md`
- Create: `d:/cursor/vault/docs/context/overview.md` (merge business + consensus)
- Move/Rename:
  - `d:/cursor/vault/docs/CURRENT_STATUS.md` → `d:/cursor/vault/docs/status/current-status.md`
  - `d:/cursor/vault/docs/pim-module-spec.md` → `d:/cursor/vault/docs/modules/products/spec.md`
  - `d:/cursor/vault/docs/system-functional-matrix.md` → `d:/cursor/vault/docs/quality/system-functional-matrix.md`
  - `d:/cursor/vault/docs/accounts.md` → `d:/cursor/vault/docs/reference/accounts.md`
  - `d:/cursor/vault/docs/02-development.md` → `d:/cursor/vault/docs/reference/development.md`
  - `d:/cursor/vault/docs/product-order-brainstorming.md` → `d:/cursor/vault/docs/roundtable/sessions/2026-03-03-product-order-brainstorming.md`
  - `d:/cursor/vault/docs/roundtables/2026-03-03-roundtable-2.md` → `d:/cursor/vault/docs/roundtable/sessions/2026-03-03-roundtable-2.md`
- Merge and delete sources:
  - `d:/cursor/vault/docs/04-handover-products-redesign.md` + `d:/cursor/vault/docs/05-handover-bugfix.md` → `d:/cursor/vault/docs/handover.md`, then delete the two sources
  - `d:/cursor/vault/docs/04-context-management.md` + `d:/cursor/vault/docs/06-ai-collaboration-flywheel.md` → incorporate key SOP into `docs/index.md`, then delete the two sources
  - `d:/cursor/vault/01_vaultcare_business_context.md` + `d:/cursor/vault/02_vaultcare_consensus_solutions.md` → `docs/context/overview.md`, then delete the two sources

---

### Task 3: Move root scripts into `scripts/` and enforce root-zero-files

**Files:**
- Move/Rename: `d:/cursor/vault/一键启动.bat` → `d:/cursor/vault/scripts/dev/start-all.bat`
- Move/Rename: `d:/cursor/vault/backend/generate_seed.bat` → `d:/cursor/vault/scripts/dev/generate-seed.bat` (optionally keep a wrapper in backend if needed)

**Step 1:** Update script internal paths if they assume old locations.
**Step 2:** Verify `d:/cursor/vault` root contains no files.

---

### Task 4: Add directory-scoped `.gitignore` files (no root `.gitignore`)

**Files:**
- Create: `d:/cursor/vault/backend/.gitignore`
- Create: `d:/cursor/vault/frontend/.gitignore`
- Create: `d:/cursor/vault/.cursor/.gitignore`
- Create: `d:/cursor/vault/tmp/.gitignore`

**Contents (high-level):**
- backend: `venv/`, `__pycache__/`, `*.pyc`, `.pytest_cache/`, `db.sqlite3`
- frontend: `node_modules/`, `dist/`, `.vite/`
- .cursor: `debug.log`
- tmp: ignore everything except `.gitignore` itself

---

### Task 5: Update all references and eliminate dead links

**Files:**
- Modify: all `*.md` under `d:/cursor/vault/docs/` and root moved docs as needed

**Step 1:** Global search for old paths/names and replace with new ones.
**Step 2:** Verify no references remain to deleted/moved files (grep).

---

### Task 6: Cleanup generated artifacts that should not be committed

**Step 1:** Delete `d:/cursor/vault/.cursor/debug.log` if present.
**Step 2:** Optionally remove `__pycache__` and `*.pyc` under `backend/` (safe).
**Step 3:** Do NOT delete `venv/` or `node_modules/` automatically unless requested.

---

### Task 7: Verification

**Step 1:** Confirm `d:/cursor/vault` root has directories only.
**Step 2:** Confirm docs entrypoint `docs/index.md` links to the new canonical documents.
**Step 3:** Confirm `docs/handover.md` and `docs/status/current-status.md` exist and are linked.

