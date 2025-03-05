#!/bin/bash
set -e

echo "ApplicationStart: Starting server"

cd /home/ec2-user/app

npm install

pm2 start index.js
