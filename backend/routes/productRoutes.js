const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { Op } = require('sequelize');
const { models } = require('../config/database');
const { Product } = models;
const { auth, adminAuth } = require('../middleware/auth');
const { uploadSingle, uploadMultiple } = require('../middleware/upload');
const multer = require('multer');
const dotenv = require('dotenv');

// 创建产品专用的multer实例
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_PATH);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件（JPG, JPEG, PNG, GIF, WebP）'));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE)
  }
});

// 为产品路由创建专门的文件上传中间件
const uploadProductFiles = upload.fields([
    { name: 'cover', maxCount: 1 },
    { name: 'images', maxCount: 20 }
]);

dotenv.config();

// 创建新作品
router.post('/', auth, uploadProductFiles, async (req, res) => {
  try {
    console.log('=== 创建作品API被调用 ===');
    console.log('请求方法:', req.method);
    console.log('请求路径:', req.path);
    console.log('完整URL:', req.originalUrl);
    console.log('请求头:', req.headers);
    console.log('接收到创建作品请求');
    console.log('请求体数据:', req.body);
    console.log('文件数据:', req.files ? `接收到的文件类型: ${Object.keys(req.files).join(', ')}` : '无文件');
    
    const { title, description, stars, tags, date } = req.body;
    
    // 验证必填参数
    console.log('验证必填参数 - 标题存在:', !!title);
    console.log('验证必填参数 - 封面文件存在:', req.files && req.files.cover && req.files.cover.length > 0);
    
    if (!title) {
      console.log('验证失败: 标题为空');
      return res.status(400).json({
        success: false,
        message: '请提供作品标题',
        field: 'title',
        value: title
      });
    }
    
    if (!req.files || !req.files.cover || req.files.cover.length === 0) {
      console.log('验证失败: 没有上传封面文件');
      return res.status(400).json({
        success: false,
        message: '请上传封面图片',
        filesCount: req.files ? Object.values(req.files).reduce((total, files) => total + files.length, 0) : 0
      });
    }
    
    // 处理标签数据
    let processedTags = [];
    if (tags) {
      try {
        processedTags = Array.isArray(tags) ? tags : JSON.parse(tags);
        if (!Array.isArray(processedTags)) {
          processedTags = [processedTags];
        }
      } catch (e) {
        processedTags = [tags];
      }
    }
    
    // 处理封面图片
    const coverImage = req.files.cover[0];
    const baseUrl = `http://8.136.34.190:3000`;
    const coverPath = `${baseUrl}/uploads/${coverImage.filename}`;
    
    // 处理作品图片，按文件名排序
    let otherImages = [];
    if (req.files.images && req.files.images.length > 0) {
      // 先创建包含文件名的临时数组，然后按文件名排序
      const tempImages = req.files.images.map((file, index) => ({
        url: `http://8.136.34.190:3000/uploads/${file.filename}`,
        originalname: file.originalname,
        filename: file.filename,
        tempIndex: index
      }));
      
      // 按文件名中的数字排序（由小到大）
      tempImages.sort((a, b) => {
        // 提取文件名中的数字进行比较
        const extractNumber = (filename) => {
          const match = filename.match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        };
        
        const numA = extractNumber(a.originalname);
        const numB = extractNumber(b.originalname);
        
        // 如果都有数字，按数字大小排序
        if (numA !== 0 && numB !== 0) {
          return numA - numB;
        }
        
        // 如果只有一个有数字，有数字的排前面
        if (numA !== 0) return -1;
        if (numB !== 0) return 1;
        
        // 如果都没有数字，按字母顺序排序
        return a.originalname.localeCompare(b.originalname);
      });
      
      // 排序后设置order
      otherImages = tempImages.map((file, index) => ({
        url: file.url,
        order: index
      }));
      
      console.log('=== 创建作品时图片按文件名排序 ===');
      console.log('上传的文件列表:', tempImages.map(f => ({ originalname: f.originalname, filename: f.filename })));
      console.log('排序后的图片order:', otherImages.map((img, index) => ({ url: img.url, order: img.order })));
    }
    
    // 获取featured字段，默认为false
    const featured = req.body.featured === 'true' || req.body.featured === true;
    
    // 创建作品
    const product = await Product.create({
      title,
      cover: coverPath,
      description: description || '',
      stars: parseInt(stars) || 0,
      tags: processedTags,
      date: date || new Date(),
      images: otherImages || [],
      featured: featured
    });
    
    res.status(201).json({
      success: true,
      message: '作品创建成功',
      data: product
    });
  } catch (error) {
    // 清理已上传的文件
    if (req.files) {
      try {
        // 清理封面文件
        if (req.files.cover) {
          for (const file of req.files.cover) {
            await fs.unlink(path.join(process.env.UPLOAD_PATH, file.filename));
          }
        }
        // 清理作品图片文件
        if (req.files.images) {
          for (const file of req.files.images) {
            await fs.unlink(path.join(process.env.UPLOAD_PATH, file.filename));
          }
        }
      } catch (e) {
        console.error('清理上传文件失败:', e);
      }
    }
    
    console.error('创建作品失败:', error);
    res.status(500).json({
      success: false,
      message: '创建作品失败，请稍后重试'
    });
  }
});

