import axios from 'axios';
import mongoose from "mongoose";
import Venta from "../../models/Venta.js";
import Counter from '../../models/Counter.js';
import { descontarStockPorItems } from "../../helpers/stock.js";
import appEvents from "../../utilities/eventEmitter.js";


export const createInteroperableQR = async (req, res) => {
    // Recibimos userId desde el frontend para evitar el error de validación de Mongoose
    const { title, items, totalAmount, expirationDate, socketId, userId } = req.body;

    if (!title || !items || !totalAmount || !socketId || !userId) {
        return res.status(400).json({ message: "Datos incompletos (Falta Usuario o Socket)." });
    }

    const baseUrl = process.env.BACKEND_PUBLIC_URL;

    const orderData = {
        // Guardamos Usuario y Socket en la referencia externa
        external_reference: `USER_${userId}|SOCKET_${socketId}`,
        title,
        description: "Adquisición en QDRON Store",
        notification_url: `${baseUrl}/payments/webhook`,
        total_amount: totalAmount,
        expiration_date: expirationDate,
        items: items.map((item) => ({
            id: item.productId,
            sku_number: item.sku || `SKU_${item.productId}`,
            category: "marketplace",
            title: item.name,
            unit_price: item.price,
            quantity: item.quantity,
            unit_measure: "unit",
            total_amount: item.price * item.quantity,
        })),
        cash_out: { amount: 0 },
    };

    try {
        const url = `https://api.mercadopago.com/instore/orders/qr/seller/collectors/${process.env.COLLECTOR_ID}/pos/${process.env.EXTERNAL_POS_ID}/qrs`;

        const response = await axios.put(url, orderData, {
            headers: {
                Authorization: `Bearer ${process.env.MERCADOPAGO_API_KEY}`,
                "Content-Type": "application/json",
            },
        });

        res.status(200).json({
            success: true,
            qr_data: response.data.qr_data,
            order_id: response.data.in_store_order_id,
            socketId
        });
    } catch (error) {
        console.error("❌ Error MP QR:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.response?.data || "Error MP" });
    }
};

/**
 * 2. WEBHOOK: RECIBIR NOTIFICACIÓN
 */
/**
 * 2. WEBHOOK: RECIBIR NOTIFICACIÓN
 * Procesa la confirmación de pago de Mercado Pago y registra la venta.
 */
export const receiveWebhook = async (req, res) => {
    const { type, data } = req.body;

    // Solo procesamos notificaciones de tipo payment
    if (type !== "payment") return res.sendStatus(200);

    const paymentId = data.id;

    try {
        // 1. Evitar duplicados (Idempotencia)
        const ventaExistente = await Venta.findOne({ transactionId: paymentId });
        if (ventaExistente) {
            console.log(`🔁 Pago ${paymentId} ya procesado anteriormente.`);
            return res.sendStatus(200);
        }

        // 2. Obtener datos detallados del pago desde la API de Mercado Pago
        const response = await axios.get(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_API_KEY}` } }
        );

        const paymentData = response.data;
        const { 
            status, 
            transaction_amount, 
            date_created, 
            external_reference, 
            status_detail, 
            order,
            description 
        } = paymentData;

        // Si el pago todavía está en proceso, no hacemos nada y esperamos al próximo reintento
        if (status === "in_process") return res.sendStatus(200);

        // 3. Extraer Identificadores de la referencia externa (USER_id|SOCKET_id)
        const referenceParts = external_reference ? external_reference.split('|') : [];
        const userId = referenceParts[0]?.replace('USER_', '');
        const socketId = referenceParts[1]?.replace('SOCKET_', '');

        // Validación de seguridad para evitar errores de Cast en MongoDB con notificaciones viejas
        if (!userId || userId === "undefined" || userId === "") {
            console.warn("⚠️ Notificación ignorada: No se encontró userId en la referencia.");
            return res.status(200).json({ message: "Ignorado: falta usuario" });
        }

        // 4. Intentar obtener los items de la orden asociada
        let items = order?.id ? await obtenerItemsOrden(order.id) : [];

        // --- PLAN B: Si MP no devuelve items, reconstruimos con la info del pago ---
        if (items.length === 0) {
            console.log("🔍 Reconstruyendo items desde la descripción del pago...");
            items = [{
                productId: null, 
                name: description || "Unidad QDRON (Sincronizada)",
                price: transaction_amount,
                quantity: 1
            }];
        }

        // 5. Incrementar número de venta secuencial
        const counter = await Counter.findOneAndUpdate(
            { name: "numeroVenta" },
            { $inc: { value: 1 } },
            { returnDocument: 'after', upsert: true }
        );

        // 6. Procesar según el estado del pago
        if (status === "approved") {
            const nuevaVenta = new Venta({
                numeroVenta: counter.value,
                usuario: userId,
                transactionId: paymentId,
                externalReference: external_reference,
                totalAmount: transaction_amount,
                status,
                fechaVenta: new Date(date_created || Date.now()),
                items,
                socketId,
                impresa: false,
                metodoPago: "mercadopago"
            });

            // Guardar en Base de Datos
            await nuevaVenta.save();
            
            // Actualizar Stock en segundo plano
            try {
                await descontarStockPorItems(items);
            } catch (e) {
                console.error("❌ Error al descontar stock:", e.message);
            }

            // 📢 Notificar éxito al Frontend en tiempo real
            appEvents.emit('entity-updated', {
                type: 'VENTA_CREADA',
                payload: {
                    status: 'approved',
                    transactionId: paymentId,
                    numeroVenta: counter.value,
                    totalAmount: transaction_amount,
                    socketId: socketId
                }
            });

            console.log(`✅ Venta #${counter.value} registrada exitosamente.`);
            
        } else {
            // 📢 Notificar fallo al Frontend en tiempo real
            appEvents.emit('entity-updated', {
                type: 'VENTA_RECHAZADA',
                payload: {
                    status: 'rejected',
                    message: getMotivoRechazo(status_detail),
                    socketId: socketId
                }
            });
            console.log(`❌ Pago ${paymentId} rechazado: ${status_detail}`);
        }

        // Responder 200 a Mercado Pago para confirmar recepción
        res.status(200).json({ message: "OK" });

    } catch (error) {
        console.error("❌ Error Crítico en Webhook:", error.message);
        // Respondemos 500 para que Mercado Pago reintente si hubo un error de servidor
        res.status(500).json({ message: "Error interno procesando webhook" });
    }
};


