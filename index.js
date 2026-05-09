import 'dotenv/config';
import express from 'express';
import { createServer } from 'http'; // Necesario para mantener la estructura estándar
import cors from 'cors';
import morgan from 'morgan';
import dbConnect from './src/config/db.js';

// --- IMPORTACIÓN DE RUTAS ---
import routerUser from './src/routes/Users/User.js';    // ✅ Cambiado de User.js a index.js
import routerAuth from './src/routes/Auth/Auth.js';     // ✅ Cambiado de Auth.js a index.js
import routerProduct from './src/routes/Product/index.js';
import routerRoles from './src/routes/Roles/index.js';     // ✅ R mayúscula coincide con la foto
import updateRoutes from './src/routes/updates/index.js';  
import contactRoutes from './src/routes/Contact/index.js';
import routerStock from './src/routes/Stock/index.js'
import routerCategory from './src/routes/Category/index.js'
import routerVentas from './src/routes/Ventas/index.js'
import routerPayments from './src/routes/Payments/index.js';
import routerCart from './src/routes/Cart/index.js';
import routerLog  from './src/routes/Log/index.js'

const app = express();

// 1. Conexión a la Base de Datos
dbConnect();

// 2. Configuración de CORS Profesional
const whiteList = [
  'https://dronstore.netlify.app', 
  'http://localhost:5173'
];

// 2. Configuramos el middleware de CORS
app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin 'origin' (como Postman, cURL o Server-to-Server)
    if (!origin) return callback(null, true);

    // Verificamos si el origen de la petición está en nuestra lista blanca
    if (whiteList.includes(origin)) {
      callback(null, true); // ✅ Acceso concedido
    } else {
      // 🔴 Acceso denegado: Esto quedará registrado en tus logs de Heroku
      console.error(`Bloqueo de seguridad CORS para el origen: ${origin}`);
      callback(new Error('No permitido por la política de seguridad CORS'));
    }
  },
  credentials: true, // Requerido para cookies/tokens y para que el SSE funcione bien
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// 3. Middlewares
app.use(express.json());
app.use(morgan('dev'));

// 4. Rutas Modulares
app.use('/auth', routerAuth); 
app.use('/users', routerUser); 
app.use('/products', routerProduct);
app.use('/roles', routerRoles); 
app.use('/updates', updateRoutes); // Aquí vive tu SSE
app.use('/contact', contactRoutes);
app.use("/stock", routerStock);
app.use("/category", routerCategory);
app.use("/ventas", routerVentas);
app.use("/Payments", routerPayments);
app.use("/cart", routerCart);
app.use("/log", routerLog);




// Ruta de Salud
app.get('/', (req, res) => {
  res.status(200).json({ status: 'online', service: 'Dron-Store SSE-Driven' });
});

// 5. Manejo de Errores Global
app.use((err, req, res, next) => {
  console.error("🔥 Error Detectado:", err.message);
  res.status(500).send({ success: false, message: err.message });
});

// 6. Lanzamiento (Heroku Compatible)
const PORT = process.env.PORT || 4000;

// IMPORTANTE: En la nube, '0.0.0.0' asegura que el tráfico externo llegue al servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 SERVIDOR SSE ACTIVO
  📡 Puerto: ${PORT}
  🌍 Whitelist: ${whiteList.join(', ')}
  `);
});