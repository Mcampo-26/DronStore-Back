import mongoose from "mongoose";
import appEvents from "../utilities/eventEmitter.js"; // Importamos tu instancia de EventEmitter

const ventaSchema = new mongoose.Schema(
  {
    // Vinculación con el usuario (ObjectId de la colección Users)
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
     ref: "Usuario",
      required: true,
    },
    numeroVenta: {
      type: Number,
      unique: true,
      required: true,
    },
    items: [
      {
        productId: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: "Producto", 
          required: true 
        },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
        tipo: { 
          type: String, 
          enum: ["venta", "alquiler", "servicio"], 
          default: "venta" 
        }
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["approved", "rejected", "pending", "in_process"],
      default: "pending",
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    externalReference: {
      type: String,
      required: true,
    },
    // Información de facturación (opcional por si falla AFIP al momento)
    factura: {
      cae: String,
      vencimiento: Date,
      puntoVenta: Number,
      numero: Number,
    },
    metodoPago: {
      type: String,
      enum: ["mercadopago", "transferencia", "efectivo"],
      default: "mercadopago",
    }
  },
  { 
    timestamps: true,
    // Esto asegura que cuando conviertas a JSON se vea bien el ID
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Middleware de Mongoose: Se dispara después de guardar en la DB
ventaSchema.post("save", function (doc) {
  // Emitimos el evento a través de tu EventEmitter
  // Esto lo escucharemos en el controlador o donde necesitemos 
  // para disparar actualizaciones hacia el front (Pusher o similar)
  appEvents.emit("venta:actualizada", doc);
});

// Índice compuesto para búsquedas rápidas de ventas por usuario y estado
ventaSchema.index({ usuario: 1, status: 1 });

const Venta = mongoose.model("Venta", ventaSchema);
export default Venta;