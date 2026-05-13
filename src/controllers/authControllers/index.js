import User from '../../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import Log from '../../models/Log.js';
import appEvents from "../../utilities/eventEmitter.js";

/**
 * LOGIN: Inicia sesión y devuelve los datos del usuario con su ROL populado.
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Buscamos al usuario incluyendo el password y POPULAMOS el rol
    // Esto es clave para que el frontend reciba "ADMIN" o "SUPERADMIN"
    const usuario = await User.findOne({ email })
      .select('+password')
      .populate('role'); 

    if (!usuario) {
      return res.status(401).json({ success: false, message: "Credenciales inválidas" });
    }

    // 2. Verificación de contraseña
    const isMatch = await bcrypt.compare(password, usuario.password);
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Credenciales inválidas" });
    }

    // 3. Generación de Token y Sesión
    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      { id: usuario._id, nombre: usuario.nombre, sessionId }, 
      process.env.JWT_SECRET || 'secret_provisorio', 
      { expiresIn: "8h" }
    );

    // --- SISTEMA DE AUDITORÍA ---
    // Grabamos el log en la base de datos
    const nuevoLog = await Log.create({
      usuario: usuario._id,
      accion: "AUTH_LOGIN",
      detalles: `Inicio de sesión exitoso. Terminal: ${sessionId.slice(0, 8)}`
    });

    // Populamos para la actualización en tiempo real
    const logPopulado = await Log.findById(nuevoLog._id).populate('usuario', 'nombre email');

    // Emitimos el evento para el Hangar de Logs (SSE)
    if (appEvents) {
      appEvents.emit('entity-updated', { 
        type: 'LOG_CREATED', 
        payload: logPopulado 
      });
    }

    // 4. Limpieza de datos sensibles antes de enviar al Frontend
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

/**
 * LOGOUT: Cierra la sesión y registra el evento de salida.
 */
export const logout = async (req, res) => {
  try {
    const { usuarioId } = req.body; 

    if (usuarioId) {
      // 1. Registramos la salida en los Logs
      const nuevoLog = await Log.create({
        usuario: usuarioId,
        accion: "AUTH_LOGOUT",
        detalles: "Sesión finalizada por el usuario.",
        ip: req.ip
      });

      // 2. Populamos para el registro visual
      const logPopulado = await Log.findById(nuevoLog._id).populate('usuario', 'nombre email');
      
      // 3. Notificamos al sistema en tiempo real
      if (appEvents) {
        appEvents.emit('entity-updated', { 
          type: 'LOG_CREATED', 
          payload: logPopulado 
        });
      }
    }

    res.json({ success: true, message: "Sesión cerrada correctamente." });
  } catch (error) {
    console.error("❌ Error al grabar log de salida:", error);
    res.status(500).json({ success: false });
  }
};