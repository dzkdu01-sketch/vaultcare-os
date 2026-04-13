# 本地部署敏感信息（复制本文件为 secrets.local.md 后填写）

**不要**把 `secrets.local.md` 提交到 Git。本文件仅作模板。

## Spaceship / VPS

- 服务商账号（邮箱）：`________________`
- 虚拟机名称 / ID：`________________`
- SSH：`root@104.207.64.70`，端口 **`22022`**
- root 密码：`*存密码管理器，勿写明文在此*`

## GitHub

- 账号 / 用于 push 的凭据：`________________`（Personal Access Token 等仅存管理器）

## 域名

- `vault-os.site` 注册商 / Spaceship 登录：`________________`

## WooCommerce 站点（若使用同步）

- 各站点的 Consumer Key / Secret：仅保存在**站点设置**或密码管理器

## 备注

- 上次数据库上传方式：`scp -P 22022 ... vaultcare.db`
