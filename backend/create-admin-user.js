const { sequelize, models } = require('./config/database');
const { User } = models;

async function createAdminUser() {
  try {
    console.log('开始创建管理员用户...');
    
    // 检查users表是否存在
    const [tables] = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'", 
      { replacements: [process.env.DB_NAME] }
    );
    
    if (tables.length === 0) {
      console.error('❌ users 表不存在，请先运行 init-db.js');
      return;
    }
    
    console.log('✅ users 表已存在');
    
    // 检查是否已存在admin用户
    const existingAdmin = await User.findOne({ where: { username: 'admin' } });
    if (existingAdmin) {
      console.log('✅ 管理员用户已存在');
      console.log('用户信息:', {
        id: existingAdmin.id,
        username: existingAdmin.username,
        role: existingAdmin.role,
        status: existingAdmin.status ? '启用' : '禁用'
      });
      return;
    }
    
    // 创建新的管理员用户
    const adminUser = await User.create({
      username: 'admin',
      password: 'admin123', // 密码会在beforeCreate钩子中自动加密
      email: 'admin@example.com',
      role: 'admin',
      status: true
    });
    
    console.log('✅ 管理员用户创建成功！');
    console.log('用户信息:', {
      id: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      role: adminUser.role,
      status: adminUser.status ? '启用' : '禁用'
    });
    
  } catch (error) {
    console.error('❌ 创建管理员用户失败:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

createAdminUser();