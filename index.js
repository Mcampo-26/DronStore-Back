import 'dotenv/config'; 
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import dbConnect from './src/config/db.js';

// --- IMPORTACIÓN DE RUTAS ---
import routerUser from './src/routes/User.js'; // El que ya tenías (CRUD)
import routerAuth from './src/routes/Auth.js'; // El nuevo para Login/Logout

const app = express();
const httpServer = createServer(app);

// Conectar a la base de datos
dbConnect();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// --- CONFIGURACIÓN DE SOCKETS ---
// Lo configuramos antes de las rutas para poder pasarlo a los controladores
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// Compartir 'io' con los controladores a través de app.locals
app.locals.io = io;

// --- DEFINICIÓN DE RUTAS MODULARES ---

// 1. Rutas de Sesión (Login, Logout)
app.use('/auth', routerAuth); 

// 2. Rutas de Gestión (Get, Post, Put, Delete)
app.use('/users', routerUser); 

// Ruta raíz de prueba
app.get('/', (req, res) => {
  res.send('Servidor Dron-Store Funcionando 🚀');
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});