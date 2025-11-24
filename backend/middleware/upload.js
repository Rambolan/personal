const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// 设置存储位置和文件名
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
    fileSize: parseInt(process.env.MAX_FILE_SIZE)
  }
});

// 单个文件上传（封面）
const uploadSingle = upload.single('cover');

// 多个文件上传（作品图片）
const uploadMultiple = upload.array('images', 10);

// 错误处理包装器
const handleUploadError = (uploadFn) => {
  return (req, res, next) => {
    console.log('接收上传请求，请求路径:', req.path);
    console.log('请求方法:', req.method);
    console.log('请求头:', req.headers['content-type']);
    
    uploadFn(req, res, (err) => {
      if (err) {
        console.error('上传错误:', err);
        return res.status(400).json({
          success: false,
          message: err.message || '文件上传失败',
          error: err.toString()
        });
      }
      
      console.log('文件上传成功，文件数量:', req.files ? req.files.length : 0);
      next();
    });
  };
};

module.exports = {
  uploadSingle: handleUploadError(uploadSingle),
  uploadMultiple: handleUploadError(uploadMultiple)
};