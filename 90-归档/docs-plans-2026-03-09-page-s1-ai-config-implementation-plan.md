# Page S1 AI Configuration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the first deliverable code for Vaultcare OS: a complete S1 “AI 服务配置” page with provider management, model management, task routing, and audit log.

**Architecture:** Because the current repository is still documentation-only, implement S1 as the first vertical slice of the system: create the backend Django + DRF project, create the frontend React + Vite project, then build the S1 page against real backend APIs. Keep the design simple and aligned to the approved page design and design system; avoid generic abstractions until a second page proves they are needed.

**Tech Stack:** Django 5.x, Django REST Framework, PostgreSQL, React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, Lucide React, pytest / pytest-django, Vitest, React Testing Library

---

## 0. Reference Documents

Read these before implementing:

- `docs/plans/2026-03-09-page-s1-ai-config-design.md`
- `20-方案设计/05-页面字段字典.md` (S1 fields)
- `20-方案设计/06-API草图.md` (S1 API section)
- `20-方案设计/design-system/MASTER.md`

Important design constraints from the approved design:

- Single-page vertical layout with 3 sections
- Provider cards grid + “Add provider” placeholder card
- Right-side drawer for create/edit provider
- Fixed 5-row route table: `translate`, `optimize`, `normalize`, `ocr`, `image_enhance`
- Read-only audit log table with pagination
- Use Violet primary + Slate neutral system from `20-方案设计/design-system/MASTER.md:32`

Important business/API constraints:

- All AI calls route through backend `AiService` abstraction `20-方案设计/06-API草图.md:105`
- S1 endpoints live under `/api/v1/system/...`
- Route config allows partial configuration; not all 5 rows are mandatory

---

### Task 1: Create backend project skeleton

**Files:**
- Create: `backend/manage.py`
- Create: `backend/requirements.txt`
- Create: `backend/pyproject.toml`
- Create: `backend/config/__init__.py`
- Create: `backend/config/settings.py`
- Create: `backend/config/urls.py`
- Create: `backend/config/wsgi.py`
- Create: `backend/config/asgi.py`
- Create: `backend/apps/system/__init__.py`
- Create: `backend/apps/system/apps.py`
- Create: `backend/apps/system/migrations/__init__.py`
- Create: `backend/tests/__init__.py`

**Step 1: Write the failing setup test**

Create `backend/tests/test_django_boot.py`:

```python
from django.conf import settings


def test_django_settings_load():
    assert settings.ROOT_URLCONF == "config.urls"
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_django_boot.py -v`
Expected: FAIL because Django project files do not exist yet.

**Step 3: Write minimal backend skeleton**

Create a minimal Django project with:

- `INSTALLED_APPS` including `rest_framework` and `apps.system`
- SQLite is acceptable for first boot if PostgreSQL is not wired yet, but structure settings so DB can switch to PostgreSQL cleanly
- `BASE_DIR / "db.sqlite3"` for initial local boot
- URL conf that includes `api/v1/system/`

**Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_django_boot.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/manage.py backend/requirements.txt backend/pyproject.toml backend/config backend/apps/system backend/tests/test_django_boot.py
git commit -m "chore: bootstrap backend project"
```

---

### Task 2: Create frontend project skeleton

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/App.test.tsx`

**Step 1: Write the failing frontend test**

Create `frontend/src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import App from './App'

it('renders app shell', () => {
  render(<App />)
  expect(screen.getByText(/vaultcare/i)).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- --runInBand`
Expected: FAIL because the Vite app and test setup do not exist yet.

**Step 3: Write minimal frontend skeleton**

Create a minimal React + TypeScript + Vite app with:

- Tailwind CSS imported in `src/index.css`
- Testing setup using Vitest + React Testing Library
- `App.tsx` rendering a placeholder shell containing “Vaultcare”

**Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html frontend/src
 git commit -m "chore: bootstrap frontend project"
```

---

### Task 3: Define backend data models for S1

**Files:**
- Create: `backend/apps/system/models.py`
- Create: `backend/apps/system/admin.py`
- Create: `backend/apps/system/tests/test_models.py`
- Create: `backend/apps/system/migrations/0001_initial.py`

**Step 1: Write the failing model tests**

Create `backend/apps/system/tests/test_models.py` with tests for:

```python
import pytest
from apps.system.models import AIProvider, AIModel, AITaskRoute, AIConfigAuditLog


