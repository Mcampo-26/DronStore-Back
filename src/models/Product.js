import { Schema, model } from 'mongoose';

const ProductSchema = new Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true }, // Precio de VENTA
  
  // Las 3 imágenes que mencionaste
  image: { type: String, required: true },
  image2: { type: String },
  image3: { type: String },
  
  // CORRECCIÓN: Ahora es una referencia al modelo de Category
  category: { 
    type: Schema.Types.ObjectId, 
    ref: 'Category', 
    required: true 
  },
  
  /* Mantenemos 'stock' como un campo directo por ahora.
     Más adelante, cuando hagamos la lógica de Stock avanzada, 
     este campo servirá para mostrar el disponible rápido.
  */
  stock: { type: Number, default: 0 },
  
  // Campos de oferta para el carrusel o banners
  isOferta: { type: Boolean, default: false },
  descuento: { type: Number, default: 0 }, 
}, { 
  timestamps: true 
});

// En Express, simplemente exportamos el modelo directamente
const Product = model('Product', ProductSchema);
export default Product;