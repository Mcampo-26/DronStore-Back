import axios from 'axios';
import Venta from "../../models/Venta.js"; 
import Counter from '../../models/Counter.js';
import { descontarStockPorItems } from "../../helpers/stock.js";
import appEvents from "../../utilities/eventEmitter.js";

/**
 * 1. GENERAR QR INTEROPERABLE
 */
export const createInteroperableQR = async (req, res) => {
    const { title, items, totalAmount, expirationDate, socketId, userId } = req.body;

    // Validación de seguridad básica
    if (!title || !items || !totalAmount || !socketId || !userId) {
        return res.status(400).json({ success: false, message: "Datos incompletos (Falta Usuario o Socket)." });
    }

    const baseUrl = process.env.BACKEND_PUBLIC_URL;

    const orderData = {
        // Almacenamos Usuario y Socket en la referencia externa para el Webhook
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
        res.status(500).json({ success: false, error: error.response?.data || "Error al conectar con Mercado Pago" });
    }
};

/**
 * 2. WEBHOOK: RECIBIR NOTIFICACIÓN
 */
export const receiveWebhook = async (req, res) => {
    const { type, data } = req.body;

    if (type !== "payment") return res.sendStatus(200);

    const paymentId = data.id;

    try {
        // Evitar procesamiento duplicado
        const ventaExistente = await Venta.findOne({ transactionId: paymentId });
        if (ventaExistente) return res.sendStatus(200);

        // Obtener detalle del pago desde MP
        const response = await axios.get(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_API_KEY}` } }
        );

        const paymentData = response.data;
        const { status, transaction_amount, date_created, external_reference, status_detail, order, description } = paymentData;

        if (status === "in_process") return res.sendStatus(200);

        // Extraer IDs de la referencia: "USER_id|SOCKET_id"
        const referenceParts = external_reference ? external_reference.split('|') : [];
        const userId = referenceParts[0]?.replace('USER_', '');
        const socketId = referenceParts[1]?.replace('SOCKET_', '');

        // Escudo contra notificaciones antiguas o sin usuario
        if (!userId || userId === "undefined" || userId === "") {
            console.warn("⚠️ Notificación ignorada: No se encontró userId.");
            return res.status(200).json({ message: "Ignorado: falta usuario" });
        }

        // Obtener items de la orden
        let items = order?.id ? await obtenerItemsOrden(order.id) : [];

        // PLAN B: Reconstrucción de items si MP no devuelve el detalle a tiempo
        if (items.length === 0) {
            items = [{
                productId: "600000000000000000000001", // ID genérico para pasar validación de ObjectId
                name: description || "Unidad QDRON (Sincronización Manual)",
                price: transaction_amount,
                quantity: 1
            }];
        }

        // Incrementar contador de ventas
        const counter = await Counter.findOneAndUpdate(
            { name: "numeroVenta" },
            { $inc: { value: 1 } },
            { returnDocument: 'after', upsert: true }
        );

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

            await nuevaVenta.save();
            
            try {
                await descontarStockPorItems(items);
            } catch (e) {
                console.error("❌ Error descontando stock:", e.message);
            }

            // Emitir evento para el frontend (SSE)
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

            console.log(`✅ Venta #${counter.value} completada.`);
            
        } else {
            // Notificar rechazo
            appEvents.emit('entity-updated', {
                type: 'VENTA_RECHAZADA',
                payload: {
                    status: 'rejected',
                    message: getMotivoRechazo(status_detail),
                    socketId: socketId
                }
            });
        }

        res.status(200).json({ message: "OK" });

    } catch (error) {
        console.error("❌ Error Crítico en Webhook:", error.message);
        res.status(500).json({ message: "Error interno" });
    }
};

/**
 * 3. OBTENER DETALLE DEL PAGO
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

// --- HELPERS ---

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

const obtenerItemsOrden = async (orderId) => {
    try {
        const { data } = await axios.get(
            `https://api.mercadopago.com/merchant_orders/${orderId}`,
            { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_API_KEY}` } }
        );
        return (data.items || []).map(i => ({
            productId: i.id || i.external_reference, 
            name: i.title,
            price: i.unit_price,
            quantity: i.quantity
        })).filter(item => item.productId);
    } catch (error) {
        return [];
    }
};