const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { models } = require('../config/database');
const { User } = models;
const { auth, adminAuth } = require('../middleware/auth');
const dotenv = require('dotenv');

dotenv.config();

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 验证参数
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供用户名和密码'
      });
    }
    
    // 查找用户
    const user = await User.findOne({ where: { username } });
    if (!user || !await user.validPassword(password)) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }
    
    // 检查用户状态
    if (!user.status) {
      return res.status(403).json({
        success: false,
        message: '账号已被禁用'
      });
    }
    
    // 生成JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN
      }
    );
    
    res.status(200).json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status
        },
        token
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试'
    });
  }
});

// 获取当前用户信息
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'username', 'email', 'role', 'status', 'createdAt']
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户信息失败'
    });
  }
});

// 获取所有用户（仅管理员）
router.get('/', adminAuth, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'email', 'role', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    
    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用户列表失败'
    });
  }
});

// 创建新用户（仅管理员）
router.post('/', adminAuth, async (req, res) => {
  try {
    const { username, password, email, role = 'editor' } = req.body;
    
    // 验证参数
    if (!username || !password || !email) {
      return res.status(400).json({
        success: false,
        message: '请提供必要的用户信息'
      });
    }
    
    // 检查用户名是否已存在
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }
    
    // 检查邮箱是否已存在
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: '邮箱已被注册'
      });
    }
    
    // 创建用户
    const user = await User.create({
      username,
      password,
      email,
      role
    });
    
    res.status(201).json({
      success: true,
      message: '用户创建成功',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('创建用户失败:', error);
    res.status(500).json({
      success: false,
      message: '创建用户失败'
    });
  }
});

// 更新用户信息
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, status, password } = req.body;
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 更新用户信息
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (status !== undefined) updateData.status = status;
    if (password) updateData.password = password;
    
    await user.update(updateData);
    
    res.status(200).json({
      success: true,
      message: '用户信息更新成功',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({
      success: false,
      message: '更新用户信息失败'
    });
  }
});

// 删除用户
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 不允许删除自己
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '不能删除当前登录用户'
      });
    }
    
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    await user.destroy();
    
    res.status(200).json({
      success: true,
      message: '用户删除成功'
    });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({
      success: false,
      message: '删除用户失败'
    });
  }
});

module.exports = router;