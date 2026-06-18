// models/Almacen.js
import mongoose from 'mongoose';

const AlmacenSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  direccion: {
    calle: String,
    ciudad: String,
    provincia: String
  },
  ubicacion: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  },
  existencias: [{
    productoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // Ajustado ref a 'Product' para coincidir con tu modelo
    cantidad: { type: Number, default: 0 },
    posicionFisica: String
  }]
}, { timestamps: true });

AlmacenSchema.index({ ubicacion: '2dsphere' });

const Almacen = mongoose.model('Almacen', AlmacenSchema);
export default Almacen;