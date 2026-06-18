import express from 'express';
import { 
  getRoles, 
  createRole, 
  updateRole, 
  deleteRole 
} from '../../controllers/roleControllers/index.js';
import { verifyToken,isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.get('/', verifyToken, isAdmin, getRoles);
router.post('/', verifyToken, isAdmin, createRole);
router.put('/:id', verifyToken, isAdmin, updateRole);
router.delete('/:id', verifyToken, isAdmin, deleteRole);

export default router;