const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 导入必要的模块
const { sequelize, models, Op } = require('./config/database');
const { User, Product, Article } = models;
const app = require('./app');

// 初始化数据库
async function initDatabase() {
  try {
    console.log('正在连接数据库...');
    await sequelize.authenticate();
    console.log('数据库连接成功！');
    
    console.log('正在同步数据库模型...');
    await sequelize.sync({
      // alter: true, // 暂时关闭自动更新表结构
      logging: process.env.NODE_ENV === 'development'
    });
    console.log('数据库模型同步完成！');
    
    // 创建默认管理员账户
    await createDefaultAdmin();
    return true;
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return false;
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
    const dbInitialized = await initDatabase();
    
    if (!dbInitialized) {
      console.error('数据库初始化失败，服务器启动中止');
      process.exit(1);
    }
    
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

// 处理未捕获的异常
process.on('uncaughtException', (err) => {
  console.error('未捕获的异常:', err);
  process.exit(1);
});

// 处理未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
});