import Role from "../../models/Role.js";
import User from "../../models/User.js"; // 👈 FUNDAMENTAL para saber quién es
import appEvents from "../../utilities/eventEmitter.js";
import { registrarLog } from "../../helpers/auditoriaHelper.js";

// --- OBTENER ROLES ---
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({}).sort({ createdAt: -1 });
    return res.status(200).json(roles);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener los roles tácticos" });
  }
};

// --- CREAR ROL (POST) ---
export const createRole = async (req, res) => {
  try {
    const { name, permissions, usuarioId } = req.body;

    if (!name) return res.status(400).json({ message: "El nombre es obligatorio" });

    const newRole = await Role.create({
      name: name.toUpperCase(),
      permissions: permissions || {}
    });

    // ✅ EMISIÓN SSE 
    appEvents.emit('entity-updated', { type: 'ROLE_ADDED', payload: newRole });

    // 📝 AUDITORÍA CON NOMBRE DE USUARIO
    if (usuarioId) {
      const operador = await User.findById(usuarioId);
      const nombreOperador = operador ? operador.nombre : "Un operador";

      await registrarLog({
        usuarioId,
        accion: 'NUEVO ROL CONFIGURADO',
        detalles: `${nombreOperador} creó el rol: ${newRole.name}`,
        req
      });
    }

    return res.status(201).json(newRole);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "Este nivel de acceso ya existe" });
    return res.status(500).json({ message: "Error al configurar el nuevo rol" });
  }
};

// --- ACTUALIZAR ROL (PUT) ---
export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissions, usuarioId } = req.body;

    const updateData = {};
    if (name) updateData.name = name.toUpperCase();
    if (permissions) updateData.permissions = permissions;

    const updatedRole = await Role.findByIdAndUpdate(
      id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedRole) return res.status(404).json({ error: "Rol no encontrado" });

    // ✅ EMISIÓN SSE
    appEvents.emit('entity-updated', { type: 'ROLE_UPDATED', payload: updatedRole });

    // 📝 AUDITORÍA CON NOMBRE DE USUARIO
    if (usuarioId) {
      const operador = await User.findById(usuarioId);
      const nombreOperador = operador ? operador.nombre : "Un operador";

      await registrarLog({
        usuarioId,
        accion: 'PRIVILEGIOS MODIFICADOS',
        detalles: `${nombreOperador} actualizó los permisos del rol: ${updatedRole.name}`,
        req
      });
    }

    return res.json(updatedRole);
  } catch (error) {
    return res.status(500).json({ error: "Error al actualizar los privilegios" });
  }
};

// --- ELIMINAR ROL (DELETE) ---
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { usuarioId } = req.query; // Se recibe por query en DELETE

    const deleted = await Role.findByIdAndDelete(id);

    if (!deleted) return res.status(404).json({ error: "Rol no encontrado" });

    // ✅ EMISIÓN SSE
    appEvents.emit('entity-updated', { type: 'ROLE_DELETED', payload: id });

    // 📝 AUDITORÍA CON NOMBRE DE USUARIO
    if (usuarioId) {
      const operador = await User.findById(usuarioId);
      const nombreOperador = operador ? operador.nombre : "Un operador";

      await registrarLog({
        usuarioId,
        accion: 'ROL ELIMINADO',
        detalles: `${nombreOperador} eliminó el acceso de nivel: ${deleted.name}`,
        req
      });
    }

    return res.json({ message: "Rol eliminado del sistema" });
  } catch (error) {
    return res.status(500).json({ error: "Error al eliminar el rol" });
  }
};