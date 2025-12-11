// Supabase文章路由示例
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');

// 文件上传的基础路径 - 使用环境变量或默认的公共IP地址
const baseUrl = process.env.SERVER_BASE_URL || 'http://localhost:3000';

// 创建新文章
router.post('/', auth, uploadSingle, async (req, res) => {
  try {
    const { title, content, isFeatured = false, status = true } = req.body;
    
    // 验证必填参数
    if (!title) {
      return res.status(400).json({ success: false, message: '请提供文章标题' });
    }
    
    if (!content) {
      return res.status(400).json({ success: false, message: '请提供文章内容' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传封面图片' });
    }
    
    // 处理封面图片
    const coverPath = baseUrl + '/uploads/' + req.file.filename;
    
    // 创建文章 - 使用Supabase
    const { data, error } = await supabase.from('articles').insert([{
      title,
      cover: coverPath,
      content,
      isfeatured: isFeatured === 'true' || isFeatured === true,
      status: status === 'true' || status === true
    }]).single();
    
    if (error) {
      throw error;
    }
    
    res.status(201).json({
      success: true,
      message: '文章创建成功',
      data
    });
  } catch (error) {
    console.error('创建文章失败:', error);
    res.status(500).json({
      success: false,
      message: '创建文章失败，请稍后重试',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 更新文章
router.put('/:id', auth, uploadSingle, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, isFeatured, status } = req.body;
    
    // 查找文章
    const { data: article, error: findError } = await supabase.from('articles').select('*').eq('id', id).single();
    
    if (findError) {
      throw findError;
    }
    
    if (!article) {
      return res.status(404).json({ success: false, message: '文章不存在' });
    }
    
    // 准备更新数据
    const updateData = {};
    
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (isFeatured !== undefined) updateData.isfeatured = isFeatured === 'true' || isFeatured === true;
    if (status !== undefined) updateData.status = status === 'true' || status === true;
    
    // 处理封面图片更新
    if (req.file) {
      // 删除旧封面图片
      if (article.cover && article.cover.startsWith('/uploads/')) {
        const oldCoverPath = path.join(__dirname, '..', article.cover);
        try {
          await fs.unlink(oldCoverPath);
        } catch (unlinkError) {
          console.warn('删除旧封面图片失败:', unlinkError.message);
        }
      }
      
      // 设置新封面路径
      updateData.cover = baseUrl + '/uploads/' + req.file.filename;
    }
    
    // 更新文章 - 使用Supabase
    const { data, error } = await supabase.from('articles').update(updateData).eq('id', id).single();
    
    if (error) {
      throw error;
    }
    
    res.status(200).json({
      success: true,
      message: '文章更新成功',
      data
    });
  } catch (error) {
    console.error('更新文章失败:', error);
    res.status(500).json({
      success: false,
      message: '更新文章失败，请稍后重试',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 获取文章列表（后台管理）
router.get('/admin/list', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const offset = (page - 1) * limit;
    
    // 构建查询 - 使用Supabase
    let query = supabase.from('articles').select('*', { count: 'exact' });
    
    // 添加搜索条件
    if (search) {
      query = query.ilike('title', `%${search}%`);
    }
    
    // 添加分页和排序
    query = query.order('createdat', { ascending: false })
                 .range(offset, offset + parseInt(limit) - 1);
    
    // 执行查询
    const { data: articles, count, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.status(200).json({
      success: true,
      data: {
        articles,
        total: count
      }
    });
  } catch (error) {
    console.error('获取文章列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取文章列表失败，请稍后重试'
    });
  }
});

// 获取单个文章详情（前端可直接访问）
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查询文章 - 使用Supabase
    const { data: article, error } = await supabase.from('articles').select('*').eq('id', id).single();
    
    if (error) {
      throw error;
    }
    
    if (!article) {
      return res.status(404).json({ success: false, message: '文章不存在' });
    }
    
    res.status(200).json({
      success: true,
      data: article
    });
  } catch (error) {
    console.error('获取文章详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取文章详情失败，请稍后重试'
    });
  }
});

// 删除文章
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查找文章
    const { data: article, error: findError } = await supabase.from('articles').select('*').eq('id', id).single();
    
    if (findError) {
      throw findError;
    }
    
    if (!article) {
      return res.status(404).json({ success: false, message: '文章不存在' });
    }
    
    // 删除封面图片
    if (article.cover && article.cover.startsWith('/uploads/')) {
      const coverPath = path.join(__dirname, '..', article.cover);
      try {
        await fs.unlink(coverPath);
      } catch (unlinkError) {
        console.warn('删除封面图片失败:', unlinkError.message);
      }
    }
    
    // 删除文章 - 使用Supabase
    const { error } = await supabase.from('articles').delete().eq('id', id);
    
    if (error) {
      throw error;
    }
    
    res.status(200).json({
      success: true,
      message: '文章删除成功'
    });
  } catch (error) {
    console.error('删除文章失败:', error);
    res.status(500).json({
      success: false,
      message: '删除文章失败，请稍后重试',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 前端获取文章列表（可选，用于网站展示）
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, featured = false } = req.query;
    const offset = (page - 1) * limit;
    
    // 构建查询 - 使用Supabase
    let query = supabase.from('articles').select('*', { count: 'exact' });
    
    // 添加查询条件
    query = query.eq('status', true);
    
    if (featured === 'true' || featured === true) {
      query = query.eq('isfeatured', true);
    }
    
    // 添加分页和排序
    query = query.order('createdat', { ascending: false })
                 .range(offset, offset + parseInt(limit) - 1);
    
    // 执行查询
    const { data: articles, count, error } = await query;
    
    if (error) {
      throw error;
    }
    
    res.status(200).json({
      success: true,
      data: {
        articles,
        total: count
      }
    });
  } catch (error) {
    console.error('获取文章列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取文章列表失败，请稍后重试'
    });
  }
});

module.exports = router;
