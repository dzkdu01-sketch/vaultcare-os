/**
 * PM2：在服务器上 backend 目录执行
 *   DEPLOY_ROOT=/var/www/vault-os1.1 pm2 start deploy/ecosystem.config.cjs
 * 或先设好下面默认值再 pm2 start ecosystem.config.cjs
 */
const root = process.env.VAULT_OS11_ROOT || '/var/www/vault-os1.1'

module.exports = {
  apps: [
    {
      name: 'vault-os11-api',
      cwd: `${root}/backend`,
      script: 'dist/index.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: '3002',
      },
    },
  ],
}
