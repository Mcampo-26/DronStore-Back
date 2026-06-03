import express from 'express';
import appEvents from '../../utilities/eventEmitter.js';
import Log from '../../models/Log.js'; // 🚀 Importamos el modelo para persistir los logs en DB
import Product from '../../models/Product.js'; // 🚀 Importamos para recuperar el nombre del dron/insumo

const router = express.Router();
const allowedOrigins = ['https://dronstore.netlify.app', 'http://localhost:5173'];

// ID genérico de sistema para satisfacer el path relacional obligatorio 'usuario: required' de Mongoose
const SYSTEM_USER_ID = "000000000000000000000000";

const sseCors = (req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Outputs', 'Content-Type'); // Expose headers en minúscula o nativo
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
};

router.get('/', sseCors, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    res.flushHeaders();
    res.write(': ok\n\n');

    const keepAlive = setInterval(() => {
        if (res.writable) {
            res.write(': heartbeat\n\n'); 
        }
    }, 20000);

    // Convertimos a función asíncrona para poder consultar MongoDB al interceptar stock
    const sendUpdate = async (data) => {
        try {
            if (!res.writable || res.writableEnded) return;

            const { type, payload } = data;

            // 🚀 INTERCEPTOR EN CALIENTE: Si es ajuste plano de stock, creamos el Log físico en MongoDB Atlas
            if (type === 'STOCK_UPDATED' && payload?.productId) {
                try {
                    const producto = await Product.findById(payload.productId).lean();
                    const nombreProducto = producto?.name || "Insumo / Componente";

                    // 1. Guardamos físicamente el registro de auditoría para que resista el F5
                    const dbLog = new Log({
                        usuario: SYSTEM_USER_ID,
                        accion: `PRODUCT_UPDATED: Ajuste manual de stock en [${nombreProducto}]`,
                        detalles: `Código de producto afectado: ${payload.productId}.`
                    });
                    await dbLog.save();

                    // 2. Transmitimos al cliente el evento unificado compatible con useLogSubscriber (Caso 1)
                    res.write(`data: ${JSON.stringify({ type: 'PRODUCT_UPDATED', payload: dbLog })}\n\n`);
                } catch (dbErr) {
                    console.error("❌ Error guardando log persistente en el puente SSE:", dbErr);
                }
            }

            // Retransmitimos siempre el evento original (para actualizar la grilla del stockStore)
            res.write(`data: ${JSON.stringify(data)}\n\n`);

        } catch (err) {
            console.error("Error escribiendo en el stream:", err.code);
            cleanup();
        }
    };

    // Función de limpieza centralizada
    const cleanup = () => {
        clearInterval(keepAlive);
        appEvents.off('entity-updated', sendUpdate);
        if (!res.writableEnded) res.end();
    };

    appEvents.on('entity-updated', sendUpdate);

    req.on('close', cleanup);
    res.on('finish', cleanup);
    
    res.on('error', (err) => {
        if (err.code === 'ECONNRESET') {
            return;
        }
        console.error("SSE Stream Error:", err);
        cleanup();
    });
});

export default router;