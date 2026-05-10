const { prisma } = require('./src/config/database');

async function checkSchools() {
  try {
    const schools = await prisma.school.findMany({
      select: {
        schoolId: true,
        schoolName: true,
        email: true,
        isVerified: true,
        isActive: true
      }
    });

    console.log('Existing schools:');
    schools.forEach(school => {
      console.log(`ID: ${school.schoolId}, Name: ${school.schoolName}, Email: ${school.email}, Verified: ${school.isVerified}, Active: ${school.isActive}`);
    });

  } catch (error) {
    console.error('Error checking schools:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchools();
