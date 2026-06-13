import { Router } from "express";
import {
  getMyProducts,
  createMyProduct,
  updateMyProduct,
  deleteMyProduct
} from "../../controllers/userProductController/index.js"; // Asegurá que la ruta apunte a tu nuevo controlador

// 🚀 IMPORTANTE: Reemplazá este import por la ruta real de tu middleware de autenticación
import { verifyToken } from "../../middlewares/auth.middleware.js"; 

const router = Router();

/**
 * 🔒 PROTOCOLO DE RUTAS PRIVADAS - RANGO: INVENTARIO DE USUARIO
 * Todas las rutas de este carril exigen de forma obligatoria pasar por 'isAuth'.
 * Esto inyecta el 'req.user' desencriptando el token de sesión de forma segura.
 */

// 📂 GET: /api/my-products -> Obtener el inventario de drones exclusivo del usuario logueado (Paginado)
router.get("/", verifyToken, getMyProducts);

// ➕ POST: /api/my-products -> Registrar un nuevo dron sellado con el ID del usuario
router.post("/", verifyToken, createMyProduct);

// ✏️ PUT: /api/my-products/:id -> Actualizar un dron propio con validación de pertenencia
router.put("/:id", verifyToken, updateMyProduct);

// ❌ DELETE: /api/my-products/:id -> Eliminar un dron propio de forma restrictiva
router.delete("/:id", verifyToken, deleteMyProduct);

export default router;