import { Schema, model } from 'mongoose';

const CartSchema = new Schema({
  usuario: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // Un solo carrito por usuario
  },
  items: [
    {
      producto: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
      },
      cantidad: {
        type: Number,
        required: true,
        min: [1, 'La cantidad no puede ser menor a 1'],
        default: 1
      }
    }
  ]
}, { timestamps: true });

export default model('Cart', CartSchema);