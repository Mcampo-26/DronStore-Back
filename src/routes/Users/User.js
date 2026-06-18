import express from 'express';
import { 
  createUsuario, 
  getUsuarios, 
  updateUsuario, 
  deleteUsuario 
} from '../../controllers/Usercontrollers/index.js';
import { verifyToken,isAdmin } from '../../middlewares/auth.middleware.js';
// O donde tengas tu validador de rol admin

const router = express.Router();

// Ruta Pública: Permite el alta autónoma de nuevos clientes en la plataforma
router.post('/register', createUsuario);

// Rutas Administrativas: Doble cerrojo para proteger los datos de las cuentas
router.get('/', verifyToken, isAdmin, getUsuarios);
router.put('/:id', verifyToken, isAdmin, updateUsuario);
router.delete('/:id', verifyToken, isAdmin, deleteUsuario);

export default router;