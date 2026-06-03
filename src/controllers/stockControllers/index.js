import Stock from "../../models/Stock.js";
import Movement from "../../models/Movement.js"; 
import Product from "../../models/Product.js";
import appEvents from "../../utilities/eventEmitter.js";

/**
 * GET /stock
 * Obtiene el inventario completo con datos del producto.
 */
export const getStock = async (req, res) => {
  try {
    const stocks = await Stock.find().populate("producto", "name image price");
    res.json(stocks);
  } catch (error) {
    console.error("Error fetching stock:", error);
    res.status(500).json({ success: false, msg: "Error al obtener el inventario" });
  }
};

/**
 * PUT /stock/:id
 * Registra un nuevo lote o incrementa uno existente y genera un movimiento.
 */
export const updateStock = async (req, res) => {
  try {
    const { id } = req.params; 
    const { batch, deviceId } = req.body; 

    // 1. Buscar o crear el documento de Stock
    let stockDoc = await Stock.findOne({ producto: id });
    
    if (!stockDoc) {
      stockDoc = new Stock({ producto: id, lotes: [] });
    }

    // 2. Manejo de lotes
    const loteExistente = stockDoc.lotes.find(l => l.codigo === batch.code);

    if (loteExistente) {
      loteExistente.cantidad += Number(batch.quantity);
      loteExistente.fechaVencimiento = batch.expiryDate; 
    } else {
      stockDoc.lotes.push({
        codigo: batch.code,
        cantidad: Number(batch.quantity),
        fechaVencimiento: batch.expiryDate,
        costoUnitario: batch.unitCost || 0
      });
    }

    // 3. Persistencia de datos
    // Marcamos 'lotes' como modificado para asegurar que Mongoose detecte cambios profundos
    stockDoc.markModified('lotes');
    await stockDoc.save();

    const newMovement = new Movement({
      productoId: id,
      loteCodigo: batch.code,
      tipo: 'ENTRADA', 
      cantidad: Number(batch.quantity),
      deviceId: deviceId,
      notas: "Ingreso manual desde panel de administración"
    });
    
    await newMovement.save();

    // 4. Sincronización con el modelo de Producto (Stock total)
    // Usamos el stockDoc.cantidadTotal que se actualizó en el pre('save') del modelo
    await Product.findByIdAndUpdate(id, { stock: stockDoc.cantidadTotal });

    // 5. ⚡️ EMISIÓN EN TIEMPO REAL
    appEvents.emit('entity-updated', { 
      type: 'STOCK_UPDATED', 
      payload: { 
        productId: id, 
        newStock: stockDoc.cantidadTotal 
      } 
    });

    res.json({ 
      success: true, 
      msg: "Stock actualizado correctamente", 
      newTotal: stockDoc.cantidadTotal 
    });

  } catch (error) {
    console.error("Error en updateStock:", error);
    res.status(500).json({ success: false, msg: error.message });
  }
};

/**
 * GET /stock/history/:productId
 * Obtiene los últimos 50 movimientos de un producto específico.
 */
export const fetchHistory = async (req, res) => {
  try {
    const { productId } = req.params;
    
    const movements = await Movement.find({ productoId: productId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(movements);
  } catch (error) {
    console.error("Error en fetchHistory:", error);
    res.status(500).json({ success: false, msg: "Error al obtener el historial" });
  }
};

/**
 * DELETE /stock/:productId/batch/:batchCode
 * Elimina un lote específico y actualiza el stock total del producto.
 */
export const deleteBatch = async (req, res) => {
  try {
    // 🚀 Recorremos los parámetros. Si venía con barras extras, req.params['0'] junta el resto
    const { productId } = req.params;
    let batchCode = req.params.batchCode;
    
    if (req.params['0']) {
      batchCode += req.params['0'];
    }

    // Buscamos el documento para aplicar la lógica de guardado de Mongoose
    const stockDoc = await Stock.findOne({ producto: productId });

    if (!stockDoc) {
      return res.status(404).json({ success: false, msg: "Producto no encontrado en inventario" });
    }

    // Filtramos los lotes para eliminar el indicado
    stockDoc.lotes = stockDoc.lotes.filter(l => l.codigo !== batchCode);
    
    // Al modificar el array directamente, forzamos la marca de modificado
    stockDoc.markModified('lotes');
    
    // Al ejecutar .save(), se dispara el pre-save que recalcula cantidadTotal
    await stockDoc.save();

    // Registrar movimiento de ajuste (opcional pero recomendado para auditoría)
    const removalMovement = new Movement({
      productoId: productId,
      loteCodigo: batchCode,
      tipo: 'AJUSTE_NEGATIVO', 
      cantidad: 0,
      notas: `Lote ${batchCode} eliminado manualmente`
    });
    await removalMovement.save();

    // Sincronizar el total tras la eliminación del lote con el modelo Producto
    await Product.findByIdAndUpdate(productId, { stock: stockDoc.cantidadTotal });

    // ⚡️ EMISIÓN EN TIEMPO REAL ORIGINAL
    appEvents.emit('entity-updated', { 
      type: 'STOCK_UPDATED', 
      payload: { 
        productId, 
        newStock: stockDoc.cantidadTotal 
      } 
    });

    return res.json({ 
      success: true, 
      msg: "Lote eliminado con éxito",
      newTotal: stockDoc.cantidadTotal 
    });

  } catch (error) {
    console.error("Error en deleteBatch:", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};