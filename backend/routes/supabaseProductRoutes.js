const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const supabase = require('../config/supabase');
const { auth } = require('../middleware/auth');
const { uploadSingle } = require('../middleware/upload');
const multer = require('multer');
const dotenv = require('dotenv');

dotenv.config();

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
  // 为了测试API功能，暂时允许所有文件类型
  return cb(null, true);
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

// 文件上传的基础路径 - 使用环境变量或默认的公共IP地址
const baseUrl = process.env.SERVER_BASE_URL || 'http://8.136.34.190:3000';

// 创建新作品
router.post('/', auth, uploadProductFiles, async (req, res) => {
  try {
    const { title, description, stars, tags, date } = req.body;
    
    // 验证必填参数
    if (!title) {
      return res.status(400).json({
        success: false,
        message: '请提供作品标题'
      });
    }
    
    if (!req.files || !req.files.cover || req.files.cover.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请上传封面图片'
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
    const coverPath = `${baseUrl}/uploads/${coverImage.filename}`;
    
    // 处理作品图片，按文件名排序
    let otherImages = [];
    if (req.files.images && req.files.images.length > 0) {
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
      otherImages = tempImages.map((file, index) => ({
        url: file.url,
        order: index
      }));
    }
    
    // 获取featured字段，默认为false
    const featured = req.body.featured === 'true' || req.body.featured === true;
    
    // 创建作品
    const { data: product, error } = await supabase
      .from('products')
      .insert([{
        title,
        cover: coverPath,
        description: description || '',
        stars: parseInt(stars) || 0,
        tags: processedTags,
        date: date || new Date(),
        images: otherImages || [],
        featured: featured,
        status: true
      }])
      .select('*');
    
    if (error) {
      throw error;
    }
    
    res.status(201).json({
      success: true,
      message: '作品创建成功',
      data: product[0]
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

// 获取作品列表（前端使用）
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 12, sort = 'date', order = 'DESC', featured } = req.query;
    
    // 构建查询条件
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('status', true);
    
    // 如果指定了featured参数，添加到查询条件中
    if (featured !== undefined) {
      query = query.eq('featured', featured === 'true');
    }
    
    // 分页和排序
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    
    query = query
      .order(sort, { ascending: order.toLowerCase() === 'asc' })
      .range(offset, offset + limitNum - 1);
    
    const { data: products, count, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // 如果没有数据，返回空数组
    if (!products || products.length === 0) {
      return res.status(200).json({
        success: false,
        message: '暂无数据',
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
      data: products,
      pagination: {
        total: count || 0,
        page: parseInt(page),
        limit: limitNum,
        pages: Math.ceil((count || 0) / limitNum)
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
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('status', true)
      .single();
    
    if (error || !product) {
      return res.status(200).json({
        success: false,
        message: '暂无数据'
      });
    }
    
    // 增加浏览量
    await supabase
      .from('products')
      .update({ viewCount: (product.viewCount || 0) + 1 })
      .eq('id', id);
    
    // 返回更新后的作品数据
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    res.status(200).json({
      success: true,
      data: updatedProduct
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
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });
    
    if (keyword) {
      query = query.ilike('title', `%${keyword}%`);
    }
    
    if (status !== undefined) {
      query = query.eq('status', status === 'true');
    }
    
    // 分页和排序
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);
    
    query = query
      .order('id', { ascending: false })
      .range(offset, offset + limitNum - 1);
    
    const { data: products, count, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // 处理图片URL
    const processedProducts = products.map(product => {
      const processed = { ...product };
      
      // 处理封面图片URL
      if (processed.cover && !processed.cover.startsWith('http')) {
        processed.cover = `${baseUrl}/${processed.cover}`;
      }
      
      // 处理图片数组URL
      if (processed.images && Array.isArray(processed.images)) {
        processed.images = processed.images.map(img => {
          if (typeof img === 'object' && img.url) {
            return {
              url: img.url && !img.url.startsWith('http') ? `${baseUrl}/${img.url}` : img.url,
              order: img.order
            };
          } else if (typeof img === 'string') {
            return {
              url: img && !img.startsWith('http') ? `${baseUrl}/${img}` : img,
              order: processed.images.indexOf(img) + 1
            };
          }
          return img;
        });
      }
      
      return processed;
    });
    
    res.status(200).json({
      success: true,
      data: processedProducts,
      pagination: {
        total: count || 0,
        page: parseInt(page),
        limit: limitNum,
        pages: Math.ceil((count || 0) / limitNum)
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
    const { data: product, error: findError } = await supabase
      .from('products')
      .select('cover, images')
      .eq('id', id)
      .single();
    
    if (findError || !product) {
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
        if (product.images && product.images.length > 0) {
          for (const image of product.images) {
            if (typeof image === 'object' && image.url) {
              const filename = image.url.split('/').pop();
              await fs.unlink(path.join(process.env.UPLOAD_PATH, filename));
            } else if (typeof image === 'string') {
              const filename = image.split('/').pop();
              await fs.unlink(path.join(process.env.UPLOAD_PATH, filename));
            }
          }
        }
      } catch (e) {
        console.error('删除文件失败:', e);
      }
    };
    
    // 先删除文件
    await deleteFiles();
    
    // 删除作品记录
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) {
      throw error;
    }
    
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

module.exports = router;