#!/bin/bash
set -e

echo "BeforeInstall: Installing Node.js and dependencies"

curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

node -v
npm -v

sudo npm install -g pm2
