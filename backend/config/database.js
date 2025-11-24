const { Sequelize, Op } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

// 自定义日志函数
function customLogger(query, timing) {
  // 只记录开发环境的SQL查询
  if (process.env.NODE_ENV === 'development') {
    const colors = {
      reset: '\x1b[0m',
      green: '\x1b[32m',
      yellow: '\x1b[33m'
    };
    
    console.log(`${colors.green}[SQL]${colors.reset} ${query}`);
    console.log(`${colors.yellow}[执行时间]${colors.reset} ${timing}ms`);
  }
}

// 创建数据库连接
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    timezone: '+08:00',
    // 使用自定义日志函数
    logging: process.env.NODE_ENV === 'development' ? customLogger : false,
    dialectOptions: {
      // 只在有socketPath时使用，否则使用TCP连接
      ...(process.env.DB_SOCKET && { socketPath: process.env.DB_SOCKET }),
      // 增加排序缓冲区大小
      sortBufferSize: 2097152, // 2MB
      // 增加临时表大小
      tmpTableSize: 67108864, // 64MB
      maxAllowedPacket: 67108864, // 64MB
      // 启用连接池复用
      keepAlive: true,
      keepAliveInitialDelay: 10000
    },
    pool: {
      max: 15, // 增加连接池最大值
      min: 2, // 保持最小连接数
      acquire: 60000, // 增加获取超时时间
      idle: 30000, // 增加空闲超时时间
      // 处理连接错误
      evict: 10000 // 每10秒检查一次连接
    },
    // 连接重试配置
    retry: {
      max: 3, // 最大重试次数
      match: [
        /ETIMEDOUT/,
        /ECONNRESET/,
        /EADDRINUSE/,
        /ECONNREFUSED/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/
      ]
    }
  }
);

// 配置连接池钩子
sequelize.addHook('beforeConnect', async (config) => {
  console.log('即将建立数据库连接...');
  // 可以在这里修改连接配置
  return config;
});

sequelize.addHook('afterConnect', async (connection, config) => {
  console.log('✅ 数据库连接已建立');
  // 设置会话变量
  try {
    await connection.query('SET SESSION max_execution_time=30000;');
  } catch (err) {
    console.warn('⚠️ 设置会话参数失败:', err.message);
  }
});

// 测试数据库连接
async function testConnection() {
  try {
    console.log('正在测试数据库连接...');
    console.log(`连接信息: ${process.env.DB_USER}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    
    // 测试基本查询
    const [results] = await sequelize.query('SELECT 1 + 1 AS solution');
    console.log(`✅ 数据库查询测试成功: 1 + 1 = ${results[0].solution}`);
    
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    console.error('错误详情:', error.original ? error.original.message : error);
    console.error('请检查以下事项:');
    console.error('1. 数据库服务是否正在运行');
    console.error('2. 数据库凭证是否正确');
    console.error('3. 数据库名称是否存在');
    console.error('4. 端口是否正确');
    return false;
  }
}

// 导入模型
const UserModel = require('../models/User');
const ProductModel = require('../models/Product');
const ArticleModel = require('../models/Article');

// 初始化模型
const User = UserModel(sequelize);
const Product = ProductModel(sequelize);
const Article = ArticleModel(sequelize);

module.exports = {
  sequelize,
  Sequelize,
  Op,
  testConnection,
  models: {
    User,
    Product,
    Article
  }
};