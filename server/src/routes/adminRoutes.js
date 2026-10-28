const router = require('express').Router();
const multer = require('multer');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const users = require('../services/userService');
const courses = require('../services/courseService');
const policies = require('../services/policyService');
const { page } = require('../utils/input');
const { badRequest } = require('../utils/errors');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
router.use(authenticate);
router.get(
  '/sections',
  authorize('ADMIN', 'FACULTY'),
  wrap(async (req, res) => {
    const { page: p, size, skip } = page(req.query);
    const where = req.user.role === 'FACULTY' ? { faculty: { some: { userId: req.user.id } } } : {};
    const [data, total] = await Promise.all([
      prisma.section.findMany({
        where,
        skip,
        take: size,
        orderBy: [{ semesterStart: 'desc' }, { id: 'asc' }],
        include: {
          course: true,
          faculty: true,
          enrollments: { include: { periods: true, user: { select: users.publicFields } } },
        },
      }),
      prisma.section.count({ where }),
    ]);
    res.json({ data, total, page: p, size });
  }),
);
router.get(
  '/users',
  authorize('ADMIN'),
  wrap(async (req, res) => {
    const { page: p, size, skip } = page(req.query);
    const where = { anonymizedAt: null };
    if (req.query.role) {
      if (!['STUDENT', 'FACULTY', 'ADMIN'].includes(req.query.role)) throw badRequest('Invalid role.');
      where.role = req.query.role;
    }
    if (req.query.q)
      where.OR = ['name', 'email', 'srn'].map((key) => ({
        [key]: { contains: String(req.query.q).slice(0, 100), mode: 'insensitive' },
      }));
    const [data, total] = await Promise.all([
      prisma.user.findMany({ where, select: users.publicFields, skip, take: size, orderBy: { id: 'asc' } }),
      prisma.user.count({ where }),
    ]);
    res.json({ data, total, page: p, size });
  }),
);
router.post(
  '/users',
  authorize('ADMIN'),
  wrap(async (req, res) => res.status(201).json(await users.saveUser(req.body, null, req.user, req.ip))),
);
router.patch(
  '/users/:id',
  authorize('ADMIN'),
  wrap(async (req, res) => res.json(await users.saveUser(req.body, req.params.id, req.user, req.ip))),
);
router.post(
  '/users/import',
  authorize('ADMIN'),
  upload.single('file'),
  wrap(async (req, res) => {
    if (!req.file) throw badRequest('A CSV file is required in the file field.');
    res.json(await users.importUsers(req.file.buffer, req.user, req.ip));
  }),
);
router.get(
  '/courses',
  authorize('ADMIN'),
  wrap(async (req, res) => {
    const { page: p, size, skip } = page(req.query);
    const [data, total] = await Promise.all([
      prisma.course.findMany({ skip, take: size, orderBy: { code: 'asc' } }),
      prisma.course.count(),
    ]);
    res.json({ data, total, page: p, size });
  }),
);
router.post(
  '/courses',
  authorize('ADMIN'),
  wrap(async (req, res) => res.status(201).json(await courses.createCourse(req.body, req.user, req.ip))),
);
router.post(
  '/sections',
  authorize('ADMIN'),
  wrap(async (req, res) => res.status(201).json(await courses.createSection(req.body, req.user, req.ip))),
);
router.put(
  '/sections/:id/faculty',
  authorize('ADMIN'),
  wrap(async (req, res) =>
    res.json(await courses.setFaculty(req.params.id, req.body.userIds, req.user, req.ip)),
  ),
);
router.put(
  '/sections/:id/enrolments',
  authorize('ADMIN'),
  wrap(async (req, res) =>
    res.json(await courses.replaceRoster(req.params.id, req.body.userIds, req.user, req.ip)),
  ),
);
router.get(
  '/policies',
  authorize('ADMIN'),
  wrap(async (_req, res) => res.json(await policies.getPolicy())),
);
router.put(
  '/policies',
  authorize('ADMIN'),
  wrap(async (req, res) => res.json(await policies.setPolicy(req.body, req.user, req.ip))),
);
module.exports = router;
