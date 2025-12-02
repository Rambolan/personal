const mysql = require('mysql2/promise');
require('dotenv').config();

async function testDbConnection() {
  try {
    console.log('测试数据库连接...');
    console.log(`配置: host=${process.env.DB_HOST}, user=${process.env.DB_USER}, port=${process.env.DB_PORT}`);
    
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT
    });
    
    console.log('✅ 数据库连接成功!');
    
    // 检查数据库是否存在
    const [databases] = await connection.query('SHOW DATABASES LIKE ?', [process.env.DB_NAME]);
    if (databases.length > 0) {
      console.log(`✅ 数据库 ${process.env.DB_NAME} 已存在`);
      
      // 连接到具体数据库
      await connection.changeUser({ database: process.env.DB_NAME });
      console.log(`✅ 已成功连接到数据库 ${process.env.DB_NAME}`);
      
      // 检查用户表是否存在
      const [tables] = await connection.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = 'Users'", 
        [process.env.DB_NAME]
      );
      
      if (tables.length > 0) {
        console.log('✅ Users 表已存在');
        // 查询用户数量
        const [users] = await connection.query('SELECT COUNT(*) as count FROM Users');
        console.log(`✅ Users 表中有 ${users[0].count} 条记录`);
      } else {
        console.log('❌ Users 表不存在');
      }
    } else {
      console.log(`❌ 数据库 ${process.env.DB_NAME} 不存在`);
    }
    
    await connection.end();
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  }
}

testDbConnection().then(success => {
  console.log('\n测试完成:', success ? '成功' : '失败');
});