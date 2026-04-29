import express from 'express';
import { 
  getRoles, 
  createRole, 
  updateRole, 
  deleteRole 
} from '../../controllers/roleControllers/index.js';

const router = express.Router();

// Operaciones de Flota de Roles
router.get('/', getRoles);
router.post('/', createRole);
router.put('/:id', updateRole);
router.delete('/:id', deleteRole);

export default router;