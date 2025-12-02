// 避免过早加载所有依赖
const dotenv = require('dotenv');

dotenv.config();

// 文件处理和内存管理配置
const FILE_PROCESSING_TIMEOUT = process.env.FILE_PROCESSING_TIMEOUT || 30000; // 默认30秒
const MAX_CONCURRENT_UPLOADS = process.env.MAX_CONCURRENT_UPLOADS || 5;

// 上传计数器和状态跟踪
let activeUploads = 0;
let uploadStats = {
  total: 0,
  success: 0,
  failed: 0,
  lastUploadTime: null
};

const multer = require('multer');
const path = require('path');
const fs = require('fs'); // 显式导入fs用于文件操作

// 文件清理函数 - 用于在错误情况下删除临时文件
function cleanupTempFiles(files) {
  if (!files) return;
  
  const filesToClean = Array.isArray(files) ? files : [files];
  
  filesToClean.forEach(file => {
    if (file && file.path) {
      fs.unlink(file.path, (err) => {
        if (err) {
          console.error(`清理临时文件失败 ${file.path}:`, err);
        } else {
          console.log(`已清理临时文件: ${file.path}`);
        }
      });
    }
  });
}

// 设置存储位置和文件名
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 确保上传路径存在
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // 生成更安全的文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, uniqueSuffix + '-' + safeName + ext);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  // 允许的文件类型
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件（JPG, JPEG, PNG, GIF, WebP）'));
  }
};

// 创建上传中间件
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 默认5MB
    files: 10,
    fieldSize: 25 * 1024 * 1024 // 整个请求体的大小限制
  }
});

// 单个文件上传（封面）
const uploadSingle = upload.single('cover');

// 多个文件上传（作品图片）
const uploadMultiple = upload.array('images', 10);

// 限制并发上传的中间件
const limitConcurrentUploads = (req, res, next) => {
  if (activeUploads >= MAX_CONCURRENT_UPLOADS) {
    return res.status(429).json({
      success: false,
      message: '当前上传请求过多，请稍后再试',
      error: 'Too many concurrent uploads'
    });
  }
  next();
};

// 错误处理包装器 - 增强资源管理
const handleUploadError = (uploadFn) => {
  return async (req, res, next) => {
    // 设置上传超时
    const timeoutId = setTimeout(() => {
      console.error('上传处理超时');
      cleanupTempFiles(req.file || req.files); // 清理文件
      res.status(408).json({
        success: false,
        message: '上传处理超时',
        error: 'Request timeout'
      });
    }, FILE_PROCESSING_TIMEOUT);
    
    // 增加活动上传计数
    activeUploads++;
    uploadStats.total++;
    uploadStats.lastUploadTime = new Date().toISOString();
    
    try {
      console.log(`接收上传请求 [${activeUploads}/${MAX_CONCURRENT_UPLOADS}]，路径:`, req.path);
      
      // 执行上传
      uploadFn(req, res, (err) => {
        // 清除超时计时器
        clearTimeout(timeoutId);
        
        if (err) {
          console.error('上传错误:', err);
          // 清理文件
          cleanupTempFiles(req.file || req.files);
          // 更新统计
          uploadStats.failed++;
          activeUploads = Math.max(0, activeUploads - 1);
          
          return res.status(400).json({
            success: false,
            message: err.message || '文件上传失败',
            error: err.toString()
          });
        }
        
        // 上传成功
        uploadStats.success++;
        console.log(`文件上传成功，文件数量: ${req.files ? req.files.length : 0}, 活跃上传: ${activeUploads}`);
        
        // 请求结束时减少计数
        const originalEnd = res.end;
        res.end = function() {
          activeUploads = Math.max(0, activeUploads - 1);
          return originalEnd.apply(this, arguments);
        };
        
        next();
      });
    } catch (error) {
      // 捕获任何异常
      clearTimeout(timeoutId);
      cleanupTempFiles(req.file || req.files);
      uploadStats.failed++;
      activeUploads = Math.max(0, activeUploads - 1);
      
      console.error('上传过程中发生异常:', error);
      res.status(500).json({
        success: false,
        message: '上传处理过程中发生错误',
        error: error.message
      });
    }
  };
};

// 获取上传统计信息的函数
function getUploadStats() {
  return {
    ...uploadStats,
    active: activeUploads,
    maxConcurrent: MAX_CONCURRENT_UPLOADS
  };
}

module.exports = {
  uploadSingle: handleUploadError(uploadSingle),
  uploadMultiple: handleUploadError(uploadMultiple),
  limitConcurrentUploads,
  cleanupTempFiles,
  getUploadStats
};