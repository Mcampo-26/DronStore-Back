import Role from "../../models/Role.js";
import appEvents from "../../utilities/eventEmitter.js";

// --- OBTENER ROLES ---
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({}).sort({ createdAt: -1 });
    return res.status(200).json(roles);
  } catch (error) {
    console.error("❌ GET_ROLES_ERROR:", error.message);
    return res.status(500).json({ message: "Error al obtener los roles tácticos" });
  }
};

// --- CREAR ROL (POST) ---
export const createRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;

    if (!name) return res.status(400).json({ message: "El nombre es obligatorio" });

    const newRole = await Role.create({
      name: name.toUpperCase(),
      permissions: permissions || {}
    });

    // ✅ EMISIÓN SSE (Única fuente de verdad)
    appEvents.emit('entity-updated', { type: 'ROLE_ADDED', payload: newRole });

    return res.status(201).json(newRole);
  } catch (error) {
    console.error("❌ CREATE_ROLE_ERROR:", error.message);
    if (error.code === 11000) return res.status(400).json({ message: "Este nivel de acceso ya existe" });
    return res.status(500).json({ message: "Error al configurar el nuevo rol" });
  }
};

// --- ACTUALIZAR ROL (PUT) ---
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

    // ✅ EMISIÓN SSE
    appEvents.emit('entity-updated', { type: 'ROLE_UPDATED', payload: updatedRole });

    return res.json(updatedRole);
  } catch (error) {
    console.error("❌ UPDATE_ROLE_ERROR:", error.message);
    return res.status(500).json({ error: "Error al actualizar los privilegios" });
  }
};

// --- ELIMINAR ROL (DELETE) ---
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Role.findByIdAndDelete(id);

    if (!deleted) return res.status(404).json({ error: "Rol no encontrado" });

    // ✅ EMISIÓN SSE
    appEvents.emit('entity-updated', { type: 'ROLE_DELETED', payload: id });

    return res.json({ message: "Rol eliminado del sistema" });
  } catch (error) {
    console.error("❌ DELETE_ROLE_ERROR:", error.message);
    return res.status(500).json({ error: "Error al eliminar el rol" });
  }
};