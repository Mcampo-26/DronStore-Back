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
  producto: { type: Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
  cantidadTotal: { type: Number, default: 0 }, // Suma automática de todos los lotes
  ubicacion: { type: String, default: 'Almacén Central' },
  stockMinimo: { type: Number, default: 5 },
  lotes: [LoteSchema], // Trazabilidad por FIFO
}, { timestamps: true });

// Middleware para mantener cantidadTotal actualizada antes de guardar
StockSchema.pre('save', function() {
    this.cantidadTotal = this.lotes.reduce((acc, lote) => acc + lote.cantidad, 0);
    // No necesitas llamar a next() aquí si no hay lógica asíncrona compleja
  });
export default model('Stock', StockSchema);