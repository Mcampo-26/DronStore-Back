import axios from 'axios';
import mongoose from "mongoose";
import Venta from "../../models/Venta.js";
import Counter from '../../models/Counter.js';
import { descontarStockPorItems } from "../../helpers/stock.js";
import appEvents from "../../utilities/eventEmitter.js";


export const createInteroperableQR = async (req, res) => {
    const { title, items, totalAmount, expirationDate, socketId } = req.body;

    // Validación de seguridad
    if (!title || !items || !totalAmount || !socketId) {
        return res.status(400).json({ success: false, message: "Datos incompletos para generar el QR." });
    }


    const baseUrl = process.env.BACKEND_PUBLIC_URL;
    // Estructura de la orden para Mercado Pago
    const orderData = {
        external_reference: `ORDER_${Date.now()}|${socketId}`,
        title,
        description: "Adquisición en QDRON Store",
        notification_url: `${baseUrl}/payments/webhook`, // Tu URL de producción
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
        res.status(500).json({ success: false, error: error.response?.data || "Error al conectar con Mercado Pago" });
    }
};

/**
 * 2. WEBHOOK: RECIBIR NOTIFICACIÓN DE PAGO
 * Procesa el pago, descuenta stock y guarda la venta de forma atómica.
 */
export const receiveWebhook = async (req, res) => {
    const { type, data } = req.body;

    // Solo procesamos eventos de tipo 'payment'
    if (type !== "payment") return res.sendStatus(200);

    const paymentId = data.id;

    try {
        // A. Evitar duplicados (Idempotencia)
        const ventaExistente = await Venta.findOne({ transactionId: paymentId });
        if (ventaExistente) return res.sendStatus(200);

        // B. Obtener detalles del pago desde MP
        const response = await axios.get(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_API_KEY}` } }
        );

        const { status, transaction_amount, date_created, external_reference, status_detail, order } = response.data;
        if (status === "in_process") return res.sendStatus(200);

        const socketId = getSocketIdFromReference(external_reference);
        const items = order?.id ? await obtenerItemsOrden(order.id) : [];

        // --- INICIO DE TRANSACCIÓN ATÓMICA ---
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Reservar Número de Venta Correlativo
            const counter = await Counter.findOneAndUpdate(
                { name: "numeroVenta" },
                { $inc: { value: 1 } },
                { returnDocument: 'after', upsert: true, session }
            );

            if (status === "approved") {
                // 2. Descontar Stock por lotes (Helper DronStore)
                const patches = await descontarStockPorItems(items, session);

                // 3. Crear Registro de Venta
                const nuevaVenta = new Venta({
                    numeroVenta: counter.value,
                    transactionId: paymentId,
                    externalReference: external_reference,
                    totalAmount: transaction_amount,
                    status,
                    fechaVenta: new Date(date_created || Date.now()),
                    items,
                    socketId,
                    impresa: false,
                });

                await nuevaVenta.save({ session });

                // 4. Confirmar Cambios en DB
                await session.commitTransaction();
                session.endSession();

                // --- NOTIFICACIONES REAL-TIME (appEvents) ---
                // Al cliente que está esperando en la Home/Checkout
                appEvents.emit('entity-updated', {
                    type: 'VENTA_CREADA',
                    payload: { ...nuevaVenta.toObject(), status, transactionId: paymentId }
                });

                // Actualización global de Stock para todas las pantallas
                if (patches.length) {
                    appEvents.emit('entity-updated', { type: 'STOCK_UPDATED', payload: patches });
                }

            } else {
                // PAGO RECHAZADO O CANCELADO
                await session.abortTransaction();
                session.endSession();

                appEvents.emit('entity-updated', {
                    type: 'VENTA_RECHAZADA',
                    payload: { socketId, status, message: getMotivoRechazo(status_detail) }
                });
            }
        } catch (transactionError) {
            await session.abortTransaction();
            session.endSession();
            throw transactionError;
        }

        res.status(200).json({ message: "Webhook procesado con éxito." });

    } catch (error) {
        console.error("❌ Error Webhook Fatal:", error.message);
        res.status(500).json({ message: "Error interno procesando el pago." });
    }
};

/**
 * 3. OBTENER DETALLE DEL PAGO (Para auditoría)
 */
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
