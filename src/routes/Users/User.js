import express from 'express';
import { 
  createUsuario,  // ✅ Asegúrate que este nombre sea igual al del controlador
  getUsuarios, 
  updateUsuario, 
  deleteUsuario 
} from '../../controllers/Usercontrollers/index.js';

const router = express.Router();

// Si tu frontend dispara a /users/register, ponlo así:
router.post('/register', createUsuario); 

router.get('/', getUsuarios);
router.put('/:id', updateUsuario);
router.delete('/:id', deleteUsuario);

export default router;