import express from 'express';
import {
  process,
  addInteraction,
  confirmMatch,
  rejectMatch,
  list,
  getById,
  approve,
  remove
} from '../controllers/connectionController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.post('/process', auth, process);
router.post('/:id/add-interaction', auth, addInteraction);
router.post('/confirm-match', auth, confirmMatch);
router.post('/reject-match', auth, rejectMatch);

router.get('/', auth, list);
router.get('/:id', auth, getById);
router.patch('/:id/approve', auth, approve);
router.delete('/:id', auth, remove);

export default router;