// 更新作品
router.put('/:id', auth, uploadProductFiles, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, stars, tags, date, status } = req.body;
    
    // 查找作品
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '作品不存在'
      });
    }
    
    // 处理标签数据
    let processedTags = [];
    if (tags) {
      try {
        processedTags = Array.isArray(tags) ? tags : JSON.parse(tags);
        if (!Array.isArray(processedTags)) {
          processedTags = [processedTags];
        }
      } catch (e) {
        processedTags = [tags];
      }
    }
    
    // 更新作品信息
    const updateData = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (stars !== undefined) updateData.stars = parseInt(stars) || 0;
    if (tags !== undefined) updateData.tags = processedTags;
    if (date) updateData.date = date;
    if (status !== undefined) updateData.status = status;
    // 添加对featured字段的处理
    if (req.body.featured !== undefined) updateData.featured = req.body.featured === 'true' || req.body.featured === true;
    
    // 处理封面上传
    let oldCover = null;
    if (req.files && req.files.cover && req.files.cover.length > 0) {
      oldCover = product.cover;
      // 从URL中提取文件名用于删除
      if (oldCover) {
        oldCover = oldCover.split('/').pop();
      }
      updateData.cover = `http://8.136.34.190:3000/uploads/${req.files.cover[0].filename}`;
    }
    
    // 处理作品图片上传，按文件名排序
    let oldImages = [];
    if (req.files && req.files.images && req.files.images.length > 0) {
      // 提取旧图片文件名用于删除
      if (product.images && product.images.length > 0) {
        oldImages = product.images.map(img => {
          // 兼容旧格式（字符串）和新格式（对象）
          if (typeof img === 'string') {
            return img.split('/').pop();
          } else if (img && img.url) {
            return img.url.split('/').pop();
          }
          return null;
        }).filter(Boolean);
      }
      
      // 先创建包含文件名的临时数组，然后按文件名排序
      const tempImages = req.files.images.map((file, index) => ({
        url: `${baseUrl}/uploads/${file.filename}`,
        originalname: file.originalname,
        filename: file.filename,
        tempIndex: index
      }));
      
      // 按文件名中的数字排序（由小到大）
      tempImages.sort((a, b) => {
        // 提取文件名中的数字进行比较
        const extractNumber = (filename) => {
          const match = filename.match(/(\d+)/);
          return match ? parseInt(match[1]) : 0;
        };
        
        const numA = extractNumber(a.originalname);
        const numB = extractNumber(b.originalname);
        
        // 如果都有数字，按数字大小排序
        if (numA !== 0 && numB !== 0) {
          return numA - numB;
        }
        
        // 如果只有一个有数字，有数字的排前面
        if (numA !== 0) return -1;
        if (numB !== 0) return 1;
        
        // 如果都没有数字，按字母顺序排序
        return a.originalname.localeCompare(b.originalname);
      });
      
      // 排序后设置order
      updateData.images = tempImages.map((file, index) => ({
        url: file.url,
        order: index
      }));
      
      console.log('=== 更新作品图片按文件名数字排序 ===');
      console.log('上传的文件列表:', tempImages.map(f => ({ originalname: f.originalname, filename: f.filename })));
      console.log('排序后的图片order:', updateData.images.map((img, index) => ({ url: img.url, order: img.order })));
    }
    
    // 更新作品
    await product.update(updateData);
    
    // 清理旧图片文件
    try {
      // 删除旧封面
      if (oldCover) {
        await fs.unlink(path.join(process.env.UPLOAD_PATH, oldCover));
      }
      // 删除旧作品图片
      for (const img of oldImages) {
        await fs.unlink(path.join(process.env.UPLOAD_PATH, img));
      }
    } catch (e) {
      console.error('清理旧图片失败:', e);
      // 不影响更新操作
    }
    
    res.status(200).json({
      success: true,
      message: '作品更新成功',
      data: product
    });
  } catch (error) {
    // 清理已上传的新文件
    if (req.files) {
      try {
        // 清理封面文件
        if (req.files.cover) {
          for (const file of req.files.cover) {
            await fs.unlink(path.join(process.env.UPLOAD_PATH, file.filename));
          }
        }
        // 清理作品图片文件
        if (req.files.images) {
          for (const file of req.files.images) {
            await fs.unlink(path.join(process.env.UPLOAD_PATH, file.filename));
          }
        }
      } catch (e) {
        console.error('清理上传文件失败:', e);
      }
    }
    
    console.error('更新作品失败:', error);
    res.status(500).json({
      success: false,
      message: '更新作品失败，请稍后重试'
    });
  }
});

