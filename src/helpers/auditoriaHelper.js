import Log from "../models/Log.js";
import appEvents from "../utilities/eventEmitter.js";

/**
 * Registra un evento en la base de datos de auditoría y lo emite vía SSE.
 * @param {Object} data - Datos del log (usuarioId, accion, detalles, req)
 */
export const registrarLog = async ({ usuarioId, accion, detalles, req }) => {
  try {
    if (!usuarioId) return null;

    // 1. Creación física en MongoDB
    const nuevoLog = await Log.create({
      usuario: usuarioId,
      accion,
      detalles,
      ip: req?.ip || "IP no detectada"
    });

    // 2. Poblado de datos del usuario para la UI del Hangar
    const logPopulado = await Log.findById(nuevoLog._id).populate('usuario', 'nombre email');

    // 3. Emisión de tiempo real
    if (appEvents) {
      appEvents.emit('entity-updated', { 
        type: 'LOG_CREATED', 
        payload: logPopulado 
      });
    }

    return logPopulado;
  } catch (error) {
    console.error("❌ Error en Helper de Auditoría:", error.message);
    return null;
  }
};