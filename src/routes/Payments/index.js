import express from "express";
import { 
    createInteroperableQR, 
    receiveWebhook, 
    getDetallePago 
} from "../../controllers/PaymentsControllers/index.js";

const router = express.Router();

/**
 * RUTA: /api/payments/qr
 * DESCRIPCIÓN: Genera la orden en Mercado Pago y devuelve el string del QR.
 */
router.post("/qr", createInteroperableQR);

/**
 * RUTA: /api/payments/webhook
 * DESCRIPCIÓN: Endpoint que recibe las notificaciones automáticas de Mercado Pago (IPN).
 * NOTA: Esta ruta debe ser pública para que los servidores de MP puedan acceder.
 */
router.post("/webhook", receiveWebhook);

/**
 * RUTA: /api/payments/detalle/:paymentId
 * DESCRIPCIÓN: Consulta los datos extendidos de un pago aprobado o rechazado.
 */
router.get("/detalle/:paymentId", getDetallePago);

export default router;