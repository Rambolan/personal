-- 创建 users 表
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role VARCHAR(10) NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor')),
    status BOOLEAN NOT NULL DEFAULT true,
    createdat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 为 users 表创建索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 创建 articles 表
CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    cover VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status BOOLEAN NOT NULL DEFAULT true,
    viewcount INTEGER NOT NULL DEFAULT 0,
    isfeatured BOOLEAN NOT NULL DEFAULT false,
    createdat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 为 articles 表创建索引
CREATE INDEX IF NOT EXISTS idx_articles_createdat ON articles(createdat);
CREATE INDEX IF NOT EXISTS idx_articles_isfeatured ON articles(isfeatured);

-- 创建 products 表
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    cover VARCHAR(255) NOT NULL,
    description TEXT,
    stars INTEGER NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 5),
    tags JSONB DEFAULT '[]',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    images JSONB DEFAULT '[]',
    viewcount INTEGER NOT NULL DEFAULT 0,
    status BOOLEAN NOT NULL DEFAULT true,
    featured BOOLEAN NOT NULL DEFAULT false,
    createdat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedat TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 为 products 表创建索引
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_date ON products(date);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_products_createdat ON products(createdat);
CREATE INDEX IF NOT EXISTS idx_products_title ON products(title);
CREATE INDEX IF NOT EXISTS idx_products_status_createdat ON products(status, createdat);
CREATE INDEX IF NOT EXISTS idx_products_featured_createdat ON products(featured, createdat);
