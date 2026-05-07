import Stock from "../../models/Stock.js";
import Product from "../../models/Product.js";
import Movement from "../../models/Movement.js";
/**
 * inventoryService
 * Biblioteca centralizada para la gestión de stock de QDRON Store.
 */
export const inventoryService = {
  
  /**
   * Descuenta stock de forma atómica y registra movimientos por lotes (FIFO).
   * @param {Array} items - Array de objetos { productId, quantity, name }
   * @param {Object} session - Sesión de MongoDB para transacciones (opcional)
   */
  async deductStock(items, session = null) {
    const results = [];

    for (const item of items) {
      const { productId, quantity, name } = item;

      // 1. Validación de ID de emergencia (Si el ID es el genérico del Plan B)
      if (productId === "600000000000000000000001") {
        console.warn(`⚠️ Saltando descuento: El producto "${name}" no tiene un ID válido de DB.`);
        continue;
      }

      // 2. Buscar el documento de Stock para este producto
      // Usamos .session(session) para que si falla la venta, el stock no se descuente
      const stockDoc = await Stock.findOne({ producto: productId }).session(session);

      if (!stockDoc) {
        throw new Error(`Inventario no encontrado para el producto: ${name || productId}`);
      }

      if (stockDoc.cantidadTotal < quantity) {
        throw new Error(`Stock insuficiente para ${name || 'el producto'}. Disponible: ${stockDoc.cantidadTotal}, Requerido: ${quantity}`);
      }

      // 3. Lógica FIFO (First In, First Out) por Lotes
      let remainingToDeduct = quantity;

      for (let lote of stockDoc.lotes) {
        if (remainingToDeduct <= 0) break;
        if (lote.cantidad <= 0) continue;

        const amountToTake = Math.min(lote.cantidad, remainingToDeduct);
        
        // Descontamos del lote
        lote.cantidad -= amountToTake;
        remainingToDeduct -= amountToTake;

        // 4. Registrar Movimiento de Salida para este lote específico
        const movement = new Movement({
          productoId: productId,
          loteCodigo: lote.codigo,
          tipo: 'SALIDA',
          cantidad: amountToTake,
          notas: `Deducción automática por venta confirmada via Webhook`
        });
        
        await movement.save({ session });
      }

      // 5. Actualizar el documento de Stock
      // Avisamos a Mongoose que el array de lotes cambió
      stockDoc.markModified('lotes');
      
      // Guardamos (El middleware pre-save del modelo Stock debería actualizar cantidadTotal)
      await stockDoc.save({ session });

      // 6. Sincronizar el stock en el modelo de Producto (Desnormalización para velocidad de lectura)
      // Buscamos el stock total actualizado después del save
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