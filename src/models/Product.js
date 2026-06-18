import { Schema, model } from 'mongoose';

const ProductSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },

  image: { type: String, required: true },
  image2: { type: String },
  image3: { type: String },
  category: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  stock: { type: Number, default: 0 }, // Puede servir como stock global total
  isOferta: { type: Boolean, default: false },
  descuento: { type: Number, default: 0 },
  peso_gramos: {
    type: Number,
    default: 0
  },

  usuarioId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  embedding: {
    type: [Number],
    default: []
  }, // <--- ¡Agregada la coma que faltaba acá!
  
  proveedorId: { 
    type: Schema.Types.ObjectId, // Simplificado para usar la importación de arriba
    ref: 'Proveedor', 
    required: true 
  }

}, {
  timestamps: true
});

// Exportamos el modelo único directamente
const Product = model('Product', ProductSchema);
export default Product;