@pytest.mark.django_db
def test_create_provider_defaults_to_unchecked_status():
    provider = AIProvider.objects.create(
        name="Moonshot",
        api_mode="openai_compatible",
        api_key_encrypted="enc-value",
        api_host="https://api.moonshot.cn",
        api_path="/chat/completions",
    )
    assert provider.connection_status == "unchecked"


@pytest.mark.django_db
def test_route_task_type_is_unique():
    AITaskRoute.objects.create(task_type="translate")
    with pytest.raises(Exception):
        AITaskRoute.objects.create(task_type="translate")
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/apps/system/tests/test_models.py -v`
Expected: FAIL because models do not exist.

**Step 3: Write minimal models**

Implement these models:

1. `AIProvider`
   - `id`
   - `name`
   - `api_mode` (`openai_compatible`, `custom`)
   - `api_key_encrypted`
   - `api_host`
   - `api_path`
   - `connection_status` (`connected`, `failed`, `unchecked`)
   - `last_checked_at`
   - `created_at`
   - `updated_at`

2. `AIModel`
   - `id`
   - `provider` FK
   - `name`
   - unique constraint on `(provider, name)`
   - `created_at`

3. `AITaskRoute`
   - `id`
   - `task_type` unique, choices: `translate`, `optimize`, `normalize`, `ocr`, `image_enhance`
   - `provider` FK nullable
   - `model` FK nullable
   - `updated_at`

4. `AIConfigAuditLog`
   - `id`
   - `operator_name`
   - `action_type`
   - `change_summary`
   - `created_at`

Do not over-model users or organizations yet.

**Step 4: Run tests and migrations**

Run:
- `python backend/manage.py makemigrations system`
- `python backend/manage.py migrate`
- `pytest backend/apps/system/tests/test_models.py -v`

Expected: migrations apply cleanly, tests PASS.

**Step 5: Commit**

```bash
git add backend/apps/system/models.py backend/apps/system/admin.py backend/apps/system/migrations backend/apps/system/tests/test_models.py
git commit -m "feat: add ai config data models"
```

---

### Task 4: Add serializer and API tests for provider CRUD

**Files:**
- Create: `backend/apps/system/serializers.py`
- Create: `backend/apps/system/views/providers.py`
- Create: `backend/apps/system/tests/test_provider_api.py`
- Modify: `backend/config/urls.py`

**Step 1: Write the failing API tests**

Create `backend/apps/system/tests/test_provider_api.py`:

```python
import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_create_provider_returns_201():
    client = APIClient()
    response = client.post('/api/v1/system/ai-providers', {
        'name': 'Moonshot',
        'api_mode': 'openai_compatible',
        'api_key': 'sk-test-1234',
        'api_host': 'https://api.moonshot.cn',
        'api_path': '/chat/completions',
    }, format='json')
    assert response.status_code == 201
    assert response.json()['data']['name'] == 'Moonshot'
```

Also add tests for:
- provider list returns array
- provider update returns 200
- provider detail returns masked API key preview, never raw key
- invalid URL returns 400

**Step 2: Run test to verify it fails**

Run: `pytest backend/apps/system/tests/test_provider_api.py -v`
Expected: FAIL because serializers/views/routes do not exist.

**Step 3: Write minimal implementation**

Implement:

- `AIProviderWriteSerializer` accepting raw `api_key`
- `AIProviderReadSerializer` returning masked preview field such as `sk-****1234`
- URL routes:
  - `GET /api/v1/system/ai-providers`
  - `POST /api/v1/system/ai-providers`
  - `GET /api/v1/system/ai-providers/<id>`
  - `PUT /api/v1/system/ai-providers/<id>`
  - `DELETE /api/v1/system/ai-providers/<id>`
- encrypt/mask boundary can be simple for first slice: store raw key through Django signer or a dedicated placeholder encryption helper, but keep the model field name `api_key_encrypted`

**Step 4: Run tests to verify they pass**

Run: `pytest backend/apps/system/tests/test_provider_api.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/apps/system/serializers.py backend/apps/system/views/providers.py backend/apps/system/tests/test_provider_api.py backend/config/urls.py
 git commit -m "feat: add ai provider crud api"
