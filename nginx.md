# nginx 相关说明

## 配置文件地址

`/etc/nginx/sites-available/neo-jira`

## 配置文件

```json
server {
    listen 3001;
    server_name _;

    # ⚠️ 关键：必须允许足够的请求体大小
    client_max_body_size 50M;

    # ⚠️ 关键：增加超时时间
    client_body_timeout 300s;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;

    # 静态文件直接由 Nginx 处理
    location /uploads {
        alias /home/ubuntu/var/www/neo-jira/public/uploads;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }

    # ⚠️ 所有其他请求转发到 Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # ⚠️ Server Actions 必须的头部
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # ⚠️ 确保缓冲开启
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
}

```

## 权限

```bash
# 确保目录有读取+执行权限
chmod 755 /home/ubuntu/var/www/neo-jira/public/uploads
chmod 644 /home/ubuntu/var/www/neo-jira/public/uploads/*
# 如果父目录权限也有限制，确保整个路径可遍历
chmod 755 /home/ubuntu
chmod 755 /home/ubuntu/var
chmod 755 /home/ubuntu/var/www
chmod 755 /home/ubuntu/var/www/neo-jira
chmod 755 /home/ubuntu/var/www/neo-jira/public
```
