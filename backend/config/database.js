// 避免过早加载所有依赖
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

// 数据库连接池动态管理配置
const POOL_MONITOR_INTERVAL = process.env.POOL_MONITOR_INTERVAL || 60000; // 默认60秒
const MIN_CONNECTIONS = parseInt(process.env.DB_POOL_MIN) || 5; // 最小连接数
const INITIAL_MAX_CONNECTIONS = parseInt(process.env.DB_POOL_MAX) || 10; // 初始最大连接数
const MAX_SCALABLE_CONNECTIONS = parseInt(process.env.DB_POOL_MAX_SCALABLE) || 20; // 最大可扩展连接数
const SCALE_UP_THRESHOLD = 80; // 扩容阈值（百分比）
const SCALE_DOWN_THRESHOLD = 30; // 缩容阈值（百分比）
const CONNECTION_TIMEOUT_THRESHOLD = 5000; // 连接超时阈值（毫秒）
const SCALE_UP_STEP = 2; // 扩容步长
const SCALE_DOWN_STEP = 1; // 缩容步长
const SCALE_UP_COOLDOWN = 60000; // 扩容冷却时间（1分钟）
const SCALE_DOWN_COOLDOWN = 300000; // 缩容冷却时间（5分钟）
const ALERT_LOG_PATH = path.join(__dirname, '../logs/alerts.log'); // 告警日志路径
const POOL_LOG_PATH = path.join(__dirname, '../logs/pool_manager.log'); // 连接池管理日志路径

let poolStats = { 
  active: 0, 
  idle: 0, 
  total: 0,
  currentMax: INITIAL_MAX_CONNECTIONS, // 当前最大连接数
  peakActive: 0,
  peakIdle: 0,
  peakTotal: 0,
  errorCount: 0,
  lastError: null,
  lastHighUsage: null,
  lastLowUsage: null,
  connectionFailures: 0,
  lastConnectionTime: null,
  lastScaleUp: null,
  lastScaleDown: null
};

// 负载历史记录，用于分析趋势
const loadHistory = [];
const MAX_HISTORY_RECORDS = 100; // 最多保留100条记录
let lastPoolCheck = new Date().toISOString();
let monitorInterval = null;
let connectionStatus = {
  healthy: true,
  lastCheckTime: new Date().toISOString(),
  consecutiveFailures: 0,
  recoveryTime: null
};

// 连接池监控函数
async function monitorConnectionPool(pool) {
  if (!pool) return;
  
  // 尝试使用不同的方式获取连接池状态
  let active = 0;
  let idle = 0;
  let total = 0;
  
  try {
    // Sequelize 6.x 及以上版本使用的方法
    if (typeof pool._acquireQueue !== 'undefined') {
      active = pool._connections ? Object.keys(pool._connections).length : 0;
      idle = pool._idleConnections ? pool._idleConnections.length : 0;
      total = active + idle;
    } 
    // 旧版本的回退方法
    else if (typeof pool.numUsed === 'function') {
      active = pool.numUsed();
      idle = pool.numFree();
      total = pool.size();
    }
    // 最基本的回退
    else {
      console.log('[连接池监控] 无法获取精确的连接池状态');
      // 使用估算值
      active = 0;
      idle = 0;
      total = 0;
    }
  } catch (error) {
    console.error('[连接池监控] 获取状态时出错:', error.message);
  }
  
  const stats = {
    active,
    idle,
    total,
    createdAt: new Date().toISOString()
  };
  
  // 计算连接使用率
  const usageRate = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
  
  // 更新统计信息
  poolStats = {
    ...poolStats,
    ...stats,
    usageRate,
    peakActive: Math.max(poolStats.peakActive || 0, stats.active),
    peakIdle: Math.max(poolStats.peakIdle || 0, stats.idle),
    peakTotal: Math.max(poolStats.peakTotal || 0, stats.total),
    lastHighUsage: usageRate > 80 ? new Date().toISOString() : poolStats.lastHighUsage,
    lastLowUsage: usageRate < 20 ? new Date().toISOString() : poolStats.lastLowUsage
  };
  
  // 更新最后检查时间
  lastPoolCheck = new Date().toISOString();
  
  // 记录监控日志
  console.log(`[数据库连接池监控] 活跃: ${stats.active}/${poolStats.currentMax}, 空闲: ${stats.idle}, 使用率: ${usageRate}%`);
  
  // 检查是否需要告警
    if (usageRate >= SCALE_UP_THRESHOLD) {
      logAlert(`[连接池告警] 连接池使用率过高: ${usageRate}% (活跃: ${stats.active}/${poolStats.currentMax})`);
    }
    
    // 尝试智能调整连接池大小
    if (Math.random() < 0.5) { // 50%的概率尝试调整，避免过于频繁
      try {
        await smartAdjustPoolSize(pool);
      } catch (error) {
        console.error('[智能调整] 调整连接池大小时出错:', error.message);
      }
    }
  
  // 自动清理机制
  performAutoCleanup(pool, stats);
  
  // 定期检查数据库连接健康状态
  if (Math.random() < 0.1) { // 10%的概率执行健康检查
    checkDatabaseHealth();
  }
}

