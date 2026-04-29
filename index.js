import 'dotenv/config';
import express from 'express';
import { createServer } from 'http'; // Necesario para mantener la estructura estándar
import cors from 'cors';
import morgan from 'morgan';
import dbConnect from './src/config/db.js';

// --- IMPORTACIÓN DE RUTAS ---
import routerUser from './src/routes/Users/User.js';
import routerAuth from './src/routes/Auth/Auth.js';
import routerProduct from './src/routes/Product/index.js';
import routerRoles from './src/routes/Roles/index.js';
import updateRoutes from './src/routes/updates/index.js';

const app = express();

// 1. Conexión a la Base de Datos
dbConnect();

// 2. Configuración de CORS Profesional
const whiteList = [
  'https://dronstore.netlify.app', 
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || whiteList.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por seguridad CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
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