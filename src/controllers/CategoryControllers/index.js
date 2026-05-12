import Category from '../../models/Category.js';
import appEvents from "../../utilities/eventEmitter.js";
import { registrarLog } from "../../helpers/auditoriaHelper.js";
import User from "../../models/User.js"; 

// 1. Obtener todas las categorías
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ active: true }).sort({ name: 1 });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener categorías", error: error.message });
  }
};

// 2. Crear una nueva categoría
export const createCategory = async (req, res) => {
  try {
    // 🔍 Recibimos usuarioId del body como en Productos
    const { name, usuarioId } = req.body; 

    if (!name) return res.status(400).json({ message: "Falta el nombre de la categoría" });

    const exists = await Category.findOne({ name: name.trim() });
    if (exists) return res.status(400).json({ message: "La categoría ya existe" });

    const newCategory = new Category({ name: name.trim() });
    await newCategory.save();

    // 🚀 EMISIÓN SSE (Tiempo Real)
    appEvents.emit('entity-updated', { 
      type: 'CATEGORY_CREATED', 
      payload: newCategory 
    });

    // 📝 AUDITORÍA
    if (usuarioId) {
      await registrarLog({
        usuarioId,
        accion: 'CATEGORÍA NUEVA',
        detalles: `Alta de categoría: ${newCategory.name}`,
        req
      });
    }

    res.status(201).json(newCategory);
  } catch (error) {
    res.status(400).json({ message: "Error al crear categoría", error: error.message });
  }
};

// 3. Actualizar una categoría
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, usuarioId } = req.body;

    const updatedCategory = await Category.findByIdAndUpdate(
      id, 
      { name: name.trim() }, 
      { returnDocument: 'after', runValidators: true } // 'after' es clave para Mongoose 6+
    );

    if (!updatedCategory) return res.status(404).json({ message: "No encontrada" });

    // 🚀 EMISIÓN
    appEvents.emit('entity-updated', { 
      type: 'CATEGORY_UPDATED', 
      payload: updatedCategory 
    });

    // 📝 LOG (Esto ya te anda perfecto)
    if (usuarioId) {
      const operador = await User.findById(usuarioId);
      const nombreOperador = operador ? operador.nombre : "Un usuario";
      await registrarLog({
        usuarioId,
        accion: 'CATEGORÍA EDITADA',
        detalles: `${nombreOperador} actualizó la categoría a: ${updatedCategory.name}`,
        req
      });
    }

    res.status(200).json(updatedCategory);
  } catch (error) {
    res.status(400).json({ message: "Error", error: error.message });
  }
};

// 4. Eliminar una categoría
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { usuarioId } = req.query; // 🔍 Igual que en Productos: se recibe por query (?usuarioId=...)

    const deleted = await Category.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Categoría no encontrada" });

    // 🚀 EMISIÓN SSE
    appEvents.emit('entity-updated', { 
      type: 'CATEGORY_DELETED', 
      payload: { _id: id } 
    });

    // 📝 AUDITORÍA
    if (usuarioId) {
      await registrarLog({
        usuarioId,
        accion: 'CATEGORÍA ELIMINADA',
        detalles: `Baja de categoría: ${deleted.name}`,
        req
      });
    }

    res.status(200).json({ message: "Categoría eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar", error: error.message });
  }
};