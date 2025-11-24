const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { sequelize, models, Op } = require('./config/database');
const { User, Product, Article } = models;
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const articleRoutes = require('./routes/articleRoutes');
const editorImageRoutes = require('./routes/editorImageRoutes');

// 加载环境变量
dotenv.config();

// 创建Express应用
const app = express();

// 配置CORS
const corsOptions = {
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://8.136.34.190:8080', 'http://localhost:8081'], // 添加公网IP和localhost:8081
    credentials: true, // 允许携带凭证
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Length', 'X-Response-Time'],
    preflightContinue: false,
    optionsSuccessStatus: 200
};
// 首先使用CORS中间件，确保在所有其他路由之前
app.use(cors(corsOptions));

// 为所有路径添加OPTIONS请求处理中间件
app.options('*', cors(corsOptions));

// 添加全局请求日志中间件
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('请求来源:', req.headers.origin);
    next();
});

// 解析JSON请求体（增加限制以支持图片数据）
app.use(express.json({ limit: '10mb' }));

// 解析URL编码的请求体（增加限制）
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 配置静态文件服务
app.use(express.static(__dirname)); // 允许访问根目录下的静态文件

// 静态文件服务 - 使用环境变量指定的上传路径
const uploadPath = path.resolve(process.env.UPLOAD_PATH || './uploads');
console.log(`上传文件路径: ${uploadPath}`);
app.use('/uploads', express.static(uploadPath));

// 确保上传目录存在
const fs = require('fs');
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
  console.log(`创建上传目录: ${uploadPath}`);
}

// 健康检查端点
app.get('/health', (req, res) => {
  console.log('收到健康检查请求:', req.headers);
  res.status(200).json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// 添加测试路由
app.get('/api/test-connectivity', (req, res) => {
  console.log('收到连通性测试请求:', req.headers);
  res.json({
    success: true,
    message: '连通性测试成功',
    timestamp: new Date().toISOString(),
    clientInfo: {
      headers: req.headers,
      ip: req.ip
    }
  });
});

// 测试POST请求的路由
app.post('/api/test-post', (req, res) => {
  console.log('收到POST测试请求:', req.headers);
  console.log('请求体:', req.body);
  res.json({
    success: true,
    message: 'POST测试成功',
    data: req.body,
    timestamp: new Date().toISOString()
  });
});

// 注册路由
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/editor', editorImageRoutes);

// 404错误处理
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在'
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('全局错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 初始化数据库
async function initDatabase() {
  try {
    console.log('正在连接数据库...');
    await sequelize.authenticate();
    console.log('数据库连接成功！');
    
    console.log('正在同步数据库模型...');
    await sequelize.sync({
      alter: true, // 自动更新表结构
      logging: process.env.NODE_ENV === 'development'
    });
    console.log('数据库模型同步完成！');
    
    // 创建默认管理员账户
    await createDefaultAdmin();
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

// 创建默认管理员账户
async function createDefaultAdmin() {
  try {
    const adminUsername = 'admin';
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123';
    
    // 检查是否已存在管理员账户
    const existingAdmin = await User.findOne({ 
      where: { 
        [Op.or]: [
          { username: adminUsername },
          { role: 'admin' }
        ]
      }
    });
    
    if (!existingAdmin) {
      await User.create({
        username: adminUsername,
        password: adminPassword,
        email: adminEmail,
        role: 'admin',
        status: true
      });
      console.log(`默认管理员账户创建成功: ${adminUsername}`);
    } else {
      console.log('管理员账户已存在，跳过创建');
    }
  } catch (error) {
    console.error('创建默认管理员失败:', error);
  }
}

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    
    const PORT = process.env.PORT || 3000;
    
    app.listen(PORT, '0.0.0.0', () => { // 监听所有网络接口
      console.log(`服务器正在运行，端口: ${PORT}`);
      console.log(`可通过 http://localhost:${PORT} 或 http://8.136.34.190:${PORT} 访问`);
      console.log(`环境: ${process.env.NODE_ENV}`);
      console.log(`API文档: http://localhost:${PORT}/health`);
      console.log(`API基础路径: http://localhost:${PORT}/api`);
      
      console.log('\n可用的API端点:');
      console.log('- GET  /health                - 健康检查');
      console.log('- POST /api/users/login       - 用户登录');
      console.log('- GET  /api/users/profile     - 获取当前用户信息');
      console.log('- GET  /api/products          - 获取作品列表（前端）');
      console.log('- GET  /api/products/:id      - 获取单个作品详情（前端）');
      console.log('- GET  /api/articles          - 获取文章列表（前端）');
      console.log('- GET  /api/articles/:id      - 获取单个文章详情（前端）');

      console.log('\n后台管理API（需要认证）:');
      console.log('- GET    /api/users           - 获取所有用户（仅管理员）');
      console.log('- POST   /api/users           - 创建新用户（仅管理员）');
      console.log('- PUT    /api/users/:id       - 更新用户信息');
      console.log('- DELETE /api/users/:id       - 删除用户');
      console.log('- GET    /api/products/admin/list - 获取所有作品（带分页）');
      console.log('- POST   /api/products           - 创建新作品');
      console.log('- PUT    /api/products/:id       - 更新作品');
      console.log('- PUT    /api/products/:id/cover - 更新作品封面');
      console.log('- POST   /api/products/:id/images - 上传作品图片');
      console.log('- DELETE /api/products/:id       - 删除作品');
      console.log('- GET    /api/articles/admin/list - 获取所有文章（带分页）');
      console.log('- POST   /api/articles           - 创建新文章');
      console.log('- PUT    /api/articles/:id       - 更新文章');
      console.log('- POST   /api/articles/:id/images - 上传文章图片');
      console.log('- PUT    /api/articles/:id/cover - 更新文章封面');
      console.log('- DELETE /api/articles/:id       - 删除文章');
      
      console.log('\n默认管理员账号:');
      console.log('- 用户名: admin');
      console.log('- 密码: admin123');
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 导出app供测试使用
module.exports = app;

// 启动服务器（如果直接运行此文件）
if (require.main === module) {
  startServer();
}