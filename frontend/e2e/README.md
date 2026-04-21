# Playwright E2E

## 凭据（勿提交仓库）

1. 复制 `frontend/.env.e2e.example` 为 `frontend/.env.e2e`（已在根目录 `.gitignore`）。
2. 填写：
   - `PLAYWRIGHT_BASE_URL`：测本机一般为 `http://localhost:5173`；测 VPS 则为 `http://<IP或域名>`。
   - `E2E_USERNAME` / `E2E_PASSWORD`：**目标环境上真实存在的**操作员或分销商账号。

`playwright.config.ts` 会在启动时读取 `frontend/.env.e2e`。

## 命令

```bash
cd frontend
npm run test:e2e
```

- **仅登录壳（smoke）**：不设 `E2E_PASSWORD` 或清空 `.env.e2e` 中密码字段时，只跑 `smoke.spec.ts`。
- **含订单页**：配置完整凭据后会先跑 `auth.setup.ts` 生成 `e2e/.auth/user.json`，再跑 `orders.spec.ts`。

测本机且未起 dev 时：

```bash
# 先起一个终端: npm run dev
set PW_NO_WEB_SERVER=1
npm run test:e2e
```

（PowerShell 也可用 `$env:PW_NO_WEB_SERVER=1`。）

## 常见问题

- **`登录失败: 用户不存在`**：说明 `E2E_USERNAME` 在该环境的 SQLite 里不存在。请在目标站创建操作员（如先调 `init-admin`）或改用已有账号。
- **测 VPS**：`PLAYWRIGHT_BASE_URL` 指向 VPS 时**不会**自动启动 Vite；无需本机 `npm run dev`。
