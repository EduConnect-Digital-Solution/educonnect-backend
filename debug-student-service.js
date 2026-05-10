const { prisma } = require('./src/config/database');

async function debugSchoolLookup() {
  try {
    // Test the exact schoolId that's in the JWT token
    const schoolIdFromToken = '7d4676e0-0f31-4fba-9c16-d1ef9740bc2d';
    console.log('Testing school lookup with UUID from token:', schoolIdFromToken);
    
    // Try UUID lookup first
    let school = await prisma.school.findFirst({
      where: { id: schoolIdFromToken, isActive: true, isVerified: true }
    });
    
    console.log('UUID lookup result:', school ? 'Found' : 'Not found');
    
    if (school) {
      console.log('School found by UUID:', {
        id: school.id,
        schoolId: school.schoolId,
        schoolName: school.schoolName,
        isActive: school.isActive,
        isVerified: school.isVerified
      });
    }
    
    // Try human-readable lookup
    if (!school) {
      console.log('Trying human-readable schoolId lookup...');
      school = await prisma.school.findFirst({
        where: { schoolId: schoolIdFromToken, isActive: true, isVerified: true }
      });
      
      console.log('Human-readable lookup result:', school ? 'Found' : 'Not found');
    }
    
    // Test with the human-readable schoolId
    const humanReadableSchoolId = 'TES1234';
    console.log('\nTesting school lookup with human-readable ID:', humanReadableSchoolId);
    
    school = await prisma.school.findFirst({
      where: { id: humanReadableSchoolId, isActive: true, isVerified: true }
    });
    
    console.log('UUID lookup with human-readable ID result:', school ? 'Found' : 'Not found');
    
    if (!school) {
      school = await prisma.school.findFirst({
        where: { schoolId: humanReadableSchoolId, isActive: true, isVerified: true }
      });
      
      console.log('Human-readable lookup result:', school ? 'Found' : 'Not found');
      
      if (school) {
        console.log('School found by human-readable ID:', {
          id: school.id,
          schoolId: school.schoolId,
          schoolName: school.schoolName,
          isActive: school.isActive,
          isVerified: school.isVerified
        });
      }
    }

  } catch (error) {
    console.error('Error debugging school lookup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugSchoolLookup();
