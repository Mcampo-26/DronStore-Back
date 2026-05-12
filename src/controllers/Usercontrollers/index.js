import Usuario from '../../models/User.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import appEvents from "../../utilities/eventEmitter.js";
import { registrarLog } from "../../helpers/auditoriaHelper.js"; // 📝 Importante

// ✅ CREAR usuario
export const createUsuario = async (req, res) => {
  try {
    const { nombre, email, password, telefono, role, usuarioId } = req.body; // 🔍 Recibimos usuarioId del operador

    const existe = await Usuario.findOne({ email });
    if (existe) return res.status(400).json({ message: 'El email ya existe' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const nuevoUsuario = new Usuario({
      nombre,
      email,
      telefono,
      password: hashedPassword,
      role: role || null,
      verificationCode
    });

    await nuevoUsuario.save();
    const usuarioPopulado = await Usuario.findById(nuevoUsuario._id).populate('role', 'name');

    // 🔥 EMISIÓN REAL-TIME
    appEvents.emit('entity-updated', { type: 'USER_ADDED', payload: usuarioPopulado });

    // 📝 REGISTRO EN AUDITORÍA
    if (usuarioId) {
      const operador = await Usuario.findById(usuarioId);
      const nombreOperador = operador ? operador.nombre : "Sistema";

      await registrarLog({
        usuarioId,
        accion: 'NUEVO USUARIO ALTA',
        detalles: `${nombreOperador} dio de alta al usuario: ${nombre} (${email})`,
        req
      });
    }

    res.status(201).json({ message: "Creado con éxito", usuario: usuarioPopulado });
  } catch (error) {
    res.status(500).json({ message: "Error al crear", error: error.message });
  }
};

// 📋 OBTENER usuarios
export const getUsuarios = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const usuarios = await Usuario.find()
      .populate('role', 'name')
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Usuario.countDocuments();
    res.json({ usuarios, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener usuarios" });
  }
};

// 🔄 ACTUALIZAR usuario
export const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { usuarioId, ...datosActualizados } = req.body; // 🔍 Extraemos el usuarioId del operador

    if (datosActualizados.password) {
      const salt = await bcrypt.genSalt(10);
      datosActualizados.password = await bcrypt.hash(datosActualizados.password, salt);
    }

    const usuarioActualizado = await Usuario.findByIdAndUpdate(
        id,
        { $set: datosActualizados },
        { returnDocument: 'after', runValidators: true }
      ).populate('role', 'name');

    if (!usuarioActualizado) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // 🔥 EMISIÓN REAL-TIME
    appEvents.emit('entity-updated', { type: 'USER_UPDATED', payload: usuarioActualizado });

    // 📝 REGISTRO EN AUDITORÍA
    if (usuarioId) {
      const operador = await Usuario.findById(usuarioId);
      const nombreOperador = operador ? operador.nombre : "Sistema";

      await registrarLog({
        usuarioId,
        accion: 'USUARIO MODIFICADO',
        detalles: `${nombreOperador} actualizó los datos de: ${usuarioActualizado.nombre}`,
        req
      });
    }

    res.json({ success: true, message: 'Usuario actualizado', usuario: usuarioActualizado });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
  }
};

// ❌ ELIMINAR usuario
export const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { usuarioId } = req.query; // 🔍 Recibimos por query

    const usuarioEliminado = await Usuario.findByIdAndDelete(id);

    if (!usuarioEliminado) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // 🔥 EMISIÓN REAL-TIME
    appEvents.emit('entity-updated', { type: 'USER_DELETED', payload: { _id: id } });

    // 📝 REGISTRO EN AUDITORÍA
    if (usuarioId) {
      const operador = await Usuario.findById(usuarioId);
      const nombreOperador = operador ? operador.nombre : "Sistema";

      await registrarLog({
        usuarioId,
        accion: 'USUARIO ELIMINADO',
        detalles: `${nombreOperador} eliminó la cuenta de: ${usuarioEliminado.nombre}`,
        req
      });
    }

    res.json({ success: true, message: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
  }
};