import axios from 'axios';
import Venta from "../../models/Venta.js"; 
import Counter from '../../models/Counter.js';

import { inventoryService } from "../../services/stock/inventoryService.js";
import { registrarLog } from "../../helpers/auditoriaHelper.js"; // Ajustá la ruta según tu carpeta





const pagosEnProceso = new Set();

/**
 * 🔧 FUNCIONES AUXILIARES
 */
const getMotivoRechazo = (statusDetail) => {
    const motivos = {
        "cc_rejected_insufficient_amount": "Fondos insuficientes.",
        "cc_rejected_high_risk": "Rechazado por seguridad.",
        "cc_rejected_duplicated_payment": "Pago duplicado.",
        "cc_rejected_bad_filled_card_number": "Número de tarjeta inválido.",
        "cc_rejected_bad_filled_date": "Fecha de vencimiento incorrecta.",
        "cc_rejected_bad_filled_security_code": "Código de seguridad incorrecto.",
        "cc_rejected_blacklist": "Tarjeta restringida.",
        "cc_rejected_call_for_authorize": "Debe autorizar el pago en su banco.",
        "cc_rejected_card_disabled": "Tarjeta deshabilitada.",
        "cc_rejected_card_error": "Error técnico con la tarjeta.",
        "cc_rejected_invalid_installments": "Número de cuotas no permitido."
    };
    return motivos[statusDetail] || "Transacción rechazada por la entidad emisora.";
};

const obtenerItemsOrden = async (orderId, backupId) => { // 👈 Agregamos backupId
    if (!orderId) return [];
    try {
        const { data } = await axios.get(
            `https://api.mercadopago.com/merchant_orders/${orderId}`,
            { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_API_KEY}` } }
        );

        return (data.items || []).map((item) => ({
            // 🔥 Si item.id está vacío, usamos el backupId que rescatamos del external_reference
            productId: item.id && item.id !== "" ? item.id : backupId, 
            name: item.title,
            price: item.unit_price,
            quantity: item.quantity,
        }));
    } catch (error) {
        console.warn(`⚠️ No se pudo rescatar items de la orden ${orderId}`);
        return [];
    }
};

/**
 * 1. GENERAR QR INTEROPERABLE
 */
export const createInteroperableQR = async (req, res) => {
    const { title, items, totalAmount, socketId, userId } = req.body;

    if (!title || !items || !totalAmount || !socketId || !userId) {
        return res.status(400).json({ success: false, message: "Datos incompletos." });
    }

    const baseUrl = process.env.BACKEND_PUBLIC_URL;
    const backupProductId = items[0]?.productId;
    const now = new Date();
    const expirationDate = new Date(now.getTime() + 40000).toISOString();
    const cleanTitle = title.replace(/[|]/g, '-');

    const orderData = {
        external_reference: `USER_${userId}|SOCKET_${socketId}|PROD_${backupProductId}|NAME_${cleanTitle}`,
        title: title,
        description: title, 
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
            socketId,
            expires_at: expirationDate
        });
    } catch (error) {
        console.error("❌ Error MP QR:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: "Error al conectar con Mercado Pago" });
    }
};

/**
 * 2. WEBHOOK: PROCESAMIENTO DE PAGO Y STOCK
 */
export const receiveWebhook = async (req, res) => {
    const io = req.app.locals.io;
    const { type, data } = req.body;
    const paymentId = data?.id || req.query.id || req.query['data.id'];

    if (!paymentId) return res.sendStatus(200);

    // Evitar ráfagas de MP
    if (pagosEnProceso.has(paymentId)) return res.sendStatus(200); 
    pagosEnProceso.add(paymentId);

    if (type !== "payment" && req.query.topic !== "payment") {
        pagosEnProceso.delete(paymentId);
        return res.sendStatus(200);
    }

    try {
        const ventaExistente = await Venta.findOne({ transactionId: paymentId });
        if (ventaExistente) {
            pagosEnProceso.delete(paymentId);
            return res.sendStatus(200);
        }

        const response = await axios.get(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_API_KEY}` } }
        );

        const p = response.data;
        if (p.status === "in_process") {
            pagosEnProceso.delete(paymentId);
            return res.sendStatus(200);
        }

        const referenceParts = p.external_reference ? p.external_reference.split('|') : [];
        const userId = referenceParts[0]?.replace('USER_', '');
        const socketId = referenceParts[1]?.replace('SOCKET_', '');
        const backupProductId = referenceParts[2]?.replace('PROD_', '');

        /**
         * 🔄 RESCATE DE ITEMS (STOCK FIX)
         * Si MP no envía items, los buscamos en la merchant_order
         */
        let items = p.additional_info?.items?.map(i => ({
            productId: i.id,
            name: i.title,
            price: parseFloat(i.unit_price),
            quantity: parseInt(i.quantity)
        })) || [];

        if (items.length === 0 && p.order?.id) {
            console.log(`🔎 Items vacíos en Payment. Rescatando de Merchant Order: ${p.order.id}`);
            items = await obtenerItemsOrden(p.order.id, backupProductId);
        }

        const counter = await Counter.findOneAndUpdate(
            { name: "numeroVenta" },
            { $inc: { value: 1 } },
            { returnDocument: 'after', upsert: true }
        );

        if (p.status === "approved") {
            // 1. Guardar Venta
            const nuevaVenta = new Venta({
                numeroVenta: counter.value,
                usuario: userId,
                transactionId: paymentId,
                externalReference: p.external_reference,
                totalAmount: p.transaction_amount,
                status: p.status,
                fechaVenta: new Date(p.date_created || Date.now()),
                items,
                socketId,
                metodoPago: p.payment_method_id
            });

            const ventaFinal = await nuevaVenta.save();
            await ventaFinal.populate('usuario', 'nombre email');

            // 2. Descontar Stock (Ahora sí tiene los IDs rescatados)
            if (items.length > 0) {
                try { 
                    await inventoryService.deductStock(items); 
                    console.log(`📉 Stock descontado para venta #${counter.value}`);
                } catch (e) { 
                    console.error("❌ Error stock:", e.message); 
                }
            }

            // 🚀 Emisión Socket (Cliente)
            if (io && socketId) {
                io.to(socketId).emit("paymentSuccess", {
                    status: 'approved',
                    paymentId: paymentId,
                    numeroVenta: counter.value,
                    totalAmount: p.transaction_amount
                });
            }

            // 📢 Emisión Eventos (Admin/Logs)
            await registrarLog({
                usuarioId: userId,
                accion: 'VENTA NUEVA', // 👈 Aquí es donde modificás el nombre del evento
                detalles: `Venta #${counter.value} (${p.payment_method_id}) aprobada por ${p.transaction_amount}.`,
                req 
            });

        } else {
            // Rechazo
            if (io && socketId) {
                io.to(socketId).emit("paymentFailed", {
                    status: 'rejected',
                    message: getMotivoRechazo(p.status_detail)
                });
            }
        }

        pagosEnProceso.delete(paymentId);
        res.status(200).json({ message: "OK" });

    } catch (error) {
        console.error("❌ Error Crítico Webhook:", error.message);
        pagosEnProceso.delete(paymentId);
        res.status(200).json({ message: "Error" });
    }
};

/**
 * 3. CONSULTAR DETALLE
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