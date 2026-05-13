import * as DashboardService from '../../services/Dashboard/dashboardService.js';

export const getDashboardStats = async (req, res) => {
  try {
    // El servicio ya orquesta la llamada a stockDashboardService internamente
    const data = await DashboardService.getStatsService();
    
    res.status(200).json({
      success: true,
      payload: {
        stats: data.stats,
        ventas: data.ventas,
        logs: data.logs,
        inventory: data.inventory // 👈 ESTO ES CLAVE: Debe enviarse dentro del payload
      }
    });
  } catch (error) {
    console.error("Dashboard Controller Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error en Nodo Tucumán al procesar métricas" 
    });
  }
};