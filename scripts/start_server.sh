#!/bin/bash
set -e

echo "ApplicationStart: Starting server"

cd /home/ec2-user/app

pm2 start index.js
