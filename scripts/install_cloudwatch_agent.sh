#!/bin/bash
set -e
set -x

echo "Installing Amazon CloudWatch Agent..."

# 安装 CloudWatch Agent（Amazon Linux 2）
sudo yum install -y amazon-cloudwatch-agent

# 创建配置目录（如果不存在）
sudo mkdir -p /opt/aws/amazon-cloudwatch-agent/etc/

# 写入配置文件
sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json > /dev/null <<EOF
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
          },
          {
            "file_path": "/var/log/messages",
            "log_group_name": "/system/messages",
            "log_stream_name": "{hostname}"
          },
          {
            "file_path": "/var/log/secure",
            "log_group_name": "/system/secure",
            "log_stream_name": "{hostname}"
          },
          {
            "file_path": "/var/log/cloud-init.log",
            "log_group_name": "/system/cloud-init",
            "log_stream_name": "{hostname}"
          }
        ]
      }
    }
  }
}
EOF

# 启动 agent 并加载配置
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
  -s

echo "✅ CloudWatch Agent installed and configured for mediasoup and system logs."
