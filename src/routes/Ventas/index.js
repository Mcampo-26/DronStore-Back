import express from "express";
import { 
  getVentas, 
  getVentaById, 
  deleteVenta 
} from "../../controllers/ventasControllers/index.js";
// 🚀 IMPORTACIÓN CLAVE: Traemos el middleware que lee e inyecta la sesión del usuario
import { verifyToken } from "../../middlewares/auth.middleware.js"; 

const router = express.Router();

/**
 * Route: GET /ventas
 * Purpose: Obtiene todas las ventas con filtros avanzados (búsqueda, estado, fechas).
 * 🔒 Protegido: Filtra automáticamente si es Admin (ve todo) o Usuario Común (ve solo sus drones)
 */
router.get("/", verifyToken, getVentas);

/**
 * Route: GET /ventas/:id
 * Purpose: Obtiene el detalle de una venta específica por su ID.
 */
router.get("/:id", verifyToken, getVentaById);

/** * Route: DELETE /ventas/:id
 * Purpose: Elimina una venta del sistema.
 */
router.delete("/:id", verifyToken, deleteVenta);

export default router;