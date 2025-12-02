const { sequelize, models } = require('./config/database');
const { Product, Article } = models;

// 将外部服务器URL(http://8.136.34.190:3000)替换为相对路径(/uploads/)
async function updateImageUrls() {
  try {
    console.log('开始更新数据库中的图片URL为相对路径...');
    
    // 连接数据库
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 更新Product模型中的cover和images字段
    const products = await Product.findAll();
    console.log(`找到 ${products.length} 个产品记录`);
    
    let productUpdatedCount = 0;
    for (const product of products) {
      let updated = false;
      const updateData = {};
      
      // 更新cover字段
      if (product.cover && (product.cover.includes('http://8.136.34.190:3000/uploads/') || product.cover.includes('http://localhost:3000/uploads/'))) {
        const filename = product.cover.split('/').pop();
        updateData.cover = `/uploads/${filename}`;
        updated = true;
        console.log(`更新产品 ${product.id} 的封面URL为相对路径: ${updateData.cover}`);
      }
      
      // 更新images字段
      if (product.images && Array.isArray(product.images) && product.images.length > 0) {
        const updatedImages = product.images.map(img => {
          if (typeof img === 'object' && img.url && (img.url.includes('http://8.136.34.190:3000/uploads/') || img.url.includes('http://localhost:3000/uploads/'))) {
            const filename = img.url.split('/').pop();
            return { ...img, url: `/uploads/${filename}` };
          } else if (typeof img === 'string' && (img.includes('http://8.136.34.190:3000/uploads/') || img.includes('http://localhost:3000/uploads/'))) {
            const filename = img.split('/').pop();
            return `/uploads/${filename}`;
          }
          return img;
        });
        
        // 检查是否有更新
        const hasImagesUpdated = product.images.some((img, index) => {
          const newImg = updatedImages[index];
          if (typeof img === 'object' && typeof newImg === 'object') {
            return img.url !== newImg.url;
          }
          return img !== newImg;
        });
        
        if (hasImagesUpdated) {
          updateData.images = updatedImages;
          updated = true;
          console.log(`更新产品 ${product.id} 的图片URL数组`);
        }
      }
      
      // 执行更新
      if (updated) {
        await product.update(updateData);
        productUpdatedCount++;
      }
    }
    
    console.log(`成功更新 ${productUpdatedCount} 个产品的图片URL`);
    
    // 由于Article模型存储的是相对路径，不需要更新
    console.log('Article模型存储的是相对路径，无需更新数据库记录');
    
  } catch (error) {
    console.error('更新图片URL失败:', error);
  } finally {
    // 关闭数据库连接
    await sequelize.close();
    console.log('数据库连接已关闭');
  }
}

// 执行更新
updateImageUrls().then(() => {
  console.log('图片URL更新任务完成');
}).catch(err => {
  console.error('任务执行异常:', err);
});