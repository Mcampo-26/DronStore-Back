import express from 'express';
import { 
  createAlmacen, 
  getAlmacenes, 
  getAlmacenById, 
  buscarStockPorCercania 
} from '../../controllers/almacenControllers/index.js';
// 🚀 IMPORTADO: Traemos el middleware de autenticación que me pasaste
import { verifyToken } from '../../middlewares/auth.middleware.js'; 

const router = express.Router();

// 🔒 Ahora sí, req.user estará poblado y el controlador aislará los datos según el ID
router.post('/', verifyToken, createAlmacen);
router.get('/', verifyToken, getAlmacenes);
router.get('/:id', verifyToken, getAlmacenById);

// 🗺️ El buscador por cercanía queda libre para el Marketplace de cara a los clientes
router.get('/geolocalizar', buscarStockPorCercania);

export default router;