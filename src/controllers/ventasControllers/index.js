import axios from 'axios';
import mongoose from "mongoose";
import Venta from "../../models/Venta.js"; 
import { descontarStockPorItems } from "../../helpers/stock.js";
import appEvents from "../../utilities/eventEmitter.js";





export const getVentaById = async (req, res) => {
  try {
    const { id } = req.params;

    // Usamos populate para traer el nombre/email del usuario 
    // y los detalles (nombre, imagen) de los productos en los items.
    const venta = await Venta.findById(id)
      .populate("usuario", "nombre email")
      .populate("items.productId", "name image");

    if (!venta) {
      return res.status(404).json({ 
        success: false, 
        message: "No se encontró la venta solicitada." 
      });
    }

    res.json({ 
      success: true, 
      venta 
    });

  } catch (error) {
    console.error("❌ Error al obtener detalle de venta:", error.message);
    
    // Si el error es por un ID de MongoDB mal formado
    if (error.kind === 'ObjectId') {
      return res.status(400).json({ success: false, message: "ID de venta inválido." });
    }

    res.status(500).json({ 
      success: false, 
      message: "Error interno al buscar la venta." 
    });
  }
};


export const getVentas = async (req, res) => {
  try {
    const { busqueda, estado, desde, hasta } = req.query;
    let query = {};

    // A. Filtro de búsqueda (Busca en nombre de items o IDs de transacción)
    if (busqueda) {
      query.$or = [
        { "items.name": { $regex: busqueda, $options: "i" } },
        { transactionId: { $regex: busqueda, $options: "i" } },
        { externalReference: { $regex: busqueda, $options: "i" } }
      ];
    }

    // B. Filtro por Estado (approved, rejected, pending)
    if (estado) {
      query.status = estado;
    }

    // C. Filtro por Rango de Fechas (basado en fechaVenta)
    if (desde || hasta) {
      query.fechaVenta = {};
      if (desde) query.fechaVenta.$gte = new Date(desde);
      if (hasta) query.fechaVenta.$lte = new Date(hasta);
    }

    // Ejecutamos la consulta con populate para tener los datos del usuario
    const ventas = await Venta.find(query)
      .populate("usuario", "nombre email")
      .sort({ fechaVenta: -1 }); // Ordenamos por las más recientes primero

    res.status(200).json({
      success: true,
      count: ventas.length,
      ventas
    });

  } catch (error) {
    console.error("❌ Error al obtener listado de ventas:", error.message);
    res.status(500).json({ 
      success: false, 
      message: "Error al cargar el historial de ventas." 
    });
  }
};



export const deleteVenta = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscamos y eliminamos en un solo paso
    const ventaEliminada = await Venta.findByIdAndDelete(id);

    if (!ventaEliminada) {
      return res.status(404).json({ 
        success: false, 
        message: 'Venta no encontrada. Es posible que ya haya sido eliminada.' 
      });
    }

    // 🔥 EMISIÓN REAL-TIME
    // Notificamos a través del sistema de eventos para que useSystemUpdates 
    // en el frontend se entere y limpie la UI.
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
    res.status(500).json({ 
      success: false, 
      message: 'Error interno al intentar eliminar la venta.' 
    });
  }
};