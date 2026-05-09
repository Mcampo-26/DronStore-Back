import mongoose from 'mongoose';
// Importamos el usuario para asegurar que el Schema se registre antes del populate


const logSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario', // ✅ DEBE COINCIDIR con el nombre en Usuario.js
    required: true
  },
  accion: {
    type: String, 
    required: true
  },
  detalles: {
    type: String, 
    required: true
  },
  ip: String,
}, { timestamps: true });

export default mongoose.model('Log', logSchema);