const express = require('express');
const { query } = require('express-validator');
const prisma = require('../utils/prisma');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

/**
 * FR-13: search the audit log by actor, action, entity and date range.
 * Read-only: entries cannot be edited or deleted through the API (SR-06).
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN'),
  query('page').optional().isInt({ min: 1 }),
  query('size').optional().isInt({ min: 1, max: 100 }),
  query('from').optional({ values: 'falsy' }).isISO8601().withMessage('from must be a date'),
  query('to').optional({ values: 'falsy' }).isISO8601().withMessage('to must be a date'),
  query('actor').optional().isString().isLength({ max: 120 }),
  query('action').optional().isString().isLength({ max: 60 }),
  query('entity').optional().isString().isLength({ max: 60 }),
  validate,
  async (req, res, next) => {
    try {
      const { actor, action, entity, from, to } = req.query;
      const size = Number(req.query.size || 25);
      const page = Number(req.query.page || 1);

      const where = {};
      if (action) where.action = action;
      if (entity) where.entity = entity;
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from);
        if (to) {
          const end = new Date(to);
          if (/^\d{4}-\d{2}-\d{2}$/.test(to)) end.setHours(23, 59, 59, 999); // whole day
          where.createdAt.lte = end;
        }
      }
      if (actor) {
        where.actor = {
          OR: [
            { name: { contains: actor, mode: 'insensitive' } },
            { email: { contains: actor, mode: 'insensitive' } },
          ],
        };
      }

      const [data, total, actions] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * size,
          take: size,
          include: { actor: { select: { id: true, name: true, email: true, role: true } } },
        }),
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
      ]);

      res.json({ data, page, size, total, actions: actions.map((a) => a.action) });
    } catch (err) {
      next(err);
    }
  }
);

// Any attempt to change or delete entries is refused (TC-17)
const notAllowed = (req, res) =>
  res.set('Allow', 'GET').status(405).json({ code: 'METHOD_NOT_ALLOWED', status: 405, error: 'Audit log entries cannot be changed or deleted.' });
router.all('/', notAllowed);
router.all('/:id', notAllowed);

module.exports = router;
