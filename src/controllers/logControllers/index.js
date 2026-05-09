import Log from '../../models/Log.js';

/**
 * GET: Obtiene los últimos 50 registros de auditoría
 * Se usa para alimentar la AuditPage
 */
export const getLogs = async (req, res) => {
  try {
    const logs = await Log.find()
      .sort({ createdAt: -1 }) // Los más nuevos primero
      .limit(50)
      .populate('usuario', 'nombre email'); // Traemos datos del operador
    
    res.json(logs);
  } catch (error) {
    console.error("Error al obtener logs:", error);
    res.status(500).json({ msg: "Error al obtener registros de auditoría" });
  }
};

/**
 * POST: Registra una nueva acción técnica desde el cliente
 */
export const postLog = async (req, res) => {
  try {
    const { userId, accion, detalles } = req.body;

    if (!userId || !accion || !detalles) {
      return res.status(400).json({ msg: "Datos de auditoría incompletos" });
    }

    const newLog = new Log({
      usuario: userId,
      accion: accion.toUpperCase(),
      detalles
    });

    await newLog.save();
    
    // Devolvemos el log populado para que Zustand lo agregue a la lista
    const populatedLog = await Log.findById(newLog._id).populate('usuario', 'nombre email');

    res.status(201).json({
      success: true,
      log: populatedLog
    });
  } catch (error) {
    res.status(500).json({ msg: "Error al registrar la actividad" });
  }
};

/**
 * Función interna para usar directamente en otros controladores del servidor
 * (Ej: registrar un login exitoso o una venta)
 */
export const createInternalLog = async (userId, accion, detalles) => {
  try {
    const log = new Log({ usuario: userId, accion: accion.toUpperCase(), detalles });
    await log.save();
  } catch (error) {
    console.error("Error en log interno:", error);
  }
};