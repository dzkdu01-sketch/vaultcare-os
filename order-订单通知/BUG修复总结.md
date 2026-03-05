# Bug修复总结报告

## 🐛 Bug描述

**问题现象**：
- n8n工作流从2026年1月21日23:00:45开始连续失败
- 错误信息：`Cannot read properties of undefined (reading 'markedUnread')`
- 次要错误：`No LID for user`
- HTTP状态码：500

**影响范围**：
- 所有WooCommerce订单通知无法发送到WhatsApp
- 工作流执行失败率100%（之前成功率100%）

## 🔍 Bug根本原因分析

### 主要原因：WAHA版本过旧

1. **时间线吻合**：
   - 失败开始时间：2026年1月21日23:00:45
   - WAHA 2026.1.4版本发布时间：2026年1月26日（昨天）
   - 说明：WhatsApp Web在1月21日左右更新，导致与旧版WAHA不兼容

2. **错误类型**：
   - `markedUnread` 错误：WhatsApp Web更新后移除了该属性
   - `No LID for user` 错误：会话认证问题
   - 都发生在 `whatsapp-web.js` 库中

3. **WAHA版本**：
   - 旧版本：2026.1.2 CORE
   - 新版本：2026.1.4 CORE（包含WEBJS 500错误修复）

### 次要原因：配置错误

1. **API Key过期**：
   - 容器重新创建后，API Key重新生成
   - 需要从WAHA日志中获取新的API Key

2. **端口配置说明**：
   - Docker内部网络：n8n使用 `http://waha:3000/api/sendText`（容器端口）
   - 外部访问：使用 `http://72.60.211.191:3001/api/sendText`（主机端口）
   - 端口映射：3001:3000（主机3001映射到容器3000）

## ✅ 解决方案

### 1. 更新WAHA到最新版本

```bash
# 备份会话数据
docker cp waha:/app/.sessions ~/waha-backup/sessions

# 停止并删除旧容器
docker stop waha
docker rm waha

# 拉取最新镜像
docker pull devlikeapro/waha:latest

# 重新创建容器
docker run -d \
  --name waha \
  --network waha_default \
  -p 3001:3000 \
  --restart unless-stopped \
  devlikeapro/waha:latest

# 恢复会话数据
docker cp ~/waha-backup/sessions waha:/app/.sessions
docker exec waha chown -R node:node /app/.sessions
```

### 2. 修复n8n HTTP Request节点配置

**URL**（已确认成功配置）：
- `http://waha:3000/api/sendText`（Docker内部网络，n8n和WAHA在同一Docker网络中）

**API Key**：
- 从WAHA日志获取：`docker logs waha | grep "WAHA_API_KEY"`
- 更新Headers中的 `X-Api-Key` 值为：`2eea8dbc517e469ca5146ce975ce4b1d`

### 3. 重新建立会话

- 删除旧的 `default` 会话
- 重新创建 `default` 会话
- 扫描QR码连接WhatsApp

## 📊 修复结果

- ✅ WAHA版本更新到2026.1.4
- ✅ `markedUnread` 错误已解决
- ✅ `No LID for user` 错误已解决
- ✅ n8n工作流恢复正常运行
- ✅ 消息成功发送到WhatsApp

## 🎯 经验教训

### 技术层面

1. **及时更新依赖**：
   - WhatsApp Web会频繁更新
   - WAHA需要及时更新以保持兼容性
   - 建议订阅WAHA更新通知

2. **配置管理**：
   - **API Key必须通过环境变量固定**，避免容器重启后改变
   - 端口配置应该统一管理
   - 避免硬编码配置
   - **注意**：Docker内部网络访问使用容器端口（3000），外部访问使用主机端口（3001）
   - **重要区别**：API Key和Dashboard密码是不同的，不要混淆

3. **配置验证**：
   - WAHA Dashboard的"服务器"配置中必须使用API Key，不是Dashboard密码
   - n8n HTTP Request节点和WAHA Dashboard服务器配置使用相同的API Key
   - 定期验证配置是否正确

4. **监控和告警**：
   - 建议设置工作流执行监控
   - 失败时及时通知
   - 监控WAHA容器状态和会话连接状态

### 配置最佳实践

1. **固定API Key**：
   ```bash
   docker run -d \
     --name waha \
     --network waha_default \
     -p 3001:3000 \
     -e WAHA_API_KEY=09972be208234342b1a0999e4426e863 \
     -e WAHA_DASHBOARD_USERNAME=admin \
     -e WAHA_DASHBOARD_PASSWORD=b4aaddedf6224eb2afe5ef6dfadba381 \
     --restart unless-stopped \
     devlikeapro/waha:latest
   ```

2. **配置检查清单**：
   - [ ] WAHA容器使用固定API Key启动
   - [ ] n8n HTTP Request节点使用正确的API Key
   - [ ] WAHA Dashboard服务器配置使用API Key（非密码）
   - [ ] 端口配置正确（内部3000，外部3001）
   - [ ] 会话状态正常（WORKING或CONNECTED）

## 📝 最终配置确认（2026-01-28更新）

### WAHA配置
- 版本：2026.1.4 CORE
- API Key：09972be208234342b1a0999e4426e863（**已固定**，通过环境变量设置）
- Dashboard用户名：admin
- Dashboard密码：b4aaddedf6224eb2afe5ef6dfadba381
- 端口映射：3001:3000（主机3001映射到容器3000）
- 网络：waha_default
- 会话：default
- **重要**：API Key已通过环境变量固定，容器重启后不会改变

### n8n HTTP Request节点配置（已测试成功）
- URL：`http://waha:3000/api/sendText`（Docker内部网络）
- Headers：
  - `Content-Type: application/json`
  - `X-Api-Key: 09972be208234342b1a0999e4426e863`
- Body：
  - `session: default`
  - `chatId: {{ $json.chatId }}`
  - `text: {{ $json.message }}`

### WAHA Dashboard配置
- 服务器名称：woo-order
- API地址：`http://72.60.211.191:3001`
- API密钥：`09972be208234342b1a0999e4426e863`（**必须是API Key，不是Dashboard密码**）

## 🔄 后续问题修复（2026-01-28）

### 问题1：API Key混淆
**现象**：WAHA Dashboard显示"服务器连接失败"，提示API密钥配置错误

**原因**：在WAHA Dashboard的"服务器"配置中，将Dashboard密码误填为API Key

**解决**：
- 明确区分API Key和Dashboard密码
- API Key (`09972be208234342b1a0999e4426e863`) 用于API调用和Dashboard服务器配置
- Dashboard密码 (`b4aaddedf6224eb2afe5ef6dfadba381`) 仅用于登录Dashboard界面

### 问题2：API Key不固定
**现象**：容器重启后API Key改变，需要频繁更新n8n配置

**解决**：
- 使用环境变量固定API Key
- 容器启动命令中添加 `-e WAHA_API_KEY=09972be208234342b1a0999e4426e863`
- 确保容器重启后API Key保持不变

## ✅ 验证清单

- [x] WAHA更新到2026.1.4
- [x] 端口配置正确（Docker内部3000，外部3001）
- [x] API Key已固定（通过环境变量）
- [x] n8n HTTP Request节点配置正确
- [x] WAHA Dashboard服务器配置正确（API Key，非密码）
- [x] 会话连接正常
- [x] n8n工作流执行成功
- [x] 消息成功发送
- [x] 无错误日志
