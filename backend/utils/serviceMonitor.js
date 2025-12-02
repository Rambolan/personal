// 服务可用性监控模块
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

class ServiceMonitor {
  constructor(options = {}) {
    this.options = {
      checkInterval: options.checkInterval || 60000, // 默认每分钟检查一次
      timeout: options.timeout || 10000, // 请求超时时间10秒
      healthEndpoint: options.healthEndpoint || '/health',
      alertThreshold: options.alertThreshold || 3, // 连续失败次数阈值
      alertCooldown: options.alertCooldown || 300000, // 告警冷却时间5分钟
      ...options
    };
    
    // 监控状态
    this.monitoringStatus = {
      lastCheckTime: null,
      isHealthy: true,
      consecutiveFailures: 0,
      responseTimes: [],
      errorRates: [],
      lastAlertTime: 0
    };
    
    // 告警历史
    this.alertHistory = [];
    
    // 确保日志目录存在
    this.alertsLogPath = path.join(__dirname, '../logs/alerts.log');
    this.ensureLogDirectory();
    
    // 定时器引用
    this.checkTimer = null;
  }
  
  // 确保日志目录存在
  ensureLogDirectory() {
    const logDir = path.dirname(this.alertsLogPath);
    if (!fs.existsSync(logDir)) {
      try {
        fs.mkdirSync(logDir, { recursive: true });
        console.log(`创建日志目录: ${logDir}`);
      } catch (error) {
        console.error('创建日志目录失败:', error);
      }
    }
  }
  
  // 记录告警日志
  logAlert(message, details = {}) {
    const timestamp = new Date().toISOString();
    const alertMessage = `[${timestamp}] [服务告警] ${message}\n详情: ${JSON.stringify(details)}\n`;
    
    // 记录到文件
    try {
      fs.appendFileSync(this.alertsLogPath, alertMessage);
      console.error(alertMessage.trim());
    } catch (error) {
      console.error('记录告警日志失败:', error);
    }
    
    // 添加到告警历史
    this.alertHistory.push({
      timestamp,
      message,
      details
    });
    
    // 保留最近100条告警记录
    if (this.alertHistory.length > 100) {
      this.alertHistory.shift();
    }
  }
  
  // 检查服务可用性
  async checkServiceHealth(baseUrl = 'http://localhost:3000') {
    const start = Date.now();
    const endpoint = `${baseUrl}${this.options.healthEndpoint}`;
    
    try {
      const response = await this.makeRequest(endpoint);
      const responseTime = Date.now() - start;
      
      // 更新响应时间历史（保留最近10个数据点）
      this.monitoringStatus.responseTimes.push(responseTime);
      if (this.monitoringStatus.responseTimes.length > 10) {
        this.monitoringStatus.responseTimes.shift();
      }
      
      // 分析响应
      if (response.statusCode >= 200 && response.statusCode < 400) {
        // 服务正常
        this.monitoringStatus.isHealthy = true;
        this.monitoringStatus.consecutiveFailures = 0;
        
        // 记录响应时间过长的警告
        if (responseTime > 2000) { // 2秒作为警告阈值
          this.logAlert('服务响应时间过长', {
            responseTime,
            threshold: 2000,
            endpoint
          });
        }
        
        console.log(`[服务监控] 健康检查成功 - 响应时间: ${responseTime}ms, 状态码: ${response.statusCode}`);
        return {
          healthy: true,
          responseTime,
          statusCode: response.statusCode,
          message: '服务运行正常'
        };
      } else {
        // 服务返回错误状态码
        return this.handleFailure(endpoint, {
          statusCode: response.statusCode,
          responseTime,
          error: `服务返回错误状态码: ${response.statusCode}`
        });
      }
    } catch (error) {
      // 服务无法访问
      return this.handleFailure(endpoint, {
        responseTime: Date.now() - start,
        error: error.message
      });
    } finally {
      this.monitoringStatus.lastCheckTime = new Date().toISOString();
    }
  }
  
  // 处理检查失败
  handleFailure(endpoint, details) {
    this.monitoringStatus.consecutiveFailures++;
    this.monitoringStatus.isHealthy = false;
    
    // 记录错误率
    const currentTime = Math.floor(Date.now() / 60000); // 按分钟统计
    this.updateErrorRate(currentTime);
    
    console.error(`[服务监控] 健康检查失败 - 连续失败次数: ${this.monitoringStatus.consecutiveFailures}`, details);
    
    // 检查是否需要发送告警
    const now = Date.now();
    if (this.monitoringStatus.consecutiveFailures >= this.options.alertThreshold &&
        now - this.monitoringStatus.lastAlertTime >= this.options.alertCooldown) {
      
      this.monitoringStatus.lastAlertTime = now;
      this.logAlert('服务可用性检查连续失败', {
        ...details,
        consecutiveFailures: this.monitoringStatus.consecutiveFailures,
        endpoint
      });
    }
    
    return {
      healthy: false,
      consecutiveFailures: this.monitoringStatus.consecutiveFailures,
      ...details
    };
  }
  
  // 更新错误率统计
  updateErrorRate(timestamp) {
    if (!this.monitoringStatus.errorRates[timestamp]) {
      this.monitoringStatus.errorRates[timestamp] = {
        total: 0,
        errors: 0
      };
    }
    
    this.monitoringStatus.errorRates[timestamp].total++;
    this.monitoringStatus.errorRates[timestamp].errors++;
    
    // 清理超过1小时的统计数据
    const oneHourAgo = Math.floor(Date.now() / 60000) - 60;
    Object.keys(this.monitoringStatus.errorRates).forEach(time => {
      if (parseInt(time) < oneHourAgo) {
        delete this.monitoringStatus.errorRates[time];
      }
    });
  }
  
