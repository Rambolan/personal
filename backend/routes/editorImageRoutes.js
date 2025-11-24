const express = require('express');
const router = express.Router();
const path = require('path');
const { auth } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const dotenv = require('dotenv');

dotenv.config();

// 富文本编辑器图片上传路由
router.post('/upload', auth, uploadSingle, async (req, res) => {
  try {
    // 检查是否有文件上传
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '请选择要上传的图片',
        // TinyMCE 要求的错误格式
        error: {
          message: '请选择要上传的图片'
        }
      });
    }
    
    // 使用相对路径避免跨域问题
    const imageUrl = `/uploads/${req.file.filename}`;
    
    // 返回 TinyMCE 要求的格式
    res.status(200).json({
      success: true,
      // TinyMCE 要求的响应格式
      location: imageUrl
    });
  } catch (error) {
    console.error('编辑器图片上传失败:', error);
    res.status(500).json({
      success: false,
      message: '图片上传失败，请稍后重试',
      // TinyMCE 要求的错误格式
      error: {
        message: '图片上传失败，请稍后重试'
      }
    });
  }
});

module.exports = router;