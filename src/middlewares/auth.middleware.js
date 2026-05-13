import jwt from 'jsonwebtoken';
import Usuario from '../models/User.js';

/**
 * Middleware para verificar si el usuario envió un token válido
 */
export const verifyToken = async (req, res, next) => {
  try {
    // 1. Obtener el token del header 'Authorization' o 'x-access-token'
    const token = req.headers.authorization?.split(' ')[1] || req.headers['x-access-token'];

    if (!token) {
      return res.status(403).json({ message: "No se proporcionó un token de acceso." });
    }

    // 2. Verificar el token usando la clave secreta del .env
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Guardar el ID del usuario en la request
    req.userId = decoded.id;

    // 4. Verificar existencia del usuario
    const user = await Usuario.findById(req.userId, { password: 0 });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    next(); 
  } catch (error) {
    return res.status(401).json({ message: "Token no válido o expirado.", error: error.message });
  }
};

/**
 * Middleware para verificar si el usuario tiene rol de ADMIN o SUPERADMIN
 * Ajustado para nombres en MAYÚSCULAS y relación por ID
 */
export const isAdmin = async (req, res, next) => {
  try {
    // Buscamos al usuario y traemos los datos del rol asociado
    const user = await Usuario.findById(req.userId).populate('role');
    
    if (!user || !user.role) {
      return res.status(403).json({ message: "El usuario no tiene un rol asignado." });
    }

    // Extraemos el nombre del rol (manejando si es objeto o string)
    const roleName = user.role.name || user.role;

    // Convertimos a mayúsculas para que 'admin' y 'ADMIN' funcionen por igual
    const normalizedRole = roleName.toString().toUpperCase();

    if (normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN') {
      next();
    } else {
      return res.status(403).json({ 
        message: `Acceso denegado. Se requiere nivel administrativo. Tu rol actual: ${normalizedRole}` 
      });
    }
  } catch (error) {
    console.error("Error en isAdmin middleware:", error);
    return res.status(500).json({ message: "Error interno al verificar permisos de seguridad." });
  }
};