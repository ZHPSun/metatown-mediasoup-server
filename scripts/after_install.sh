#!/bin/bash
set -e
set -x

echo "AfterInstall: Preparing app directory"

APP_DIR="/home/ec2-user/app"
LOG_DIR="$APP_DIR/logs"

mkdir -p "$LOG_DIR"
chmod -R 755 "$APP_DIR"

# 安装依赖（如果有）
if [ -f "$APP_DIR/package.json" ]; then
  cd "$APP_DIR"
  npm install
fi

echo "✅ AfterInstall complete"