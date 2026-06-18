import Stock from "../../models/Stock.js";
import Product from "../../models/Product.js";
import Movement from "../../models/Movement.js";

export const stockService = {

  async getStockStatsForDash(limit = 0) {
    try {
      const pipeline = [
        {
          $project: {
            _id: 1,
            name: 1,
            stock: { $ifNull: ["$stock", 0] },
            isCritical: {
              $lt: [ { $ifNull: ["$stock", 0] }, 5 ]
            }
          }
        },
        { $sort: { stock: 1 } }
      ];

      // 🚀 Si pasamos un límite mayor a 0 (ej: desde otra vista), lo aplica. 
      // Si viene en 0, no corta la lista y te trae todos tus productos para el gráfico.
      if (limit > 0) {
        pipeline.push({ $limit: limit });
      }

      const inventory = await Product.aggregate(pipeline);
      return inventory;
    } catch (error) {
      console.error("❌ Error en getStockStatsForDash:", error);
      return [];
    }
  },

  async deductStock(items, almacenId = null, session = null) {
    if (!Array.isArray(items)) {
      throw new Error("El parámetro items debe ser un array.");
    }

    const results = [];

    for (const item of items) {
      const { productId, quantity, name } = item;

      if (!productId) {
        throw new Error(`Producto inválido: ${name || "Sin nombre"}`);
      }

      if (typeof quantity !== "number" || quantity <= 0) {
        throw new Error(`Cantidad inválida para ${name || productId}`);
      }

      if (productId === "600000000000000000000001") {
        console.warn(`⚠️ Producto omitido: "${name}" posee ID placeholder.`);
        continue;
      }

      const query = { producto: productId };
      if (almacenId) {
        query.almacen = almacenId;
      }

      const stockDoc = await Stock.findOne(query).session(session);

      if (!stockDoc) {
        throw new Error(`Inventario no encontrado para: ${name || productId}`);
      }

      const stockDisponible = stockDoc.cantidadTotal || 0;

      if (stockDisponible < quantity) {
        throw new Error(`Stock insuficiente para ${name || productId}. Disponible: ${stockDisponible}`);
      }

      let remainingToDeduct = quantity;

      for (const lote of stockDoc.lotes) {
        if (remainingToDeduct <= 0) break;
        if (!lote.cantidad || lote.cantidad <= 0) continue;

        const amountToTake = Math.min(lote.cantidad, remainingToDeduct);

        lote.cantidad -= amountToTake;
        remainingToDeduct -= amountToTake;

        const movement = new Movement({
          productoId: productId,
          almacenId: almacenId || stockDoc.almacen || null,
          loteCodigo: lote.codigo,
          tipo: "SALIDA",
          cantidad: amountToTake,
          notas: "Descuento automático por venta aprobada"
        });

        await movement.save({ session });
      }

      const totalActualizado = stockDoc.lotes.reduce((acc, lote) => acc + (Number(lote.cantidad) || 0), 0);
      stockDoc.cantidadTotal = totalActualizado;
      stockDoc.markModified("lotes");
      await stockDoc.save({ session });

      const todosLosStocks = await Stock.find({ producto: productId }).session(session);
      const nuevoGlobalTotal = todosLosStocks.reduce((acc, doc) => acc + (doc.cantidadTotal || 0), 0);

      await Product.findByIdAndUpdate(
        productId,
        { stock: nuevoGlobalTotal },
        { session }
      );

      results.push({
        productId,
        productName: name || "Producto",
        deducted: quantity,
        newWarehouseTotal: totalActualizado,
        newGlobalTotal: nuevoGlobalTotal
      });
    }

    return results;
  }
};