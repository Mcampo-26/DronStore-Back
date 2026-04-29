import express from 'express';
import appEvents from '../../utilities/eventEmitter.js';

const router = express.Router();

/**
 * RUTA: GET /updates
 * DESCRIPCIÓN: Establece el canal de Server-Sent Events (SSE) para actualizaciones en tiempo real.
 */
router.get('/', (req, res) => {
    console.log('--- 📡 Intento de conexión SSE ---');
    console.log('Origin:', req.headers.origin);

    // Cabeceras manuales para asegurar el permiso
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // 🟢 Log de éxito en cabeceras
    console.log('✅ Cabeceras SSE enviadas al cliente');

    res.write(': ok\n\n');

    const sendUpdate = (data) => {
        console.log(`📦 Enviando actualización vía SSE: ${data.type}`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    appEvents.on('entity-updated', sendUpdate);

    req.on('close', () => {
        console.log('❌ Conexión SSE cerrada por el cliente');
        appEvents.off('entity-updated', sendUpdate);
        res.end();
    });
});
// ESTE ES EL EXPORT QUE NODE BUSCA EN TU INDEX.JS
export default router;