```

---

### Task 5: Add backend model APIs and deletion guards

**Files:**
- Create: `backend/apps/system/views/models.py`
- Create: `backend/apps/system/tests/test_model_api.py`
- Modify: `backend/apps/system/serializers.py`
- Modify: `backend/config/urls.py`

**Step 1: Write the failing tests**

Create tests for:

- `GET /api/v1/system/ai-providers/{id}/models` returns provider models
- `POST /api/v1/system/ai-providers/{id}/models` adds a manual model
- `DELETE /api/v1/system/ai-providers/{id}/models/{model_id}` deletes a model when unused
- deleting a model used by a route returns `409`

Example test:

```python
@pytest.mark.django_db
def test_delete_model_in_use_returns_409(provider, model, route_client):
    response = route_client.delete(f'/api/v1/system/ai-providers/{provider.id}/models/{model.id}')
    assert response.status_code == 409
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/apps/system/tests/test_model_api.py -v`
Expected: FAIL

**Step 3: Write minimal implementation**

Implement model CRUD nested under provider.

Deletion rule:
- If any `AITaskRoute.model_id == model.id`, reject with 409 and message like `当前模型已被任务路由引用，不能删除`

**Step 4: Run tests**

Run: `pytest backend/apps/system/tests/test_model_api.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/apps/system/views/models.py backend/apps/system/tests/test_model_api.py backend/apps/system/serializers.py backend/config/urls.py
git commit -m "feat: add ai model management api"
```

---

### Task 6: Add backend task route APIs

**Files:**
- Create: `backend/apps/system/views/routes.py`
- Create: `backend/apps/system/tests/test_task_route_api.py`
- Modify: `backend/config/urls.py`
- Modify: `backend/apps/system/serializers.py`

**Step 1: Write the failing tests**

Create tests for:
- GET route list returns the 5 fixed task types
- PUT batch update changes provider/model for selected tasks only
- route can remain partially unconfigured
- assigning a model from a different provider returns 400

Example:

```python
@pytest.mark.django_db
def test_get_task_routes_returns_fixed_rows(client):
    response = client.get('/api/v1/system/ai-task-routes')
    data = response.json()['data']
    assert [row['task_type'] for row in data] == [
        'translate', 'optimize', 'normalize', 'ocr', 'image_enhance'
    ]
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/apps/system/tests/test_task_route_api.py -v`
Expected: FAIL

**Step 3: Write minimal implementation**

Implement:

- `GET /api/v1/system/ai-task-routes`
  - auto-seed missing rows for the 5 task types
- `PUT /api/v1/system/ai-task-routes`
  - request body shape:

```json
{
  "routes": [
    {
      "task_type": "translate",
      "provider_id": 1,
      "model_id": 2
    }
  ]
}
```

Validation rules:
- `provider_id` and `model_id` can both be null
- if `model_id` provided, it must belong to `provider_id`

**Step 4: Run tests**

Run: `pytest backend/apps/system/tests/test_task_route_api.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/apps/system/views/routes.py backend/apps/system/tests/test_task_route_api.py backend/apps/system/serializers.py backend/config/urls.py
git commit -m "feat: add ai task route api"
```

---

### Task 7: Add audit log writing and query API

**Files:**
- Create: `backend/apps/system/audit.py`
- Create: `backend/apps/system/views/audit_log.py`
- Create: `backend/apps/system/tests/test_audit_log_api.py`
- Modify: `backend/apps/system/views/providers.py`
- Modify: `backend/apps/system/views/models.py`
- Modify: `backend/apps/system/views/routes.py`
- Modify: `backend/config/urls.py`

**Step 1: Write the failing tests**

Create tests for:
- creating provider writes audit log
- updating route writes audit log
- GET `/api/v1/system/ai-config/audit-log?page=1&page_size=10` returns paginated rows sorted newest first

Example:

```python
@pytest.mark.django_db
def test_provider_create_writes_audit_log(client):
    client.post('/api/v1/system/ai-providers', {...}, format='json')
    response = client.get('/api/v1/system/ai-config/audit-log?page=1&page_size=10')
    assert response.status_code == 200
    assert response.json()['data']['results'][0]['action_type'] == 'add_provider'
```

**Step 2: Run test to verify it fails**

Run: `pytest backend/apps/system/tests/test_audit_log_api.py -v`
Expected: FAIL

**Step 3: Write minimal implementation**

Implement a tiny audit helper:

```python
def write_ai_audit_log(*, operator_name: str, action_type: str, change_summary: str) -> None:
    ...
