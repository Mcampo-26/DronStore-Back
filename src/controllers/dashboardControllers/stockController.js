import { stockService } from '../../services/Dashboard/stockDashboardService.js';

/**
 * Controller para la gestión operativa del Stock
 */
export const stockController = {

  /**
   * Endpoint para descontar stock (útil para integraciones manuales o correcciones)
   * POST /api/stock/deduct
   */
  deductStock: async (req, res) => {
    try {
      const { items } = req.body; // Array de { productId, quantity, name }

      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ 
          success: false, 
          message: "Se requiere un array de items para procesar el stock." 
        });
      }

      const results = await stockService.deductStock(items);

      res.status(200).json({
        success: true,
        message: "Stock actualizado correctamente",
        payload: results
      });
    } catch (error) {
      console.error("Stock Controller Error:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al procesar la deducción de stock"
      });
    }
  },

  /**
   * Endpoint para obtener el estado actual de los productos (Dash)
   * GET /api/stock/stats
   */
  getInventoryStats: async (req, res) => {
    try {
      const inventory = await stockService.getStockStatsForDash();
      
      res.status(200).json({
        success: true,
        payload: inventory
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Error al obtener estadísticas de inventario"
      });
    }
  }
};