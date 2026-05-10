const http = require('http');

function testFixes() {
  // Test login to get token
  const loginData = JSON.stringify({
    schoolId: 'TES1234',
    email: 'testschool@educonnect.com',
    password: 'Admin123!'
  });

  const loginOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/school/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  };

  const loginReq = http.request(loginOptions, (loginRes) => {
    let loginData = '';

    loginRes.on('data', (chunk) => {
      loginData += chunk;
    });

    loginRes.on('end', () => {
      try {
        const loginResponse = JSON.parse(loginData);
        if (loginResponse.success && loginResponse.data && loginResponse.data.tokens && loginResponse.data.tokens.accessToken) {
          const token = loginResponse.data.tokens.accessToken;
          console.log('✅ Login successful');
          
          // Test /user/auth/me endpoint
          testUserMe(token);
          
        } else {
          console.log('❌ Login failed:', loginResponse);
        }
      } catch (error) {
        console.error('Error parsing login response:', error.message);
      }
    });
  });

  loginReq.on('error', (error) => {
    console.error('Login request error:', error.message);
  });

  loginReq.write(loginData);
  loginReq.end();
}

function testUserMe(token) {
  console.log('\n🧪 Testing /user/auth/me endpoint...');
  
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/user/auth/me',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('📋 /user/auth/me Response:');
      console.log('Status:', res.statusCode);
      try {
        const response = JSON.parse(data);
        console.log('Response:', JSON.stringify(response, null, 2));
        
        if (response.success && response.user) {
          console.log('✅ User profile retrieved successfully');
          console.log('🏫 School ID:', response.user.schoolId);
          console.log('🏫 School Name:', response.user.school?.schoolName);
        }
      } catch (error) {
        console.log('Raw response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error.message);
  });

  req.end();
}

testFixes();
