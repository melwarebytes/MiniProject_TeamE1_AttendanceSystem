const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const reports = require('../services/reportService');
const { badRequest } = require('../utils/errors');
router.get('/', authenticate, authorize('ADMIN', 'FACULTY'), async (req, res, next) => {
  try {
    const format = req.query.format || 'json';
    if (!['json', 'csv', 'pdf'].includes(format)) throw badRequest('format must be json, csv or pdf.');
    if (format === 'json') return res.json(await reports.createReport(req.query, req.user));
    const report = await reports.getSnapshot(req.query.snapshot, req.user);
    res.attachment(`attendance-${report.from}-${report.to}.${format}`);
    if (format === 'csv') return res.type('text/csv').send(reports.csv(report));
    res.type('application/pdf'); reports.pdf(report, res);
  } catch (error) { next(error); }
});
module.exports = router;
