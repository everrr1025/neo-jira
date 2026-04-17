# 🚀 Neo-Jira 终极单机自动部署指南 (Next.js + Prisma + SQLite)

本指南针对 Ubuntu 系统（推荐 22.04 或 24.04），带你从零实现：**通过 IP 优雅访问（去除端口号）**，以及 **提交代码后服务器全自动构建部署**。

---

## 第一步：准备服务器与配置网络防火墙
1. **购买服务器**：在云服务商购买一台香港或海外的服务器（推荐最低 1核2G/2核2G）。系统选择 **Ubuntu Server**。
2. **开放端口**：
   在服务商控制台找到这台服务器的【防火墙】或【安全组】配置，添加两条入站规则：
   - 允许 **TCP 80** 端口（用于 HTTP IP 直接访问）
   - 允许 **TCP 22** 端口（默认就有，用于 SSH 登录）

## 第二步：初次连接与环境搭建

本地使用终端连接到服务器：
```bash
ssh root@你的服务器IP
```

在服务器中依次执行以下命令，安装关键组件（Node.js + Git）：
```bash
# 更新系统依赖包
apt update && apt upgrade -y

# 安装 Git
apt install git -y

# 安装 Node.js (使用 NVM 管理)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

nvm install 20  # 安装 Node v20
nvm use 20
```

## 第三步：拉取代码并首次启动服务

1. **部署代码目录**：
```bash
mkdir -p /var/www
cd /var/www
git clone https://你的Github仓库地址.git neo-jira
cd neo-jira
```

2. **环境变量与依赖初始化**：
```bash
# 将本地的 .env 拷贝上来，或者用 nano 手动创建
nano .env 
# 建议直接使用仓库外的生产数据库路径:
# DATABASE_URL="file:/var/www/neo-jira-data/dev.db"

mkdir -p /var/www/neo-jira-data
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

3. **使用 PM2 在后台守护运行**：
```bash
# 全局安装守护工具 PM2
npm install -g pm2

# 启动 Next.js 生产环境
pm2 start npm --name "neo-jira" -- start

