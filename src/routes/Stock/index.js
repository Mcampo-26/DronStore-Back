import express from "express";
import { 
  getStock, 
  updateStock, 
  deleteBatch,    
  fetchHistory,  
} from "../../controllers/stockControllers/index.js";
import { getGeoStock } from "../../controllers/stockControllers/geoStockController.js";
import { verifyToken } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// 🗺️ Ruta Pública: El mapa de calor de stock geolocalizado para el Marketplace
router.get('/geo-stock', getGeoStock);

// 🔒 Rutas Privadas Protegidas: Control estricto de inventario por proveedor
router.get("/", verifyToken, getStock);
router.get("/movements/:productId", verifyToken, fetchHistory);
router.put("/:id", verifyToken, updateStock);
router.delete("/:productId/batch/:batchCode", verifyToken, deleteBatch);

export default router;