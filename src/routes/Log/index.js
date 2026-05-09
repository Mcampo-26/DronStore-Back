import express from 'express';
import { getLogs, postLog } from '../../controllers/logControllers/index.js';


const router = express.Router();
// Rutas de Auditoría Técnica
router.get('/', getLogs);      // Para alimentar la pantalla AuditPage
router.post('/', postLog);     // Para registrar nuevas acciones desde el cliente

export default router;