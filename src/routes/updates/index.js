import express from 'express';
import appEvents from '../../utilities/eventEmitter.js';

const router = express.Router();

const allowedOrigins = ['https://dronstore.netlify.app', 'http://localhost:5173'];

/**
 * Middleware de CORS específico para SSE
 * Centralizamos la lógica para evitar discrepancias entre GET y OPTIONS
 */
const sseCors = (req, res, next) => {
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        // Fallback seguro para evitar errores de cabecera vacía
        res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0]);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    next();
};

/**
 * Endpoint de Server-Sent Events (SSE)
 */
router.get('/', sseCors, (req, res) => {
    // 1. Configuración de cabeceras de streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform'); // no-transform es vital para compresión
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Evita el buffering en Nginx/Render
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // 2. Establecer la conexión inmediatamente
    res.flushHeaders(); 

    // Mensaje inicial (comentario SSE para mantener la conexión activa)
    res.write(': ok\n\n');

    // 3. Heartbeat (Latido) para evitar Timeouts de red (cada 25s)
    const keepAlive = setInterval(() => {
        if (!res.writableEnded) {
            res.write(': keep-alive\n\n');
        }
    }, 25000);

    // 4. Manejador de eventos global
    const sendUpdate = (data) => {
        if (!res.writableEnded) {
            // Estructura estándar: data: <string>\n\n
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    };

    // Escuchar emisiones de appEvents (User, Stock, etc.)
    appEvents.on('entity-updated', sendUpdate);

    // 5. Gestión de cierre de conexión
    req.on('close', () => {
        clearInterval(keepAlive);
        appEvents.off('entity-updated', sendUpdate);
        res.end();
    });

    // Manejo de errores de stream
    req.on('error', (err) => {
        console.error("SSE Stream Error:", err);
        clearInterval(keepAlive);
        appEvents.off('entity-updated', sendUpdate);
    });
});

export default router;