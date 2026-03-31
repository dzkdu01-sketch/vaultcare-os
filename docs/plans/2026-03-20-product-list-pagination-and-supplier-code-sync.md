# Product List Pagination + Supplier Code Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the product list page show 150 products per page and ensure supplier bindings created in the supplier workbench are reflected in the product list's supplier code column.

**Architecture:** Keep the current product list page and supplier workbench architecture intact. Change only the `/products` page page-size behavior on the frontend, and extend supplier workbench bind/unbind backend actions so they also upsert/delete rows in `product_supplier`, which is the table already used by the product list aggregation query.

**Tech Stack:** React 19, TypeScript, Vite, Express, SQLite via sql.js

---

### Task 1: Update product list page size to 150

**Files:**
- Modify: `D:\cursor\vault-os1.1\frontend\src\pages\products\ProductListPage.tsx`
- Test: manual verification on `http://127.0.0.1:5173/products`

**Step 1: Write the failing test**

There is no existing automated frontend page test harness in this repo for `ProductListPage.tsx`, so use a concrete manual failing check:

- Open `http://127.0.0.1:5173/products`
- Observe current pagination fetch size is 20 per page
- Confirm the first page does **not** show 150 rows

**Step 2: Verify RED**

Manual expected result before code change:
- Product list page shows current default page size (20), not 150.

**Step 3: Write minimal implementation**

In `frontend/src/pages/products/ProductListPage.tsx`:
- Change the `page_size` used in `loadProducts()` from `20` to `150`
- Keep the rest of pagination logic unchanged

Specifically update all hardcoded product-list page-size usages so they are consistent.

**Step 4: Verify GREEN**

Run:
```bash
powershell -NoProfile -Command "Set-Location 'D:\cursor\vault-os1.1\frontend'; npm run build"
```

Expected:
- Frontend build passes

Manual verification:
- Open `http://127.0.0.1:5173/products`
- Confirm first page loads up to 150 products
- Confirm pagination still works

**Step 5: Commit**

```bash
git add D:\cursor\vault-os1.1\frontend\src\pages\products\ProductListPage.tsx
git commit -m "feat: show 150 products per page"
```

### Task 2: Make workbench bind sync into `product_supplier`

**Files:**
- Modify: `D:\cursor\vault-os1.1\backend\src\routes\suppliers.ts`
- Test: `http://127.0.0.1:3001/api/v1/suppliers/imported-products`, supplier workbench bind flow, product list supplier code column

**Step 1: Write the failing test**

Use a concrete runtime failing scenario:
- In supplier workbench, bind an imported supplier product to an internal product
- Open product list page
- Observe that the `供应商编码` column does **not** show the newly bound supplier code

That failing symptom proves `supplier_products` binding is not yet synced to `product_supplier`.

**Step 2: Verify RED**

Manual expected result before code change:
- Binding in supplier workbench succeeds
- Product list still shows `-` in `供应商编码` for that product

**Step 3: Write minimal implementation**

In `backend/src/routes/suppliers.ts`, inside:
- `POST /suppliers/imported-products/bind`
- `POST /suppliers/imported-products/unbind`

For bind:
- For each selected `supplier_product_id`, load the imported supplier product row
- After setting `mapped_product_id`, upsert the corresponding row into `product_supplier`
- Upsert target fields:
  - `product_id`
  - `supplier_id`
  - `supplier_code`
  - `cost_price` (from `cost_price_aed`)
  - `note` keep empty string for v1
- Because `product_supplier` has `UNIQUE(product_id, supplier_id)`, use:
  - update existing row if present
  - otherwise insert a new one

For unbind:
- Before clearing `mapped_product_id`, load the imported supplier product row
- Delete the matching row from `product_supplier` using:
  - `product_id = mapped_product_id`
  - `supplier_id = supplier_id`
- Then clear `mapped_product_id`

**Step 4: Verify GREEN**

Run:
```bash
powershell -NoProfile -Command "Set-Location 'D:\cursor\vault-os1.1\backend'; npm run build"
```

Expected:
- Backend build passes

Runtime verification:
1. Open supplier workbench
2. Bind one imported supplier product to one internal product
3. Open `http://127.0.0.1:5173/products`
4. Confirm the bound supplier code appears in the `供应商编码` column
5. Unbind it
6. Confirm product list supplier code column removes it

**Step 5: Commit**

```bash
git add D:\cursor\vault-os1.1\backend\src\routes\suppliers.ts
git commit -m "feat: sync supplier workbench bindings to product mappings"
```

### Task 3: Verify end-to-end workflow still behaves correctly

**Files:**
- Modify: none unless bugs are found
- Test: supplier workbench UI and product list UI

**Step 1: Write the failing test**

Use the real workflow as the verification checklist:
- Import supplier CSV
- View imported supplier products list
- Bind supplier product to internal product
- See supplier code in product list
- Unbind supplier product
- See supplier code removed from product list
- Confirm product list page shows 150 rows per page

Before implementation, at least one of these behaviors was failing.

**Step 2: Verify RED**

Expected pre-fix failures:
- Product list page size not 150
- Workbench bind does not reflect in product list supplier code column

**Step 3: Minimal implementation**

No new implementation in this step unless verification reveals a small regression.

**Step 4: Verify GREEN**

Run backend and frontend, then manually verify:

Backend endpoint sanity:
```bash
curl -s "http://127.0.0.1:3001/api/v1/suppliers/imported-products"
```
Expected:
- `code: 200`
- returns imported supplier product rows

Frontend build sanity:
```bash
powershell -NoProfile -Command "Set-Location 'D:\cursor\vault-os1.1\frontend'; npm run build"
```
Expected:
- build passes

Manual UI verification:
1. Refresh `http://127.0.0.1:5173/suppliers`
2. Confirm imported supplier rows load without `加载失败`
3. Bind one row
4. Refresh `http://127.0.0.1:5173/products`
5. Confirm supplier code displays
6. Confirm `/products` page now shows 150 rows on first page
7. Unbind and confirm removal

**Step 5: Commit**

```bash
git add D:\cursor\vault-os1.1\backend\src\routes\suppliers.ts D:\cursor\vault-os1.1\frontend\src\pages\products\ProductListPage.tsx
git commit -m "fix: align supplier bindings with product list display"
```
