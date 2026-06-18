import mongoose from "mongoose";
import Product from "../../models/Product.js";

import { registrarLog } from "../../helpers/auditoriaHelper.js"; // ✅ Tu nuevo Helper centralizado
import appEvents from "../../utilities/eventEmitter.js";
import User from "../../models/User.js"; // 🚀 AGREGA ESTA LÍNEA
import { generarProductEmbedding } from "../../helpers/geminiHelper.js"; // 🤖 Helper de IA

// 1. OBTENER TODOS LOS PRODUCTOS
export const getProducts = async (req, res) => {
  try {
    // Desactivamos la cache HTTP agresiva para evitar estados fantasmas 304
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    // Query dinámica para el buscador
    let query = {};
    if (search.trim()) {
      const isObjectId = mongoose.Types.ObjectId.isValid(search);
      query = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
          ...(isObjectId ? [{ _id: search }] : [])
        ]
      };
    }

    // Ejecutamos el lote, el total global y los AGOTADOS en paralelo en la BD
    const [products, totalItems, totalAgotados] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 }) // ✅ CORREGIDO: Mongoose usa 'createdAt' por defecto con timestamps
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
        totalAgotados
      }
    });
  } catch (error) {
    console.error("GET_PRODUCTS_ERROR:", error);
    return res.status(500).json({ message: "Error al obtener los productos" });
  }
};

// 2. CREAR UN PRODUCTO (POST)
export const createProduct = async (req, res) => {
  try {
    // 1. SEPARAMOS el usuarioId de la info del producto
    const { usuarioId, ...productInfo } = req.body;
    const { name, price, image, description, peso_gramos } = productInfo;

    if (!name || !price || !image) {
      return res.status(400).json({ message: "Faltan protocolos obligatorios" });
    }

    const existing = await Product.findOne({ name: name.trim() });
    if (existing) {
      return res.status(409).json({ message: "Este equipo ya existe" });
    }

    // 🤖 GENERACIÓN DE EMBEDDING CON IA
    const embedding = await generarProductEmbedding(name.trim(), description || "");

    // 2. CREAMOS el producto incluyendo el vector generado y parseamos el peso numérico
    const newProduct = await Product.create({
      ...productInfo,
      name: name.trim(),
      price: Number(price),
      stock: Number(productInfo.stock || 0),
      peso_gramos: Number(peso_gramos || 0), // 📦 Nos aseguramos de guardarlo como un número válido
      embedding // ✨ Guardamos el vector en la BD
    });

    // 3. AUDITORÍA (Si no hay usuarioId, el helper simplemente no graba el log)
    if (usuarioId) {
      await registrarLog({
        usuarioId,
        accion: "PRODUCT_CREATED",
        details: `Alta de equipo: ${newProduct.name} (${newProduct.peso_gramos}g)`,
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
    
    const { 
      usuarioId, 
      nombreOriginal, 
      logDetalle,     
      ...body         
    } = req.body; 

    // 📦 Forzamos que el peso se convierta a número si viene en la petición
    if (body.peso_gramos !== undefined) {
      body.peso_gramos = Number(body.peso_gramos || 0);
    }

    // 🤖 ACTUALIZACIÓN DEL EMBEDDING INTELIGENTE
    if (body.name || body.description) {
      const prodPrevio = await Product.findById(id);
      if (prodPrevio) {
        const nuevoNombre = body.name ? body.name.trim() : prodPrevio.name;
        const nuevaDesc = body.description !== undefined ? body.description : prodPrevio.description;
        
        const nuevoEmbedding = await generarProductEmbedding(nuevoNombre, nuevaDesc);
        
        // 🔥 CLAVE: Solo actualizamos el embedding si la IA lo generó con éxito.
        // Si la IA devolvió null o falló, mantenemos el embedding viejo y NO rompemos la actualización del peso.
        if (nuevoEmbedding && nuevoEmbedding.length > 0) {
          body.embedding = nuevoEmbedding;
        } else {
          console.log("⚠️ Conservando embedding anterior para evitar corrupción de datos.");
        }
      }
    }

    // Actualizamos la base de datos con el body limpio (que ya incluye el peso_gramos)
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: body },
      { returnDocument: 'after', runValidators: true } 
    );

    if (!updatedProduct) return res.status(404).json({ error: "Equipo no encontrado" });

    if (usuarioId) {
      const operador = await User.findById(usuarioId);
      const nombreOperador = operador ? operador.nombre : "Un usuario";

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

// 6. OBTENER UN PRODUCTO POR ID
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

export const getProductRecommendations = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Buscamos el producto actual para obtener su vector (embedding)
    const targetProduct = await Product.findById(id);
    if (!targetProduct) {
      return res.status(404).json({ error: "Producto de referencia no encontrado" });
    }

    // Si el producto no tiene embedding todavía (por ser viejo), devolvemos un array vacío seguro
    if (!targetProduct.embedding || targetProduct.embedding.length === 0) {
      // Fallback: Si no tiene IA, traemos los últimos 4 productos cargados de forma tradicional
      const fallback = await Product.find({ _id: { $ne: id } }).limit(4);
      return res.json(fallback);
    }

    // 2. Ejecutamos la búsqueda por similitud de vectores en MongoDB Atlas
    const recommendations = await Product.aggregate([
      {
        $vectorSearch: {
          index: "vector_index", // Así se debe llamar el índice que crearemos en Atlas
          path: "embedding",
          queryVector: targetProduct.embedding,
          numCandidates: 10,     // Margen de candidatos a evaluar internamente
          limit: 4               // Cantidad de sugerencias que queremos mostrar en la interfaz
        }
      },
      {
        // Filtro fundamental: Evitamos recomendar el mismo producto que ya se está comprando
        $match: {
          _id: { $ne: targetProduct._id }
        }
      },
      {
        // Limpiamos la respuesta mandando solo lo necesario para el diseño de las tarjetas
        $project: {
          name: 1,
          price: 1,
          image: 1,
          category: 1,
          stock: 1
        }
      }
    ]);

    return res.json(recommendations);
  } catch (error) {
    console.error("GET_RECOMMENDATIONS_ERROR:", error);
    return res.status(550).json({ error: "Error en el protocolo de recomendación por IA" });
  }
};