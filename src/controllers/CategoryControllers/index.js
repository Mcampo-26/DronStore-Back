import Category from '../../models/Category.js';

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
    const { name } = req.body;
    
    // Verificar si ya existe
    const exists = await Category.findOne({ name });
    if (exists) return res.status(400).json({ message: "La categoría ya existe" });

    const newCategory = new Category({ name });
    await newCategory.save();
    
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(400).json({ message: "Error al crear categoría", error: error.message });
  }
};

// 3. Actualizar una categoría
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const updatedCategory = await Category.findByIdAndUpdate(
      id, 
      { name }, 
      { new: true, runValidators: true }
    );

    if (!updatedCategory) return res.status(404).json({ message: "Categoría no encontrada" });

    res.status(200).json(updatedCategory);
  } catch (error) {
    res.status(400).json({ message: "Error al actualizar", error: error.message });
  }
};

// 4. Eliminar una categoría (o desactivarla)
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Opción A: Eliminación física
    const deleted = await Category.findByIdAndDelete(id);
    
    // Nota: Aquí podrías verificar si hay productos usando esta categoría 
    // antes de borrar para evitar errores de referencia.

    if (!deleted) return res.status(404).json({ message: "Categoría no encontrada" });

    res.status(200).json({ message: "Categoría eliminada correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar", error: error.message });
  }
};