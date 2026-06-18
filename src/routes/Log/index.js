import express from 'express';
import { getLogs, postLog } from '../../controllers/logControllers/index.js';
import { verifyToken,isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', verifyToken, isAdmin, getLogs);
router.post('/', verifyToken, postLog);

export default router;