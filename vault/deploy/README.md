# Vaultcare OS 部署文件

## 文件说明

| 文件 | 用途 |
|------|------|
| `nginx.conf` | Nginx 反向代理配置 |
| `vaultcare.service` | Gunicorn systemd 服务 |
| `vaultcare-q.service` | Django-Q2 异步任务服务 |
| `setup.sh` | 一键部署脚本 |

## 快速部署

在**项目根目录**执行（将 `你的域名或IP` 替换为实际值）：

```bash
sudo bash deploy/setup.sh 你的域名或IP
```

## 详细文档

见 [docs/deploy/VPS-DEPLOYMENT-GUIDE.md](../docs/deploy/VPS-DEPLOYMENT-GUIDE.md)
