const { prisma } = require('./src/config/database');

async function migrateClassLevels() {
  try {
    console.log('Starting class level migration...');
    
    // Get all existing classes
    const classes = await prisma.class.findMany({
      select: {
        id: true,
        baseLevel: true
      }
    });
    
    console.log(`Found ${classes.length} classes to migrate`);
    
    // Map baseLevel to level
    const levelMap = {
      'JSS1': 1, 'JSS2': 2, 'JSS3': 3,
      'SSS1': 4, 'SSS2': 5, 'SSS3': 6
    };
    
    // Update each class with the corresponding level
    const updates = classes.map(cls => {
      const level = levelMap[cls.baseLevel];
      if (level) {
        return prisma.class.update({
          where: { id: cls.id },
          data: { level }
        });
      }
      return null;
    }).filter(Boolean);
    
    // Execute all updates
    const results = await Promise.all(updates);
    console.log(`Successfully migrated ${results.length} classes`);
    
    // Show any unmigrated classes
    const unmigrated = classes.filter(cls => !levelMap[cls.baseLevel]);
    if (unmigrated.length > 0) {
      console.log('Classes that could not be migrated:');
      unmigrated.forEach(cls => {
        console.log(`- ${cls.baseLevel} (ID: ${cls.id})`);
      });
    }
    
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateClassLevels();
