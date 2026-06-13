import mongoose from "mongoose";
import Product from "../../models/Product.js";
import User from "../../models/User.js";
import { registrarLog } from "../../helpers/auditoriaHelper.js";
import appEvents from "../../utilities/eventEmitter.js";
import { generarProductEmbedding } from "../../helpers/geminiHelper.js";

/**
 * 📂 1. OBTENER PRODUCTOS EXCLUSIVOS DEL USUARIO LOGUEADO (PAGINADOS)
 */
export const getMyProducts = async (req, res) => {
  try {
    // Desactivamos la cache HTTP para evitar lecturas fantasmas de inventario
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Extraemos el ID del usuario directamente del token de autenticación
    const usuarioLogueadoId = req.user?._id; 
    if (!usuarioLogueadoId) {
      return res.status(401).json({ message: "No autorizado. Token inválido o inexistente." });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    // Construimos la query base obligatoria filtrando por el DUEÑO del producto
    let query = { usuarioId: usuarioLogueadoId };

    // Si el usuario escribe en el buscador, agregamos las condiciones sin romper el filtro de dueño
    if (search.trim()) {
      const isObjectId = mongoose.Types.ObjectId.isValid(search);
      query.$and = [
        { usuarioId: usuarioLogueadoId },
        {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            ...(isObjectId ? [{ _id: search }] : [])
          ]
        }
      ];
    }

    // Ejecutamos la paginación, el conteo total y los agotados EN PARALELO restringidos a su usuarioId
    const [products, totalItems, totalAgotados] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1, _id: -1 }) // Desempate de índice estricto
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(query),
      Product.countDocuments({ ...query, stock: { $lte: 0 } })
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return res.status(200).json({
      success: true,
      products,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        itemsPerPage: limit,
        totalAgotados // Estadísticas reales solo de sus productos
      }
    });
  } catch (error) {
    console.error("GET_MY_PRODUCTS_ERROR:", error);
    return res.status(500).json({ message: "Error al obtener tu inventario de productos" });
  }
};

/**
 * ➕ 2. CREAR UN PRODUCTO VINCULADO AL USUARIO LOGUEADO
 */
export const createMyProduct = async (req, res) => {
  try {
    const usuarioLogueadoId = req.user?._id;
    if (!usuarioLogueadoId) {
      return res.status(401).json({ message: "No autorizado." });
    }

    console.log("📦 [Backend Privado] Body Crudo Recibido:", req.body);

    const { name, price, description, image, ...rest } = req.body;

    // Control antivacios: saneamos los strings obligatorios
    const finalName = name && name.trim() !== "" ? name.trim() : null;
    const finalDescription = description && description.trim() !== "" ? description.trim() : "Sin descripción técnica proporcionada.";
    const finalImage = image && image.trim() !== "" ? image.trim() : null;

    if (!finalName || !price || !finalImage) {
      return res.status(400).json({ 
        message: "Faltan especificaciones obligatorias. El nombre, precio e imagen principal no pueden estar vacíos." 
      });
    }

    // Validamos duplicados locales de ese usuario para no colisionar el hangar
    const existing = await Product.findOne({ name: finalName, usuarioId: usuarioLogueadoId });
    if (existing) {
      return res.status(409).json({ message: "Ya tenés registrado un equipo con este nombre exacto" });
    }

    // Generación de embedding semántico asistido por IA
    const embedding = await generarProductEmbedding(finalName, finalDescription);

    // Creamos el registro usando las variables sanitizadas
    const newProduct = await Product.create({
      ...rest,
      name: finalName,
      price: Number(price),
      description: finalDescription,
      image: finalImage,
      stock: Number(rest.stock || 0),
      usuarioId: usuarioLogueadoId,
      embedding
    });

    // Auditoría centralizada
    await registrarLog({
      usuarioId: usuarioLogueadoId,
      accion: "USER_PRODUCT_CREATED",
      details: `El usuario dio de alta su dron privado: ${newProduct.name}`,
      req
    });

    // 🚀 TIEMPO REAL REFINADO: Emitimos el payload normalizado para que el Front actualice instantáneamente
    appEvents.emit('entity-updated', { 
      type: 'PRODUCTS_CHANGED', 
      payload: newProduct 
    });

    return res.status(201).json({ success: true, product: newProduct });
  } catch (error) {
    console.error("❌ [CREATE_MY_PRODUCT_ERROR]:", error);
    return res.status(500).json({ message: "Error interno en el servidor al guardar el dron." });
  }
};

