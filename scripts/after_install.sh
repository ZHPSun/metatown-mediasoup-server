#!/bin/bash
set -e
set -x

echo "AfterInstall: Fixing permissions and installing dependencies"

# 设置应用路径（根据你的部署目录调整）
APP_DIR="/home/ec2-user/app"

# 创建日志目录
mkdir -p "$APP_DIR/logs"
chmod -R 755 "$APP_DIR"

# 安装 Node.js 依赖（如需要）
if [ -f "$APP_DIR/package.json" ]; then
  cd "$APP_DIR"
  npm install || echo "⚠️ npm install failed, skipping..."
fi

# 可选：修复 Let's Encrypt 证书目录权限（若存在）
SSL_PATH="/etc/letsencrypt/live"
if [ -d "$SSL_PATH" ]; then
  echo "SSL directory found, setting permissions"
  chmod -R 755 "$SSL_PATH"
else
  echo "No SSL directory found at $SSL_PATH, skipping SSL permission fix"
fi

echo "✅ AfterInstall completed successfully"