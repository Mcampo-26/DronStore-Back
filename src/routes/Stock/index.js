import express from "express";
import { 
  getStock, 
  updateStock, 
  deleteBatch,    // Importamos la nueva función
  fetchHistory    // Importamos el historial de movimientos
} from "../../controllers/stockControllers/index.js";

const router = express.Router();

/**
 * Route: GET /stock
 * Purpose: Obtiene todos los documentos de stock y lotes.
 */
router.get("/", getStock);

/**
 * Route: GET /stock/movements/:productId
 * Purpose: Obtiene el historial de movimientos de un producto específico.
 */
router.get("/movements/:productId", fetchHistory);

/**
 * Route: PUT /stock/:id
 * Purpose: Actualiza niveles de stock y agrega un nuevo lote.
 */
router.put("/:id", updateStock);

/**
 * Route: DELETE /stock/:productId/batch/:batchCode
 * Purpose: Elimina un lote específico de un producto.
 */
router.delete("/:productId/batch/:batchCode", deleteBatch);

export default router;