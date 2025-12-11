// 只导入必要的模块，避免过早加载所有依赖
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs'); // 移到顶部，因为多处使用

// 延迟导入服务监控模块，减少启动时内存占用
let ServiceMonitor = null;

// 加载环境变量
dotenv.config();

// 内存使用监控配置
const MEMORY_CHECK_INTERVAL = process.env.MEMORY_CHECK_INTERVAL || 3600000; // 默认1小时
const MEMORY_WARNING_THRESHOLD = process.env.MEMORY_WARNING_THRESHOLD || 1024; // 默认1GB

// 定期记录内存使用情况
function monitorMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  const rssInMB = (memoryUsage.rss / 1024 / 1024).toFixed(2);
  const heapUsedInMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2);
  
  console.log(`[内存监控] RSS: ${rssInMB}MB, Heap Used: ${heapUsedInMB}MB`);
  
  // 如果内存使用超过阈值，记录警告
  if (heapUsedInMB > MEMORY_WARNING_THRESHOLD) {
    console.warn(`[内存警告] 内存使用超过阈值: ${heapUsedInMB}MB > ${MEMORY_WARNING_THRESHOLD}MB`);
  }
}

// 创建Express应用 - 移到顶部避免重复声明
const app = express();

// 全局异常捕获 - 捕获未处理的同步异常
process.on('uncaughtException', (error) => {
  console.error('【严重错误】未捕获的异常:', error);
  console.error('异常堆栈:', error.stack);
  
  // 记录到告警日志
  try {
    const alertLogPath = path.join(__dirname, 'logs/alerts.log');
    const alertMessage = `[${new Date().toISOString()}] [系统异常] 未捕获的异常: ${error.message}\n堆栈: ${error.stack}\n`;
    if (!fs.existsSync(path.dirname(alertLogPath))) {
      fs.mkdirSync(path.dirname(alertLogPath), { recursive: true });
    }
    fs.appendFileSync(alertLogPath, alertMessage);
  } catch (logError) {
    console.error('记录异常日志失败:', logError);
  }
  
  // 尝试优雅地关闭服务器
  try {
    console.log('正在尝试优雅关闭服务器...');
    // 停止数据库监控
    if (app.locals.dbMonitor && app.locals.dbMonitor.stop) {
      app.locals.dbMonitor.stop();
    }
    // 关闭数据库连接
    if (app.locals.sequelize) {
      app.locals.sequelize.close().catch(err => {
        console.error('关闭数据库连接时出错:', err);
      });
    }
    
    // 延迟退出，确保日志输出
    setTimeout(() => {
      console.log('服务器关闭完成，进程退出');
      process.exit(1);
    }, 2000);
  } catch (err) {
    console.error('关闭服务器时出错:', err);
    process.exit(1);
  }
});

// 全局异常捕获 - 捕获未处理的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('【严重错误】未处理的Promise拒绝:', reason);
  console.error('Promise:', promise);
  
  if (reason instanceof Error) {
    console.error('拒绝原因堆栈:', reason.stack);
  }
  
  // 记录到告警日志
  try {
    const alertLogPath = path.join(__dirname, 'logs/alerts.log');
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    const errorStack = reason instanceof Error ? reason.stack : '';
    const alertMessage = `[${new Date().toISOString()}] [Promise拒绝] ${errorMessage}\n堆栈: ${errorStack}\n`;
    if (!fs.existsSync(path.dirname(alertLogPath))) {
      fs.mkdirSync(path.dirname(alertLogPath), { recursive: true });
    }
    fs.appendFileSync(alertLogPath, alertMessage);
  } catch (logError) {
    console.error('记录Promise拒绝日志失败:', logError);
  }
});

// 处理终止信号
process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭服务器...');
  shutdownServer();
});

process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  shutdownServer();
});

