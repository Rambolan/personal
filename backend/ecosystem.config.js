module.exports = {
  apps: [
    {
      // 应用名称
      name: 'personal-web-backend',
      
      // 入口文件
      script: 'app.js',
      
      // 工作目录
      cwd: '/root/code_cursor/personal web/backend',
      
      // 环境配置
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // 内存监控配置
        MEMORY_CHECK_INTERVAL: 300000, // 5分钟检查一次内存
        MEMORY_WARNING_THRESHOLD: 512, // 内存警告阈值（MB）
        // 数据库连接池配置
        DB_POOL_MAX: 20,
        DB_POOL_MIN: 2,
        DB_POOL_IDLE: 10000,
        DB_POOL_ACQUIRE: 30000,
        // 监控告警配置
        SERVICE_CHECK_INTERVAL: 60000,
        SERVICE_TIMEOUT: 10000,
        // 动态连接池配置
        MIN_CONNECTIONS: 2,
        MAX_SCALABLE_CONNECTIONS: 50
      },
      
      // 实例数，根据CPU核心数自动扩展
      instances: 'max',
      
      // 执行模式：cluster 模式充分利用多核CPU
      exec_mode: 'cluster',
      
      // 自动重启策略
      autorestart: true,
      
      // 错误退出码不会自动重启的列表
      max_restarts: 10,
      
      // 两次重启间隔至少为1秒
      restart_delay: 1000,
      
      // 内存限制，超过则重启
      max_memory_restart: '512M',
      
      // 日志配置
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      
      // 输出日志
      out_file: './logs/app-out.log',
      
      // 错误日志
      error_file: './logs/app-error.log',
      
      // 合并日志
      merge_logs: true,
      
      // 日志轮转配置
      log_type: 'json',
      
      // 心跳检测，每30秒检查一次应用是否正常运行
      listen_timeout: 30000,
      
      // 优雅关闭的超时时间
      kill_timeout: 5000,
      
      // 确保应用准备就绪后再接受流量
      wait_ready: true,
      
      // 监听文件变化（仅开发环境使用）
      watch: false,
      
      // 崩溃恢复的指数退避延迟
      exp_backoff_restart_delay: 100,
      
      // 定期重启（可选）
      cron_restart: '0 3 * * *', // 每天凌晨3点重启一次
      
      // 健康检查配置
      health_check: {
        path: '/health',
        port: 3000,
        interval: 30000
      }
    }
  ],
  // 部署配置（可选）
  deploy: {
    production: {
      user: 'node',
      host: ['localhost'],
      ref: 'origin/main',
      repo: 'git@github.com:repo.git',
      path: '/root/code_cursor/personal_web/backend',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};