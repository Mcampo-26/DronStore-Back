// src/services/stock.service.js
import mongoose from 'mongoose';
import Stock from '../models/Stock.js';
import Movimiento from '../models/Movimiento.js';
import appEvents from '../utilities/eventEmitter.js';

export const procesarVentaStock = async ({ productoId, cantidad, deviceId, refId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const stockDoc = await Stock.findOne({ producto: productoId }).session(session);
    if (!stockDoc || stockDoc.cantidadTotal < cantidad) throw new Error("Stock insuficiente");

    let restante = cantidad;
    let lotesAfectados = [];

    // Lógica FIFO: Descontar de los lotes más antiguos primero
    for (let lote of stockDoc.lotes) {
      if (restante <= 0) break;
      
      if (lote.cantidad > 0) {
        const aDescontar = Math.min(lote.cantidad, restante);
        lote.cantidad -= aDescontar;
        restante -= aDescontar;
        
        lotesAfectados.push({
          codigo: lote.codigo,
          cantidad: aDescontar
        });
      }
    }

    // Guardar cambios en Stock (el middleware actualizará cantidadTotal)
    await stockDoc.save({ session });

    // Crear registros de movimiento para cada lote afectado
    for (let af of lotesAfectados) {
      await Movimiento.create([{
        productoId,
        loteCodigo: af.codigo,
        tipo: 'SALIDA',
        cantidad: -af.cantidad,
        deviceId,
        referenciaOperacion: refId,
        notas: "Venta procesada vía Webhook"
      }], { session });
    }

    await session.commitTransaction();

    // 🔥 EMISIÓN SSE: Avisamos a todos del nuevo stock, pero mandamos el deviceId
    appEvents.emit('entity-updated', {
      type: 'STOCK_SYNC',
      payload: {
        productoId,
        nuevoStock: stockDoc.cantidadTotal,
        originatorId: deviceId // Para que el front sepa si fue él quien compró
      }
    });

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};