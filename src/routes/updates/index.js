import express from 'express';
import appEvents from '../../utilities/eventEmitter.js';

const router = express.Router();

/**
 * RUTA: GET /updates
 * Canal SSE dinámico con Variables de Entorno
 */
router.get('/', (req, res) => {
    const origin = req.headers.origin;

    // Si el origen es válido, lo usamos exactamente como viene
    if (origin && (origin === 'https://dronstore.netlify.app' || origin === 'http://localhost:5173')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
        // Fallback de seguridad
        res.setHeader('Access-Control-Allow-Origin', 'https://dronstore.netlify.app');
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Heartbeat inicial
    res.write(': ok\n\n');

    // Mantenemos la conexión viva para Heroku
    const keepAlive = setInterval(() => {
        res.write(': keep-alive\n\n');
    }, 25000);

    const sendUpdate = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    appEvents.on('entity-updated', sendUpdate);

    req.on('close', () => {
        clearInterval(keepAlive);
        appEvents.off('entity-updated', sendUpdate);
        console.log("❌ Conexión SSE cerrada");
    });
});

export default router;