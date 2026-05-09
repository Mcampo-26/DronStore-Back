import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGO_URI;

if (!MONGODB_URI) {
  throw new Error('Por favor, definí la variable MONGO_URI en el archivo .env');
}

const dbConnect = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  const opts = {
    bufferCommands: true,  // ✅ CAMBIADO A TRUE (Esto soluciona tu error)
    maxPoolSize: 10,
    minPoolSize: 5,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };

  try {
    const conn = await mongoose.connect(MONGODB_URI, opts);
    console.log(`🚀 MongoDB: Conexión caliente y lista en ${conn.connection.host}`);
    return conn;
  } catch (e) {
    console.error("❌ Error en la conexión a MongoDB:", e.message);
    process.exit(1);
  }
};

export default dbConnect;