// 更新作品封面
router.put('/:id/cover', auth, uploadSingle, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查找作品
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '作品不存在'
      });
    }
    
    // 保存旧封面文件名
    const oldCover = product.cover;
    
    // 更新封面
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    product.cover = `${baseUrl}/uploads/${req.file.filename}`;
    await product.save();
    
    // 删除旧封面文件
    if (oldCover) {
      try {
        await fs.unlink(path.join(process.env.UPLOAD_PATH, oldCover));
      } catch (e) {
        console.error('删除旧封面文件失败:', e);
      }
    }
    
    res.status(200).json({
      success: true,
      message: '封面更新成功',
      data: product
    });
  } catch (error) {
    // 清理已上传的新文件
    if (req.file) {
      try {
        await fs.unlink(path.join(process.env.UPLOAD_PATH, req.file.filename));
      } catch (e) {
        console.error('清理上传文件失败:', e);
      }
    }
    
    console.error('更新封面失败:', error);
    res.status(500).json({
      success: false,
      message: '更新封面失败，请稍后重试'
    });
  }
});

// 上传作品图片（增量上传）
router.post('/:id/images', auth, uploadProductFiles, async (req, res) => {
  try {
    console.log('=== 上传作品图片API被调用 ===');
    console.log('请求方法:', req.method);
    console.log('请求路径:', req.path);
    console.log('完整URL:', req.originalUrl);
    console.log('请求头:', req.headers);
    console.log('接收到的文件数量:', req.files && req.files.images ? req.files.images.length : 0);
    if (req.files && req.files.images) {
      console.log('文件详情:', req.files.images.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, filename: f.filename })));
    }
    
    const { id } = req.params;
    
    // 查找作品
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '作品不存在'
      });
    }
    
    // 获取当前图片列表
    const currentImages = product.images || [];
    
    // 添加新上传的图片，按文件名排序后再设置order
    const maxOrder = currentImages.length > 0 ? 
      Math.max(...currentImages.map(img => typeof img === 'object' ? img.order || 0 : 0)) : 0;
    
    // 先创建包含文件名的临时数组，然后按文件名排序
    const tempImages = req.files.images.map((file, index) => ({
      url: `http://8.136.34.190:3000/uploads/${file.filename}`,
      originalname: file.originalname,
      filename: file.filename,
      tempIndex: index
    }));
    
    // 按文件名中的数字排序（由小到大）
    tempImages.sort((a, b) => {
      // 提取文件名中的数字进行比较
      const extractNumber = (filename) => {
        const match = filename.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      };
      
      const numA = extractNumber(a.originalname);
      const numB = extractNumber(b.originalname);
      
      // 如果都有数字，按数字大小排序
      if (numA !== 0 && numB !== 0) {
        return numA - numB;
      }
      
      // 如果只有一个有数字，有数字的排前面
      if (numA !== 0) return -1;
      if (numB !== 0) return 1;
      
      // 如果都没有数字，按字母顺序排序
      return a.originalname.localeCompare(b.originalname);
    });
    
    // 排序后设置order（从最大order+1开始）
    const newImages = tempImages.map((file, index) => ({
      url: file.url,
      order: maxOrder + index + 1
    }));
    
    console.log('=== 增量上传图片按文件名数字排序 ===');
    console.log('当前最大order值:', maxOrder);
    console.log('上传的文件列表:', tempImages.map(f => ({ originalname: f.originalname, filename: f.filename })));
    console.log('排序后的图片order:', newImages.map((img, index) => ({ url: img.url, order: img.order })));
    
    const updatedImages = [...currentImages, ...newImages];
    
    // 更新作品图片列表
    await product.update({ images: updatedImages });
    
    // 返回成功响应，包含正确的图片URL映射
    res.status(200).json({
      success: true,
      message: '图片上传成功',
      data: {
        images: updatedImages,
        newImages: newImages,
        urlMapping: newImages.map(img => ({
          filename: img.url.split('/').pop(),
          url: img.url,
          order: img.order
        }))
      }
    });
  } catch (error) {
    // 清理已上传的文件
    if (req.files && req.files.images && req.files.images.length > 0) {
      for (const file of req.files.images) {
        try {
          await fs.unlink(path.join(process.env.UPLOAD_PATH, file.filename));
        } catch (e) {
          console.error('清理上传文件失败:', e);
        }
      }
    }
    
    console.error('上传图片失败:', error);
    res.status(500).json({
      success: false,
      message: '上传图片失败，请稍后重试'
    });
  }
});

