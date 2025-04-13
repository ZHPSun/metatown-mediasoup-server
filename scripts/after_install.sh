#!/bin/bash
set -e
set -x

echo "AfterInstall: Preparing app directory"

APP_DIR="/home/ec2-user/app"
LOG_DIR="$APP_DIR/logs"

# 确保 logs 子目录存在（ec2-user 可写）
mkdir -p "$LOG_DIR"
chmod 755 "$LOG_DIR"

# 安装依赖（如存在 package.json）
if [ -f "$APP_DIR/package.json" ]; then
  cd "$APP_DIR"
  npm install || echo "⚠️ npm install failed"
fi

echo "✅ AfterInstall completed"