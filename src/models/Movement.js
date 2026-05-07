import { Schema, model } from 'mongoose';

const MovimientoSchema = new Schema({
  productoId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  loteCodigo: { type: String, required: true }, // A qué lote afectó
  tipo: { 
    type: String, 
    enum: ['ENTRADA', 'SALIDA', 'AJUSTE', 'VENCIDO', 'DEVOLUCION', 'AJUSTE_NEGATIVO'], // Agregamos el guion bajo
    required: true 
  },
  cantidad: { type: Number, required: true },
  
  // TRAZABILIDAD DE ORIGEN
  operador: { type: Schema.Types.ObjectId, ref: 'User' }, // Quién lo hizo (si fue manual)
  deviceId: { type: String }, // ID del cliente/navegador (para compras web)
  referenciaOperacion: { type: String }, // ID de Mercado Pago o ID de Factura
  
  notas: { type: String },
}, { timestamps: true });

export default model('Movimiento', MovimientoSchema);