// 优雅关闭服务器函数
function shutdownServer() {
  try {
    console.log('开始关闭服务器...');
    
    // 关闭HTTP服务器
    if (app.locals.server) {
      console.log('正在关闭HTTP服务器...');
      app.locals.server.close((err) => {
        if (err) {
          console.error('关闭HTTP服务器时出错:', err);
        } else {
          console.log('HTTP服务器已关闭');
        }
        
        // 关闭数据库连接
        if (app.locals.sequelize && app.locals.sequelize.connectionManager) {
          console.log('正在关闭数据库连接...');
          app.locals.sequelize.close()
            .then(() => {
              console.log('数据库连接已关闭');
              console.log('服务器已优雅关闭');
              process.exit(0);
            })
            .catch((err) => {
              console.error('关闭数据库连接时出错:', err);
              process.exit(1);
            });
        } else {
          console.log('没有活跃的数据库连接需要关闭');
          process.exit(0);
        }
      });
    } else {
      // 如果服务器未启动，直接关闭数据库
      if (app.locals.sequelize && app.locals.sequelize.connectionManager) {
        app.locals.sequelize.close()
          .then(() => {
            console.log('数据库连接已关闭');
            console.log('服务器已优雅关闭');
            process.exit(0);
          })
          .catch((err) => {
            console.error('关闭数据库连接时出错:', err);
            process.exit(1);
          });
      } else {
        process.exit(0);
      }
    }
  } catch (error) {
    console.error('关闭服务器时出错:', error);
    process.exit(1);
  }
}

// Express应用已在顶部定义

// 配置CORS - 支持credentials模式
const corsOptions = {
    // 动态设置origin，当credentials为true时不能使用通配符'*'
    origin: (origin, callback) => {
        // 允许所有来源，包括null（本地文件访问）
        callback(null, true);
    },
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
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
  console.log(`创建上传目录: ${uploadPath}`);
}

// 健康检查端点
app.get('/health', (req, res) => {
  console.log('收到健康检查请求:', req.headers);
  
  // 获取数据库连接状态（如果可用）
  const dbStatus = app.locals.poolManager ? app.locals.poolManager.getStatus() : null;
  
  res.status(200).json({
    success: true,
    message: '服务运行正常',
    timestamp: new Date().toISOString(),
    database: dbStatus ? {
      healthy: dbStatus.connectionStatus.healthy,
      lastCheck: dbStatus.connectionStatus.lastCheckTime,
      poolStats: {
        active: dbStatus.poolStats.active,
        idle: dbStatus.poolStats.idle,
        total: dbStatus.poolStats.total
      }
    } : '未初始化'
  });
});

// 服务监控状态端点
app.get('/health/monitoring', async (req, res) => {
  try {
    // 获取数据库连接池状态
    const dbStatus = app.locals.poolManager ? app.locals.poolManager.getStatus() : null;
    
    // 获取服务可用性监控状态
    const serviceStatus = app.locals.serviceMonitor ? app.locals.serviceMonitor.getStatus() : null;
    
    // 获取最近的告警记录
    const recentAlerts = app.locals.serviceMonitor ? app.locals.serviceMonitor.getRecentAlerts(5) : [];
    
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      database: dbStatus,
      service: serviceStatus,
      recentAlerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取监控状态失败',
      error: error.message
    });
  }
});

