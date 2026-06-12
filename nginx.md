# nginx 相关说明

## 部署触发规则

| 触发方式 | 目标服务器 | 对应 Job |
|---------|-----------|---------|
| push 到 `main` 分支 | 现有服务器（`SERVER_*` secrets） | `deploy` |
| 发布 GitHub Release | 新生产服务器（`PROD_*` secrets） | `deploy-prod` |

工作流文件：`.github/workflows/deploy.yml`

---

## 新生产服务器初始化（Release 触发部署）

### 1. 服务器环境准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Git
sudo apt install git -y

# 安装 NVM + Node 20
curl -fsSL https://gitee.com/RubyMetric/nvm-cn/raw/main/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# 设置 npm 使用阿里云镜像源
npm config set registry https://registry.npmmirror.com

# 验证是否生效（应输出 https://registry.npmmirror.com/）
npm config get registry

# 安装 PM2
npm install -g pm2
```

### 2. 生成 SSH 密钥（一把密钥两个用途）

```bash
ssh-keygen -t rsa -b 4096 -C "deploy@github"
# 全部按回车，不设密码

# 用途一：授权自己免密登录
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys

# 用途二：添加公钥到 GitHub Deploy Keys（用于 git clone/fetch）
cat ~/.ssh/id_rsa.pub
# → GitHub 仓库 → Settings → Deploy keys → Add deploy key（只读即可）

# 用途三：私钥添加到 GitHub Actions Secrets（用于 SSH 登录部署）
cat ~/.ssh/id_rsa
# → GitHub 仓库 → Settings → Secrets → PROD_SERVER_SSH_KEY
```

### 3. 克隆代码并初始化

```bash
# 创建目录
sudo mkdir -p /var/www
sudo chown ubuntu:ubuntu /var/www
cd /var/www

# 使用 SSH 地址克隆
git clone git@github.com:你的用户名/neo-jira.git
cd neo-jira

# 创建生产数据库目录
mkdir -p /var/www/neo-jira-data

# 创建 .env
cat > .env << 'EOF'
DATABASE_URL="file:/var/www/neo-jira-data/dev.db"
EOF

# 首次安装依赖和构建
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

# PM2 启动
pm2 start npm --name "neo-jira" -- start
pm2 save
pm2 startup
```

### 4. 创建默认 Admin 用户

```bash
cd /home/ubuntu/var/www/neo-jira
npx prisma db seed
```

输出示例：
```
Admin user created: admin@neo-jira.local
Initial admin password: xG7$kL2!pQ9w
Save this password. Running seed again will not reset it.
```

> 预设密码：在 `.env` 中添加 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 后再执行 seed。

### 5. 在 GitHub 添加 Production Secrets

GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret 名称 | 值 |
|-------------|-----|
| `PROD_SERVER_HOST` | 新生产服务器外网 IP |
| `PROD_SERVER_USER` | SSH 用户名（如 `ubuntu`） |
| `PROD_SERVER_SSH_KEY` | 第 2 步中 `cat ~/.ssh/id_rsa` 的完整私钥内容 |

---

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
