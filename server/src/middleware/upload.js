const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const { badRequest } = require('../utils/errors');
const uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const receive = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
function mimeFor(buffer) {
  if (buffer.subarray(0, 5).toString() === '%PDF-') return ['application/pdf', '.pdf'];
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return ['image/png', '.png'];
  if (buffer.length > 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return ['image/jpeg', '.jpg'];
  return null;
}
module.exports = {
  single(field) {
    return (req, res, next) =>
      receive.single(field)(req, res, async (error) => {
        if (error) return next(error);
        if (!req.file) return next();
        try {
          const detected = mimeFor(req.file.buffer);
          if (!detected) throw badRequest('Only PDF, JPG and PNG file content is accepted.');
          const declared = req.file.mimetype === 'image/jpg' ? 'image/jpeg' : req.file.mimetype;
          if (declared !== detected[0])
            throw badRequest('Attachment content does not match its declared type.');
          await fs.mkdir(uploadDir, { recursive: true });
          const filename = crypto.randomUUID() + detected[1];
          const filePath = path.join(uploadDir, filename);
          await fs.writeFile(filePath, req.file.buffer, { flag: 'wx', mode: 0o600 });
          req.file = { path: filePath, mimetype: detected[0], filename };
          next();
        } catch (err) {
          next(err);
        }
      });
  },
};
