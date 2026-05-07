import express from 'express';
const router = express.Router();
import { syncCart, getCart } from '../../controllers/cartControllers/index.js';
// import { checkAuth } from '../middleware/authMiddleware.js'; // Opcional pero recomendado

router.post('/sync', syncCart);
router.get('/:userId', getCart);

export default router;