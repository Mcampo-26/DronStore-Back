import axios from 'axios';
import Venta from "../../models/Venta.js"; 
import Counter from '../../models/Counter.js';
import appEvents from "../../utilities/eventEmitter.js";

// 🔥 IMPORTACIÓN CORRECTA DE LA LIBRERÍA DE INVENTARIO
import { inventoryService } from "../../services/stock/inventoryService.js";

/**
 * 1. GENERAR QR INTEROPERABLE
 * Refactorizado para incluir Backup de Producto en la referencia externa.
 */
export const createInteroperableQR = async (req, res) => {
    const { title, items, totalAmount, expirationDate, socketId, userId } = req.body;

    // Validación de seguridad básica
    if (!title || !items || !totalAmount || !socketId || !userId) {
        return res.status(400).json({ success: false, message: "Datos incompletos (Falta Usuario o Socket)." });
    }

    const baseUrl = process.env.BACKEND_PUBLIC_URL;

    // 🔥 BACKUP ESTRATÉGICO: 
    // Extraemos el ID del producto desde los items que vienen del Store.
    const backupProductId = items[0]?.productId;

    const orderData = {
        // Blindamos la referencia: USER | SOCKET | PRODUCTO
        external_reference: `USER_${userId}|SOCKET_${socketId}|PROD_${backupProductId}`,
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
        res.status(500).json({ 
            success: false, 
            error: error.response?.data || "Error al conectar con Mercado Pago" 
        });
    }
};

/**
 * 2. WEBHOOK: RECIBIR NOTIFICACIÓN
 */
/**
 * 2. WEBHOOK: RECIBIR NOTIFICACIÓN
 */
export const receiveWebhook = async (req, res) => {
    const { type, data } = req.body;
    const paymentId = data?.id || req.query.id;

    console.log(`📩 Webhook recibido: Tipo [${type}] - ID [${paymentId}]`);
    
    if (type !== "payment" && req.query.topic !== "payment") {
        return res.sendStatus(200);
    }

    try {
        const ventaExistente = await Venta.findOne({ transactionId: paymentId });
        if (ventaExistente) {
            console.log(`⏭️ Pago ${paymentId} ya procesado.`);
            return res.sendStatus(200);
        }

        const response = await axios.get(
            `https://api.mercadopago.com/v1/payments/${paymentId}`,
            { headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_API_KEY}` } }
        );

        const p = response.data;
        if (p.status === "in_process") return res.sendStatus(200);

        const referenceParts = p.external_reference ? p.external_reference.split('|') : [];
        const userId = referenceParts[0]?.replace('USER_', '');
        const socketId = referenceParts[1]?.replace('SOCKET_', '');
        const productIdBackup = referenceParts[2]?.replace('PROD_', '');

        let items = [];
        if (p.order?.id) items = await obtenerItemsOrden(p.order.id);

        if (items.length === 0 && p.additional_info?.items) {
            items = p.additional_info.items.map(i => ({
                productId: i.id,
                name: i.title,
                price: parseFloat(i.unit_price),
                quantity: parseInt(i.quantity)
            }));
        }

        // Rescate del nombre (Para que no diga "Código QR")
        if (items.length === 0 || (items[0]?.name && items[0].name.toLowerCase().includes("qr"))) {
            console.log("🛠️ Limpiando nombre genérico detectado...");
            items = [{
                productId: productIdBackup || "600000000000000000000001", 
                name: (p.description && !p.description.toLowerCase().includes("qr")) 
                       ? p.description 
                       : "Unidad QDRON Especial",
                price: p.transaction_amount,
                quantity: 1
            }];
        }

        const counter = await Counter.findOneAndUpdate(
            { name: "numeroVenta" },
            { $inc: { value: 1 } },
            { returnDocument: 'after', upsert: true }
        );

        if (p.status === "approved") {
            // 🔥 CORRECCIÓN DEL ERROR DE ENUM:
            // Si el método es 'interop_transfer' u otro raro, guardamos 'mercadopago'
            // para que no falle la validación de tu modelo.
            const metodoFinal = p.payment_method_id === 'interop_transfer' 
                                ? 'mercadopago' 
                                : p.payment_method_id;

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
                metodoPago: metodoFinal // <-- Usamos el valor validado
            });

            const ventaFinal = await nuevaVenta.save();
            await ventaFinal.populate('usuario', 'nombre email');

            try {
                await inventoryService.deductStock(items);
            } catch (e) {
                console.error("❌ Error Stock:", e.message);
            }

            console.log(`🚀 Enviando VENTA_CREADA: #${ventaFinal.numeroVenta}`);
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
            appEvents.emit('entity-updated', {
                type: 'VENTA_RECHAZADA',
                payload: {
                    status: 'rejected',
                    message: getMotivoRechazo(p.status_detail),
                    socketId: socketId
                }
            });
        }

        res.status(200).json({ message: "OK" });

    } catch (error) {
        console.error("❌ Error Crítico Webhook:", error.message);
        // Respondemos 200 para que MP deje de insistir, pero logueamos el error.
        res.status(200).json({ message: "Error interno procesado" });
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