```

Log these actions at minimum:
- `add_provider`
- `update_provider`
- `delete_provider`
- `add_model`
- `delete_model`
- `update_route`
- `check_connection`
- `fetch_models`

Keep `operator_name` simple for now, e.g. `system` or a placeholder from request header.

**Step 4: Run tests**

Run: `pytest backend/apps/system/tests/test_audit_log_api.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/apps/system/audit.py backend/apps/system/views/audit_log.py backend/apps/system/tests/test_audit_log_api.py backend/apps/system/views/providers.py backend/apps/system/views/models.py backend/apps/system/views/routes.py backend/config/urls.py
git commit -m "feat: add ai config audit log api"
```

---

### Task 8: Add backend provider actions for connection check and fetch models

**Files:**
- Create: `backend/apps/system/services/ai_client.py`
- Create: `backend/apps/system/tests/test_provider_actions_api.py`
- Modify: `backend/apps/system/views/providers.py`
- Modify: `backend/config/urls.py`

**Step 1: Write the failing tests**

Mock the external AI provider calls and test:
- `POST /api/v1/system/ai-providers/{id}/check` returns success and marks provider connected
- failed check marks provider failed
- `POST /api/v1/system/ai-providers/{id}/fetch-models` creates new models and returns created list

**Step 2: Run test to verify it fails**

Run: `pytest backend/apps/system/tests/test_provider_actions_api.py -v`
Expected: FAIL

**Step 3: Write minimal implementation**

Create a minimal service class:

```python
class AiProviderClient:
    def check_connection(self, provider: AIProvider) -> tuple[bool, str | None]:
        ...

    def fetch_models(self, provider: AIProvider) -> list[str]:
        ...
```

Implementation notes:
- For `openai_compatible`, perform a simple test request or models-list request
- For first slice, keep the HTTP integration thin and mock it in tests
- Do not let the view call `requests` directly; keep that inside the service

**Step 4: Run tests**

Run: `pytest backend/apps/system/tests/test_provider_actions_api.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/apps/system/services/ai_client.py backend/apps/system/tests/test_provider_actions_api.py backend/apps/system/views/providers.py backend/config/urls.py
git commit -m "feat: add ai provider actions api"
```

---

### Task 9: Create frontend app shell and route for S1 page

**Files:**
- Create: `frontend/src/app/router.tsx`
- Create: `frontend/src/layouts/app-shell.tsx`
- Create: `frontend/src/features/system/pages/ai-config-page.tsx`
- Create: `frontend/src/features/system/pages/ai-config-page.test.tsx`
- Modify: `frontend/src/App.tsx`

**Step 1: Write the failing page-shell test**

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from '@/App'

it('renders AI config page entry from shell', () => {
  render(
    <MemoryRouter initialEntries={['/system/ai-config']}>
      <App />
    </MemoryRouter>
  )
  expect(screen.getByRole('heading', { name: 'AI 服务配置' })).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- ai-config-page.test.tsx --run`
Expected: FAIL

**Step 3: Write minimal implementation**

Implement:
- left sidebar shell with active nav item “AI 服务配置”
- page title “AI 服务配置”
- route `/system/ai-config`

Do not build the content sections yet.

**Step 4: Run test**

Run: `npm --prefix frontend test -- ai-config-page.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/app/router.tsx frontend/src/layouts/app-shell.tsx frontend/src/features/system/pages/ai-config-page.tsx frontend/src/features/system/pages/ai-config-page.test.tsx
git commit -m "feat: add ai config page shell"
```

---

### Task 10: Build frontend API client and shared S1 types

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/features/system/api/ai-config.ts`
- Create: `frontend/src/features/system/types.ts`
- Create: `frontend/src/features/system/api/ai-config.test.ts`

**Step 1: Write the failing client tests**

Test that the client functions call the expected endpoints:
- `listProviders()` → `/api/v1/system/ai-providers`
- `saveRoutes()` → `/api/v1/system/ai-task-routes`
- `getAuditLog({ page, pageSize })` → `/api/v1/system/ai-config/audit-log?page=...`

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- ai-config.test.ts --run`
Expected: FAIL

**Step 3: Write minimal implementation**

Implement typed API helpers for:
- providers list/create/update/delete/check/fetch-models
- model list/create/delete
- routes get/update
- audit log get

Keep fetch wrapper small and local. Do not introduce React Query yet unless a second page needs it.