// 简化的图片重新排序API（推荐使用）
router.put('/:id/images/reorder', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { images } = req.body;
    
    console.log('=== 图片重新排序API ===');
    console.log('作品ID:', id);
    console.log('接收到的图片数组:', JSON.stringify(images, null, 2));
    
    // 查找作品
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '作品不存在'
      });
    }
    
    // 验证图片数据
    if (!Array.isArray(images)) {
      console.error('图片数据无效：不是数组');
      return res.status(400).json({
        success: false,
        message: '图片数据无效，必须是数组格式'
      });
    }
    
    // 处理图片数组，确保每个图片都有正确的order
    const processedImages = images.map((img, index) => {
      if (typeof img === 'string') {
        // 兼容字符串格式
        return {
          url: img,
          order: index + 1
        };
      } else if (typeof img === 'object' && img.url) {
        // 对象格式，更新order
        return {
          ...img,
          order: index + 1
        };
      } else {
        // 无效格式，跳过
        console.warn('跳过无效图片数据:', img);
        return null;
      }
    }).filter(img => img !== null); // 过滤掉无效项
    
    if (processedImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: '没有有效的图片数据'
      });
    }
    
    console.log('处理后的图片数组:', JSON.stringify(processedImages, null, 2));
    
    // 更新作品图片列表
    await product.update({ images: processedImages });
    
    console.log('图片顺序更新完成');
    
    res.status(200).json({
      success: true,
      message: '图片顺序更新成功',
      data: {
        images: processedImages,
        count: processedImages.length
      }
    });
  } catch (error) {
    console.error('图片重新排序失败:', error);
    res.status(500).json({
      success: false,
      message: '图片顺序更新失败，请稍后重试',
      error: error.message
    });
  }
});

