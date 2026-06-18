import express from 'express';
import {
  createProveedor,
  getProveedores,
  updateProveedor,
  deleteProveedor
} from '../../controllers/proveedorControllers/index.js';

const router = express.Router();

router.post('/', createProveedor);
router.get('/', getProveedores);
router.put('/:id', updateProveedor);
router.delete('/:id', deleteProveedor);

export default router;