/**
 * ✏️ 3. ACTUALIZAR UN PRODUCTO PRIVADO (CON CERROJO DE SEGURIDAD EN RUTA)
 */
export const updateMyProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioLogueadoId = req.user?._id;
    if (!usuarioLogueadoId) {
      return res.status(401).json({ message: "No autorizado." });
    }

    const { nombreOriginal, logDetalle, ...body } = req.body;

    // 🔒 CERROJO DE PERTENENCIA: Validamos que el documento realmente le pertenezca a su ID de sesión
    const originalProduct = await Product.findOne({ _id: id, usuarioId: usuarioLogueadoId });
    if (!originalProduct) {
      return res.status(403).json({ message: "Acceso denegado. Este equipo no te pertenece." });
    }

    // Actualización adaptativa del embedding semántico por IA si hubo modificaciones de texto
    if (body.name || body.description) {
      const nuevoNombre = body.name ? body.name.trim() : originalProduct.name;
      const nuevaDesc = body.description !== undefined ? body.description : originalProduct.description;
      body.embedding = await generarProductEmbedding(nuevoNombre, nuevaDesc);
    }

    // Ejecutamos la actualización restrictiva inyectando al dueño en el filtro atómico
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, usuarioId: usuarioLogueadoId },
      { $set: body },
      { returnDocument: 'after', runValidators: true }
    );

    // Grabamos los cambios en el historial de auditoría del sistema
    const operador = await User.findById(usuarioLogueadoId);
    const nombreOperador = operador ? operador.nombre : "Operador";
    const productoIdentificado = nombreOriginal || updatedProduct.name;
    const fraseFinal = `${nombreOperador} editó su producto privado ${productoIdentificado}${logDetalle || ""}`;

    await registrarLog({
      usuarioId: usuarioLogueadoId,
      accion: "USER_PRODUCT_UPDATED",
      details: fraseFinal,
      req
    });

    appEvents.emit('entity-updated', { type: 'PRODUCTS_CHANGED', payload: updatedProduct });

    return res.status(200).json({ success: true, product: updatedProduct });
  } catch (error) {
    console.error("UPDATE_MY_PRODUCT_ERROR:", error);
    return res.status(500).json({ message: "Error al editar tu producto" });
  }
};

/**
 * ❌ 4. ELIMINAR UN PRODUCTO PRIVADO (CON CERROJO DE SEGURIDAD EN RUTA)
 */
export const deleteMyProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioLogueadoId = req.user?._id;
    if (!usuarioLogueadoId) {
      return res.status(401).json({ message: "No autorizado." });
    }

    // 🔒 CERROJO ATÓMICO: findOneAndDelete garantiza que solo borre si coinciden el ID del producto y el DUEÑO
    const deleted = await Product.findOneAndDelete({ _id: id, usuarioId: usuarioLogueadoId });
    
    if (!deleted) {
      return res.status(403).json({ message: "No se puede eliminar. El producto no te pertenece o no existe." });
    }

    await registrarLog({
      usuarioId: usuarioLogueadoId,
      accion: "USER_PRODUCT_DELETED",
      details: `El usuario dio de baja su dron: ${deleted.name}`,
      req
    });

    appEvents.emit('entity-updated', { type: 'PRODUCTS_CHANGED', payload: { id } });

    return res.status(200).json({ success: true, message: "Equipo desvinculado de tu inventario" });
  } catch (error) {
    console.error("DELETE_MY_PRODUCT_ERROR:", error);
    return res.status(500).json({ message: "Error al eliminar tu producto" });
  }
};