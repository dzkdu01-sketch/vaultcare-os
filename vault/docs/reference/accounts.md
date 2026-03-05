# Vaultcare OS — 账号与密码

> 更新时间：2026-03-02
> 环境：本地开发（localhost）

---

## 登录地址

| 系统 | 地址 |
|------|------|
| 前端 ERP | http://localhost:5173 |
| Django Admin 后台 | http://localhost:8000/admin |
| API 文档（Swagger） | http://localhost:8000/api/schema/swagger-ui/ |
| 获取 JWT Token | POST http://localhost:8000/api/token/ |

---

## 账号列表

### 超级管理员

| 用户名 | 密码 | 权限 | 用途 |
|--------|------|------|------|
| `admin` | `admin123` | 超级管理员 | Django Admin 后台管理 |
| `test_admin` | `123456` | 超级管理员 | 前端 ERP 管理员角色测试 |

### 自营团队

| 用户名 | 密码 | 权限 | 用途 |
|--------|------|------|------|
| `test_self1` | `123456` | 普通用户 | 自营一组操作员测试 |
| `test_self2` | `123456` | 普通用户 | 自营二组操作员测试 |

### 分销商

| 用户名 | 密码 | 权限 | 用途 |
|--------|------|------|------|
| `test_dist1` | `123456` | 普通用户 | 分销商 1 号测试账号 |
| `test_dist2` | `123456` | 普通用户 | 分销商 2 号测试账号 |
| `test_dist3` | `123456` | 普通用户 | 分销商 3 号测试账号 |

---

## 快速登录（前端 ERP）

日常开发测试推荐使用 `test_admin / 123456`，拥有完整管理员权限。

分销商视角测试使用 `test_dist1 / 123456`，可验证分销商权限隔离是否正确。

---

## 获取 API Token（Postman / curl）

```bash
curl -X POST http://localhost:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "test_admin", "password": "123456"}'
```

返回：
```json
{
  "access": "eyJ...",
  "refresh": "eyJ..."
}
```

后续请求在 Header 中携带：
```
Authorization: Bearer eyJ...
```

---

## 注意事项

- `admin` 账号仅用于 Django Admin 后台，前端 ERP 登录请用 `test_admin`
- 所有密码为开发环境专用，**生产环境必须替换**
- Token 有效期：Access Token 12 小时，Refresh Token 7 天
