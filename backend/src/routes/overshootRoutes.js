import express from 'express';
import { receiveOvershootResult, generateHeadshot } from '../controllers/overshootController.js';

const router = express.Router();

// Route to receive Overshoot SDK results
router.post('/overshoot-result', receiveOvershootResult);

// Route to generate headshot using OpenRouter (Gemini)
router.post('/generate-headshot', generateHeadshot);

export default router;

