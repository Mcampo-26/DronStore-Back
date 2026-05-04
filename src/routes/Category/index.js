import express from 'express';
const router = express.Router();
import { 
  getCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory 
} from '../../controllers/CategoryControllers/index.js';

// Prefijo base: /api/categories
router.get('/', getCategories);
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;