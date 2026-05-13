import Venta from '../../models/Venta.js';
import Usuario from '../../models/User.js';
import Log from '../../models/Log.js';
import { stockService } from './stockDashboardService.js';

/**
 * Servicio orquestador para procesar métricas del Dashboard de QDRON Store.
 * Centraliza datos de ventas, logs, usuarios e inventario detallado.
 */
export const getStatsService = async () => {
  // 1. Procesamiento de Ventas (Ingresos y Gráfico de Área)
  const ventasStats = await Venta.aggregate([
    {
      $facet: {
        totalIngresos: [
          { $match: { status: "approved" } },
          { 
            $group: { 
              _id: null, 
              sum: { $sum: "$totalAmount" } 
            } 
          }
        ],
        historico: [
          { $match: { status: "approved" } },
          { $sort: { createdAt: -1 } },
          { $limit: 15 }, 
          { 
            $project: { 
              _id: 1,
            
              hour: {
                $dateToString: {
                  format: "%H:%M",
                  date: "$createdAt"
                }
              },
            
              totalAmount: 1,
              status: 1
            }
          },
          { $sort: { _id: 1 } }
        ]
      }
    }
  ]);

  // 2. Ejecución en paralelo para optimizar el rendimiento del Nodo Tucumán
  const [totalUsuarios, inventory, ultimosLogs] = await Promise.all([
    // Conteo de usuarios registrados
    Usuario.countDocuments(),
    
    // NUEVO: Obtención de stock detallado para el gráfico de barras y sección inventario
    stockService.getStockStatsForDash(),
    
    // Últimos 10 eventos del sistema para trazabilidad
    Log.find()
      .sort({ fecha: -1 })
      .limit(10)
      .lean()
  ]);

  // 3. Estructura de respuesta final enviada al Controller
  return {
    stats: {
      ingresos: ventasStats[0].totalIngresos[0]?.sum || 0,
      activos: totalUsuarios,
      // Calculamos el stock total a partir del desglose real de inventory
      stock: inventory.reduce(
        (acc, curr) => acc + (curr.stock || 0),
        0
      )
    },
    ventas: ventasStats[0].historico || [],
    inventory: inventory || [], // 👈 Crucial para que el frontend vea los SKUs
    logs: ultimosLogs || []
  };
};