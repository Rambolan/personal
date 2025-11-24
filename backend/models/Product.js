const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [1, 200]
    }
  },
  cover: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  stars: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 5
    }
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    comment: '作品图片数组，每个元素包含url和order字段'
  },
  viewCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false
  },
  featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
    onUpdate: DataTypes.NOW
  }
}, {
  tableName: 'products',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  indexes: [
    {
      fields: ['status']
    },
    {
      fields: ['date']
    },
    {
      fields: ['featured']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['title']
    },
    {
      fields: ['status', 'createdAt']
    },
    {
      fields: ['featured', 'createdAt']
    }
  ]
});

  return Product;
};