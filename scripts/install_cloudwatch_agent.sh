#!/bin/bash
set -e
set -x

echo "Installing Amazon CloudWatch Agent..."

# 安装 CloudWatch Agent
yum install -y amazon-cloudwatch-agent

# 确保配置目录存在
mkdir -p /opt/aws/amazon-cloudwatch-agent/etc/

# 写入配置
cat <<EOF > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/home/ec2-user/app/logs/server.log",
            "log_group_name": "/mediasoup/server",
            "log_stream_name": "{instance_id}",
            "timestamp_format": "%Y-%m-%d %H:%M:%S",
            "multi_line_start_pattern": "^{"
          }
        ]
      }
    }
  }
}
EOF

# 启动 Agent 并加载配置
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
  -s

echo "✅ CloudWatch Agent installed and running."