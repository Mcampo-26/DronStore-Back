import Role from "../../models/Role.js";
import appEvents from "../../utilities/eventEmitter.js";

// 1. OBTENER TODOS LOS ROLES
export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({}).sort({ createdAt: -1 });
    return res.status(200).json(roles);
  } catch (error) {
    console.error("GET_ROLES_ERROR:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error al obtener los roles tácticos" 
    });
  }
};

// 2. CREAR ROL (POST)
export const createRole = async (req, res) => {
  try {
    const { name, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ message: "El nombre del rol es obligatorio" });
    }

    const newRole = await Role.create({
      name: name.toUpperCase(),
      permissions: permissions || {}
    });

    // 🔥 EMISIÓN SSE (Única fuente de verdad para tiempo real)
    appEvents.emit('entity-updated', { type: 'ROLE_ADDED', payload: newRole });

    return res.status(201).json(newRole);
  } catch (error) {
    console.error("CREATE_ROLE_ERROR:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Este nivel de acceso ya existe" });
    }
    return res.status(500).json({ message: "Error al configurar el nuevo rol" });
  }
};

// 3. ACTUALIZAR ROL (PUT)
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

    if (!updatedRole) {
      return res.status(404).json({ error: "Rol no encontrado" });
    }

    // 🔥 EMISIÓN SSE
    appEvents.emit('entity-updated', { type: 'ROLE_UPDATED', payload: updatedRole });

    return res.json(updatedRole);
  } catch (error) {
    console.error("UPDATE_ROLE_ERROR:", error);
    return res.status(500).json({ error: "Error al actualizar los privilegios" });
  }
};

// 4. ELIMINAR ROL (DELETE)
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificamos si el ID es válido antes de proceder
    const deleted = await Role.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ error: "Rol no encontrado" });
    }

    // 🔥 EMISIÓN SSE (Enviamos el ID para que el Front lo filtre de la lista)
    appEvents.emit('entity-updated', { type: 'ROLE_DELETED', payload: id });

    return res.json({ 
      success: true, 
      message: "Rol eliminado del sistema de seguridad" 
    });
  } catch (error) {
    console.error("DELETE_ROLE_ERROR:", error);
    return res.status(500).json({ 
      success: false, 
      error: "Error al eliminar el rol" 
    });
  }
};