export const getDetallePago = async (req, res) => {
    const { paymentId } = req.params;
    try {
        const { data } = await axios.get(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_API_KEY}` } }
        );

        res.status(200).json({
            status: data.status,
            monto: data.transaction_amount,
            metodo: data.payment_method_id,
            email: data.payer?.email,
            motivo: getMotivoRechazo(data.status_detail)
        });
    } catch (error) {
        res.status(500).json({ message: "Error al consultar pago." });
    }
};

// --- HELPERS INTERNOS ---

const getMotivoRechazo = (statusDetail) => {
    const motivos = {
        "cc_rejected_insufficient_amount": "Fondos insuficientes.",
        "cc_rejected_high_risk": "Rechazado por seguridad (Alto riesgo).",
        "cc_rejected_duplicated_payment": "El pago ya fue procesado anteriormente.",
        "cc_rejected_card_disabled": "La tarjeta se encuentra inhabilitada.",
        "cc_rejected_bad_filled_security_code": "Código de seguridad incorrecto."
    };
    return motivos[statusDetail] || "La transacción no pudo ser procesada.";
};

const getSocketIdFromReference = (ref = "") => ref.includes("|") ? ref.split("|")[1] : "manual";

const obtenerItemsOrden = async (orderId) => {
    try {
      const { data } = await axios.get(
        `https://api.mercadopago.com/merchant_orders/${orderId}`,
        { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_API_KEY}` } }
      );
  
      // Mapeamos los items asegurándonos de que el ID sea válido
      return (data.items || []).map(i => {
        // Intentamos sacar el ID de varias posibles ubicaciones
        const idLimpio = i.id || i.external_reference; 
  
        return {
          productId: idLimpio, 
          name: i.title,
          price: i.unit_price,
          quantity: i.quantity
        };
      }).filter(item => item.productId && item.productId !== ""); // Eliminamos items sin ID para evitar el crash
    } catch (error) {
      console.error("⚠️ Error obteniendo items de la orden:", orderId);
      return [];
    }
  };
