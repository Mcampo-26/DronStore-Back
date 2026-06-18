import express from 'express';
import { 
  createAlmacen, 
  getAlmacenes, 
  getAlmacenById, 
  buscarStockPorCercania 
} from '../../controllers/almacenControllers/index.js';

const router = express.Router();

router.post('/', createAlmacen);
router.get('/', getAlmacenes);
router.get('/geolocalizar', buscarStockPorCercania);
router.get('/:id', getAlmacenById);

export default router;