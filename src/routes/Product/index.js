import express from 'express';
import { 
  getProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct,
  getProductRecommendations // 🤖 Agregamos el nuevo controlador que crearemos ahora
} from '../../controllers/productControllers/index.js';

const router = express.Router();

router.get('/', getProducts);
router.get('/:id', getProductById);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);

// ==========================================
// NUEVA RUTA PARA RECOMENDACIONES CON IA
// ==========================================
router.get('/:id/recommendations', getProductRecommendations);

export default router;