// 更新图片顺序（原有的复杂方式）
router.put('/:id/images/order', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { imageOrder } = req.body; // imageOrder应该是包含索引和新顺序的数组
    
    // 查找作品
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '作品不存在'
      });
    }
    
    // 获取当前图片列表
    const currentImages = product.images || [];
    const parsedImages = typeof currentImages === 'string' ? JSON.parse(currentImages) : currentImages;
    
    console.log('=== 图片顺序更新调试信息 ===');
    console.log('作品ID:', id);
    console.log('接收到的imageOrder数据:', JSON.stringify(imageOrder, null, 2));
    console.log('当前图片列表:', JSON.stringify(parsedImages, null, 2));
    
    // 验证图片顺序数据
    if (!Array.isArray(imageOrder)) {
      console.error('图片顺序数据无效：不是数组');
      return res.status(400).json({
        success: false,
        message: '图片顺序数据无效'
      });
    }
    
    // 验证索引范围
    const maxIndex = Math.max(...imageOrder.map(item => item.index));
    if (maxIndex >= parsedImages.length) {
      return res.status(400).json({
        success: false,
        message: '图片索引超出范围'
      });
    }
    
    // 根据新的顺序重新排列图片
    // 创建一个新数组，按照DOM顺序重新排列
    const reorderedImages = [];
    
    // 首先创建一个从order到图片对象的映射
    const orderToImageMap = {};
    parsedImages.forEach((image, index) => {
      const currentOrder = typeof image === 'object' ? (image.order || index + 1) : (index + 1);
      orderToImageMap[currentOrder] = {
        ...image,
        originalIndex: index
      };
    });
    
    // 根据前端发送的顺序数据重新排列
    imageOrder.forEach(item => {
      const { index, order } = item;
      if (index >= 0 && index < parsedImages.length) {
        const originalImage = parsedImages[index];
        if (typeof originalImage === 'object') {
          reorderedImages.push({
            ...originalImage,
            order: order
          });
        } else {
          reorderedImages.push({
            url: originalImage,
            order: order
          });
        }
      }
    });
    
    // 如果有图片没有被包含在imageOrder中，保持它们的原始顺序
    const includedIndexes = new Set(imageOrder.map(item => item.index));
    parsedImages.forEach((image, index) => {
      if (!includedIndexes.has(index)) {
        if (typeof image === 'object') {
          reorderedImages.push({
            ...image,
            order: reorderedImages.length + 1
          });
        } else {
          reorderedImages.push({
            url: image,
            order: reorderedImages.length + 1
          });
        }
      }
    });
    
    // 按order字段排序
    reorderedImages.sort((a, b) => a.order - b.order);
    
    console.log('重新排序后的图片列表:', JSON.stringify(reorderedImages, null, 2));
    
    // 更新作品图片列表
    await product.update({ images: reorderedImages });
    
    console.log('数据库更新完成');
    
    res.status(200).json({
      success: true,
      message: '图片顺序更新成功',
      data: {
        images: reorderedImages
      }
    });
  } catch (error) {
    console.error('更新图片顺序失败:', error);
    res.status(500).json({
      success: false,
      message: '更新图片顺序失败，请稍后重试'
    });
  }
});

