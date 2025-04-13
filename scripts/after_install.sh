#!/bin/bash
set -e
set -x

echo "AfterInstall: Fixing permissions and installing dependencies"

APP_DIR="/home/ec2-user/app"

# 确保 app 目录存在并属于 ec2-user
mkdir -p "$APP_DIR"
chown -R ec2-user:ec2-user "$APP_DIR"

# 创建 logs 子目录（确保可写）
mkdir -p "$APP_DIR/logs"

# 如果存在 package.json 则安装依赖
if [ -f "$APP_DIR/package.json" ]; then
  cd "$APP_DIR"
  npm install || echo "⚠️ npm install failed, skipping..."
fi

echo "✅ AfterInstall completed"