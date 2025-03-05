#!/bin/bash
set -e

echo "BeforeInstall: Installing Node.js and dependencies"

curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

node -v
npm -v

sudo npm install -g pm2

sudo chown -R ec2-user:ec2-user /home/ec2-user/app
sudo chmod -R 755 /home/ec2-user/app
