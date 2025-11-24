const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { sequelize, models, Op } = require('./config/database');
const { User, Product, Article } = models;
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const articleRoutes = require('./routes/articleRoutes');

dotenv.config();

const app = express();

// 配置CORS
const corsOptions = {
  origin: (origin, callback) => {
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// 解析JSON请求体
app.use(express.json());

// 解析URL编码的请求体
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: '服务器运行正常',
    time: new Date().toISOString()
  });
});

// 注册路由
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/articles', articleRoutes);

// 404错误处理
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: '请求的资源不存在'
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('全局错误:', err);
  res.status(500).json({
    status: 'error',
    message: '服务器内部错误'
  });
});

// 初始化数据库
async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功！');
    
    // 同步数据库模型
    await sequelize.sync({
      force: false,
      logging: false
    });
    
    console.log('数据库模型同步完成！');
    
    // 创建默认管理员账号
    await createDefaultAdmin();
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

// 创建默认管理员账号
async function createDefaultAdmin() {
  try {
    // 检查是否已存在管理员
    const existingAdmin = await User.findOne({
      where: {
        [Op.or]: [{ username: 'admin' }, { role: 'admin' }]
      }
    });
    
    if (!existingAdmin) {
      // 创建默认管理员
      const admin = await User.create({
        username: 'admin',
        password: 'admin123',
        email: 'admin@example.com',
        role: 'admin',
        status: true
      });
      
      console.log('默认管理员账号创建成功！');
    } else {
      console.log('管理员账户已存在，跳过创建');
    }
  } catch (error) {
    console.error('创建默认管理员失败:', error);
    throw error;
  }
}

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    
    const PORT = process.env.PORT || 3000;
    
    app.listen(PORT, () => {
      console.log(`服务器正在运行，端口: ${PORT}`);
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
      console.log('- PUT    /api/articles/:id/cover - 更新文章封面');
      console.log('- POST   /api/articles/:id/images - 上传文章图片');
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

// 启动服务器
startServer();