**Step 4: Run test**

Run: `npm --prefix frontend test -- ai-config.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/features/system/api/ai-config.ts frontend/src/features/system/types.ts frontend/src/features/system/api/ai-config.test.ts
git commit -m "feat: add ai config frontend api client"
```

---

### Task 11: Implement provider cards section

**Files:**
- Create: `frontend/src/features/system/components/provider-card.tsx`
- Create: `frontend/src/features/system/components/provider-grid.tsx`
- Create: `frontend/src/features/system/components/provider-grid.test.tsx`
- Modify: `frontend/src/features/system/pages/ai-config-page.tsx`

**Step 1: Write the failing UI test**

Test that:
- provider cards render name, host, status, model count
- an “+ 添加供应商” card is always visible
- connected/failed/unchecked text is visible

Example:

```tsx
it('renders provider cards and add card', () => {
  render(<ProviderGrid providers={[...]}/>)
  expect(screen.getByText('Moonshot')).toBeInTheDocument()
  expect(screen.getByText('已连通')).toBeInTheDocument()
  expect(screen.getByText('添加供应商')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- provider-grid.test.tsx --run`
Expected: FAIL

**Step 3: Write minimal implementation**

Implement UI matching `docs/plans/2026-03-09-page-s1-ai-config-design.md:43`:
- responsive grid
- provider card hover state
- badge for API mode
- status dot + text
- model count and last checked text
- add-card with dashed border

**Step 4: Run test**

Run: `npm --prefix frontend test -- provider-grid.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/features/system/components/provider-card.tsx frontend/src/features/system/components/provider-grid.tsx frontend/src/features/system/components/provider-grid.test.tsx frontend/src/features/system/pages/ai-config-page.tsx
git commit -m "feat: add ai provider cards section"
```

---

### Task 12: Implement provider drawer form

**Files:**
- Create: `frontend/src/features/system/components/provider-drawer.tsx`
- Create: `frontend/src/features/system/components/provider-form.tsx`
- Create: `frontend/src/features/system/components/provider-drawer.test.tsx`
- Modify: `frontend/src/features/system/pages/ai-config-page.tsx`

**Step 1: Write the failing UI tests**

Test:
- clicking add card opens drawer
- required fields render
- openai-compatible mode auto-fills `/chat/completions`
- save button disabled while request pending
- API key visibility toggle works

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- provider-drawer.test.tsx --run`
Expected: FAIL

**Step 3: Write minimal implementation**

Implement:
- right-side drawer width `w-[500px]`
- fields: name, api_mode, api_key, api_host, api_path
- inline model list area
- buttons: 检查连接 / 获取模型列表 / 删除供应商 / 保存
- ESC and overlay close support

Use accessible labels and visible validation errors.

**Step 4: Run tests**

Run: `npm --prefix frontend test -- provider-drawer.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/features/system/components/provider-drawer.tsx frontend/src/features/system/components/provider-form.tsx frontend/src/features/system/components/provider-drawer.test.tsx frontend/src/features/system/pages/ai-config-page.tsx
git commit -m "feat: add ai provider drawer form"
```

---

### Task 13: Implement provider actions in the drawer

**Files:**
- Create: `frontend/src/features/system/components/model-list.tsx`
- Create: `frontend/src/features/system/components/provider-actions.test.tsx`
- Modify: `frontend/src/features/system/components/provider-drawer.tsx`
- Modify: `frontend/src/features/system/api/ai-config.ts`

**Step 1: Write the failing tests**

Test:
- check connection button calls API and updates status text
- fetch models populates model list
- manual add model adds row
- deleting in-use model surfaces backend error message

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- provider-actions.test.tsx --run`
Expected: FAIL

**Step 3: Write minimal implementation**

Implement:
- loading states for action buttons
- model list with delete action per row
- inline add-model input and confirm button
- success/error toast integration

**Step 4: Run tests**

Run: `npm --prefix frontend test -- provider-actions.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/features/system/components/model-list.tsx frontend/src/features/system/components/provider-actions.test.tsx frontend/src/features/system/components/provider-drawer.tsx frontend/src/features/system/api/ai-config.ts
git commit -m "feat: add ai provider action workflows"
```

---

### Task 14: Implement task route table

**Files:**
- Create: `frontend/src/features/system/components/task-route-table.tsx`
- Create: `frontend/src/features/system/components/task-route-table.test.tsx`
- Modify: `frontend/src/features/system/pages/ai-config-page.tsx`

