import express from 'express';
import { getDashboardStats } from '../../controllers/dashboardControllers/index.js';
import { stockController } from '../../controllers/dashboardControllers/stockController.js'; // Importamos el nuevo controlador
import { verifyToken, isAdmin } from '../../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * RUTAS DEL PANEL ADMINISTRATIVO (QDRON DASH)
 * Protocolo: Yerba Buena
 */

// 1. Métricas Globales: Obtiene ventas, logs y stats generales para la vista principal
router.get('/stats', [verifyToken, isAdmin], getDashboardStats);

// 2. Gestión de Stock: Endpoint para obtener el desglose detallado de inventario
// Útil para alimentar el gráfico de barras específicamente
router.get('/stock/stats', [verifyToken, isAdmin], stockController.getInventoryStats);

// 3. Operaciones de Stock: Para ajustes manuales o deducciones fuera del flujo de ventas
router.post('/stock/deduct', [verifyToken, isAdmin], stockController.deductStock);

export default router;