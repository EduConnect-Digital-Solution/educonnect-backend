const { prisma } = require('./src/config/database');

async function fixSchoolId() {
  try {
    // Update the test school to have the correct format
    const school = await prisma.school.updateMany({
      where: { schoolId: 'TEST1234' },
      data: { schoolId: 'TES1234' }
    });

    console.log('Updated school ID format');
    console.log('Updated', school.count, 'schools');

    // Check the updated school
    const updatedSchool = await prisma.school.findFirst({
      where: { schoolId: 'TES1234' },
      select: {
        schoolId: true,
        schoolName: true,
        email: true,
        isVerified: true,
        isActive: true
      }
    });

    console.log('Updated school info:');
    console.log(`ID: ${updatedSchool.schoolId}, Name: ${updatedSchool.schoolName}, Email: ${updatedSchool.email}, Verified: ${updatedSchool.isVerified}, Active: ${updatedSchool.isActive}`);

  } catch (error) {
    console.error('Error fixing school ID:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixSchoolId();
