// Supabase配置文件
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();

// 检查必要的环境变量是否存在
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
  console.error('错误: Supabase配置缺失。请在.env文件中设置SUPABASE_URL和SUPABASE_KEY。');
  process.exit(1);
}

// 创建Supabase客户端
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY,
  {
    // 配置选项
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false,
  }
);

module.exports = supabase;
