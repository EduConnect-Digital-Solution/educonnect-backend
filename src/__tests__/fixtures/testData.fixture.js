/**
 * Test Data Fixtures
 * Provides sample data for testing purposes
 */

const mongoose = require('mongoose');

// Sample School Data
const sampleSchools = [
  {
    schoolId: 'SCH123456',
    schoolName: 'Springfield Elementary',
    email: 'admin@springfield.edu',
    phone: '+1234567890',
    address: '123 Education Street, Springfield',
    website: 'https://springfield.edu',
    isActive: true,
    isVerified: true
  },
  {
    schoolId: 'SCH789012',
    schoolName: 'Riverside High School',
    email: 'admin@riverside.edu',
    phone: '+0987654321',
    address: '456 Learning Avenue, Riverside',
    website: 'https://riverside.edu',
    isActive: true,
    isVerified: false
  }
];

// Sample User Data
const sampleUsers = [
  {
    _id: new mongoose.Types.ObjectId(),
    schoolId: 'SCH123456',
    email: 'admin@springfield.edu',
    firstName: 'John',
    lastName: 'Doe',
    role: 'admin',
    isActive: true,
    isVerified: true,
    isTemporaryPassword: false
  },
  {
    _id: new mongoose.Types.ObjectId(),
    schoolId: 'SCH123456',
    email: 'teacher@springfield.edu',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'teacher',
    subjects: ['Mathematics', 'Science'],
    qualifications: 'M.Ed in Mathematics',
    experience: '5 years',
    isActive: true,
    isVerified: true,
    isTemporaryPassword: false
  },
  {
    _id: new mongoose.Types.ObjectId(),
    schoolId: 'SCH123456',
    email: 'parent@example.com',
    firstName: 'Bob',
    lastName: 'Johnson',
    role: 'parent',
    phone: '+1555123456',
    address: '789 Parent Street',
    occupation: 'Engineer',
    isActive: true,
    isVerified: true,
    isTemporaryPassword: false
  }
];

// Sample Student Data
const sampleStudents = [
  {
    _id: new mongoose.Types.ObjectId(),
    schoolId: 'SCH123456',
    studentId: 'STU001',
    firstName: 'Alice',
    lastName: 'Wilson',
    email: 'alice.wilson@student.springfield.edu',
    class: '10A',
    section: 'A',
    rollNumber: '001',
    grade: '10',
    dateOfBirth: new Date('2008-05-15'),
    gender: 'female',
    isActive: true
  },
  {
    _id: new mongoose.Types.ObjectId(),
    schoolId: 'SCH123456',
    studentId: 'STU002',
    firstName: 'Charlie',
    lastName: 'Brown',
    email: 'charlie.brown@student.springfield.edu',
    class: '10B',
    section: 'B',
    rollNumber: '002',
    grade: '10',
    dateOfBirth: new Date('2008-08-22'),
    gender: 'male',
    isActive: true
  }
];

// Sample Invitation Data
const sampleInvitations = [
  {
    _id: new mongoose.Types.ObjectId(),
    schoolId: 'SCH123456',
    email: 'newteacher@springfield.edu',
    role: 'teacher',
    invitedBy: sampleUsers[0]._id,
    token: 'sample-invitation-token-123',
    firstName: 'New',
    lastName: 'Teacher',
    subjects: ['English', 'History'],
    status: 'pending',
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 hours from now
  },
  {
    _id: new mongoose.Types.ObjectId(),
    schoolId: 'SCH123456',
    email: 'newparent@example.com',
    role: 'parent',
    invitedBy: sampleUsers[0]._id,
    token: 'sample-invitation-token-456',
    firstName: 'New',
    lastName: 'Parent',
    studentIds: [sampleStudents[0]._id],
    status: 'pending',
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000)
  }
];

// Sample OTP Data
const sampleOTPs = [
  {
    _id: new mongoose.Types.ObjectId(),
    email: 'admin@springfield.edu',
    otp: '123456',
    purpose: 'email_verification',
    schoolId: 'SCH123456',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
    isUsed: false
  }
];