// 开发环境专用压力测试端点
if (process.env.NODE_ENV !== 'production') {
  app.get('/health/stress-test', async (req, res) => {
    try {
      const { requests = 100, concurrency = 10, endpoint = '/api/test-connectivity' } = req.query;
      
      console.log(`开始压力测试: ${requests}次请求，${concurrency}并发，目标: ${endpoint}`);
      
      if (app.locals.serviceMonitor) {
        const results = await app.locals.serviceMonitor.stressTest(endpoint, parseInt(requests), parseInt(concurrency));
        res.status(200).json({
          success: true,
          message: '压力测试完成',
          results
        });
      } else {
        res.status(500).json({
          success: false,
          message: '服务监控未启动'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '压力测试失败',
        error: error.message
      });
    }
  });
}

// 数据库状态监控端点（仅管理员可访问）
app.get('/health/database', async (req, res) => {
  try {
    if (!app.locals.poolManager) {
      return res.status(503).json({
        success: false,
        message: '数据库监控未初始化'
      });
    }
    
    // 手动触发健康检查
    const healthStatus = await app.locals.poolManager.checkHealth();
    const poolStatus = app.locals.poolManager.getStatus();
    
    res.status(200).json({
      success: true,
      message: '数据库状态查询成功',
      timestamp: new Date().toISOString(),
      connectionStatus: healthStatus,
      poolStats: poolStatus.poolStats,
      config: poolStatus.config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询数据库状态失败',
      error: error.message
    });
  }
});

// 服务监控状态端点
app.get('/health/monitoring', (req, res) => {
  try {
    const monitoringStatus = {
      database: app.locals.poolManager ? app.locals.poolManager.getStatus() : '未初始化',
      service: app.locals.serviceMonitor ? app.locals.serviceMonitor.getStatus() : '未初始化'
    };
    
    // 获取最近的告警记录
    const recentAlerts = app.locals.serviceMonitor ? 
      app.locals.serviceMonitor.getRecentAlerts(5) : [];
    
    res.status(200).json({
      success: true,
      message: '监控状态查询成功',
      timestamp: new Date().toISOString(),
      monitoringStatus,
      recentAlerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '查询监控状态失败',
      error: error.message
    });
  }
});

// 服务压力测试端点（仅在开发环境可用）
if (process.env.NODE_ENV !== 'production') {
  app.post('/health/stress-test', async (req, res) => {
    try {
      if (!app.locals.serviceMonitor) {
        return res.status(503).json({
          success: false,
          message: '服务监控未初始化'
        });
      }
      
      const { requests = 10, concurrency = 2, endpoint = '/health' } = req.body;
      const fullEndpoint = `http://localhost:${process.env.PORT || 3000}${endpoint}`;
      
      const results = await app.locals.serviceMonitor.stressTest(
        fullEndpoint,
        requests,
        concurrency
      );
      
      res.status(200).json({
        success: true,
        message: '压力测试完成',
        timestamp: new Date().toISOString(),
        testConfig: {
          endpoint,
          requests,
          concurrency
        },
        results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '压力测试失败',
        error: error.message
      });
    }
  });
}

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

// 异常测试路由 - 用于验证全局异常捕获机制
app.get('/api/test-exception', (req, res) => {
  console.log('收到异常测试请求，将抛出同步异常...');
  // 故意抛出一个未捕获的异常
  throw new Error('这是一个测试异常，用于验证全局异常捕获机制');
});

// Promise拒绝测试路由
app.get('/api/test-promise-rejection', (req, res) => {
  console.log('收到Promise拒绝测试请求，将产生未处理的Promise拒绝...');
  // 创建一个会被拒绝但没有catch的Promise
  new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error('这是一个测试的Promise拒绝，用于验证全局Promise拒绝捕获'));
    }, 100);
  });
  
  res.json({
    success: true,
    message: 'Promise拒绝测试已触发，请检查服务器日志',
    timestamp: new Date().toISOString()
  });
});

// 延迟加载路由，减少启动时的内存占用
// 这里需要重新导入路由
// const userRoutes = require('./routes/userRoutes');
// const productRoutes = require('./routes/productRoutes');
// const articleRoutes = require('./routes/articleRoutes');
const userRoutes = require('./routes/supabaseUserRoutes');
const productRoutes = require('./routes/supabaseProductRoutes');
const articleRoutes = require('./routes/supabaseArticleRoutes');
const editorImageRoutes = require('./routes/editorImageRoutes');

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
    // 延迟导入Supabase配置，减少启动时内存占用
    const supabase = require('./config/supabase');
    const bcrypt = require('bcrypt');
    
    console.log('正在连接Supabase数据库...');
    
    // 测试Supabase连接
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (error) {
      throw new Error(`Supabase连接失败: ${error.message}`);
    }
    
    console.log('Supabase数据库连接成功！');
    
    // 创建默认管理员账户
    await createDefaultAdmin(supabase, bcrypt);
    
    console.log('数据库初始化完成！');
    
    // 返回空对象，因为我们不再使用Sequelize
    return { sequelize: null, poolManager: null };
  } catch (error) {
    console.error('数据库初始化失败:', error);
    // 记录到告警日志
    try {
      const alertLogPath = path.join(__dirname, 'logs/alerts.log');
      const alertMessage = `[${new Date().toISOString()}] [数据库初始化失败] ${error.message}\n`;
      if (!fs.existsSync(path.dirname(alertLogPath))) {
        fs.mkdirSync(path.dirname(alertLogPath), { recursive: true });
      }
      fs.appendFileSync(alertLogPath, alertMessage);
    } catch (logError) {
      console.error('记录数据库初始化失败日志失败:', logError);
    }
    process.exit(1);
  }
}

