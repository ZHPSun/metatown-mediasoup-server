#!/bin/bash
set -e

echo "ApplicationStop: Stopping server"

pm2 stop all || true
