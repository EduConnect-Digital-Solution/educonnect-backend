const { prisma } = require('./src/config/database');
const bcrypt = require('bcrypt');

async function createTestSchool() {
  try {
    // Create a test school
    const school = await prisma.school.create({
      data: {
        schoolId: 'TES1234',
        schoolName: 'Test School',
        email: 'testschool@educonnect.com',
        password: await bcrypt.hash('Admin123!', 12),
        isVerified: true,
        isActive: true
      }
    });

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        schoolId: school.id,
        email: 'testschool@educonnect.com',
        password: await bcrypt.hash('Admin123!', 12),
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isVerified: true,
        isActive: true
      }
    });

    console.log('Test school created successfully:');
    console.log('School ID:', school.schoolId);
    console.log('School UUID:', school.id);
    console.log('Admin User ID:', adminUser.id);

    // Create a test class and arm
    const testClass = await prisma.class.create({
      data: {
        name: 'Test Class 10',
        baseLevel: '10',
        schoolId: school.id,
        isActive: true
      }
    });

    const testArm = await prisma.arm.create({
      data: {
        name: 'A',
        classId: testClass.id,
        schoolId: school.id,
        isActive: true
      }
    });

    console.log('Test Class ID:', testClass.id);
    console.log('Test Arm ID:', testArm.id);

  } catch (error) {
    console.error('Error creating test school:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestSchool();
