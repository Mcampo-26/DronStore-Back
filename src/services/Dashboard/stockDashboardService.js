import Stock from "../../models/Stock.js";
import Product from "../../models/Product.js";
import Movement from "../../models/Movement.js";

/**
 * Servicio centralizado de stock y dashboard
 */
export const stockService = {

  /**
   * Obtiene métricas optimizadas para el dashboard
   */
  async getStockStatsForDash() {
    try {
      const inventory = await Product.aggregate([
        {
          $project: {
            _id: 1,
            name: 1,
            stock: {
              $ifNull: ["$stock", 0]
            },
            isCritical: {
              $lt: [
                { $ifNull: ["$stock", 0] },
                5
              ]
            }
          }
        },

        {
          $sort: {
            stock: 1
          }
        },

        {
          $limit: 8
        }
      ]);

      return inventory;

    } catch (error) {

      console.error(
        "❌ Error en getStockStatsForDash:",
        error
      );

      return [];
    }
  },

  /**
   * Descuenta stock usando FIFO
   * @param {Array} items
   * @param {Object|null} session
   */
  async deductStock(items, session = null) {

    if (!Array.isArray(items)) {
      throw new Error("El parámetro items debe ser un array.");
    }

    const results = [];

    for (const item of items) {

      const {
        productId,
        quantity,
        name
      } = item;

      /**
       * VALIDACIONES
       */
      if (!productId) {
        throw new Error(
          `Producto inválido: ${name || "Sin nombre"}`
        );
      }

      if (
        typeof quantity !== "number" ||
        quantity <= 0
      ) {
        throw new Error(
          `Cantidad inválida para ${name || productId}`
        );
      }

      /**
       * PRODUCTO PLACEHOLDER
       */
      if (
        productId ===
        "600000000000000000000001"
      ) {

        console.warn(
          `⚠️ Producto omitido: "${name}" posee ID placeholder.`
        );

        continue;
      }

      /**
       * BUSCAR DOCUMENTO DE STOCK
       */
      const stockDoc = await Stock.findOne({
        producto: productId
      }).session(session);

      if (!stockDoc) {
        throw new Error(
          `Inventario no encontrado para: ${name || productId}`
        );
      }

      /**
       * VALIDAR DISPONIBILIDAD
       */
      const stockDisponible =
        stockDoc.cantidadTotal || 0;

      if (stockDisponible < quantity) {
        throw new Error(
          `Stock insuficiente para ${
            name || productId
          }. Disponible: ${stockDisponible}`
        );
      }

      /**
       * FIFO
       */
      let remainingToDeduct = quantity;

      for (const lote of stockDoc.lotes) {

        if (remainingToDeduct <= 0) {
          break;
        }

        if (!lote.cantidad || lote.cantidad <= 0) {
          continue;
        }

        const amountToTake = Math.min(
          lote.cantidad,
          remainingToDeduct
        );

        /**
         * DESCONTAR DEL LOTE
         */
        lote.cantidad -= amountToTake;

        remainingToDeduct -= amountToTake;

        /**
         * REGISTRAR MOVIMIENTO
         */
        const movement = new Movement({
          productoId: productId,
          loteCodigo: lote.codigo,
          tipo: "SALIDA",
          cantidad: amountToTake,
          notas: "Descuento automático por venta aprobada"
        });

        await movement.save({
          session
        });
      }

      /**
       * RECALCULAR STOCK TOTAL
       */
      const totalActualizado =
        stockDoc.lotes.reduce(
          (acc, lote) => {
            return acc + (
              Number(lote.cantidad) || 0
            );
          },
          0
        );

      stockDoc.cantidadTotal =
        totalActualizado;

      stockDoc.markModified("lotes");

      await stockDoc.save({
        session
      });

      /**
       * SINCRONIZAR PRODUCT
       */
      await Product.findByIdAndUpdate(
        productId,
        {
          stock: totalActualizado
        },
        {
          session
        }
      );

      /**
       * RESPUESTA
       */
      results.push({
        productId,
        productName: name || "Producto",
        deducted: quantity,
        newTotal: totalActualizado
      });
    }

    return results;
  }
};