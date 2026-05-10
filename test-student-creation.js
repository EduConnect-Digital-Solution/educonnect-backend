const https = require('https');
const http = require('http');

function testStudentCreation() {
  // First get the login token
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
          console.log('Login successful, got token');
          
          // Now test student creation
          const studentData = JSON.stringify({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@test.com',
            classId: 'eab5457d-9bff-4035-8be4-6758a0273104', // Test Class ID from our setup
            armId: '9070b0d4-06ac-42e3-acd8-5374038871cc', // Test Arm ID from our setup
            rollNumber: '001',
            grade: '10',
            dateOfBirth: '2008-05-10',
            gender: 'male',
            parentIds: [],
            teacherIds: []
          });

          const studentOptions = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/students',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'Content-Length': Buffer.byteLength(studentData)
            }
          };

          const studentReq = http.request(studentOptions, (studentRes) => {
            let studentData = '';

            studentRes.on('data', (chunk) => {
              studentData += chunk;
            });

            studentRes.on('end', () => {
              console.log('Student Creation Response:');
              console.log('Status:', studentRes.statusCode);
              console.log('Body:', studentData);
              
              try {
                const studentResponse = JSON.parse(studentData);
                console.log('Parsed Response:', JSON.stringify(studentResponse, null, 2));
              } catch (error) {
                console.log('Raw response could not be parsed as JSON');
              }
            });
          });

          studentReq.on('error', (error) => {
            console.error('Student creation request error:', error.message);
          });

          studentReq.write(studentData);
          studentReq.end();

        } else {
          console.log('Login failed or no token found');
          console.log('Login response:', JSON.stringify(loginResponse, null, 2));
        }
      } catch (error) {
        console.error('Error parsing login response:', error.message);
        console.log('Raw login response:', loginData);
      }
    });
  });

  loginReq.on('error', (error) => {
    console.error('Login request error:', error.message);
  });

  loginReq.write(loginData);
  loginReq.end();
}

testStudentCreation();