// 创建默认管理员账户（使用Supabase）
async function createDefaultAdmin(supabase, bcrypt) {
  try {
    const adminUsername = 'admin';
    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin123';
    
    // 检查是否已存在管理员账户
    const { data: existingAdmin, error } = await supabase
      .from('users')
      .select('id')
      .or('username.eq.' + adminUsername, 'role.eq.admin')
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116表示未找到记录
      throw error;
    }
    
    if (!existingAdmin) {
      // 加密密码
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      const { data, error } = await supabase
        .from('users')
        .insert([{
          username: adminUsername,
          password: hashedPassword,
          email: adminEmail,
          role: 'admin',
          status: true
        }]);
      
      if (error) {
        throw error;
      }
      
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
    // 确保日志目录存在
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      console.log(`创建日志目录: ${logsDir}`);
    }
    
    // 初始化数据库（使用Supabase）
    const { sequelize, poolManager } = await initDatabase();
    
    // 存储sequelize实例（null）和poolManager（null）到app对象中
    app.locals.sequelize = sequelize;
    app.locals.poolManager = poolManager;
    
    // 启动内存监控
    monitorMemoryUsage(); // 立即执行一次
    setInterval(monitorMemoryUsage, MEMORY_CHECK_INTERVAL);
    
    // 启动服务可用性监控
    console.log('启动服务可用性监控...');
    if (!ServiceMonitor) {
      ServiceMonitor = require('./utils/serviceMonitor');
    }
    
    const serviceMonitor = new ServiceMonitor({
      checkInterval: process.env.SERVICE_CHECK_INTERVAL || 60000, // 默认60秒检查一次
      timeout: process.env.SERVICE_TIMEOUT || 10000, // 默认10秒超时
      alertThreshold: 3, // 连续失败3次触发告警
      alertCooldown: 300000 // 5分钟告警冷却时间
    });
    
    // 确保服务监控实例已保存到app.locals
    app.locals.serviceMonitor = serviceMonitor;
    
    const PORT = process.env.PORT || 3000;
    
    // 启动监控
    const baseUrl = `http://localhost:${PORT}`;
    serviceMonitor.startMonitoring(baseUrl);
    
    // 存储服务监控实例
    app.locals.serviceMonitor = serviceMonitor;
    
    const server = app.listen(PORT, '0.0.0.0', () => { // 监听所有网络接口
      console.log(`服务器正在运行，端口: ${PORT}`);
      console.log(`可通过 http://localhost:${PORT} 或 http://8.136.34.190:${PORT} 访问`);
      console.log(`环境: ${process.env.NODE_ENV}`);
      console.log(`API文档: http://localhost:${PORT}/health`);
      console.log(`API基础路径: http://localhost:${PORT}/api`);
      
      // 通知PM2应用已就绪（在cluster模式下）
      if (process.send) {
        process.send('ready');
        console.log('PM2就绪通知已发送');
      }
      
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
      
      // 通知PM2应用已就绪（在cluster模式下）
      if (process.send) {
        process.send('ready');
        console.log('PM2就绪通知已发送');
      }
    });
    
    // 存储server实例到app对象中
    app.locals.server = server;
    
    // 服务器关闭时清理资源
    server.on('close', () => {
      console.log('服务器正在关闭...');
      if (app.locals.dbMonitor && app.locals.dbMonitor.stop) {
        app.locals.dbMonitor.stop();
        console.log('数据库连接池监控已停止');
      }
      if (app.locals.serviceMonitor) {
        app.locals.serviceMonitor.stopMonitoring();
        console.log('服务可用性监控已停止');
      }
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    // 记录到告警日志
    try {
      const alertLogPath = path.join(__dirname, 'logs/alerts.log');
      const alertMessage = `[${new Date().toISOString()}] [服务器启动失败] ${error.message}\n`;
      if (!fs.existsSync(path.dirname(alertLogPath))) {
        fs.mkdirSync(path.dirname(alertLogPath), { recursive: true });
      }
      fs.appendFileSync(alertLogPath, alertMessage);
    } catch (logError) {
      console.error('记录服务器启动失败日志失败:', logError);
    }
    process.exit(1);
  }
}

// 导出app供测试使用
module.exports = app;

// 监听PM2心跳检测
process.on('message', (msg) => {
  if (msg === 'online') {
    // 响应PM2的心跳检测
    if (process.send) {
      process.send('online');
    }
  }
});

// 监听PM2心跳检测
process.on('message', (msg) => {
  if (msg === 'online') {
    // 响应PM2的心跳检测
    if (process.send) {
      process.send('online');
    }
  }
});

// 启动服务器（如果直接运行此文件）
if (require.main === module) {
  startServer();
}