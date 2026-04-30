import express from 'express';
import { 
  createUsuario, 
  getUsuarios, 
  updateUsuario, 
  deleteUsuario 
} from '../../controllers/Usercontrollers/index.js';

const router = express.Router();

// Rutas de Gestión de Usuarios
router.post('/register', createUsuario); // Crear
router.get('/', getUsuarios);            // Leer todos
router.put('/:id', updateUsuario);       // Actualizar
router.delete('/:id', deleteUsuario);    // Eliminar

export default router;