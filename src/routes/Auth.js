import express from 'express';
import { login,  logout} from '../controllers/authControllers/index.js';    

const router = express.Router();

// Prefijo: /api/auth

router.post('/login', login);
router.post('/logout', logout);

export default router;