// 自动清理连接池函数
function performAutoCleanup(pool, stats) {
  // 空闲连接过多时的清理策略
  if (stats.idle > Math.max(2, Math.floor(stats.total * 0.7))) {
    console.log(`[连接池清理] 检测到 ${stats.idle} 个空闲连接，尝试回收多余连接`);
    // 强制关闭一些空闲连接（但保留最小连接数）
    const targetIdle = Math.max(1, pool.config.min || 1);
    const connectionsToRemove = stats.idle - targetIdle;
    
    if (connectionsToRemove > 0 && pool._idleConnections && pool._idleConnections.length > 0) {
      try {
        // 关闭多余的空闲连接
        const connectionsToClose = pool._idleConnections.slice(0, connectionsToRemove);
        connectionsToClose.forEach(conn => {
          try {
            if (conn && conn.release) {
              conn.release();
              console.log('[连接池清理] 释放一个空闲连接');
            }
          } catch (error) {
            console.error('[连接池清理] 释放连接时出错:', error.message);
          }
        });
      } catch (error) {
        console.error('[连接池清理] 执行清理操作时出错:', error.message);
      }
    }
  }
  
  // 连接池使用率过高的警告
    if (stats.active >= poolStats.currentMax * 0.9) {
      console.warn(`[连接池警告] 连接使用率超过90%，当前活跃: ${stats.active}/${poolStats.currentMax}`);
    }
  
  // 长时间低使用率检测
  const usageRate = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
  if (usageRate < 10 && poolStats.lastHighUsage && 
      (new Date() - new Date(poolStats.lastHighUsage)) / (1000 * 60 * 60) > 24) {
    console.log('[连接池优化] 检测到超过24小时的低使用率，可以考虑减小连接池大小');
  }
}

