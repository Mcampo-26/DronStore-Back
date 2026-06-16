import DefaultShipping from '../../models/DefaultShipping.js';
import User from "../../models/User.js";
import { obtenerCotizacionesDeEnvio } from '../../services/shipping/shippingGateway.js';
import appEvents from '../../utilities/eventEmitter.js';

// 🔍 1. COTIZAR ENVÍO EN EL CHECKOUT
export const quoteShipping = async (req, res) => {
  try {
    const { codigoPostalDestino, productos } = req.body;

    if (!codigoPostalDestino || !productos || !Array.isArray(productos)) {
      return res.status(400).json({ message: "Faltan datos obligatorios (CP o Productos)" });
    }

    // Calculamos el peso total acumulado del carrito en el servidor para evitar fraudes en el precio
    const pesoTotalKg = productos.reduce((acc, prod) => acc + (Number(prod.pesoKg) * Number(prod.quantity)), 0);

    // Llamamos a la capa de servicios (Gateway agnóstico)
    const opcionesBusqueda = await obtenerCotizacionesDeEnvio({ codigoPostalDestino, pesoTotalKg });

    res.json({
      success: true,
      pesoTotalKg,
      options: opcionesBusqueda
    });
  } catch (error) {
    res.status(500).json({ message: "Error al calcular la cotización", error: error.message });
  }
};

// 📦 2. CREAR DESPACHO FINAL (Guardar la compra con el correo elegido)
export const createShippingDelivery = async (req, res) => {
  try {
    const { usuarioId, products, totalProductsPrice, shippingSelected } = req.body;

    // Calculamos precio final sumando productos + costo de envío elegido
    const totalOrderPrice = Number(totalProductsPrice) + Number(shippingSelected.cost);

    // Simulamos la generación de un número de guía/tracking realista
    const randomHex = Math.random().toString(16).substring(2, 8).toUpperCase();
    const trackingCode = `DRON-${shippingSelected.providerName.substring(0, 3).toUpperCase()}-${randomHex}`;
    
    // Concatenamos el código generado a la URL base del transporte elegido
    const trackingUrl = `${shippingSelected.trackingBaseUrl}${trackingCode}`;

    const nuevoDespacho = new DefaultShipping({
      usuarioId,
      products,
      totalProductsPrice,
      totalOrderPrice,
      shipping: {
        address: shippingSelected.address,
        providerName: shippingSelected.providerName,
        serviceType: shippingSelected.serviceType,
        cost: shippingSelected.cost,
        deliveryEstimate: shippingSelected.deliveryEstimate,
        status: "pending", // Arranca en pendiente
        trackingCode,
        trackingUrl
      }
    });

    await nuevoDespacho.save();

    // 🔥 EMISIÓN TIEMPO REAL: Avisamos al Dashboard de administración que hay un nuevo despacho en cola
    appEvents.emit('entity-updated', { 
      type: 'NEW_SHIPPING_DESPACHO', 
      payload: nuevoDespacho 
    });

    res.status(201).json({ 
      success: true, 
      message: "Despacho creado y orden registrada con éxito", 
      data: nuevoDespacho 
    });
  } catch (error) {
    res.status(500).json({ message: "Error al procesar el despacho", error: error.message });
  }
};