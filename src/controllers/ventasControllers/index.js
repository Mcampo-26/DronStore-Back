import mongoose from "mongoose";
import Venta from "../../models/Venta.js"; 
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
 * OBTIENE EL LISTADO FILTRADO DE VENTAS
 */
export const getVentas = async (req, res) => {
  try {
    const { busqueda, estado, desde, hasta } = req.query;
    let query = {};

    // Filtros de búsqueda (items, IDs o Referencias)
    if (busqueda) {
      query.$or = [
        { "items.name": { $regex: busqueda, $options: "i" } },
        { transactionId: { $regex: busqueda, $options: "i" } },
        { externalReference: { $regex: busqueda, $options: "i" } }
      ];
    }

    // Filtro por estado
    if (estado) query.status = estado;

    // Filtro por rango de fechas (Ajustado para cubrir días completos)
    if (desde || hasta) {
      query.fechaVenta = {};
      if (desde) query.fechaVenta.$gte = new Date(desde);
      if (hasta) {
        const fechaHasta = new Date(hasta);
        fechaHasta.setHours(23, 59, 59, 999);
        query.fechaVenta.$lte = fechaHasta;
      }
    }

    const ventas = await Venta.find(query)
      .populate("usuario", "nombre email")
      .sort({ fechaVenta: -1 });

    res.status(200).json({
      success: true,
      count: ventas.length,
      ventas
    });

  } catch (error) {
    console.error("❌ Error al obtener listado de ventas:", error.message);
    res.status(500).json({ success: false, message: "Error al cargar historial." });
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

    // Notificamos al frontend vía SSE para que useSystemUpdates limpie la UI
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