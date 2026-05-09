import Product from "../../models/Product.js";
import { registrarLog } from "../../helpers/auditoriaHelper.js"; // ✅ Tu nuevo Helper centralizado
import appEvents from "../../utilities/eventEmitter.js";
import User from "../../models/User.js"; // 🚀 AGREGA ESTA LÍNEA
// 1. OBTENER TODOS LOS PRODUCTOS
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find({}).sort({ creadoEl: -1 });
    return res.status(200).json(products);
  } catch (error) {
    console.error("GET_PRODUCTS_ERROR:", error);
    return res.status(500).json({ message: "Error al obtener los productos" });
  }
};

// 2. OBTENER UN PRODUCTO POR ID
export const createProduct = async (req, res) => {
  try {
    // 1. SEPARAMOS el usuarioId de la info del producto
    const { usuarioId, ...productInfo } = req.body;
    const { name, price, image } = productInfo;

    if (!name || !price || !image) {
      return res.status(400).json({ message: "Faltan protocolos obligatorios" });
    }

    const existing = await Product.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ message: "Este equipo ya existe" });
    }

    // 2. CREAMOS el producto solo con la info técnica (productInfo)
    const newProduct = await Product.create({
      ...productInfo,
      name: name.trim(),
      price: Number(price),
      stock: Number(productInfo.stock || 0)
    });

    // 3. AUDITORÍA (Si no hay usuarioId, el helper simplemente no graba el log)
    if (usuarioId) {
      await registrarLog({
        usuarioId,
        accion: "PRODUCT_CREATED",
        detalles: `Alta de equipo: ${newProduct.name}`,
        req
      });
    }

    // 4. TIEMPO REAL
    appEvents.emit('entity-updated', { 
      type: 'PRODUCTS_CHANGED', 
      payload: newProduct 
    });

    return res.status(201).json(newProduct);
  } catch (error) {
    console.error("POST_PRODUCT_ERROR:", error);
    return res.status(500).json({ message: "Error al crear producto" });
  }
};
// 4. ACTUALIZAR PRODUCTO (PUT)
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 🔍 Capturamos TODO lo que manda el Zustand
    const { 
      usuarioId, 
      nombreOriginal, // El nombre que tenía antes de editar
      logDetalle,     // El string "(modificó: el precio, etc)"
      ...body         // El resto de los datos técnicos del dron
    } = req.body; 

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: body },
      { returnDocument: 'after', runValidators: true } 
    );

    if (!updatedProduct) return res.status(404).json({ error: "Equipo no encontrado" });

    if (usuarioId) {
      const operador = await User.findById(usuarioId);
      const nombreOperador = operador ? operador.nombre : "Un usuario";

      // 🚀 CONSTRUCCIÓN DE LA FRASE FINAL
      // Usamos nombreOriginal si viene del front, sino usamos el del producto actualizado
      const productoIdentificado = nombreOriginal || updatedProduct.name;
      const fraseFinal = `${nombreOperador} editó el producto ${productoIdentificado}${logDetalle || ""}`;

      await registrarLog({
        usuarioId,
        accion: "PRODUCT_UPDATED",
        detalles: fraseFinal,
        req
      });
    }

    appEvents.emit('entity-updated', { type: 'PRODUCTS_CHANGED', payload: updatedProduct });

    return res.json(updatedProduct);
  } catch (error) {
    console.error("PUT_PRODUCT_ERROR:", error);
    return res.status(500).json({ error: "Error en protocolo de edición" });
  }
};
// 5. ELIMINAR PRODUCTO (DELETE)
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { usuarioId } = req.query; // Se recibe por query: ?usuarioId=...

    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Equipo no encontrado" });

    // ✅ AUDITORÍA CENTRALIZADA
    await registrarLog({
      usuarioId,
      accion: "PRODUCT_DELETED",
      detalles: `Baja de equipo: ${deleted.name}`,
      req
    });

    // ✅ SINCRONIZACIÓN EN TIEMPO REAL
    appEvents.emit('entity-updated', { type: 'PRODUCTS_CHANGED', payload: { id } });

    return res.json({ message: "Equipo desvinculado exitosamente" });
  } catch (error) {
    console.error("DELETE_PRODUCT_ERROR:", error);
    return res.status(500).json({ error: "Error en protocolo de eliminación" });
  }
};

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