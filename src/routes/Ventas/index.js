import express from "express";
import { 
  getVentas, 
  getVentaById, 
  deleteVenta 
} from "../../controllers/ventasControllers/index.js";
import { verifyToken, isAdmin } from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", verifyToken, getVentas);
router.get("/:id", verifyToken, getVentaById);
router.delete("/:id", verifyToken, isAdmin, deleteVenta);

export default router;