import express from 'express';
import appEvents from '../../utilities/eventEmitter.js';

const router = express.Router();
const allowedOrigins = ['https://dronstore.netlify.app', 'http://localhost:5173'];

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
        // ✅ Cambio 1: Verificar res.writable antes de escribir
        if (res.writable && !res.writableEnded) {
            res.write(': keep-alive\n\n');
        }
    }, 25000);

    const sendUpdate = (data) => {
        // ✅ Cambio 2: Try-catch para capturar el error de escritura en socket cerrado
        try {
            if (res.writable && !res.writableEnded) {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            }
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

    // ✅ Cambio 3: Escuchar 'finish' además de 'close'
    req.on('close', cleanup);
    res.on('finish', cleanup);
    
    // Manejo de errores de stream para no tumbar el proceso
    res.on('error', (err) => {
        if (err.code === 'ECONNRESET') {
            // Silenciamos el error común de desconexión
            return;
        }
        console.error("SSE Stream Error:", err);
        cleanup();
    });
});

export default router;