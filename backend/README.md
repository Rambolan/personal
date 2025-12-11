# 个人网站后台管理系统

## 技术栈

- **后端**: Node.js + Express.js
- **数据库**: PostgreSQL (Supabase)
- **ORM**: Sequelize
- **认证**: JWT
- **文件上传**: Multer
- **部署平台**: Vercel

## 部署到Vercel

### 前置条件

1. 拥有Vercel账号
2. 拥有Supabase账号并创建了数据库
3. 安装了Git和Node.js

### 步骤

1. **克隆仓库**

   ```bash
   git clone <repository-url>
   cd personal web/backend
   ```

2. **安装依赖**

   ```bash
   npm install
   ```

3. **配置Supabase**

   在Supabase控制台中：
   - 创建一个新的PostgreSQL数据库
   - 获取数据库连接信息：
     - 主机名 (Host)
     - 端口 (Port)
     - 数据库名 (Database Name)
     - 用户名 (Username)
     - 密码 (Password)

4. **部署到Vercel**

   方法一：通过Vercel CLI
   ```bash
   # 安装Vercel CLI
   npm install -g vercel

   # 登录Vercel
   vercel login

   # 部署应用
   vercel
   ```

   方法二：通过Vercel控制台
   - 访问 [Vercel控制台](https://vercel.com/dashboard)
   - 点击 "New Project"
   - 连接你的Git仓库
   - 选择后端目录 `personal web/backend`

5. **配置环境变量**

   在Vercel项目设置中，添加以下环境变量：

   | 变量名 | 说明 | 值 |
   |-------|------|----|
   | DB_HOST | 数据库主机名 | Supabase的主机名 |
   | DB_USER | 数据库用户名 | Supabase的用户名 |
   | DB_PASSWORD | 数据库密码 | Supabase的密码 |
   | DB_NAME | 数据库名 | Supabase的数据库名 |
   | DB_PORT | 数据库端口 | Supabase的端口 (通常是5432) |
   | DB_SSL | 是否使用SSL | true |
   | PORT | 服务器端口 | 3000 (Vercel会自动处理) |
   | NODE_ENV | 运行环境 | production |
   | JWT_SECRET | JWT密钥 | 自定义密钥 |
   | JWT_EXPIRES_IN | JWT过期时间 | 24h |
   | UPLOAD_PATH | 上传文件路径 | ./uploads |
   | MAX_FILE_SIZE | 最大文件大小 | 5000000 (5MB) |
   | ALLOWED_ORIGINS | 允许的域名 | 前端应用的URL |

6. **完成部署**

   部署成功后，Vercel会提供一个URL，你可以使用这个URL访问后端API。

## 注意事项

1. **文件上传**: Vercel的无服务器环境是短暂的，上传的文件会在一段时间后被删除。建议使用Supabase Storage或其他云存储服务来存储上传的文件。

2. **数据库连接**: 确保Supabase的数据库允许来自Vercel IP的连接。在Supabase控制台的"Database" > "Network"设置中，可以添加0.0.0.0/0作为允许的IP地址（生产环境建议只允许Vercel的IP）。

3. **环境变量**: 不要将敏感信息（如数据库密码、JWT密钥）提交到版本控制系统。

4. **日志**: 在Vercel控制台中可以查看应用的日志，用于调试问题。

## API文档

### 健康检查

- `GET /health` - 检查服务器和数据库状态

### 用户管理

- `POST /api/users/login` - 用户登录
- `GET /api/users/profile` - 获取当前用户信息

### 作品管理

- `GET /api/products` - 获取作品列表（前端）
- `GET /api/products/:id` - 获取单个作品详情（前端）
- `GET /api/products/admin/list` - 获取所有作品（带分页，后台管理）
- `POST /api/products` - 创建新作品
- `PUT /api/products/:id` - 更新作品
- `DELETE /api/products/:id` - 删除作品

### 文章管理

- `GET /api/articles` - 获取文章列表（前端）
- `GET /api/articles/:id` - 获取单个文章详情（前端）
- `GET /api/articles/admin/list` - 获取所有文章（带分页，后台管理）
- `POST /api/articles` - 创建新文章
- `PUT /api/articles/:id` - 更新文章
- `DELETE /api/articles/:id` - 删除文章

### 文件上传

- `POST /api/editor/upload` - 富文本编辑器图片上传

## 开发

### 本地运行

```bash
# 启动开发服务器
npm run dev
```

### 初始化数据库

```bash
# 初始化数据库结构
npm run init-db
```

## 维护

### 监控

- `GET /health/monitoring` - 查看服务监控状态

### 压力测试

```bash
# 仅在开发环境可用
GET /health/stress-test
```