# 设置开机自启
pm2 startup
pm2 save
```
*(此时应用已经跑在服务器本地的 3000 端口了)*

## 第四步：Nginx 反向代理配置（实现纯 IP 访问）

为了让你的朋友不用加 `:3000` 尾巴就能直接访问：

1. **安装 Nginx 并创建配置**：
```bash
apt install nginx -y
nano /etc/nginx/sites-available/neo-jira
```

2. **写入配置文本**（此处的 `_` 符号非常核心，代表匹配所有 IP 请求）：
```nginx
server {
    listen 80;
    server_name _; 

    # 限制上传文件大小 (默认为 1M，改为 50M)
    client_max_body_size 50M;
    # 增加超时时间以支持大文件上传
    client_body_timeout 300s;
    proxy_read_timeout 300s;

    # 优先由 Nginx 直接处理附件，解决上传后不可见的问题
    location /uploads {
        alias /var/www/neo-jira/public/uploads;
        expires 7d;
        add_header Cache-Control "public, no-transform";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. **激活配置并重启应用**：
```bash
ln -s /etc/nginx/sites-available/neo-jira /etc/nginx/sites-enabled/
# 为了防止抢占请求，可以把默认配置删掉
rm /etc/nginx/sites-enabled/default 

nginx -t       # 提示 successful 表示格式正确
systemctl restart nginx
```
🎉 **里程碑 1 达成**：现在你在浏览器长条输入你的【服务器外网 IP】，已经可以完美访问 Neo-Jira 了！

---

## 第五步：开启飞升模式 —— Github 自动部署

你已经在项目里有了 `.github/workflows/deploy.yml` 文件。为了让它发挥作用，还需要我们在 Github 后台配置**这台服务器的安全钥匙**。

### 1. 从服务器获取密钥（如果使用了密码登录请看这里，若是私钥无需操作）
在服务器终端执行生成密钥对：
```bash
ssh-keygen -t rsa -b 4096 -C "deploy@github"
# 接下来全部按回车，不设置密码
```
把自己电脑生成的公钥授权给自己（让这个密钥可以直接免密登录当前这台机器）：
```bash
cat ~/.ssh/id_rsa.pub >> ~/.ssh/authorized_keys
```
查看并完整复制这把“私有钥匙”的全部文本内容：
```bash
cat ~/.ssh/id_rsa
```

### 2. 在 Github 后台中录入信息
在你的 Github 浏览器端：`仓库主页 -> Settings -> 侧边栏的 Secrets and variables -> Actions -> New repository secret`。

依序加入以下 3 个环境变量：
1. `SERVER_HOST`: 填入你的服务器**外网 IP**
2. `SERVER_USER`: 填入 `root` 或 `ubuntu`
3. `SERVER_SSH_KEY`: 填入上一步你 `cat` 复制出来包含 `-----BEGIN ...` 与结尾部分的整段**私钥**内容。

### 3. 开始你的现代化开发旅程
你在本地使用你的宇宙级 IDE 开发了新功能。
只要你：
```bash
git add .
git commit -m "feat: 修复了一个很棒的功能"
git push
```
打开仓库的 **Actions** 面板，你将看到云端小机器人在帮你全自动化 SSH 登录服务器、拉取代码、生成数据库、Build并重启应用。
你只需泡杯咖啡，2分钟后刷新网页，新功能即刻上线。

## 第六步：后续 schema 变更如何安全发布

从现在开始，不再建议在线上使用 `npx prisma db push`。更稳妥的流程是：

1. 本地修改 [prisma/schema.prisma](/Users/lihongda/Documents/dev/neo-jira/prisma/schema.prisma)
2. 本地生成迁移文件：
```bash
npx prisma migrate dev --name 你的变更名称
```
3. 提交代码时把 `prisma/migrations/` 一并提交
4. 推送到 `main` 后，线上自动执行 `npx prisma migrate deploy`

这样线上只会应用已经进入版本库的迁移，避免生产库被 `db push` 直接改结构。

部署脚本现在还会额外校验 `/var/www/neo-jira/.env` 里的 `DATABASE_URL`。
如果它不是 `file:/var/www/neo-jira-data/dev.db`，发布会直接失败，避免误连到仓库内数据库或其他路径。

### 本地如何验证 migrate 流程

本地建议把开发环境数据库写成：

```bash
DATABASE_URL="file:./dev.db"
```

这是因为 [schema.prisma](/Users/lihongda/Documents/dev/neo-jira/prisma/schema.prisma) 位于 `prisma/` 目录，SQLite 相对路径按 schema 目录解析时会更稳定，避免出现 `prisma/prisma/dev.db` 这类套娃路径。

每次修改 schema 并生成 migration 后，先运行：

```bash
npm run db:migrate:verify
```

这个脚本会自动验证两件事：

1. 用全新 SQLite 数据库执行 `prisma migrate deploy`
2. 模拟“已有旧库 + baseline + deploy”的升级流程

两条都通过，说明你的 migration 目录至少在“新库初始化”和“旧库平滑接入”两个关键场景下是通的。

### 已有线上 SQLite 数据如何平滑切换到 Prisma Migrate

仓库已经提供了初始基线迁移。部署脚本会在首次发布时自动做三件事：

1. 先备份 `/var/www/neo-jira-data/dev.db`
2. 检查数据库里是否已有业务表但还没有 `_prisma_migrations`
3. 如果是老库，就先把初始迁移标记为已应用，再执行 `migrate deploy`

这意味着已有线上数据不会因为接入 Prisma Migrate 被重建。

### 建议的变更发布策略

为了尽量不影响线上数据，schema 改动尽量采用“两阶段”或“三阶段”：

1. 先加表、加可空字段、加索引
2. 再发布业务代码开始读写新结构
3. 最后再清理旧字段或把字段改成必填

像“删列”“改唯一约束”“可空改必填”这类高风险变更，不建议和业务代码一起硬切。

---

> [!CAUTION]
> **风险管理最终提醒**：全量代码均在 `/var/www/neo-jira` 中，而所有宝贵的数据都应保存在 `/var/www/neo-jira-data/dev.db`。请定期将该文件或 `/var/www/neo-jira-data/backups/` 目录中的备份下载到你个人电脑或云盘中，作为退路。
