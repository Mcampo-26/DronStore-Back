import { Router } from 'express';
import { quoteShipping, createShippingDelivery } from '../../controllers/shippingControllers/index.js';
import { verifyToken } from '../../middlewares/auth.middleware.js';

const router = Router();

// Pública por UX: El cliente simula el costo de envío con su CP antes de iniciar sesión
router.post('/quote', quoteShipping);

// Privada por Seguridad: Solo un usuario logueado puede generar una orden de despacho real
router.post('/delivery', verifyToken, createShippingDelivery);

export default router;