// 删除作品图片
router.delete('/:id/images/:imageIndex', auth, async (req, res) => {
  try {
    const { id, imageIndex } = req.params;
    
    // 查找作品
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '作品不存在'
      });
    }
    
    // 获取当前图片列表
    const currentImages = product.images || [];
    const index = parseInt(imageIndex);
    
    // 验证索引有效性
    if (index < 0 || index >= currentImages.length) {
      return res.status(404).json({
        success: false,
        message: '图片索引无效'
      });
    }
    
    // 获取要删除的图片信息
    const imageToDelete = currentImages[index];
    const imageUrl = typeof imageToDelete === 'object' ? imageToDelete.url : imageToDelete;
    const imageName = imageUrl.split('/').pop();
    
    // 从列表中移除图片
    const updatedImages = currentImages.filter((_, i) => i !== index);
    
    // 重新排序剩余图片的order
    const reorderedImages = updatedImages.map((img, newIndex) => {
      if (typeof img === 'object') {
        return { ...img, order: newIndex + 1 };
      } else {
        return { url: img, order: newIndex + 1 };
      }
    });
    
    // 更新作品图片列表
    await product.update({ images: reorderedImages });
    
    // 删除图片文件
    try {
      await fs.unlink(path.join(process.env.UPLOAD_PATH, imageName));
    } catch (e) {
      console.error('删除图片文件失败:', e);
      // 不影响API响应
    }
    
    res.status(200).json({
      success: true,
      message: '图片删除成功',
      data: {
        images: reorderedImages,
        deletedImage: imageToDelete
      }
    });
  } catch (error) {
    console.error('删除图片失败:', error);
    res.status(500).json({
      success: false,
      message: '删除图片失败，请稍后重试'
    });
  }
});

// 获取作品列表（前端使用）
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 12, sort = 'date', order = 'DESC', featured } = req.query;
    
    // 构建查询条件
    const where = { status: true };
    
    // 如果指定了featured参数，添加到查询条件中
    if (featured !== undefined) {
      where.featured = featured === 'true';
    }
    
    // 分页参数
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    
    // 查询作品
    const { count, rows } = await Product.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [[sort, order]],
      attributes: ['id', 'title', 'cover', 'stars', 'tags', 'date', 'viewCount', 'featured', 'description']
    });
    
    // 如果没有数据，返回空数组和总数为0
    if (count === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: limitNum,
          pages: 0
        }
      });
    }
    
    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: limitNum,
        pages: Math.ceil(count / limitNum)
      }
    });
  } catch (error) {
    console.error('获取作品列表失败:', error);
    res.status(200).json({
      success: false,
      message: '暂无数据',
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 12,
        pages: 0
      }
    });
  }
});

// 获取单个作品详情（前端使用）
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查找作品
    const product = await Product.findByPk(id, {
      where: { status: true }
    });
    
    if (!product) {
      return res.status(200).json({
        success: false,
        message: '暂无数据'
      });
    }
    
    // 增加浏览量
    product.viewCount += 1;
    await product.save();
    
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('获取作品详情失败:', error);
    res.status(200).json({
      success: false,
      message: '暂无数据'
    });
  }
});

// 后台获取所有作品（带分页）
router.get('/admin/list', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = '', status } = req.query;
    
    // 构建查询条件
    const where = {};
    if (keyword) {
      where.title = { [Op.like]: `%${keyword}%` };
    }
    if (status !== undefined) {
      where.status = status === 'true';
    }
    
    // 分页参数
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    
    // 查询作品 - 使用更简单的排序方式
    const { count, rows } = await Product.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['id', 'DESC']] // 改用ID排序，避免大字段排序
    });
    
    // 处理返回的产品数据，为图片URL添加前缀
    const processedRows = rows.map(product => {
      const processedProduct = { ...product.toJSON() };
      
      // 处理封面图片URL
      if (processedProduct.cover && !processedProduct.cover.startsWith('http')) {
        processedProduct.cover = `${baseUrl}/${processedProduct.cover}`;
      }
      
      // 处理图片数组URL，保持order信息
      if (processedProduct.images && Array.isArray(processedProduct.images)) {
        processedProduct.images = processedProduct.images.map(img => {
          // 处理不同类型的图片数据
          if (typeof img === 'object' && img.url) {
            // 如果是对象格式，保持order信息
            const imageUrl = img.url;
            return {
              url: imageUrl && !imageUrl.startsWith('http') ? `${baseUrl}/${imageUrl}` : imageUrl,
              order: img.order
            };
          } else if (typeof img === 'string') {
            // 如果是字符串格式，转换为对象格式
            return {
              url: img && !img.startsWith('http') ? `${baseUrl}/${img}` : img,
              order: processedProduct.images.indexOf(img) + 1 // 基于位置设置order
            };
          } else {
            return img; // 保持原样，如果不是字符串或对象
          }
        });
      }
      
      return processedProduct;
    });
    
    res.status(200).json({
      success: true,
      data: processedRows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: limitNum,
        pages: Math.ceil(count / limitNum)
      }
    });
  } catch (error) {
    console.error('获取后台作品列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取作品列表失败'
    });
  }
});

