import express from 'express';
import { 
  getProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getProductRecommendations 
} from '../../controllers/productControllers/index.js';
import { verifyToken } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Rutas Públicas (Catálogo del Marketplace para los clientes)
router.get('/', getProducts);
router.get('/:id', getProductById);
router.get('/:id/recommendations', getProductRecommendations);

// Rutas Privadas (Solo proveedores o administradores autenticados)
router.post('/', verifyToken, createProduct);
router.put('/:id', verifyToken, updateProduct);
router.delete('/:id', verifyToken, deleteProduct);

export default router;