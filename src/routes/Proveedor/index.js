import express from 'express';
import {
  createProveedor,
  getProveedores,
  updateProveedor,
  deleteProveedor
} from '../../controllers/proveedorControllers/index.js';
// 🚀 IMPORTANTE: Importamos el middleware de validación de token
import { verifyToken } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// 🔒 Aplicamos el escudo a todos los endpoints corporativos de proveedores
router.post('/', verifyToken, createProveedor);
router.get('/', verifyToken, getProveedores);
router.put('/:id', verifyToken, updateProveedor);
router.delete('/:id', verifyToken, deleteProveedor);

export default router;