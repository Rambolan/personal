const { sequelize, models } = require('./config/database');

async function clearDatabase() {
  try {
    console.log('正在连接数据库...');
    await sequelize.authenticate();
    console.log('数据库连接成功');

    console.log('\n=== 数据库清除脚本 ===');
    console.log('当前数据库中的数据：');
    
    // 显示当前数据统计
    const userCount = await models.User.count();
    const productCount = await models.Product.count();
    const articleCount = await models.Article.count();
    
    console.log(`用户数量: ${userCount}`);
    console.log(`作品数量: ${productCount}`);
    console.log(`文章数量: ${articleCount}`);
    
    console.log('\n请选择要清除的数据：');
    console.log('1. 清除所有作品数据 (products)');
    console.log('2. 清除所有文章数据 (articles)');
    console.log('3. 清除所有用户数据 (users)');
    console.log('4. 清除所有数据 (包括用户、作品、文章)');
    console.log('5. 仅清除测试数据 (status=false的数据)');
    console.log('0. 退出');
    
    // 由于这是脚本文件，我们需要通过命令行参数来决定操作
    const args = process.argv.slice(2);
    const choice = args[0] || 'help';
    
    switch(choice) {
      case '1':
        console.log('\n正在清除所有作品数据...');
        await models.Product.destroy({ where: {} });
        console.log('✅ 作品数据清除完成');
        break;
        
      case '2':
        console.log('\n正在清除所有文章数据...');
        await models.Article.destroy({ where: {} });
        console.log('✅ 文章数据清除完成');
        break;
        
      case '3':
        console.log('\n正在清除所有用户数据...');
        await models.User.destroy({ where: {} });
        console.log('✅ 用户数据清除完成');
        break;
        
      case '4':
        console.log('\n正在清除所有数据...');
        await models.Product.destroy({ where: {} });
        await models.Article.destroy({ where: {} });
        await models.User.destroy({ where: {} });
        console.log('✅ 所有数据清除完成');
        break;
        
      case '5':
        console.log('\n正在清除测试数据...');
        await models.Product.destroy({ where: { status: false } });
        await models.Article.destroy({ where: { status: false } });
        console.log('✅ 测试数据清除完成');
        break;
        
      case 'help':
      default:
        console.log('\n使用方法：');
        console.log('node clear-database.js [选项]');
        console.log('选项：');
        console.log('  1  - 清除所有作品数据');
        console.log('  2  - 清除所有文章数据');
        console.log('  3  - 清除所有用户数据');
        console.log('  4  - 清除所有数据');
        console.log('  5  - 清除测试数据');
        console.log('  help - 显示帮助信息');
        break;
    }
    
    // 显示清除后的数据统计
    if (choice !== 'help') {
      console.log('\n清除后的数据统计：');
      const newUserCount = await models.User.count();
      const newProductCount = await models.Product.count();
      const newArticleCount = await models.Article.count();
      
      console.log(`用户数量: ${newUserCount}`);
      console.log(`作品数量: ${newProductCount}`);
      console.log(`文章数量: ${newArticleCount}`);
    }
    
  } catch (error) {
    console.error('清除数据库时出错:', error);
  } finally {
    await sequelize.close();
    console.log('\n数据库连接已关闭');
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  clearDatabase();
}

module.exports = clearDatabase;