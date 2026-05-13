import Stock from "../../models/Stock.js";
import Product from "../../models/Product.js";
import Movement from "../../models/Movement.js";

/**
 * stockDashboardService
 * Biblioteca centralizada para la gestión de stock y métricas visuales de QDRON Store.
 */
export const stockService = {
  
  /**
   * Obtiene métricas para los gráficos del Dashboard.
   * Procesa el stock actual y determina niveles críticos.
   */
  async getStockStatsForDash() {
    try {
      return await Product.aggregate([
        {
          $project: {
            name: 1,
            stock: 1,
            // Nivel crítico basado en el diseño de imagen.jpg (umbral de 5 unidades)
            isCritical: { $lt: ["$stock", 5] }
          }
        },
        { $sort: { stock: 1 } }, 
        { $limit: 8 }
      ]);
    } catch (error) {
      console.error("Error en getStockStatsForDash:", error);
      return [];
    }
  },

  /**
   * Descuenta stock de forma atómica y registra movimientos por lotes (FIFO).
   * @param {Array} items - Array de objetos { productId, quantity, name }
   * @param {Object} session - Sesión de MongoDB para transacciones
   */
  async deductStock(items, session = null) {
    const results = [];

    for (const item of items) {
      const { productId, quantity, name } = item;

      // 1. Validación de ID de emergencia
      if (productId === "600000000000000000000001") {
        console.warn(`⚠️ Saltando descuento: El producto "${name}" no tiene un ID válido.`);
        continue;
      }

      // 2. Buscar documento de Stock
      const stockDoc = await Stock.findOne({ producto: productId }).session(session);

      if (!stockDoc) {
        throw new Error(`Inventario no encontrado para: ${name || productId}`);
      }

      if (stockDoc.cantidadTotal < quantity) {
        throw new Error(`Stock insuficiente para ${name}. Disponible: ${stockDoc.cantidadTotal}`);
      }

      // 3. Lógica FIFO (First In, First Out) por Lotes
      let remainingToDeduct = quantity;

      for (let lote of stockDoc.lotes) {
        if (remainingToDeduct <= 0) break;
        if (lote.cantidad <= 0) continue;

        const amountToTake = Math.min(lote.cantidad, remainingToDeduct);
        
        lote.cantidad -= amountToTake;
        remainingToDeduct -= amountToTake;

        // 4. Registro de Movimiento de Salida
        const movement = new Movement({
          productoId: productId,
          loteCodigo: lote.codigo,
          tipo: 'SALIDA',
          cantidad: amountToTake,
          notas: `Deducción automática por venta confirmada`
        });
        
        await movement.save({ session });
      }

      // 5. Actualizar Documento de Stock
      stockDoc.markModified('lotes');
      await stockDoc.save({ session });

      // 6. Sincronización con el modelo Product
      const updatedStockDoc = await Stock.findOne({ producto: productId }).session(session);
      
      await Product.findByIdAndUpdate(
        productId, 
        { stock: updatedStockDoc.cantidadTotal }, 
        { session }
      );

      results.push({ 
        productId, 
        newTotal: updatedStockDoc.cantidadTotal 
      });
    }

    return results;
  }
};