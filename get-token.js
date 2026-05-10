const https = require('https');
const http = require('http');

function getLoginToken() {
  const postData = JSON.stringify({
    schoolId: 'TES1234',
    email: 'testschool@educonnect.com',
    password: 'Admin123!'
  });

  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/school/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        console.log('Full response:', JSON.stringify(response, null, 2));
        if (response.success && response.data && response.data.accessToken) {
          console.log('Access Token:', response.data.accessToken);
          console.log('School ID in token:', response.data.user.schoolId);
        } else {
          console.log('No access token found in response');
        }
      } catch (error) {
        console.log('Response data:', data);
        console.error('Error parsing response:', error.message);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error.message);
  });

  req.write(postData);
  req.end();
}

getLoginToken();
