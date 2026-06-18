import Stock from "../../models/Stock.js";
import Movement from "../../models/Movement.js"; 
import Product from "../../models/Product.js";
import appEvents from "../../utilities/eventEmitter.js";

export const getStock = async (req, res) => {
  try {
    const query = {};
    if (req.query.almacenId) {
      query.almacen = req.query.almacenId;
    }

    const stocks = await Stock.find(query)
      .populate("producto", "name image price")
      .populate("almacen", "nombre direccion");
      
    res.json(stocks);
  } catch (error) {
    console.error("Error fetching stock:", error);
    res.status(500).json({ success: false, msg: "Error al obtener el inventario" });
  }
};

export const updateStock = async (req, res) => {
  try {
    const { id } = req.params; 
    const { batch, deviceId, almacenId } = req.body; 

    if (!almacenId) {
      return res.status(400).json({ success: false, msg: "El id del almacén es requerido" });
    }

    let stockDoc = await Stock.findOne({ producto: id, almacen: almacenId });
    
    if (!stockDoc) {
      stockDoc = new Stock({ producto: id, almacen: almacenId, lotes: [] });
    }

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

    stockDoc.markModified('lotes');
    await stockDoc.save();

    const newMovement = new Movement({
      productoId: id,
      almacenId: almacenId,
      loteCodigo: batch.code,
      tipo: 'ENTRADA', 
      cantidad: Number(batch.quantity),
      deviceId: deviceId,
      notas: "Ingreso manual desde panel de administración"
    });
    
    await newMovement.save();

    const todosLosStocks = await Stock.find({ producto: id });
    const nuevoGlobalTotal = todosLosStocks.reduce((acc, doc) => acc + (doc.cantidadTotal || 0), 0);

    await Product.findByIdAndUpdate(id, { stock: nuevoGlobalTotal });

    appEvents.emit('entity-updated', { 
      type: 'STOCK_UPDATED', 
      payload: { 
        productId: id, 
        newStock: nuevoGlobalTotal 
      } 
    });

    res.json({ 
      success: true, 
      msg: "Stock actualizado correctamente", 
      newTotal: stockDoc.cantidadTotal,
      newGlobalTotal: nuevoGlobalTotal
    });

  } catch (error) {
    console.error("Error en updateStock:", error);
    res.status(500).json({ success: false, msg: error.message });
  }
};

export const fetchHistory = async (req, res) => {
  try {
    const { productId } = req.params;
    const query = { productoId: productId };

    if (req.query.almacenId) {
      query.almacenId = req.query.almacenId;
    }
    
    const movements = await Movement.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    res.json(movements);
  } catch (error) {
    console.error("Error en fetchHistory:", error);
    res.status(500).json({ success: false, msg: "Error al obtener el historial" });
  }
};

export const deleteBatch = async (req, res) => {
  try {
    const { productId } = req.params;
    const { almacenId } = req.query;
    let batchCode = req.params.batchCode;
    
    if (req.params['0']) {
      batchCode += req.params['0'];
    }

    if (!almacenId) {
      return res.status(400).json({ success: false, msg: "El id del almacén es requerido en los parámetros de búsqueda" });
    }

    const stockDoc = await Stock.findOne({ producto: productId, almacen: almacenId });

    if (!stockDoc) {
      return res.status(404).json({ success: false, msg: "Producto no encontrado en el almacén indicado" });
    }

    stockDoc.lotes = stockDoc.lotes.filter(l => l.codigo !== batchCode);
    stockDoc.markModified('lotes');
    await stockDoc.save();

    const removalMovement = new Movement({
      productoId: productId,
      almacenId: almacenId,
      loteCodigo: batchCode,
      tipo: 'AJUSTE_NEGATIVO', 
      cantidad: 0,
      notas: `Lote ${batchCode} eliminado manualmente`
    });
    await removalMovement.save();

    const todosLosStocks = await Stock.find({ producto: productId });
    const nuevoGlobalTotal = todosLosStocks.reduce((acc, doc) => acc + (doc.cantidadTotal || 0), 0);

    await Product.findByIdAndUpdate(productId, { stock: nuevoGlobalTotal });

    appEvents.emit('entity-updated', { 
      type: 'STOCK_UPDATED', 
      payload: { 
        productId, 
        newStock: nuevoGlobalTotal 
      } 
    });

    return res.json({ 
      success: true, 
      msg: "Lote eliminado con éxito",
      newTotal: stockDoc.cantidadTotal,
      newGlobalTotal: nuevoGlobalTotal
    });

  } catch (error) {
    console.error("Error en deleteBatch:", error);
    return res.status(500).json({ success: false, msg: error.message });
  }
};