import { stockService } from '../../services/Dashboard/stockDashboardService.js';

export const stockController = {

  deductStock: async (req, res) => {
    try {
      const { items, almacenId } = req.body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Se requiere un array válido de items."
        });
      }

      const results = await stockService.deductStock(items, almacenId || null);

      return res.status(200).json({
        success: true,
        message: "Stock actualizado correctamente",
        payload: results
      });

    } catch (error) {
      console.error("❌ Stock Controller Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Error al procesar stock",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  },

  getInventoryStats: async (req, res) => {
    try {
      const inventory = await stockService.getStockStatsForDash();

      return res.status(200).json({
        success: true,
        payload: inventory || []
      });

    } catch (error) {
      console.error("❌ Inventory Stats Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error al obtener estadísticas de inventario",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
    }
  }
};