import express from 'express';
import multer from 'multer';
import { transcribe, transcribeLive } from '../controllers/transcribeController.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});
const rawAudio = express.raw({
  type: ['audio/*', 'application/octet-stream'],
  limit: '200mb',
});

router.post(
  '/',
  (req, res, next) => {
    if (req.is('multipart/form-data')) {
      return upload.single('audio')(req, res, next);
    }

    return rawAudio(req, res, next);
  },
  transcribe
);
router.post('/live', transcribeLive);

export default router;

