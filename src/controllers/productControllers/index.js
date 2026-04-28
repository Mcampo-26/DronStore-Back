import Product from "../../models/Product.js"
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
    const body = req.body;
    const { name, price, image } = body;

    if (!name || !price || !image) {
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    const newProduct = await Product.create({
      ...body,
      price: Number(price),
      stock: Number(body.stock || 0)
    });

    // En lugar de revalidateTag, usamos Sockets para avisar al Front
    req.app.locals.io.emit('product:added', newProduct);

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

    // Avisamos a todos los clientes que este producto cambió
    req.app.locals.io.emit('product:updated', updatedProduct);

    return res.json(updatedProduct);
  } catch (error) {
    return res.status(500).json({ error: "Error al actualizar" });
  }
};

// 5. ELIMINAR PRODUCTO (DELETE)
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);

    if (!deleted) return res.status(404).json({ error: "No encontrado" });

    // Avisamos por Socket que se borró
    req.app.locals.io.emit('product:deleted', id);

    return res.json({ message: "Producto eliminado" });
  } catch (error) {
    return res.status(500).json({ error: "Error al eliminar" });
  }
};