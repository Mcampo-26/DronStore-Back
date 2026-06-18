import 'dotenv/config';
import express from 'express';
import { createServer } from 'http'; 
import { Server } from 'socket.io';  
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
import routerDashboard from './src/routes/DashBoard/index.js';
import userProductRoutes from "./src/routes/UserProduct/index.js";
import shippingRoutes from './src/routes/shipping/index.js'; 
import almacenRoutes from './src/routes/Almacen/index.js';
import proveedorRoutes from './src/routes/Proveedor/index.js';
import reporteRoutes from './src/routes/Reportes/index.js';
// (Ajustá la ruta del import según dónde tengas la carpeta de rutas respecto a este archivo)
const app = express();

// --- 1. CONFIGURACIÓN DEL SERVIDOR HTTP & SOCKET.IO ---
const httpServer = createServer(app); 

const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "https://dronstore.netlify.app"],
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000, 
  pingInterval: 25000, 
  connectTimeout: 45000 
});

app.locals.io = io;

io.on('connection', (socket) => {
  console.log(`🔌 Dispositivo vinculado: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`❌ Dispositivo desconectado: ${socket.id}`);
  });
});

// --- 2. BASE DE DATOS ---
dbConnect();

// --- 3. CONFIGURACIÓN DE CORS BLINDADA (Solución imagen_19.png) ---
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
  // 🔥 Cabeceras añadidas para estabilizar el flujo SSE y evitar bloqueos de navegador
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'Accept', 
    'Cache-Control', 
    'Pragma'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
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
app.use("/shipping", shippingRoutes);
app.use("/log", routerLog);
app.use("/admin/dashboard", routerDashboard);
app.use("/my-products", userProductRoutes);
app.use('/almacenes', almacenRoutes);
app.use('/proveedores', proveedorRoutes);
app.use('/reportes', reporteRoutes);


app.get('/', (req, res) => {
  res.status(200).json({ status: 'online', service: 'Dron-Store Hybrid (Socket+SSE)' });
});

// --- 6. LANZAMIENTO ---
const PORT = process.env.PORT || 4000;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 SERVIDOR HÍBRIDO ACTIVO
  📡 Sockets: Funcionando
  ⚡ SSE: Funcionando
  🌍 Puerto: ${PORT}
  `);
});