import Role from "../../models/Role.js";
import appEvents from "../../utilities/eventEmitter.js"; // <--- IMPORTANTE

// 1. OBTENER TODOS LOS ROLES (Sin cambios)
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({}).sort({ createdAt: -1 });
    return res.status(200).json(roles);
  } catch (error) {
    console.error("GET_ROLES_ERROR:", error);
    return res.status(500).json({ message: "Error al obtener los roles tácticos" });
  }
};

// 3. CREAR ROL (POST)
export const createRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;

    if (!name) return res.status(400).json({ message: "El nombre del rol es obligatorio" });

    const newRole = await Role.create({
      name: name.toUpperCase(),
      permissions: permissions || {}
    });

    // 🔥 EMISIÓN SSE (La nueva antena)
    appEvents.emit('entity-updated', { type: 'ROLE_ADDED', payload: newRole });

    // 🌐 Mantenemos Sockets por compatibilidad
    req.app.locals.io.emit('role:added', newRole);

    return res.status(201).json(newRole);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ message: "Este nivel de acceso ya existe" });
    return res.status(500).json({ message: "Error al configurar el nuevo rol" });
  }
};

// 4. ACTUALIZAR ROL (PUT)
export const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    if (body.name) body.name = body.name.toUpperCase();

    const updatedRole = await Role.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!updatedRole) return res.status(404).json({ error: "Rol no encontrado" });

    // 🔥 EMISIÓN SSE
    appEvents.emit('entity-updated', { type: 'ROLE_UPDATED', payload: updatedRole });

    // 🌐 Sockets
    req.app.locals.io.emit('role:updated', updatedRole);

    return res.json(updatedRole);
  } catch (error) {
    return res.status(500).json({ error: "Error al actualizar los privilegios" });
  }
};

// 5. ELIMINAR ROL (DELETE)
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Role.findByIdAndDelete(id);

    if (!deleted) return res.status(404).json({ error: "Rol no encontrado" });

    // 🔥 EMISIÓN SSE (Pasamos el ID para que el Front lo filtre)
    appEvents.emit('entity-updated', { type: 'ROLE_DELETED', payload: id });

    // 🌐 Sockets
    req.app.locals.io.emit('role:deleted', id);

    return res.json({ message: "Rol eliminado del sistema de seguridad" });
  } catch (error) {
    return res.status(500).json({ error: "Error al eliminar el rol" });
  }
};