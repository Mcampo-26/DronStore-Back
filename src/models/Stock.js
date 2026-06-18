import { Schema, model } from 'mongoose';

const LoteSchema = new Schema({
  codigo: { type: String, required: true }, // Ej: LOTE-2026-001
  cantidad: { type: Number, required: true, min: 0 },
  costoUnitario: { type: Number, default: 0 },
  fechaIngreso: { type: Date, default: Date.now },
  fechaVencimiento: { type: Date },
  proveedorId: { type: Schema.Types.ObjectId, ref: 'Provider' }
});

const StockSchema = new Schema({
  producto: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  cantidadTotal: { type: Number, default: 0 }, // Suma automática de todos los lotes
  ubicacion: { type: String, default: 'Almacén Central' },
  stockMinimo: { type: Number, default: 5 },
  almacen: { 
    type: Schema.Types.ObjectId, 
    ref: 'Almacen', 
    required: true 
  },
  lotes: [LoteSchema], // Trazabilidad por FIFO
}, { timestamps: true });

// 🚀 DEFINICIÓN DEL ÍNDICE COMPUESTO MULTI-ALMACÉN
StockSchema.index({ producto: 1, almacen: 1 }, { unique: true });

// 🛠️ REPARADO: Al ser síncrono, operamos directo sobre "this" sin invocar a "next"
StockSchema.pre('save', function() {
  this.cantidadTotal = this.lotes.reduce((acc, lote) => acc + lote.cantidad, 0);
});

export default model('Stock', StockSchema);