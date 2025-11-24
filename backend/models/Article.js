const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Article = sequelize.define('Article', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      comment: '文章标题'
    },
    cover: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: '文章封面图片'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      comment: '文章内容'
    },
    status: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: '文章状态：true(已发布)，false(草稿)'
    },
    viewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: '浏览次数'
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: '是否精选'
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'articles',
    indexes: [
      {
        name: 'idx_createdAt',
        fields: ['createdAt']
      },
      {
        name: 'idx_isFeatured',
        fields: ['isFeatured']
      }
    ]
  });

  return Article;
};