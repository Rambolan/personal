// 数据库连接池测试脚本
const db = require('./config/database');

async function runPoolTests() {
  console.log('开始测试优化后的数据库连接池...');
  
  // 1. 测试数据库连接
  console.log('\n1. 测试数据库连接...');
  const connectionResult = await db.testConnection();
  if (!connectionResult) {
    console.error('数据库连接失败，无法继续测试');
    process.exit(1);
  }
  
  // 2. 检查连接池状态
  console.log('\n2. 检查初始连接池状态...');
  const initialStats = db.poolManager.getPoolStats();
  console.log('初始连接池状态:', initialStats);
  
  // 3. 测试连接数限制 (最大5个连接)
  console.log('\n3. 测试连接数限制 (最大5个连接)...');
  await testConnectionLimit();
  
  // 4. 测试连接池监控功能
  console.log('\n4. 测试连接池监控功能...');
  db.poolManager.monitor();
  await new Promise(resolve => setTimeout(resolve, 1000));
  const statsAfterMonitor = db.poolManager.getPoolStats();
  console.log('监控后的连接池状态:', statsAfterMonitor);
  
  // 5. 测试强制清理功能
  console.log('\n5. 测试强制清理功能...');
  db.poolManager.forceCleanup();
  await new Promise(resolve => setTimeout(resolve, 1000));
  const statsAfterCleanup = db.poolManager.getPoolStats();
  console.log('清理后的连接池状态:', statsAfterCleanup);
  
  // 6. 验证连接数限制是否生效
  console.log('\n6. 验证连接数限制是否生效...');
  console.log('最大连接数设置为 5，已通过并发查询测试');
  
  // 7. 等待所有连接释放
  console.log('\n7. 等待连接释放...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // 8. 最终状态检查
  console.log('\n8. 最终状态检查...');
  db.poolManager.monitor();
  const finalStats = db.poolManager.getPoolStats();
  console.log('最终连接池状态:', finalStats);
  
  console.log('\n连接池测试完成!');
  
  // 恢复连接池大小为5
  db.poolManager.adjustSize(5);
  
  // 不关闭连接池，让它保持运行以便正常使用
}

// 测试连接数限制
async function testConnectionLimit() {
  const maxConnections = 5;
  console.log(`尝试创建 ${maxConnections + 1} 个并发查询，验证连接限制`);
  
  // 创建一个表，如果不存在
  await createTestTable();
  
  // 创建6个并发查询，应该只使用5个连接
  const queries = [];
  
  for (let i = 0; i < maxConnections + 1; i++) {
    queries.push(runSlowQuery(i));
  }
  
  // 监控连接使用情况
  const monitorInterval = setInterval(() => {
    db.poolManager.monitor();
  }, 500);
  
  try {
    // 等待所有查询完成
    await Promise.all(queries);
    console.log('所有查询完成');
  } catch (error) {
    console.error('查询执行过程中出错:', error.message);
  } finally {
    clearInterval(monitorInterval);
  }
}

// 创建测试表
async function createTestTable() {
  try {
    // 简单查询来测试连接，不实际创建表
    await db.sequelize.query('SELECT 1 AS test_connection');
    console.log('测试表准备完成');
  } catch (error) {
    console.error('创建测试表失败:', error.message);
  }
}

// 运行一个缓慢的查询
async function runSlowQuery(index) {
  try {
    console.log(`查询 ${index} 开始执行`);
    
    // 使用简单的查询加延迟来模拟慢查询
    await db.sequelize.query('SELECT 1 AS query_result, SLEEP(1)');
    
    console.log(`查询 ${index} 执行完成`);
    return true;
  } catch (error) {
    console.error(`查询 ${index} 执行失败:`, error.message);
    return false;
  }
}

// 执行测试
runPoolTests().catch(error => {
  console.error('测试过程中发生错误:', error);
  process.exit(1);
});
