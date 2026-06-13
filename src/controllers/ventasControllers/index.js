import mongoose from "mongoose";
import Venta from "../../models/Venta.js"; 
import Product from "../../models/Product.js"; // 🚀 CORRECCIÓN CLAVE: Importación que faltaba para evitar el ReferenceError
import appEvents from "../../utilities/eventEmitter.js";

/**
 * OBTIENE EL DETALLE DE UNA VENTA ESPECÍFICA
 */
export const getVentaById = async (req, res) => {
  try {
    const { id } = req.params;

    const venta = await Venta.findById(id)
      .populate("usuario", "nombre email")
      .populate("items.productId", "name image");

    if (!venta) {
      return res.status(404).json({ 
        success: false, 
        message: "No se encontró la venta solicitada." 
      });
    }

    res.json({ success: true, venta });

  } catch (error) {
    console.error("❌ Error al obtener detalle de venta:", error.message);
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: "ID de venta inválido." });
    }
    res.status(500).json({ success: false, message: "Error interno al buscar la venta." });
  }
};

/**
 * OBTIENE EL LISTADO FILTRADO DE VENTAS (MUESTRA TODO A ADMINS / FILTRA MIS PRODUCTOS A USUARIOS)
 */
export const getVentas = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { busqueda, estado, desde, hasta } = req.query;
    
    let query = {};

    // 🛡️ CONTROL DE ROLES HÍBRIDO
    const usuarioLogueado = req.user || {};
    const stringRol = JSON.stringify(usuarioLogueado.role || "").toUpperCase();
    const esAdminGlobal = stringRol.includes("ADMIN") || stringRol.includes("SUPERADMIN");

    console.log("👤 [Ventas Auth] Operador ID:", usuarioLogueado._id);
    console.log("🛡️ [Ventas Auth] ¿Es Administrador Global?:", esAdminGlobal);

    // Si NO es administrador global y tenemos sesión activa de usuario, aislamos sus drones
    if (!esAdminGlobal && usuarioLogueado._id) {
      const misProductos = await Product.find({ usuarioId: usuarioLogueado._id }).select("_id");
      const misProductIds = misProductos.map(p => p._id.toString());

      // Filtramos la query para que solo traiga transacciones que involucren sus productos
      query["items.productId"] = { $in: misProductIds };
    } else if (!esAdminGlobal && !usuarioLogueado._id) {
      return res.status(401).json({ 
        success: false, 
        message: "No se pudo identificar las credenciales del operador. Verificá el token." 
      });
    }

    // Filtros de búsqueda (items, IDs o Referencias)
    if (busqueda && busqueda.trim()) {
      const isObjectId = mongoose.Types.ObjectId.isValid(busqueda);
      
      query.$or = [
        { "items.name": { $regex: busqueda, $options: "i" } },
        { transactionId: { $regex: busqueda, $options: "i" } },
        { externalReference: { $regex: busqueda, $options: "i" } },
        ...(isObjectId ? [{ _id: busqueda }] : [])
      ];
    }

    // Filtro por estado
    if (estado) {
      query.$or = [
        { status: estado },
        { estado: estado }
      ];
    }

    // Filtro por rango de fechas respetando 'fechaVenta'
    if (desde || hasta) {
      query.fechaVenta = {};
      if (desde) query.fechaVenta.$gte = new Date(desde);
      if (hasta) {
        const fechaHasta = new Date(hasta);
        fechaHasta.setHours(23, 59, 59, 999);
        query.fechaVenta.$lte = fechaHasta;
      }
    }

    // 🚀 EJECUCIÓN SANEADA: Eliminado el populate de items.productId que rompía el Promise.all
    const [ventas, totalItems] = await Promise.all([
      Venta.find(query)
        .populate("usuario", "nombre email") // Dejamos solo el de usuario que sí es una referencia ObjectId válida
        .sort({ fechaVenta: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Venta.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return res.status(200).json({
      success: true,
      ventas,
      pagination: {
        totalItems,
        totalPages,
        currentPage: page,
        itemsPerPage: limit
      }
    });

  } catch (error) {
    console.error("❌ [CRITICAL_GET_VENTAS_ERROR]:", error.message);
    return res.status(500).json({ 
      success: false, 
      message: "Error interno al procesar el listado de transacciones.",
      errorReal: error.message 
    });
  }
};

/**
 * ELIMINA UNA VENTA Y NOTIFICA AL FRONTEND EN TIEMPO REAL
 */
export const deleteVenta = async (req, res) => {
  try {
    const { id } = req.params;

    const ventaEliminada = await Venta.findByIdAndDelete(id);

    if (!ventaEliminada) {
      return res.status(404).json({ 
        success: false, 
        message: 'La venta no existe o ya fue eliminada.' 
      });
    }

    appEvents.emit('entity-updated', { 
      type: 'VENTA_DELETED', 
      payload: id 
    });

    res.json({ 
      success: true, 
      message: `Venta #${ventaEliminada.numeroVenta} eliminada correctamente.` 
    });

  } catch (error) {
    console.error("❌ Error al eliminar venta:", error.message);
    res.status(500).json({ success: false, message: 'Error interno al eliminar.' });
  }
};