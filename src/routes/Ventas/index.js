import express from "express";
import { 
  getVentas, 
  getVentaById, 
  deleteVenta 
} from "../../controllers/ventasControllers/index.js";

const router = express.Router();

/**
 * Route: GET /ventas
 * Purpose: Obtiene todas las ventas con filtros avanzados (búsqueda, estado, fechas).
 */
router.get("/", getVentas);

/**
 * Route: GET /ventas/:id
 * Purpose: Obtiene el detalle de una venta específica por su ID.
 */
router.get("/:id", getVentaById);


/** * Route: DELETE /ventas/:id
 * Purpose: Elimina una venta del sistema.
 */
router.delete("/:id", deleteVenta);

export default router;