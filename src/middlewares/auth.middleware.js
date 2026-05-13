import jwt from 'jsonwebtoken';
import Usuario from '../models/User.js';

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.headers['x-access-token'];

    if (!token) {
      return res.status(403).json({ message: "No se proporcionó un token de acceso." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;

    const user = await Usuario.findById(req.userId, { password: 0 }).populate('role');
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado." });
    }

    // Guardamos el usuario completo en la request para no volver a consultar la DB en el siguiente middleware
    req.user = user; 
    next(); 
  } catch (error) {
    return res.status(401).json({ message: "Token no válido o expirado.", error: error.message });
  }
};

export const isAdmin = async (req, res, next) => {
  try {
    const user = req.user; // Ya lo tenemos de verifyToken
    
    if (!user || !user.role) {
      return res.status(403).json({ message: "Requerido rol de administrador." });
    }

    const roleName = user.role.name || user.role;
    const normalizedRole = roleName.toString().toUpperCase();

    if (normalizedRole === 'ADMIN' || normalizedRole === 'SUPERADMIN') {
      next();
    } else {
      return res.status(403).json({ message: "Acceso denegado. Se requiere nivel administrativo." });
    }
  } catch (error) {
    return res.status(500).json({ message: "Error en validación de permisos." });
  }
};