// 删除作品
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查找作品
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '作品不存在'
      });
    }
    
    // 删除相关文件
    const deleteFiles = async () => {
      try {
        // 删除封面
        if (product.cover) {
          const filename = product.cover.split('/').pop();
          await fs.unlink(path.join(process.env.UPLOAD_PATH, filename));
        }
        // 删除图片
        for (const imageUrl of product.images || []) {
          const filename = imageUrl.split('/').pop();
          await fs.unlink(path.join(process.env.UPLOAD_PATH, filename));
        }
      } catch (e) {
        console.error('删除文件失败:', e);
      }
    };
    
    // 先删除文件
    await deleteFiles();
    
    // 删除作品记录
    await product.destroy();
    
    res.status(200).json({
      success: true,
      message: '作品删除成功'
    });
  } catch (error) {
    console.error('删除作品失败:', error);
    res.status(500).json({
      success: false,
      message: '删除作品失败，请稍后重试'
    });
  }
});



// 更新作品图片顺序（支持按order字段删除）
router.delete('/:id/images/:order', auth, async (req, res) => {
  try {
    const { id, order } = req.params;
    
    // 查找作品
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: '作品不存在'
      });
    }
    
    // 获取当前图片列表
    const currentImages = product.images || [];
    const imageOrder = parseInt(order);
    
    // 查找要删除的图片
    const imageToDelete = currentImages.find(img => {
      if (typeof img === 'object') {
        return img.order === imageOrder;
      } else {
        // 兼容旧格式，假设按数组索引作为order
        return currentImages.indexOf(img) === imageOrder;
      }
    });
    
    if (!imageToDelete) {
      return res.status(404).json({
        success: false,
        message: '图片不存在'
      });
    }
    
    // 从列表中移除图片
    const updatedImages = currentImages.filter(img => {
      if (typeof img === 'object') {
        return img.order !== imageOrder;
      } else {
        return currentImages.indexOf(img) !== imageOrder;
      }
    });
    
    // 重新排序剩余图片的order
    const reorderedImages = updatedImages.map((img, index) => {
      if (typeof img === 'object') {
        return { ...img, order: index + 1 };
      } else {
        return { url: img, order: index + 1 };
      }
    });
    
    // 更新作品图片列表
    await product.update({ images: reorderedImages });
    
    // 删除图片文件
    try {
      const imageUrl = typeof imageToDelete === 'object' ? imageToDelete.url : imageToDelete;
      const imageName = imageUrl.split('/').pop();
      await fs.unlink(path.join(process.env.UPLOAD_PATH, imageName));
    } catch (e) {
      console.error('删除图片文件失败:', e);
      // 不影响API响应
    }
    
    res.status(200).json({
      success: true,
      message: '图片删除成功',
      data: {
        images: reorderedImages
      }
    });
  } catch (error) {
    console.error('删除图片失败:', error);
    res.status(500).json({
      success: false,
      message: '删除图片失败，请稍后重试'
    });
  }
});

module.exports = router;