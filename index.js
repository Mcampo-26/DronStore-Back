import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import dbConnect from './src/config/db.js';

// --- IMPORTACIÓN DE RUTAS ---
import routerUser from './src/routes/User.js';
import routerAuth from './src/routes/Auth.js';

const app = express();
const httpServer = createServer(app);

// 1. Conexión a la Base de Datos
dbConnect();

// 2. Configuración de CORS (BUENA PRÁCTICA)
// Esto permite que Netlify y tu Localhost se conecten sin bloqueos
const whiteList = [
  'https://dronstore.netlify.app', 
  'http://localhost:5173',
  'http://localhost:4000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir peticiones sin origen (como Postman) o las de la WhiteList
    if (!origin || whiteList.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS - DronStore Security'));
    }
  },
  credentials: true
}));

// 3. Middlewares Estándar
app.use(express.json());
app.use(morgan('dev'));

// 4. Configuración de Socket.io
// Usamos la misma lógica de CORS para los Sockets
const io = new Server(httpServer, {
  cors: {
    origin: whiteList,
    methods: ["GET", "POST"]
  }
});

// Compartir 'io' globalmente
app.locals.io = io;

// 5. Rutas Modulares
app.use('/auth', routerAuth); 
app.use('/users', routerUser); 

// Ruta raíz de salud (Health Check)
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Servidor Dron-Store Funcionando 🚀',
    version: '1.0.0'
  });
});

// 6. Manejo de Errores Global (BUENA PRÁCTICA)
// Captura cualquier error que no hayas manejado en los controladores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({
    success: false,
    message: 'Ocurrió un error interno en el servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 7. Lanzamiento del Servidor
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`
  ################################################
  🚀 Servidor listo en el puerto: ${PORT}
  📡 URL Local: http://localhost:${PORT}
  ✅ CORS configurado para: ${whiteList.join(', ')}
  ################################################
  `);
});