**Step 1: Write the failing UI tests**

Test:
- page shows 5 fixed task rows in correct order
- selecting provider filters model options
- status badge changes to 已配置 / 未配置 / 供应商不可用
- save button sends only changed rows

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- task-route-table.test.tsx --run`
Expected: FAIL

**Step 3: Write minimal implementation**

Implement table matching `docs/plans/2026-03-09-page-s1-ai-config-design.md:140`:
- fixed rows
- provider select
- dependent model select
- route status badge
- bottom save button
- local diffing before submit

**Step 4: Run tests**

Run: `npm --prefix frontend test -- task-route-table.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/features/system/components/task-route-table.tsx frontend/src/features/system/components/task-route-table.test.tsx frontend/src/features/system/pages/ai-config-page.tsx
git commit -m "feat: add ai task route table"
```

---

### Task 15: Implement audit log table

**Files:**
- Create: `frontend/src/features/system/components/audit-log-table.tsx`
- Create: `frontend/src/features/system/components/audit-log-table.test.tsx`
- Modify: `frontend/src/features/system/pages/ai-config-page.tsx`

**Step 1: Write the failing UI tests**

Test:
- audit log renders columns: 操作时间 / 操作人 / 操作类型 / 变更内容
- empty state renders when no records exist
- pagination controls change page

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- audit-log-table.test.tsx --run`
Expected: FAIL

**Step 3: Write minimal implementation**

Implement read-only paginated table with:
- newest-first rows
- empty state
- simple previous/next or numeric pagination

**Step 4: Run tests**

Run: `npm --prefix frontend test -- audit-log-table.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/features/system/components/audit-log-table.tsx frontend/src/features/system/components/audit-log-table.test.tsx frontend/src/features/system/pages/ai-config-page.tsx
git commit -m "feat: add ai config audit log table"
```

---

### Task 16: Wire page-level data loading and mutations

**Files:**
- Create: `frontend/src/features/system/hooks/use-ai-config-page.ts`
- Create: `frontend/src/features/system/hooks/use-ai-config-page.test.ts`
- Modify: `frontend/src/features/system/pages/ai-config-page.tsx`
- Modify: `frontend/src/features/system/components/provider-drawer.tsx`
- Modify: `frontend/src/features/system/components/task-route-table.tsx`
- Modify: `frontend/src/features/system/components/audit-log-table.tsx`

**Step 1: Write the failing integration-style tests**

Test:
- page loads providers, routes, and audit log on mount
- saving provider refreshes provider grid and audit log
- saving routes refreshes audit log
- error state renders user-visible message

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- use-ai-config-page.test.ts --run`
Expected: FAIL

**Step 3: Write minimal implementation**

Implement a page-level hook or controller that:
- fetches providers, routes, audit log
- stores selected provider and drawer state
- refreshes relevant sections after mutation
- avoids introducing global store

**Step 4: Run tests**

Run: `npm --prefix frontend test -- use-ai-config-page.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/features/system/hooks/use-ai-config-page.ts frontend/src/features/system/hooks/use-ai-config-page.test.ts frontend/src/features/system/pages/ai-config-page.tsx frontend/src/features/system/components/provider-drawer.tsx frontend/src/features/system/components/task-route-table.tsx frontend/src/features/system/components/audit-log-table.tsx
git commit -m "feat: wire ai config page data flows"
```

---

### Task 17: Add loading, empty, and error states aligned with design system

**Files:**
- Create: `frontend/src/components/ui/empty-state.tsx`
- Create: `frontend/src/components/ui/skeleton-card.tsx`
- Create: `frontend/src/features/system/pages/ai-config-states.test.tsx`
- Modify: `frontend/src/features/system/pages/ai-config-page.tsx`
- Modify: `frontend/src/features/system/components/provider-grid.tsx`
- Modify: `frontend/src/features/system/components/audit-log-table.tsx`

**Step 1: Write the failing UI-state tests**

Test:
- loading state shows skeletons, not spinners, for section loading
- audit log empty state renders text
- route/API action errors show visible message

**Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- ai-config-states.test.tsx --run`
Expected: FAIL

**Step 3: Write minimal implementation**

Follow `20-方案设计/design-system/MASTER.md:346`:
- use skeletons for data loading
- keep spinners only inside action buttons
- show clear empty states
- keep color + text for status, never color only

