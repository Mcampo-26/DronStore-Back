import Product from "../../models/Product.js";
import appEvents from "../../utilities/eventEmitter.js"; // Importación corregida

// 1. OBTENER PRODUCTOS
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    return res.status(200).json(products);
  } catch (error) {
    console.error("GET_PRODUCTS_ERROR:", error);
    return res.status(500).json({ message: "Error al obtener los productos" });
  }
};

// 2. OBTENER UN PRODUCTO POR ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: "No encontrado" });
    return res.json(product);
  } catch (error) {
    return res.status(500).json({ error: "Error al obtener" });
  }
};

// 3. CREAR PRODUCTO (POST)
export const createProduct = async (req, res) => {
  try {
    const { name, price, image } = req.body;

    if (!name || !price || !image) {
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    // 🛡️ OPCIONAL: Evitar duplicados exactos en un tiempo corto
    const existing = await Product.findOne({ name: name.trim() });
    if (existing) {
      // Si el producto ya existe, podrías decidir no crearlo o retornar un error
      return res.status(409).json({ message: "Este producto ya existe" });
    }

    const newProduct = await Product.create({
      ...req.body,
      name: name.trim(),
      price: Number(price),
      stock: Number(req.body.stock || 0)
    });

    // Solo emitimos si la creación fue exitosa
    appEvents.emit('entity-updated', { 
      type: 'PRODUCT_CREATED', 
      payload: newProduct 
    });

    return res.status(201).json(newProduct);
  } catch (error) {
    console.error("POST_PRODUCT_ERROR:", error);
    return res.status(500).json({ message: "Error al crear" });
  }
};

// 4. ACTUALIZAR PRODUCTO (PUT)
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) return res.status(404).json({ error: "No encontrado" });

    // ⚡️ TIEMPO REAL: Notificamos que el producto cambió
    appEvents.emit('entity-updated', { 
      type: 'PRODUCT_UPDATED', 
      payload: updatedProduct 
    });

    return res.json(updatedProduct);
  } catch (error) {
    console.error("PUT_PRODUCT_ERROR:", error);
    return res.status(500).json({ error: "Error al actualizar" });
  }
};

// 5. ELIMINAR PRODUCTO (DELETE)
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);

    if (!deleted) return res.status(404).json({ error: "No encontrado" });

    // ⚡️ TIEMPO REAL: Notificamos que se eliminó el producto
    appEvents.emit('entity-updated', { 
      type: 'PRODUCT_DELETED', 
      payload: { id } 
    });

    return res.json({ message: "Producto eliminado" });
  } catch (error) {
    console.error("DELETE_PRODUCT_ERROR:", error);
    return res.status(500).json({ error: "Error al eliminar" });
  }
};