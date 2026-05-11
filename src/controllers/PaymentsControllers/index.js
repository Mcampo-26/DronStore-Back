import axios from 'axios';
import Venta from "../../models/Venta.js"; 
import Counter from '../../models/Counter.js';
import appEvents from "../../utilities/eventEmitter.js";
import { inventoryService } from "../../services/stock/inventoryService.js";

// 🔥 ESCUDO DE IDEMPOTENCIA: Memoria RAM para bloquear ráfagas simultáneas
const pagosEnProceso = new Set();

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

    // 🕒 EXPIRACIÓN 40 SEG
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
 * 2. WEBHOOK: RECIBIR NOTIFICACIÓN (CON RE-EMISIÓN PARA LOGS)
 */
export const receiveWebhook = async (req, res) => {
    const { type, data } = req.body;
    const paymentId = data?.id || req.query.id || req.query['data.id'];

    if (!paymentId) return res.sendStatus(200);

    // 🛡️ PASO 1 IDEMPOTENCIA: Bloqueo de ráfaga en RAM
    if (pagosEnProceso.has(paymentId)) {
        console.log(`⏳ Notificación en proceso: ${paymentId}`);
        return res.sendStatus(200); 
    }
    pagosEnProceso.add(paymentId);

    console.log(`📩 Webhook recibido: Tipo [${type || req.query.topic}] - ID [${paymentId}]`);
    
    if (type !== "payment" && req.query.topic !== "payment") {
        pagosEnProceso.delete(paymentId);
        return res.sendStatus(200);
    }

    try {
        // 🛡️ PASO 2: Verificación en Base de Datos + RE-EMISIÓN DE LOGS 🔥
        const ventaExistente = await Venta.findOne({ transactionId: paymentId }).populate('usuario', 'nombre email');
        if (ventaExistente) {
            console.log(`⏭️ Re-emitiendo evento para pago ya procesado: ${paymentId}`);
            
            // Si Mercado Pago vuelve a avisar, re-gritamos al Front por si el SSE falló antes
            appEvents.emit('entity-updated', {
                type: 'VENTA_CREADA',
                payload: {
                    status: 'approved',
                    transactionId: paymentId,
                    numeroVenta: ventaExistente.numeroVenta,
                    totalAmount: ventaExistente.totalAmount,
                    socketId: ventaExistente.socketId,
                    venta: ventaExistente 
                }
            });

            pagosEnProceso.delete(paymentId);
            return res.sendStatus(200);
        }

        // Consultar detalle del pago a Mercado Pago
        const response = await axios.get(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_API_KEY}` } }
        );

        const p = response.data;

        // Si el estado es procesando, liberamos RAM y esperamos el próximo aviso
        if (p.status === "in_process" || p.status === "pending") {
            console.log(`⏳ Pago ${paymentId} en estado: ${p.status}. Liberando para reintento.`);
            pagosEnProceso.delete(paymentId);
            return res.sendStatus(200);
        }

        // Extracción de datos de referencia
        const referenceParts = p.external_reference ? p.external_reference.split('|') : [];
        const userId = referenceParts[0]?.replace('USER_', '');
        const socketId = referenceParts[1]?.replace('SOCKET_', '');
        const productIdBackup = referenceParts[2]?.replace('PROD_', '');
        const productNameBackup = referenceParts[3]?.replace('NAME_', '');

        let items = [];
        if (p.order?.id) items = await obtenerItemsOrden(p.order.id);

        if (items.length === 0 && p.additional_info?.items?.length > 0) {
            items = p.additional_info.items.map(i => ({
                productId: i.id,
                name: i.title,
                price: parseFloat(i.unit_price),
                quantity: parseInt(i.quantity)
            }));
        }

        // Rescate de nombre para logs
        const esNombreGenerico = (n) => !n || n.toLowerCase().includes("qr") || n.toLowerCase().includes("qdron store");
        if (items.length === 0 || esNombreGenerico(items[0]?.name)) {
            const nombreRescatado = productNameBackup || p.description || "Unidad QDRON Sincronizada";
            items = [{
                productId: productIdBackup || "600000000000000000000001", 
                name: nombreRescatado.replace(/Adquisición QDRON:|Adquisición:/gi, '').trim(),
                price: p.transaction_amount,
                quantity: 1
            }];
        }

        if (p.status === "approved") {
            // Incrementar contador de ventas
            const counter = await Counter.findOneAndUpdate(
                { name: "numeroVenta" },
                { $inc: { value: 1 } },
                { returnDocument: 'after', upsert: true }
            );

            const metodosPermitidos = ['mercadopago', 'efectivo', 'transferencia', 'credit_card', 'debit_card']; 
            const metodoFinal = metodosPermitidos.includes(p.payment_method_id) ? p.payment_method_id : 'mercadopago';

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
                impresa: false,
                metodoPago: metodoFinal 
            });

            const ventaFinal = await nuevaVenta.save();
            await ventaFinal.populate('usuario', 'nombre email');

            // 📉 Descuento de stock en DB
            try {
                await inventoryService.deductStock(items);
                console.log("✅ Stock actualizado en DB");
            } catch (e) {
                console.error("❌ Error Stock:", e.message);
            }

            // 🚀 EMISIÓN SSE (Avisamos al Front)
            console.log(`🚀 VENTA_CREADA: #${ventaFinal.numeroVenta} - Emitiendo evento`);
            appEvents.emit('entity-updated', {
                type: 'VENTA_CREADA',
                payload: {
                    status: 'approved',
                    transactionId: paymentId,
                    numeroVenta: counter.value,
                    totalAmount: p.transaction_amount,
                    socketId: socketId,
                    venta: ventaFinal 
                }
            });

        } else {
            // Notificar rechazo
            appEvents.emit('entity-updated', {
                type: 'VENTA_RECHAZADA',
                payload: {
                    status: 'rejected',
                    message: getMotivoRechazo(p.status_detail),
                    socketId: socketId
                }
            });
        }

        pagosEnProceso.delete(paymentId);
        res.status(200).json({ message: "OK" });

    } catch (error) {
        console.error("❌ Error Crítico Webhook:", error.message);
        pagosEnProceso.delete(paymentId);
        res.status(200).json({ message: "Error procesado" });
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