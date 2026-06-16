import { Router } from 'express';
import { quoteShipping, createShippingDelivery } from '../../controllers/shippingControllers/index.js';

const router = Router();

// Endpoint para el checkout: calcula opciones de envío según CP y productos del carrito
router.post('/quote', quoteShipping);

// Endpoint para procesar el botón de "Confirmar Compra / Despacho"
router.post('/delivery', createShippingDelivery);

export default router;