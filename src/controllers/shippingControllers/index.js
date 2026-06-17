import DefaultShipping from '../../models/DefaultShipping.js';
import User from "../../models/User.js";
import Product from '../../models/Product.js'; // 📦 IMPORTANTE: Traemos el modelo de Productos
import { obtenerCotizacionesDeEnvio } from '../../services/shipping/shippingGateway.js';
import appEvents from '../../utilities/eventEmitter.js';

// 🔍 1. COTIZAR ENVÍO EN EL CHECKOUT (BLINDADO Y ULTRA SEGURO)
export const quoteShipping = async (req, res) => {
  try {
    const { codigoPostalDestino, productos } = req.body;

    if (!codigoPostalDestino || !productos || !Array.isArray(productos)) {
      return res.status(400).json({ message: "Faltan datos obligatorios (CP o Productos)" });
    }

    // 📦 MOTOR DE LOGÍSTICA REAL DESDE MONGO:
    let pesoTotalGramosAcumulado = 0;

    // Recorremos los ítems que mandó el carrito para buscar su peso real en la DB
    for (const item of productos) {
      // Buscamos el producto por su ID (soportando tanto item.productId como item.id por consistencia)
      const idABuscar = item.productId || item.id;
      const productoDB = await Product.findById(idABuscar).select('peso_gramos');

      if (productoDB) {
        // Si el producto no tiene peso asignado, usamos un fallback seguro de 249g
        const pesoPorUnidad = productoDB.peso_gramos || 249;
        pesoTotalGramosAcumulado += pesoPorUnidad * Number(item.quantity || 1);
      } else {
        // Fallback por si mandan un producto fantasma o eliminado
        pesoTotalGramosAcumulado += 249 * Number(item.quantity || 1);
      }
    }

    // 🧼 Convertimos el total acumulado de gramos a Kilogramos para el Gateway de envíos
    const pesoTotalKg = pesoTotalGramosAcumulado / 1000;

    console.log(`🛰️ [Logística DronStore] CP: ${codigoPostalDestino} | Peso verificado en DB: ${pesoTotalKg} kg`);

    // Llamamos a la capa de servicios (Gateway agnóstico) con el peso real calculado en el servidor
    const opcionesBusqueda = await obtenerCotizacionesDeEnvio({ codigoPostalDestino, pesoTotalKg });

    res.json({
      success: true,
      pesoTotalKg,
      options: opcionesBusqueda
    });
  } catch (error) {
    console.error("❌ ERROR_QUOTE_SHIPPING:", error);
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