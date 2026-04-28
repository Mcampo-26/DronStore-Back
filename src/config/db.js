import mongoose from 'mongoose';

// Usamos la variable de entorno que definimos en el .env
const MONGODB_URI = process.env.MONGO_URI; // Que coincida con tu .env

if (!MONGODB_URI) {
  throw new Error(
    'Por favor, definí la variable MONGO_URI en el archivo .env'
  );
}

const dbConnect = async () => {
  // En Express, verificamos el estado de la conexión directamente desde mongoose
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  const opts = {
    bufferCommands: false,
    maxPoolSize: 10,       // Máximo de conexiones simultáneas
    minPoolSize: 5,        // Mantiene 5 conexiones abiertas para evitar lag
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };

  try {
    const conn = await mongoose.connect(MONGODB_URI, opts);
    console.log(`🚀 MongoDB: Conexión caliente y lista en ${conn.connection.host}`);
    return conn;
  } catch (e) {
    console.error("❌ Error en la conexión a MongoDB:", e.message);
    // En el backend, si falla la base de datos, solemos cerrar el proceso
    process.exit(1);
  }
};

export default dbConnect;