#!/bin/bash
set -e

echo "ApplicationStart: Starting server"

cd /home/ec2-user/app

TOKEN=$(curl -sX PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
PUBLIC_IP=$(curl -sH "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/public-ipv4)
echo "Public IP: $PUBLIC_IP"

ANNOUNCED_IP=$PUBLIC_IP pm2 start index.js --update-env
