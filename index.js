import 'dotenv/config';
import express from 'express';
import { createServer } from 'http'; // 👈 IMPORTANTE: Para crear el servidor real
import { Server } from 'socket.io';   // 👈 IMPORTANTE: Para los sockets
import cors from 'cors';
import morgan from 'morgan';
import dbConnect from './src/config/db.js';

// --- IMPORTACIÓN DE RUTAS ---
import routerUser from './src/routes/Users/User.js';
import routerAuth from './src/routes/Auth/Auth.js';
import routerProduct from './src/routes/Product/index.js';
import routerRoles from './src/routes/Roles/index.js';
import updateRoutes from './src/routes/updates/index.js';
import contactRoutes from './src/routes/Contact/index.js';
import routerStock from './src/routes/Stock/index.js';
import routerCategory from './src/routes/Category/index.js';
import routerVentas from './src/routes/Ventas/index.js';
import routerPayments from './src/routes/Payments/index.js';
import routerCart from './src/routes/Cart/index.js';
import routerLog from './src/routes/Log/index.js';

const app = express();

// --- 1. CONFIGURACIÓN DEL SERVIDOR HTTP & SOCKET.IO ---
const httpServer = createServer(app); // ✅ Definimos httpServer envolviendo a app

const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "https://tu-app.netlify.app"],
    methods: ["GET", "POST"],
    credentials: true
  },
  // 🔥 AJUSTES DE ESTABILIDAD 2026
  pingTimeout: 60000, // 60 segundos (Heroku suele cerrar conexiones inactivas rápido)
  pingInterval: 25000, // Latido cada 25s para mantener el túnel abierto
  connectTimeout: 45000 // Tiempo de espera para la conexión inicial
});

// Compartimos 'io' para usarlo en los controladores de pagos (req.app.locals.io)
app.locals.io = io;

// Lógica de conexión de sockets
io.on('connection', (socket) => {
  console.log(`🔌 Dispositivo vinculado: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`❌ Dispositivo desconectado: ${socket.id}`);
  });
});

// --- 2. BASE DE DATOS ---
dbConnect();

// --- 3. CONFIGURACIÓN DE CORS ---
const whiteList = ['https://dronstore.netlify.app', 'http://localhost:5173'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (whiteList.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// --- 4. MIDDLEWARES ---
app.use(express.json());
app.use(morgan('dev'));

// --- 5. RUTAS MODULARES ---
app.use('/auth', routerAuth);
app.use('/users', routerUser);
app.use('/products', routerProduct);
app.use('/roles', routerRoles);
app.use('/updates', updateRoutes);
app.use('/contact', contactRoutes);
app.use("/stock", routerStock);
app.use("/category", routerCategory);
app.use("/ventas", routerVentas);
app.use("/Payments", routerPayments);
app.use("/cart", routerCart);
app.use("/log", routerLog);

app.get('/', (req, res) => {
  res.status(200).json({ status: 'online', service: 'Dron-Store Hybrid (Socket+SSE)' });
});

// --- 6. LANZAMIENTO ---
const PORT = process.env.PORT || 4000;

// 🔥 IMPORTANTE: Usamos httpServer.listen, NO app.listen
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 SERVIDOR HÍBRIDO ACTIVO
  📡 Sockets: Funcionando
  ⚡ SSE: Funcionando
  🌍 Puerto: ${PORT}
  `);
});