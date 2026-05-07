// helpers/stock.js
import Stock from "../models/Stock.js";
import Product from "../models/Product.js";
import Movement from "../models/Movement.js";

/**
 * Esta función descuenta stock lote por lote (FIFO: el primero que vence o entra es el primero que sale)
 */
export const descontarStockPorItems = async (items = [], session) => {
  const patches = [];

  for (const item of items) {
    const { productId, quantity } = item;

    // 1. Buscar el documento de stock de ese producto
    const stockDoc = await Stock.findOne({ producto: productId }).session(session);

    if (!stockDoc || stockDoc.cantidadTotal < quantity) {
      throw new Error(`Stock insuficiente para el producto: ${item.name}`);
    }

    // 2. Lógica de descuento por lotes (recorremos los lotes y restamos)
    let pendientePorRestar = quantity;

    for (let lote of stockDoc.lotes) {
      if (pendientePorRestar <= 0) break;

      if (lote.cantidad > 0) {
        const aRestar = Math.min(lote.cantidad, pendientePorRestar);
        lote.cantidad -= aRestar;
        pendientePorRestar -= aRestar;

        // Registrar el movimiento de SALIDA para este lote
        const movimiento = new Movement({
          productoId: productId,
          loteCodigo: lote.codigo,
          tipo: 'SALIDA',
          cantidad: aRestar,
          notas: "Venta automática"
        });
        await movimiento.save({ session });
      }
    }

    // 3. Guardar el documento de Stock actualizado
    await stockDoc.save({ session });

    // 4. Sincronizar el total en el modelo de Producto
    await Product.findByIdAndUpdate(
      productId, 
      { stock: stockDoc.cantidadTotal },
      { session }
    );

    // Guardamos la info para el socket
    patches.push({
      productId: productId,
      newStock: stockDoc.cantidadTotal
    });
  }

  return patches;
};