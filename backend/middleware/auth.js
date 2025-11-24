const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

// 认证中间件
const auth = (req, res, next) => {
  console.log('认证中间件 - 接收到请求:', req.method, req.path);
  
  // 从请求头获取token
  const authHeader = req.header('Authorization');
  console.log('认证中间件 - Authorization头部:', authHeader);
  
  const token = authHeader?.replace('Bearer ', '');
  console.log('认证中间件 - 提取的token:', token ? '存在' : '不存在');
  
  if (!token) {
    console.log('认证中间件 - 验证失败: 未提供认证令牌');
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌',
      detail: 'Authorization头部缺失或格式错误'
    });
  }
  
  try {
    // 验证token
    console.log('认证中间件 - 开始验证token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log('认证中间件 - 验证成功! 用户信息:', { id: decoded.id, username: decoded.username, role: decoded.role });
    next();
  } catch (error) {
    console.error('认证中间件 - 验证失败:', error.message);
    res.status(401).json({
      success: false,
      message: '认证令牌无效',
      error: error.message
    });
  }
};

// 管理员权限中间件
const adminAuth = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '没有权限执行此操作'
      });
    }
    next();
  });
};

module.exports = {
  auth,
  adminAuth
};