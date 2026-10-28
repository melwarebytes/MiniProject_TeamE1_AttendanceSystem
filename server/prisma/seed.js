require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/utils/prisma');

async function main() {
  console.log('Seeding SAMS Database...');
  await prisma.policy.upsert({ where: { id: 'institution' }, create: {}, update: {} });

  // 1. Create Users
  const passwordHash = await bcrypt.hash('Password123!', 12);

  await prisma.user.upsert({
    where: { email: 'admin@pes.edu' },
    update: {},
    create: {
      name: 'System Admin',
      email: 'admin@pes.edu',
      passwordHash,
      role: 'ADMIN',
      active: true,
    },
  });

  const faculty = await prisma.user.upsert({
    where: { email: 'faculty@pes.edu' },
    update: {},
    create: {
      name: 'Prof. Ramesh Kumar',
      email: 'faculty@pes.edu',
      passwordHash,
      role: 'FACULTY',
      active: true,
    },
  });

  const bhuvan = await prisma.user.upsert({
    where: { email: 'bhuvan@pes.edu' },
    update: {},
    create: {
      srn: 'PES1UG24CS286',
      name: 'N Bhuvan Teja',
      email: 'bhuvan@pes.edu',
      passwordHash,
      role: 'STUDENT',
      active: true,
    },
  });

  const student2 = await prisma.user.upsert({
    where: { email: 'student2@pes.edu' },
    update: {},
    create: {
      srn: 'PES1UG24CS270',
      name: 'Merull Shah',
      email: 'student2@pes.edu',
      passwordHash,
      role: 'STUDENT',
      active: true,
    },
  });

  // 2. Create Courses
  const seCourse = await prisma.course.upsert({
    where: { code: 'UE24CS301' },
    update: {},
    create: {
      code: 'UE24CS301',
      name: 'Software Engineering',
      description: 'Core software engineering concepts, Agile methodologies, and mini-project.',
    },
  });

  await prisma.course.upsert({
    where: { code: 'UE24CS302' },
    update: {},
    create: {
      code: 'UE24CS302',
      name: 'Database Management Systems',
      description: 'Relational data models, SQL, indexing, and transactions.',
    },
  });

  // 3. Create Sections
  const semesterStart = new Date('2026-08-01');
  const semesterEnd = new Date('2026-12-15');

  const sectionA = await prisma.section.upsert({
    where: {
      courseId_name_semesterStart: {
        semesterStart,
        courseId: seCourse.id,
        name: 'A',
      },
    },
    update: {},
    create: {
      courseId: seCourse.id,
      name: 'A',
      semesterStart,
      semesterEnd,
      attendanceThreshold: 75.0,
      editWindowHours: 48,
    },
  });

  // 4. Assign Faculty to Section
  await prisma.sectionFaculty.upsert({
    where: {
      sectionId_userId: {
        sectionId: sectionA.id,
        userId: faculty.id,
      },
    },
    update: {},
    create: {
      sectionId: sectionA.id,
      userId: faculty.id,
    },
  });

  // 5. Enroll Students
  const bhuvanEnrollment = await prisma.enrollment.upsert({
    where: {
      sectionId_userId: {
        sectionId: sectionA.id,
        userId: bhuvan.id,
      },
    },
    update: {},
    create: {
      sectionId: sectionA.id,
      userId: bhuvan.id,
    },
  });

  await prisma.enrollment.upsert({
    where: {
      sectionId_userId: {
        sectionId: sectionA.id,
        userId: student2.id,
      },
    },
    update: {},
    create: {
      sectionId: sectionA.id,
      userId: student2.id,
    },
  });

  // 6. Timetable Slots (FR-05)
  const existingSlot = await prisma.timetableSlot.findFirst({
    where: { sectionId: sectionA.id },
  });

  if (!existingSlot) {
    await prisma.timetableSlot.createMany({
      data: [
        { sectionId: sectionA.id, dayOfWeek: 'MON', startTime: '09:00', endTime: '10:00' },
        { sectionId: sectionA.id, dayOfWeek: 'WED', startTime: '11:15', endTime: '12:15' },
        { sectionId: sectionA.id, dayOfWeek: 'FRI', startTime: '14:00', endTime: '15:00' },
      ],
    });
  }

  // 7. Seed Sample Sessions & Attendance Records for Bhuvan
  const today = new Date();
  for (let i = 1; i <= 5; i++) {
    const sessionDate = new Date();
    sessionDate.setDate(today.getDate() - (6 - i));

    const sess = await prisma.session.create({
      data: {
        sectionId: sectionA.id,
        date: sessionDate,
        startTime: '09:00',
        endTime: '10:00',
        status: 'SCHEDULED',
      },
    });

    // Mark 4 present and 1 absent for Bhuvan (80% attendance)
    await prisma.attendanceRecord.create({
      data: {
        enrollmentId: bhuvanEnrollment.id,
        sessionId: sess.id,
        status: i === 3 ? 'ABSENT' : 'PRESENT',
        markedById: faculty.id,
        markedAt: sessionDate,
      },
    });
  }

  console.log('Seeding completed successfully!');
  console.log('Test Accounts created:');
  console.log(' - Admin: admin@pes.edu / Password123!');
  console.log(' - Faculty: faculty@pes.edu / Password123!');
  console.log(' - Student (Bhuvan): bhuvan@pes.edu / Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
