// models/Almacen.js
import mongoose from 'mongoose';

const AlmacenSchema = new mongoose.Schema({
  // 🚀 EL CERROJO DE SEGURIDAD: Vincula el almacén al usuario dueño
  usuarioId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, "El almacén debe estar vinculado a un usuario/proveedor"] 
  },
  nombre: { type: String, required: true },
  direccion: {
    calle: String,
    ciudad: String,
    provincia: String
  },
  ubicacion: {
    type: { type: String, default: 'Point' },
    coordinates: [Number] // [longitud, latitud]
  },
  existencias: [{
    productoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    cantidad: { type: Number, default: 0 },
    posicionFisica: String
  }]
}, { timestamps: true });

AlmacenSchema.index({ ubicacion: '2dsphere' });

const Almacen = mongoose.model('Almacen', AlmacenSchema);
export default Almacen;