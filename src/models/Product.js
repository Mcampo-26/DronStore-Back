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
  stock: { type: Number, default: 0 },  
  isOferta: { type: Boolean, default: false },
  descuento: { type: Number, default: 0 }, 
  
  // 🚀 CLAVE SENIOR: Establecemos la relación multiusuario.
  // Guardamos el ObjectId del usuario dueño del producto apuntando al modelo 'User'.
  // Lo dejamos como opcional (sin required: true) para que los productos viejos que ya 
  // tenés cargados en tu base de datos no tiren error de validación al iniciar.
  usuarioId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true // ⚡️ Agregamos un índice para que MongoDB busque a la velocidad de la luz al filtrar en el panel privado
  },

  embedding: {
    type: [Number], 
    default: []     
  }

}, { 
  timestamps: true 
});

// Exportamos el modelo único directamente
const Product = model('Product', ProductSchema);
export default Product;