// backend/src/services/Dashboard/dashboardService.js
import Venta from '../../models/Venta.js';
import Usuario from '../../models/User.js';
import Log from '../../models/Log.js';
import { stockService } from './stockDashboardService.js';

/**
 * Servicio orquestador para procesar métricas del Dashboard de QDRON Store.
 * Centraliza datos de ventas, logs segmentados, usuarios e inventario detallado.
 */
export const getStatsService = async ({ limit = 20, skip = 0 } = {}) => {
  
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

  // 2. Orquestación y Agregación Avanzada en Paralelo (Hangar Core)
  const [totalUsuarios, inventory, logAnalytics] = await Promise.all([
    Usuario.countDocuments(),
    
    stockService.getStockStatsForDash(),
    
    Log.aggregate([
      {
        $facet: {
          // 📊 EN 2026 EL BACKEND AGRUPA: Devolvemos los totales listos para Recharts sin estresar la CPU del frente
          paraGrafico: [
            { $sort: { fecha: -1 } },
            { $limit: 200 }, // Analizamos una muestra pesada de los últimos 200 eventos
            {
              $group: {
                _id: {
                  $cond: [
                    {
                      $or: [
                        { $regexMatch: { input: "$accion", regex: "AUTH", options: "i" } },
                        { $regexMatch: { input: "$accion", regex: "LOGIN", options: "i" } },
                        { $regexMatch: { input: "$accion", regex: "INICIÓ", options: "i" } }
                      ]
                    },
                    "Accesos (Auth)",
                    {
                      $cond: [
                        {
                          $or: [
                            { $regexMatch: { input: "$accion", regex: "PRODUCT", options: "i" } },
                            { $regexMatch: { input: "$accion", regex: "STOCK", options: "i" } },
                            { $regexMatch: { input: "$accion", regex: "CATEGORY", options: "i" } },
                            { $regexMatch: { input: "$accion", regex: "MODIFICÓ", options: "i" } },
                            { $regexMatch: { input: "$accion", regex: "EDITÓ", options: "i" } }
                          ]
                        },
                        "Cambios Técnicos",
                        "Núcleo Sistema"
                      ]
                    }
                  ]
                },
                value: { $sum: 1 }
              }
            },
            {
              $project: {
                _id: 0,
                name: "$_id",
                value: 1,
                // Asignamos los colores corporativos directamente desde la persistencia
                color: {
                  $switch: {
                    branches: [
                      { case: { $eq: ["$_id", "Accesos (Auth)"] }, then: "#22c55e" },
                      { case: { $eq: ["$_id", "Cambios Técnicos"] }, then: "#3483fa" }
                    ],
                    default: "#a855f7"
                  }
                }
              }
            }
          ],
          
          // ⏱️ FEED CONFIGURABLE: Los últimos 20 logs crudos para la Timeline con soporte de Skip para el botón de cargar más
          paraFeed: [
            { $sort: { fecha: -1 } },
            { $skip: skip },
            { $limit: limit }
          ]
        }
      }
    ])
  ]);

  const dataLogs = logAnalytics[0] || { paraGrafico: [], paraFeed: [] };

  // 3. Estructura de respuesta final enviada al Controller (Limpia e Inmutable)
  return {
    stats: {
      ingresos: ventasStats[0].totalIngresos[0]?.sum || 0,
      activos: totalUsuarios,
      stock: inventory.reduce((acc, curr) => acc + (curr.stock || 0), 0)
    },
    ventas: ventasStats[0].historico || [],
    inventory: inventory || [], 
    
    // Formato de salida desacoplado
    securityDistData: dataLogs.paraGrafico || [], // 🚀 Listo: <Pie data={securityDistData} /> directo en Recharts
    logsFeed: dataLogs.paraFeed || []          // 🚀 Listo: Lista corta de 20 para tu Timeline
  };
};