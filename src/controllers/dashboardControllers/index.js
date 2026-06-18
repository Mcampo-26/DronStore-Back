import * as DashboardService from '../../services/Dashboard/dashboardService.js';

export const getDashboardStats = async (req, res) => {
  try {
    const data = await DashboardService.getStatsService();

    return res.status(200).json({
      success: true,
      payload: {
        stats: data.stats || {
          ingresos: 0,
          activos: 0,
          stock: 0
        },
        ventas: data.ventas || [],
        inventory: data.inventory || [],
        logs: data.logsFeed || [] // Cambiado a logsFeed para que coincida con el servicio optimizado
      }
    });

  } catch (error) {
    console.error("❌ Dashboard Controller Error:", error);
    return res.status(500).json({
      success: false,
      message: "Error al procesar métricas del dashboard",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};