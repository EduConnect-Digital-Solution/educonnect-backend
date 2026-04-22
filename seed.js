const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const School = require('./src/models/School');
const User = require('./src/models/User');
const Student = require('./src/models/Student');

const BCRYPT_ROUNDS = 12;

const seedData = {
  school: {
    schoolName: 'Sunrise Academy',
    email: 'admin@sunrise.edu',
    password: 'Password123!',
    adminFirstName: 'John',
    adminLastName: 'Doe',
    phone: '+2348012345678',
    address: '123 Education Lane, Lagos, Nigeria'
  },
  teachers: [
    { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@sunrise.edu', subjects: ['Mathematics', 'Physics'], classes: ['JSS1', 'JSS2'] },
    { firstName: 'Michael', lastName: 'Adeyemi', email: 'michael.adeyemi@sunrise.edu', subjects: ['English', 'Literature'], classes: ['JSS1', 'SSS1'] },
    { firstName: 'Grace', lastName: 'Okonkwo', email: 'grace.okonkwo@sunrise.edu', subjects: ['Chemistry', 'Biology'], classes: ['SSS1', 'SSS2'] },
    { firstName: 'Emmanuel', lastName: 'Bello', email: 'emmanuel.bello@sunrise.edu', subjects: ['Geography', 'History'], classes: ['JSS2', 'SSS1'] },
    { firstName: 'Fatima', lastName: 'Hassan', email: 'fatima.hassan@sunrise.edu', subjects: ['Computer Science', 'ICT'], classes: ['SSS1', 'SSS2', 'SSS3'] }
  ],
  parents: [
    { firstName: 'David', lastName: 'Okafor', email: 'david.okafor@email.com', phone: '+2348012345679' },
    { firstName: 'Chioma', lastName: 'Nwofor', email: 'chioma.nwofor@email.com', phone: '+2348012345680' },
    { firstName: 'Emeka', lastName: 'Eze', email: 'emeka.eze@email.com', phone: '+2348012345681' },
    { firstName: 'Amina', lastName: 'Garba', email: 'amina.garba@email.com', phone: '+2348012345682' }
  ],
  students: [
    { firstName: 'Chibueze', lastName: 'Okafor', class: 'JSS1', section: 'A', gender: 'male', dateOfBirth: '2012-03-15' },
    { firstName: 'Ngozi', lastName: 'Nwofor', class: 'JSS1', section: 'A', gender: 'female', dateOfBirth: '2012-07-22' },
    { firstName: 'Obinna', lastName: 'Eze', class: 'JSS2', section: 'B', gender: 'male', dateOfBirth: '2011-11-08' },
    { firstName: 'Zainab', lastName: 'Garba', class: 'SSS1', section: 'A', gender: 'female', dateOfBirth: '2010-05-30' },
    { firstName: 'Emeka', lastName: 'Okafor', class: 'SSS1', section: 'A', gender: 'male', dateOfBirth: '2010-09-12' },
    { firstName: 'Adaeze', lastName: 'Nwofor', class: 'JSS1', section: 'B', gender: 'female', dateOfBirth: '2012-01-25' },
    { firstName: 'Kunle', lastName: 'Eze', class: 'SSS2', section: 'A', gender: 'male', dateOfBirth: '2009-04-18' },
    { firstName: 'Fatimah', lastName: 'Garba', class: 'JSS2', section: 'A', gender: 'female', dateOfBirth: '2011-08-05' }
  ],
  parentStudentLinks: [
    { parentIndex: 0, studentIndices: [0, 1] },
    { parentIndex: 1, studentIndices: [2, 5] },
    { parentIndex: 2, studentIndices: [4, 6] },
    { parentIndex: 3, studentIndices: [3, 7] }
  ]
};

async function seed() {
  try {
    console.log('Starting database seed...\n');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/educonnect-phase1');
    console.log('Connected to MongoDB\n');

    console.log('Clearing existing data...');
    await School.deleteMany({});
    await User.deleteMany({});
    await Student.deleteMany({});
    console.log('Data cleared\n');

    console.log('Creating school...');
    const school = new School({
      schoolName: seedData.school.schoolName,
      email: seedData.school.email,
      password: seedData.school.password,
      phone: seedData.school.phone,
      address: seedData.school.address,
      isVerified: true,
      'systemConfig.subscriptionTier': 'trial',
      'systemConfig.subscriptionStatus': 'active'
    });
    await school.save();
    console.log(`School created: ${school.schoolName} (${school.schoolId})\n`);

    console.log('Creating admin user...');
    const adminUser = new User({
      schoolId: school.schoolId,
      email: seedData.school.email,
      password: seedData.school.password,
      firstName: seedData.school.adminFirstName,
      lastName: seedData.school.adminLastName,
      role: 'admin',
      isVerified: true,
      isActive: true
    });
    await adminUser.save();
    console.log(`Admin created: ${adminUser.email}\n`);

    school.adminUserId = adminUser._id;
    await school.save();

    console.log('Creating students...');
    const students = [];
    for (const studentData of seedData.students) {
      const student = new Student({
        schoolId: school.schoolId,
        firstName: studentData.firstName,
        lastName: studentData.lastName,
        class: studentData.class,
        section: studentData.section,
        gender: studentData.gender,
        dateOfBirth: new Date(studentData.dateOfBirth),
        currentClass: studentData.class,
        createdBy: adminUser._id,
        isActive: true,
        isEnrolled: true,
        email: `${studentData.firstName.toLowerCase()}.${studentData.lastName.toLowerCase()}@student.sunrise.edu`
      });
      await student.save();
      students.push(student);
      console.log(`  Student: ${student.fullName} (${student.studentId}) - ${student.class}`);
    }
    console.log('');

    console.log('Creating parents (with linked students)...');
    const parents = [];
    for (let i = 0; i < seedData.parents.length; i++) {
      const parentData = seedData.parents[i];
      const link = seedData.parentStudentLinks[i];
      const studentIds = link.studentIndices.map(idx => students[idx]._id);

      const parent = new User({
        schoolId: school.schoolId,
        email: parentData.email,
        password: 'Parent@123',
        firstName: parentData.firstName,
        lastName: parentData.lastName,
        phone: parentData.phone,
        role: 'parent',
        studentIds: studentIds,
        children: studentIds,
        isVerified: true,
        isActive: true,
        isTemporaryPassword: true
      });
      await parent.save();
      parents.push(parent);
      console.log(`  Parent: ${parent.fullName}`);

      for (const studentIndex of link.studentIndices) {
        const student = students[studentIndex];
        student.parents.push(parent._id);
        await student.save();
      }
    }
    console.log('');

    console.log('Creating teachers...');
    const teachers = [];
    for (const teacherData of seedData.teachers) {
      const teacher = new User({
        schoolId: school.schoolId,
        email: teacherData.email,
        password: 'Teacher@123',
        firstName: teacherData.firstName,
        lastName: teacherData.lastName,
        role: 'teacher',
        subjects: teacherData.subjects,
        classes: teacherData.classes,
        isVerified: true,
        isActive: true,
        isTemporaryPassword: true
      });
      await teacher.save();
      teachers.push(teacher);
      console.log(`  Teacher: ${teacher.fullName} (${teacher.subjects.join(', ')})`);
    }
    console.log('');

    console.log('Assigning teachers to students...');
    for (const student of students) {
      const classTeachers = teachers.filter(t => t.classes.includes(student.class));
      for (const teacher of classTeachers) {
        if (!student.teachers.includes(teacher._id)) {
          student.teachers.push(teacher._id);
          await student.save();
        }
      }
      console.log(`  Assigned teachers to ${student.fullName}`);
    }
    console.log('');

    console.log('========================================');
    console.log('SEED COMPLETE - TEST CREDENTIALS');
    console.log('========================================\n');

    console.log(`School ID: ${school.schoolId}`);
    console.log(`School Email: ${school.email}\n`);

    console.log('ADMIN LOGIN:');
    console.log(`  Email: ${school.email}`);
    console.log(`  Password: ${seedData.school.password}\n`);

    console.log('TEACHER LOGIN (password same for all): Teacher@123');
    teachers.forEach(t => console.log(`  - ${t.email}`));
    console.log('');

    console.log('PARENT LOGIN (password same for all): Parent@123');
    parents.forEach(p => console.log(`  - ${p.email}`));
    console.log('');

    console.log('STUDENTS (auto-generated IDs):');
    students.forEach(s => console.log(`  - ${s.fullName} (${s.studentId})`));

    await mongoose.disconnect();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();