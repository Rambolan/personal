// 修复数据库表字符集的脚本
const { sequelize } = require('./config/database');

async function fixDatabaseCharset() {
  try {
    console.log('开始检查数据库表字符集...');
    
    // 检查products表的字符集
    const [results, _] = await sequelize.query(
      "SHOW CREATE TABLE products;"
    );
    console.log('Products表当前配置:', results[0]['Create Table']);
    
    // 修改表字符集
    console.log('正在修改products表字符集...');
    await sequelize.query(
      "ALTER TABLE products CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    );
    console.log('Products表字符集修改成功！');
    
    // 也修改其他相关表
    console.log('正在修改其他表字符集...');
    await sequelize.query(
      "ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    );
    await sequelize.query(
      "ALTER TABLE articles CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    );
    console.log('所有表字符集修改成功！');
    
  } catch (error) {
    console.error('修改字符集时出错:', error.message);
  } finally {
    await sequelize.close();
  }
}

fixDatabaseCharset();