  // 发送HTTP请求
  makeRequest(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const timeout = setTimeout(() => {
        reject(new Error(`请求超时 (${this.options.timeout}ms)`));
      }, this.options.timeout);
      
      const req = protocol.get(url, (res) => {
        clearTimeout(timeout);
        
        // 收集响应数据
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            res.body = data;
            if (data) {
              try {
                res.parsedBody = JSON.parse(data);
              } catch (e) {
                res.parsedBody = null;
              }
            }
            resolve(res);
          } catch (error) {
            reject(error);
          }
        });
      });
      
      req.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
  
  // 启动监控
  startMonitoring(baseUrl) {
    if (this.checkTimer) {
      console.log('服务监控已经在运行中');
      return;
    }
    
    console.log(`启动服务可用性监控 - 检查间隔: ${this.options.checkInterval}ms`);
    
    // 立即执行一次检查
    this.checkServiceHealth(baseUrl);
    
    // 设置定时器
    this.checkTimer = setInterval(() => {
      this.checkServiceHealth(baseUrl);
    }, this.options.checkInterval);
    
    // 防止定时器阻塞Node.js进程退出
    this.checkTimer.unref();
    
    return {
      stop: this.stopMonitoring.bind(this)
    };
  }
  
  // 停止监控
  stopMonitoring() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      console.log('服务可用性监控已停止');
    }
  }
  
  // 获取当前监控状态
  getStatus() {
    // 计算平均响应时间
    const avgResponseTime = this.monitoringStatus.responseTimes.length > 0
      ? this.monitoringStatus.responseTimes.reduce((sum, time) => sum + time, 0) / this.monitoringStatus.responseTimes.length
      : 0;
    
    // 计算最近5分钟的错误率
    const now = Math.floor(Date.now() / 60000);
    let recentErrors = 0;
    let recentTotal = 0;
    
    for (let i = 0; i < 5; i++) {
      const time = now - i;
      if (this.monitoringStatus.errorRates[time]) {
        recentErrors += this.monitoringStatus.errorRates[time].errors;
        recentTotal += this.monitoringStatus.errorRates[time].total;
      }
    }
    
    const errorRate = recentTotal > 0 ? (recentErrors / recentTotal * 100).toFixed(2) : 0;
    
    return {
      lastCheckTime: this.monitoringStatus.lastCheckTime,
      isHealthy: this.monitoringStatus.isHealthy,
      consecutiveFailures: this.monitoringStatus.consecutiveFailures,
      avgResponseTime: avgResponseTime.toFixed(2),
      responseTimes: this.monitoringStatus.responseTimes,
      errorRate: `${errorRate}%`,
      recentErrors,
      recentTotalChecks: recentTotal,
      config: this.options
    };
  }
  
  // 获取最近的告警记录
  getRecentAlerts(limit = 10) {
    return this.alertHistory.slice(-limit).reverse();
  }
  
  // 模拟服务压力测试
  async stressTest(endpoint, requests = 10, concurrency = 2) {
    console.log(`开始服务压力测试 - 目标: ${endpoint}, 请求数: ${requests}, 并发数: ${concurrency}`);
    
    const results = {
      totalRequests: requests,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      responseTimes: [],
      errors: []
    };
    
    let completed = 0;
    const queue = [];
    
    // 填充请求队列
    for (let i = 0; i < requests; i++) {
      queue.push(i);
    }
    
    const start = Date.now();
    
    // 并发执行请求
    const runTest = async () => {
      while (queue.length > 0) {
        const requestId = queue.shift();
        
        try {
          const reqStart = Date.now();
          const response = await this.makeRequest(endpoint);
          const responseTime = Date.now() - reqStart;
          
          results.successfulRequests++;
          results.totalResponseTime += responseTime;
          results.responseTimes.push(responseTime);
          
          console.log(`[压力测试] 请求 ${requestId} 成功 - ${responseTime}ms, 状态码: ${response.statusCode}`);
        } catch (error) {
          results.failedRequests++;
          results.errors.push({
            requestId,
            error: error.message
          });
          
          console.error(`[压力测试] 请求 ${requestId} 失败:`, error.message);
        } finally {
          completed++;
          if (completed === requests) {
            // 所有请求完成
            const totalTime = Date.now() - start;
            const avgResponseTime = results.successfulRequests > 0
              ? (results.totalResponseTime / results.successfulRequests).toFixed(2)
              : 0;
            
            const finalResults = {
              ...results,
              totalTime,
              avgResponseTime,
              successRate: ((results.successfulRequests / requests) * 100).toFixed(2) + '%'
            };
            
            console.log('\n压力测试结果:', finalResults);
            
            // 如果失败率过高，记录告警
            if (results.failedRequests / requests > 0.1) { // 10%失败率阈值
              this.logAlert('服务压力测试失败率过高', finalResults);
            }
            
            return finalResults;
          }
        }
      }
    };
    
    // 启动并发测试
    const promises = [];
    for (let i = 0; i < concurrency; i++) {
      promises.push(runTest());
    }
    
    return Promise.all(promises).then(() => {
      // 等待所有并发任务完成
      const totalTime = Date.now() - start;
      const avgResponseTime = results.successfulRequests > 0
        ? (results.totalResponseTime / results.successfulRequests).toFixed(2)
        : 0;
      
      return {
        ...results,
        totalTime,
        avgResponseTime,
        successRate: ((results.successfulRequests / requests) * 100).toFixed(2) + '%'
      };
    });
  }
}

module.exports = ServiceMonitor;
