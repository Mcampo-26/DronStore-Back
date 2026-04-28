import User from '../../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const io = req.app?.locals?.io; // Instancia de Socket.io si la usas

    // 1. Buscamos al usuario y traemos el password (que está oculto por defecto)
    // Quitamos el .populate('role') para evitar el MissingSchemaError
    const usuario = await User.findOne({ email }).select('+password');

    // 2. Si no existe el usuario
    if (!usuario) {
      console.log("Login fallido: Usuario no encontrado ->", email);
      return res.status(401).json({ 
        success: false, 
        message: "Credenciales inválidas" 
      });
    }

    // 3. Comparamos la contraseña enviada con la de la base de datos
    const isMatch = await bcrypt.compare(password, usuario.password);
    
    if (!isMatch) {
      console.log("Login fallido: Contraseña incorrecta para ->", email);
      return res.status(401).json({ 
        success: false, 
        message: "Credenciales inválidas" 
      });
    }

    // 4. Generamos un ID de sesión único y el Token JWT
    const sessionId = crypto.randomUUID();
    const token = jwt.sign(
      { 
        id: usuario._id, 
        nombre: usuario.nombre, 
        sessionId 
      }, 
      process.env.JWT_SECRET || 'secret_provisorio', 
      { expiresIn: "8h" }
    );

    // 5. Opcional: Emitir evento por Socket (si tienes el frontend escuchando)
    if (io) {
      io.to(`user:${usuario._id}`).emit("auth:login", {
        sessionId,
        at: new Date()
      });
    }

    // 6. Limpiamos el objeto usuario para no enviar el password al frontend
    const usuarioFinal = usuario.toObject();
    delete usuarioFinal.password;

    console.log("✅ Login exitoso:", usuario.email);

    // 7. Respuesta final
    res.json({ 
      success: true,
      token, 
      sessionId, 
      usuario: usuarioFinal 
    });

  } catch (error) {
    console.error("❌ Error crítico en Login:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor", 
      error: error.message 
    });
  }
};

// También te dejo el logout para que el archivo esté completo
export const logout = async (req, res) => {
  try {
    res.json({ success: true, message: "Sesión cerrada correctamente" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error al cerrar sesión" });
  }
};