**Step 4: Run tests**

Run: `npm --prefix frontend test -- ai-config-states.test.tsx --run`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/ui/empty-state.tsx frontend/src/components/ui/skeleton-card.tsx frontend/src/features/system/pages/ai-config-states.test.tsx frontend/src/features/system/pages/ai-config-page.tsx frontend/src/features/system/components/provider-grid.tsx frontend/src/features/system/components/audit-log-table.tsx
git commit -m "feat: add ai config loading and empty states"
```

---

### Task 18: Add backend/frontend end-to-end smoke verification

**Files:**
- Create: `backend/apps/system/tests/test_s1_smoke.py`
- Create: `frontend/src/features/system/pages/ai-config-smoke.test.tsx`
- Create: `docs/plans/2026-03-09-page-s1-test-checklist.md`

**Step 1: Write the failing smoke tests**

Backend smoke should cover:
- create provider
- fetch models
- assign route
- audit log row appears

Frontend smoke should cover:
- page renders all 3 sections
- add-card opens drawer
- route table has 5 rows
- audit log headers render

**Step 2: Run tests to verify they fail**

Run:
- `pytest backend/apps/system/tests/test_s1_smoke.py -v`
- `npm --prefix frontend test -- ai-config-smoke.test.tsx --run`

Expected: initial FAIL if smoke files are added before final wiring.

**Step 3: Write minimal test-only fixes**

Fill any gaps exposed by smoke tests. Do not refactor unrelated code.

**Step 4: Run smoke tests again**

Run:
- `pytest backend/apps/system/tests/test_s1_smoke.py -v`
- `npm --prefix frontend test -- ai-config-smoke.test.tsx --run`

Expected: PASS

**Step 5: Commit**

```bash
git add backend/apps/system/tests/test_s1_smoke.py frontend/src/features/system/pages/ai-config-smoke.test.tsx docs/plans/2026-03-09-page-s1-test-checklist.md
git commit -m "test: add s1 ai config smoke coverage"
```

---

### Task 19: Run full verification before calling S1 complete

**Files:**
- Modify: none unless verification reveals defects

**Step 1: Run backend checks**

Run:
- `python backend/manage.py check`
- `python backend/manage.py migrate`
- `pytest backend -v`

Expected: all PASS

**Step 2: Run frontend checks**

Run:
- `npm --prefix frontend install`
- `npm --prefix frontend test -- --run`
- `npm --prefix frontend run build`

Expected: tests PASS, production build succeeds

**Step 3: Manual verification**

Run backend and frontend locally, then verify:
- provider cards render correctly
- add/edit drawer opens and closes
- connection check and fetch models produce toast feedback
- route model dropdown depends on provider selection
- audit log paginates
- keyboard focus is visible
- no emoji icons
- mobile width does not introduce horizontal scroll

**Step 4: Fix any failures found**

Only fix what verification proves is broken.

**Step 5: Commit**

```bash
git add <only-files-changed-during-verification>
git commit -m "fix: address s1 verification issues"
```

---

## 1. Proposed File Layout After This Plan

```text
backend/
  config/
  apps/system/
    models.py
    serializers.py
    audit.py
    services/ai_client.py
    views/
      providers.py
      models.py
      routes.py
      audit_log.py
    tests/
frontend/
  src/
    app/router.tsx
    layouts/app-shell.tsx
    lib/api.ts
    components/ui/
    features/system/
      api/ai-config.ts
      types.ts
      hooks/use-ai-config-page.ts
      components/
      pages/ai-config-page.tsx
```

---

## 2. Notes for the Implementer

- This repository currently has no application code, only documentation. Treat this as first-slice scaffolding, not a refactor.
- Keep naming aligned with the approved docs: use `AIProvider`, `AIModel`, `AITaskRoute`, `AIConfigAuditLog`.
- Do not introduce auth, permissions, tenancy, Redis, Celery, or React Query in this slice unless a test or hard dependency forces it.
- Do not invent extra route types beyond the fixed five from `docs/plans/2026-03-09-page-s1-ai-config-design.md:150`.
- Never return raw API keys in any read API or frontend state dump.
- Keep audit summaries human-readable Chinese strings because the page is admin-facing Chinese UI.
- Follow the design system, especially status text + color pairing, button loading behavior, and skeleton usage.

---
