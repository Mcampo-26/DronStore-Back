import User from '../../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Log from '../../models/Log.js';
import appEvents from "../../utilities/eventEmitter.js";

// LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscamos al usuario incluyendo el password oculto
    const usuario = await User.findOne({ email }).select('+password');

    if (!usuario) {
      return res.status(401).json({ success: false, message: "Credenciales inválidas" });
    }

    // Verificación de contraseña
    const isMatch = await bcrypt.compare(password, usuario.password);
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Credenciales inválidas" });
    }

    // Generación de Token y Sesión
    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      { id: usuario._id, nombre: usuario.nombre, sessionId }, 
      process.env.JWT_SECRET || 'secret_provisorio', 
      { expiresIn: "8h" }
    );

    // --- SISTEMA DE AUDITORÍA ---
    // 1. Grabamos el log en la base de datos
    const nuevoLog = await Log.create({
      usuario: usuario._id,
      accion: "AUTH_LOGIN",
      detalles: `Inicio de sesión exitoso. Terminal: ${sessionId.slice(0, 8)}`
    });

    // 2. Populamos con el usuario para que la Consola de Logs tenga el nombre/email
    const logPopulado = await Log.findById(nuevoLog._id).populate('usuario', 'nombre email');

    // 3. Emitimos el evento para actualización en tiempo real en el frontend
    appEvents.emit('entity-updated', { 
      type: 'LOG_CREATED', 
      payload: logPopulado 
    });

    // Limpieza de datos sensibles
    const usuarioFinal = usuario.toObject();
    delete usuarioFinal.password;

    res.json({ 
      success: true,
      token, 
      sessionId, 
      usuario: usuarioFinal 
    });

  } catch (error) {
    console.error("❌ Error en Login:", error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

// LOGOUT
// controllers/authController.js
export const logout = async (req, res) => {
  try {
    const { usuarioId } = req.body; // Enviamos el ID desde el frente si no usas protect

    if (usuarioId) {
      // 1. Creamos el registro en la DB
      const nuevoLog = await Log.create({
        usuario: usuarioId,
        accion: "AUTH_LOGOUT",
        detalles: "Sesión finalizada por el usuario.",
        ip: req.ip
      });

      // 2. Populamos para que el Hangar de Logs muestre el nombre real
      const logPopulado = await Log.findById(nuevoLog._id).populate('usuario', 'nombre email');
      
      // 3. Emitimos el evento para que la página se actualice SOLA (SSE)
      if (appEvents) {
        appEvents.emit('entity-updated', { 
          type: 'LOG_CREATED', 
          payload: logPopulado 
        });
      }
    }

    res.json({ success: true, message: "Log grabado y sesión cerrada" });
  } catch (error) {
    console.error("Error al grabar log de salida:", error);
    res.status(500).json({ success: false });
  }
};