#!/bin/bash

# Amazon Linux 2023 uses dnf
dnf install -y amazon-cloudwatch-agent

mkdir -p /opt/aws/amazon-cloudwatch-agent/bin/

cat <<EOF > /opt/aws/amazon-cloudwatch-agent/bin/config.json
{
  "metrics": {
    "namespace": "EC2/Custom",
    "metrics_collected": {
      "cpu": {
        "measurement": ["cpu_usage_idle", "cpu_usage_user"],
        "metrics_collection_interval": 60,
        "totalcpu": true
      },
      "mem": {
        "measurement": ["mem_used_percent"],
        "metrics_collection_interval": 60
      }
    }
  }
}
EOF

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -c file:/opt/aws/amazon-cloudwatch-agent/bin/config.json -s