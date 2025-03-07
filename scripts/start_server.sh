#!/bin/bash
set -e

echo "ApplicationStart: Setting environment variables"

cd /home/ec2-user/app

# 获取 EC2 实例的 PUBLIC_IP
TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
PUBLIC_IP=$(curl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Public IP: $PUBLIC_IP"
# 设置环境变量
export ANNOUNCED_IP=$PUBLIC_IP

# SSL 证书路径
SSL_PATH="/etc/letsencrypt/live/mediasoup.melfish.xyz/"

if [[ -d "$SSL_PATH" && -f "$SSL_PATH/fullchain.pem" && -f "$SSL_PATH/privkey.pem" ]]; then
    echo "SSL certificate found, enabling HTTPS..."
    export HTTPS=$SSL_PATH
else
    echo "SSL certificate not found, starting in HTTP mode..."
    unset HTTPS  # 确保 HTTPS 变量未定义
fi

# 启动 PM2 进程（环境变量已设置）
echo "Starting application with PM2..."

pm2 start index.js --update-env
