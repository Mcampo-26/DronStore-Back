import Venta from '../../models/Venta.js';
import Usuario from '../../models/User.js';
import Log from '../../models/Log.js';
import Product from '../../models/Product.js'; // 🚀 Importamos Product para contar el stock global real
import { stockService } from './stockDashboardService.js';

export const getStatsService = async ({ limit = 20, skip = 0 } = {}) => {
  
  // 1. Procesamiento de Ventas (Se mantiene igual)
  const ventasStats = await Venta.aggregate([
    {
      $facet: {
        totalIngresos: [
          { $match: { status: "approved" } },
          { $group: { _id: null, sum: { $sum: "$totalAmount" } } }
        ],
        historico: [
          { $match: { status: "approved" } },
          { $sort: { createdAt: -1 } },
          { $limit: 15 },
          { $unwind: { path: "$productos", preserveNullAndEmptyArrays: true } }, 
          { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: "products",
              localField: "productos.productoId",
              foreignField: "_id",
              as: "productoDetalle"
            }
          },
          {
            $project: {
              _id: 1,
              hour: { $dateToString: { format: "%H:%M", date: "$createdAt" } },
              totalAmount: 1,
              status: 1,
              productName: {
                $ifNull: [
                  { $arrayElemAt: ["$productoDetalle.name", 0] },
                  { $ifNull: ["$productos.name", { $ifNull: ["$items.name", "Operación de Venta"] }] }
                ]
              }
            }
          },
          { $sort: { _id: 1 } }
        ]
      }
    }
  ]);

  // 2. Orquestación y Agregación Avanzada en Paralelo
  // 🚀 Agregamos la suma real de stock de todos los productos de la BD en paralelo
  const [totalUsuarios, inventoryCritical, logAnalytics, globalStockCalc] = await Promise.all([
    Usuario.countDocuments(),
    stockService.getStockStatsForDash(), // Esto te trae el Top 8 crítico para el gráfico/tabla del dash
    Log.aggregate([
      {
        $facet: {
          paraGrafico: [
            { $sort: { fecha: -1 } },
            { $limit: 200 },
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
          paraFeed: [
            { $sort: { fecha: -1 } },
            { $skip: skip },
            { $limit: limit }
          ]
        }
      }
    ]),
    // 🚀 Query rápida para saber el stock total de la empresa de verdad:
    Product.aggregate([
      { $group: { _id: null, total: { $sum: { $ifNull: ["$stock", 0] } } } }
    ])
  ]);

  const dataLogs = logAnalytics[0] || { paraGrafico: [], paraFeed: [] };

  // 3. Estructura de respuesta final limpia
  return {
    stats: {
      ingresos: ventasStats[0].totalIngresos[0]?.sum || 0,
      activos: totalUsuarios,
      stock: globalStockCalc[0]?.total || 0 // 🚀 Cambiado: Ahora sí es el stock global real de QDRON Store
    },
    ventas: ventasStats[0].historico || [],
    inventory: inventoryCritical || [], // Mantiene el top 8 para componentes visuales cortos
    securityDistData: dataLogs.paraGrafico || [], 
    logsFeed: dataLogs.paraFeed || [] 
  };
};