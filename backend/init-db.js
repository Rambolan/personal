const { sequelize, testConnection } = require('./config/database');

console.log('开始初始化数据库...');

async function initializeDatabase() {
  try {
    // 测试数据库连接
    await testConnection();
    
    console.log('正在同步数据库模型...');
    // 同步模型到数据库
    await sequelize.sync({
      alter: true, // 自动更新表结构
      logging: console.log
    });
    
    console.log('数据库模型同步完成！');
    console.log('数据库初始化成功！');
    process.exit(0);
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
}

initializeDatabase();