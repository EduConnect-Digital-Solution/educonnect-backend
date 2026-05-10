const { prisma } = require('./src/config/database');

async function debugSchoolData() {
  try {
    // Test the exact same query as in userAuthController
    const user = {
      schoolId: '7d4676e0-0f31-4fba-9c16-d1ef9740bc2d'
    };

    console.log('🔍 Looking up school with user.schoolId:', user.schoolId);
    
    const school = await prisma.school.findFirst({
      where: { id: user.schoolId },
      select: { id: true, schoolId: true, schoolName: true, email: true, address: true, phone: true, website: true }
    });
    
    console.log('🏫 School found:', school ? 'Yes' : 'No');
    
    if (school) {
      console.log('🏫 School data:', {
        id: school.id,
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        email: school.email
      });
      
      const schoolData = {
        id: school.id,
        schoolId: school.schoolId, // Include human-readable schoolId
        schoolName: school.schoolName,
        email: school.email,
        address: school.address,
        phone: school.phone,
        website: school.website
      };
      
      console.log('🏫 School data object:', schoolData);
      console.log('🏫 Final schoolId to return:', schoolData.schoolId);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugSchoolData();