// 动态调整连接池大小的函数
async function adjustPoolSize(pool, newMax) {
  try {
    console.log(`[连接池调整] 尝试将连接池大小从 ${poolStats.currentMax} 调整到 ${newMax}`);
    
    // 记录调整操作
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [连接池调整] 从 ${poolStats.currentMax} 调整到 ${newMax}\n`;
    
    try {
      fs.appendFileSync(POOL_LOG_PATH, logMessage);
    } catch (writeError) {
      console.error('[连接池日志错误] 无法写入连接池管理日志:', writeError.message);
    }
    
    // 在Sequelize中，我们需要重新配置连接池
    // 1. 更新当前最大连接数记录
    poolStats.currentMax = newMax;
    
    // 2. 如果可能，尝试动态调整连接池
    if (pool && pool.setMax) {
      pool.setMax(newMax);
      console.log(`[连接池调整] 成功将连接池大小调整为 ${newMax}`);
      return true;
    } else {
      console.warn('[连接池调整] 当前连接池实现不支持动态调整，需要在重启时生效');
      return false;
    }
  } catch (error) {
    console.error(`[连接池调整] 调整失败: ${error.message}`);
    logAlert(`[连接池调整失败] ${error.message}`);
    return false;
  }
}

// 记录负载历史
function recordLoadHistory(active, idle, total, usageRate) {
  const record = {
    timestamp: Date.now(),
    active,
    idle,
    total,
    usageRate
  };
  
  loadHistory.push(record);
  
  // 只保留最近的记录
  if (loadHistory.length > MAX_HISTORY_RECORDS) {
    loadHistory.shift();
  }
}

// 分析负载趋势
function analyzeLoadTrend(minutes = 5) {
  const cutoffTime = Date.now() - (minutes * 60 * 1000);
  const recentLoad = loadHistory.filter(record => record.timestamp >= cutoffTime);
  
  if (recentLoad.length < 5) { // 需要至少5个数据点才有意义
    return { trend: 'insufficient_data', averageUsage: 0 };
  }
  
  const averageUsage = recentLoad.reduce((sum, record) => sum + record.usageRate, 0) / recentLoad.length;
  
  // 计算趋势
  const firstHalf = recentLoad.slice(0, Math.floor(recentLoad.length / 2));
  const secondHalf = recentLoad.slice(Math.floor(recentLoad.length / 2));
  
  const firstHalfAvg = firstHalf.reduce((sum, record) => sum + record.usageRate, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, record) => sum + record.usageRate, 0) / secondHalf.length;
  
  let trend = 'stable';
  if (secondHalfAvg > firstHalfAvg * 1.2) { // 增长超过20%
    trend = 'increasing';
  } else if (secondHalfAvg < firstHalfAvg * 0.8) { // 下降超过20%
    trend = 'decreasing';
  }
  
  return {
    trend,
    averageUsage: averageUsage.toFixed(2),
    firstHalfAverage: firstHalfAvg.toFixed(2),
    secondHalfAverage: secondHalfAvg.toFixed(2),
    dataPoints: recentLoad.length
  };
}

// 智能调整连接池大小
async function smartAdjustPoolSize(pool) {
  const now = Date.now();
  const stats = { ...poolStats };
  const usageRate = stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
  
  // 记录当前负载
  recordLoadHistory(stats.active, stats.idle, stats.total, usageRate);
  
  // 分析负载趋势
  const trend = analyzeLoadTrend();
  
  // 检查是否需要扩容
  if (usageRate >= SCALE_UP_THRESHOLD && 
      stats.currentMax < MAX_SCALABLE_CONNECTIONS &&
      (!poolStats.lastScaleUp || (now - poolStats.lastScaleUp) >= SCALE_UP_COOLDOWN)) {
    
    const newMax = Math.min(stats.currentMax + SCALE_UP_STEP, MAX_SCALABLE_CONNECTIONS);
    const result = await adjustPoolSize(pool, newMax);
    
    if (result) {
      poolStats.lastScaleUp = now;
      logAlert(`[连接池扩容] 成功将连接池从 ${stats.currentMax - SCALE_UP_STEP} 扩容到 ${stats.currentMax}`);
      console.log(`[智能调整] 根据负载趋势(${trend.trend})和使用率(${usageRate}%)，连接池已扩容`);
      return 'scaled_up';
    }
  }
  // 检查是否需要缩容
  else if (usageRate <= SCALE_DOWN_THRESHOLD && 
           stats.currentMax > MIN_CONNECTIONS &&
           (!poolStats.lastScaleDown || (now - poolStats.lastScaleDown) >= SCALE_DOWN_COOLDOWN) &&
           stats.active <= stats.currentMax - SCALE_DOWN_STEP) { // 确保不会影响现有连接
    
    const newMax = Math.max(stats.currentMax - SCALE_DOWN_STEP, MIN_CONNECTIONS);
    const result = await adjustPoolSize(pool, newMax);
    
    if (result) {
      poolStats.lastScaleDown = now;
      console.log(`[智能调整] 根据负载趋势(${trend.trend})和使用率(${usageRate}%)，连接池已缩容`);
      return 'scaled_down';
    }
  }
  
  return 'no_change';
}

// 告警日志记录函数
function logAlert(message) {
  const timestamp = new Date().toISOString();
  const alertMessage = `[${timestamp}] ${message}\n`;
  
  console.error(`⚠️ ${message}`);
  
  // 写入告警日志文件
  try {
    fs.appendFileSync(ALERT_LOG_PATH, alertMessage);
  } catch (writeError) {
    console.error('[告警日志错误] 无法写入告警日志:', writeError.message);
  }
}

// 数据库健康检查函数
async function checkDatabaseHealth() {
  try {
    const startTime = Date.now();
    await sequelize.query('SELECT 1');
    const duration = Date.now() - startTime;
    
    connectionStatus = {
      healthy: true,
      lastCheckTime: new Date().toISOString(),
      consecutiveFailures: 0,
      responseTime: duration,
      recoveryTime: connectionStatus.consecutiveFailures > 0 ? new Date().toISOString() : null
    };
    
    // 记录连接恢复
    if (connectionStatus.recoveryTime) {
      logAlert(`[数据库状态] 连接已恢复，响应时间: ${duration}ms`);
    }
    
    console.log(`[数据库健康检查] 正常，响应时间: ${duration}ms`);
  } catch (error) {
    connectionStatus.consecutiveFailures++;
    connectionStatus.healthy = false;
    connectionStatus.lastCheckTime = new Date().toISOString();
    
    poolStats.errorCount++;
    poolStats.lastError = {
      message: error.message,
      time: new Date().toISOString()
    };
    
    const alertMessage = `[数据库健康检查失败] ${error.message} (连续失败: ${connectionStatus.consecutiveFailures})`;
    logAlert(alertMessage);
    
    // 如果连续失败次数过多，尝试重新连接
    if (connectionStatus.consecutiveFailures >= 3) {
      logAlert('[数据库重连] 检测到多次连接失败，尝试重新建立数据库连接');
      try {
        await sequelize.authenticate();
        logAlert('[数据库重连] 重新连接成功');
        connectionStatus.consecutiveFailures = 0;
        connectionStatus.healthy = true;
      } catch (reconnectError) {
        logAlert(`[数据库重连失败] ${reconnectError.message}`);
      }
    }
  }
}

function adjustPoolSize(pool, newMax) {
  if (pool && pool.config && newMax > 0) {
    try {
      const oldMax = pool.config.max || 5;
      const adjustedMax = Math.min(newMax, 50); // 限制最大调整上限
      console.log(`[数据库连接池调整] 调整最大连接数从 ${oldMax} 到 ${adjustedMax}`);
      pool.config.max = adjustedMax;
      logAlert(`[连接池动态调整] 最大连接数已从 ${oldMax} 调整为 ${adjustedMax}`);
      return true;
    } catch (error) {
      console.error('[数据库连接池调整] 调整大小时出错:', error.message);
      logAlert(`[连接池调整错误] ${error.message}`);
      return false;
    }
  }
  console.log('[数据库连接池调整] 连接池或配置不可用');
  return false;
}

const { Sequelize, Op } = require('sequelize');

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
    dialect: 'postgres',
    timezone: '+08:00',
    // 使用自定义日志函数
    logging: process.env.NODE_ENV === 'development' ? customLogger : false,
    dialectOptions: {
      // PostgreSQL 特定配置
      ssl: process.env.DB_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false,
      // 设置连接超时
      connectTimeout: 30000
    },
    pool: {
        max: INITIAL_MAX_CONNECTIONS, // 初始最大连接数，后续可能动态调整
        min: MIN_CONNECTIONS, // 最小连接数
        acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 20000, // 减少获取超时时间到20秒
        idle: parseInt(process.env.DB_POOL_IDLE) || 5000, // 减少空闲超时时间到5秒
        // 处理连接错误
        evict: 3000, // 每3秒检查一次连接
        // 最大连接生命周期
        maxUses: 5000 // 每个连接最多使用5000次后会被回收
      },
  // 全局字符集配置
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  },
  // 连接重试配置
  retry: {
    max: 2, // 减少重试次数避免连接风暴
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
      ],
      backoffBase: 1000, // 重试基础延迟1秒
      backoffExponent: 1.5 // 指数退避因子
    },
    // 启用连接池预热
    poolWarmup: true
  }
);

// 连接钩子 - 连接前
sequelize.addHook('beforeConnect', async (config) => {
  console.log(`[数据库连接] 正在连接到 ${config.host}:${config.port}`);
});

// 连接钩子 - 连接后
sequelize.addHook('afterConnect', async (connection, config) => {
  console.log(`[数据库连接] 成功连接到 ${config.host}:${config.port}`);
});

// 测试数据库连接
async function testConnection() {
  try {
    console.log('[数据库] 正在测试连接...');
    await sequelize.authenticate();
    console.log('[数据库] 连接成功!');
    
    // 初始化连接池监控
    const pool = sequelize.connectionManager?.pool;
    if (pool) {
      try {
        // 立即执行一次监控
        monitorConnectionPool(pool);
        
        // 设置定时监控
        setInterval(() => {
          monitorConnectionPool(pool);
        }, POOL_MONITOR_INTERVAL);
        
        console.log(`[数据库] 连接池监控已启动，间隔 ${POOL_MONITOR_INTERVAL/1000} 秒`);
      } catch (error) {
        console.error('[数据库] 初始化连接池监控时出错:', error.message);
      }
    } else {
      console.log('[数据库] 连接池不可用，跳过监控初始化');
    }
    
    return true;
  } catch (error) {
    console.error('[数据库] 连接失败:', error.message);
    // 记录详细错误信息，但只在开发环境
    if (process.env.NODE_ENV === 'development') {
      console.error(error);
    }
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

// 设置模型关联
// User.hasMany(Article);
// Article.belongsTo(User);

// 导出数据库相关功能和连接池管理
module.exports = {
  sequelize,
  Sequelize,
  Op,
  testConnection,
  models: {
    User,
    Product,
    Article
  },
  // 连接池管理功能
  poolManager: {
    getPoolStats: () => ({ ...poolStats, lastCheck: lastPoolCheck }),
    monitor: async () => {
      // 启动连接池监控
      console.log('[连接池管理] 启动动态连接池监控');
      
      // 确保日志目录存在
      try {
        const logsDir = path.join(__dirname, '../logs');
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
      } catch (err) {
        console.error('[日志目录创建失败]', err.message);
      }
      
      // 立即执行一次监控
      const pool = sequelize.connectionManager.pool;
      if (pool) {
        try {
          await monitorConnectionPool(pool);
        } catch (error) {
          console.error('[连接池监控] 初始化监控失败:', error.message);
          logAlert(`[监控初始化错误] ${error.message}`);
        }
      }
      
      // 设置定时监控
      if (monitorInterval) {
        clearInterval(monitorInterval);
      }
      
      monitorInterval = setInterval(async () => {
        try {
          const pool = sequelize.connectionManager.pool;
          if (pool) {
            await monitorConnectionPool(pool);
          }
        } catch (error) {
          console.error('[监控定时器错误]', error.message);
          logAlert(`[监控系统错误] ${error.message}`);
        }
      }, POOL_MONITOR_INTERVAL);
      
      // 启动定期健康检查（每30秒）
      setInterval(async () => {
        try {
          await checkDatabaseHealth();
        } catch (error) {
          console.error('[健康检查] 执行失败:', error.message);
        }
      }, 30000);
      
      return {
        stop: () => poolManager.close()
      };
    },
    forceCleanup: () => {
      const pool = sequelize.connectionManager.pool;
      if (pool && poolStats.idle > 0) {
        console.log('[连接池强制清理] 手动触发连接回收');
        try {
          performAutoCleanup(pool, poolStats);
        } catch (error) {
          console.error('[连接池管理] 强制清理时出错:', error.message);
          logAlert(`[连接池清理错误] ${error.message}`);
        }
      }
    },
    close: async () => {
      const pool = sequelize.connectionManager.pool;
      
      // 停止监控
      if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
        console.log('[连接池监控] 监控已停止');
        
        // 记录停止信息
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [连接池监控] 已停止\n`;
        
        try {
          fs.appendFileSync(POOL_LOG_PATH, logMessage);
        } catch (writeError) {
          console.error('[连接池日志错误] 无法写入关闭日志:', writeError.message);
        }
      }
      
      // 关闭连接池
      if (pool) {
        console.log('[连接池] 开始关闭所有连接...');
        try {
          await pool.close();
          console.log('[连接池] 所有连接已关闭');
        } catch (error) {
          console.error('[连接池] 关闭连接时出错:', error.message);
          logAlert(`[连接池关闭错误] ${error.message}`);
        }
      }
    },
    adjustSize: async (newMax) => {
      // 参数验证
      if (!newMax || typeof newMax !== 'number' || newMax < MIN_CONNECTIONS || newMax > MAX_SCALABLE_CONNECTIONS) {
        throw new Error(`无效的连接池大小，必须在 ${MIN_CONNECTIONS} 到 ${MAX_SCALABLE_CONNECTIONS} 之间`);
      }
      return await smartAdjustPoolSize(sequelize.connectionManager?.pool);
    },
    // 获取当前连接池状态
    getStatus: () => {
      return {
        poolStats: { ...poolStats },
        connectionStatus: { ...connectionStatus },
        loadTrend: analyzeLoadTrend(),
        config: {
          minConnections: MIN_CONNECTIONS,
          currentMax: poolStats.currentMax,
          maxScalable: MAX_SCALABLE_CONNECTIONS,
          monitorInterval: POOL_MONITOR_INTERVAL,
          scaleUpThreshold: SCALE_UP_THRESHOLD,
          scaleDownThreshold: SCALE_DOWN_THRESHOLD
        },
        historyRecords: loadHistory.length,
        lastCheck: lastPoolCheck
      };
    },
    // 手动触发健康检查
    checkHealth: async () => {
      await checkDatabaseHealth();
      return connectionStatus;
    }
  }
};
