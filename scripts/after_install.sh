#!/bin/bash
set -e

echo "AfterInstall: Fixing permissions and installing dependencies"

sudo chown -R ec2-user:ec2-user /home/ec2-user/app
sudo chmod -R 755 /home/ec2-user/app

cd /home/ec2-user/app

npm install
