const multer = require('multer');
const { AppError } = require('../utils/AppError');

/**
 * Accept a single CSV file in memory (field name "file").
 *
 * 5 MB is far more than 5000 rows need. It matches the limit the global error
 * handler reports for oversized uploads. The file is never written to disk.
 */

const MAX_CSV_BYTES = 5 * 1024 * 1024;

// Browsers and Windows disagree on the MIME type of a .csv file.
const CSV_MIME_TYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/octet-stream'
]);

const fileFilter = (req, file, callback) => {
  const hasCsvName = /\.csv$/i.test(file.originalname || '');
  if (!hasCsvName || !CSV_MIME_TYPES.has(file.mimetype)) {
    return callback(new AppError('Upload a .csv file', 400, 'CSV_FILE_REQUIRED'));
  }
  return callback(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CSV_BYTES, files: 1 },
  fileFilter
});

/** Express middleware: parses the upload and puts the bytes on req.csvBuffer. */
const csvUpload = [
  upload.single('file'),
  (req, res, next) => {
    if (!req.file) {
      return next(new AppError('Attach the CSV as a form field named "file"', 400, 'CSV_FILE_REQUIRED'));
    }
    req.csvBuffer = req.file.buffer;
    return next();
  }
];

module.exports = {
  MAX_CSV_BYTES,
  fileFilter,
  csvUpload
};