// JWT Test Tokens
const testTokens = {
  admin: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NTc4OWFiY2RlZjEyMzQ1Njc4OTAiLCJzY2hvb2xJZCI6IlNDSDEyMzQ1NiIsImVtYWlsIjoiYWRtaW5Ac3ByaW5nZmllbGQuZWR1Iiwicm9sZSI6ImFkbWluIiwiZmlyc3ROYW1lIjoiSm9obiIsImxhc3ROYW1lIjoiRG9lIiwiaWF0IjoxNjM5NTc4MDAwLCJleHAiOjE2Mzk1ODE2MDAsImlzcyI6ImVkdWNvbm5lY3QiLCJhdWQiOiJlZHVjb25uZWN0LXVzZXJzIn0.test-signature',
  teacher: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NTc4OWFiY2RlZjEyMzQ1Njc4OTEiLCJzY2hvb2xJZCI6IlNDSDEyMzQ1NiIsImVtYWlsIjoidGVhY2hlckBzcHJpbmdmaWVsZC5lZHUiLCJyb2xlIjoidGVhY2hlciIsImZpcnN0TmFtZSI6IkphbmUiLCJsYXN0TmFtZSI6IlNtaXRoIiwiaWF0IjoxNjM5NTc4MDAwLCJleHAiOjE2Mzk1ODE2MDAsImlzcyI6ImVkdWNvbm5lY3QiLCJhdWQiOiJlZHVjb25uZWN0LXVzZXJzIn0.test-signature',
  parent: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NTc4OWFiY2RlZjEyMzQ1Njc4OTIiLCJzY2hvb2xJZCI6IlNDSDEyMzQ1NiIsImVtYWlsIjoicGFyZW50QGV4YW1wbGUuY29tIiwicm9sZSI6InBhcmVudCIsImZpcnN0TmFtZSI6IkJvYiIsImxhc3ROYW1lIjoiSm9obnNvbiIsImlhdCI6MTYzOTU3ODAwMCwiZXhwIjoxNjM5NTgxNjAwLCJpc3MiOiJlZHVjb25uZWN0IiwiYXVkIjoiZWR1Y29ubmVjdC11c2VycyJ9.test-signature'
};

// Test Request Bodies
const testRequestBodies = {
  schoolRegistration: {
    schoolName: 'Test School',
    email: 'admin@testschool.edu',
    password: 'TestPass123!',
    adminFirstName: 'Test',
    adminLastName: 'Admin',
    phone: '+1234567890',
    address: '123 Test Street',
    website: 'https://testschool.edu'
  },
  schoolLogin: {
    schoolId: 'SCH123456',
    email: 'admin@springfield.edu',
    password: 'AdminPass123!'
  },
  userLogin: {
    email: 'teacher@springfield.edu',
    password: 'TeacherPass123!',
    schoolId: 'SCH123456'
  },
  completeRegistration: {
    email: 'teacher@springfield.edu',
    schoolId: 'SCH123456',
    currentPassword: 'temppass123',
    newPassword: 'NewPass123!',
    firstName: 'Jane',
    lastName: 'Smith',
    phone: '+1234567890'
  },
  createStudent: {
    firstName: 'New',
    lastName: 'Student',
    email: 'new.student@student.edu',
    class: '9A',
    section: 'A',
    rollNumber: '003'
  },
  inviteParent: {
    email: 'newparent@example.com',
    firstName: 'New',
    lastName: 'Parent',
    studentIds: ['507f1f77bcf86cd799439011']
  }
};

// Database Cleanup Utilities
const cleanupDatabase = async () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Database cleanup can only be run in test environment');
  }
  
  const collections = ['schools', 'users', 'students', 'invitations', 'otps'];
  
  for (const collection of collections) {
    try {
      await mongoose.connection.db.collection(collection).deleteMany({});
    } catch (error) {
      // Collection might not exist, which is fine
      console.log(`Collection ${collection} not found or already empty`);
    }
  }
};

const seedTestData = async () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Test data seeding can only be run in test environment');
  }
  
  // Insert sample data
  await mongoose.connection.db.collection('schools').insertMany(sampleSchools);
  await mongoose.connection.db.collection('users').insertMany(sampleUsers);
  await mongoose.connection.db.collection('students').insertMany(sampleStudents);
  await mongoose.connection.db.collection('invitations').insertMany(sampleInvitations);
  await mongoose.connection.db.collection('otps').insertMany(sampleOTPs);
};

module.exports = {
  sampleSchools,
  sampleUsers,
  sampleStudents,
  sampleInvitations,
  sampleOTPs,
  testTokens,
  testRequestBodies,
  cleanupDatabase,
  seedTestData
};