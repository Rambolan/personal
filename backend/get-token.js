const axios = require('axios');

async function loginAndGetToken() {
  try {
    const response = await axios.post('http://localhost:3000/api/users/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    if (response.data.success) {
      console.log('登录成功!');
      console.log('Token:', response.data.data.token);
      console.log('用户信息:', response.data.data.user);
      return response.data.data.token;
    } else {
      console.error('登录失败:', response.data.message);
    }
  } catch (error) {
    console.error('登录错误:', error.response?.data || error.message);
  }
}

loginAndGetToken();