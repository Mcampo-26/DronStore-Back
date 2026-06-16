import { Schema, model } from "mongoose";

/**
 * 📦 ESQUEMA: DefaultShipping
 * Registra la transacción de compra enfocada en el control del envío, 
 * el estado del correo en tiempo real y los datos de tracking.
 */
const DefaultShippingSchema = new Schema({
  usuarioId: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  
  // Estructura limpia del carrito al momento de la compra
  products: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    pesoKg: { type: Number, required: true }
  }],
  
  totalProductsPrice: { type: Number, required: true },
  totalOrderPrice: { type: Number, required: true }, // Productos + Costo de Envío

  // 🚚 Bloque operativo para el control del Correo / Logística
  shipping: {
    address: {
      alias: { type: String },
      calle: { type: String, required: true },
      numero: { type: String, required: true },
      pisoDepto: { type: String },
      localidad: { type: String, required: true },
      provincia: { type: String, required: true },
      codigoPostal: { type: String, required: true }
    },
    providerName: { type: String, required: true },      // Ej: "Andreani" o "Transporte El Tucumanito"
    serviceType: { type: String, required: true },       // Ej: "Micro-Logística Express" o "Carga Pesada"
    cost: { type: Number, required: true },              // Costo cobrado por el envío
    deliveryEstimate: { type: String, required: true },  // Plazo prometido
    
    // Control de tracking en tiempo real para el cliente y el Hangar
    status: { 
      type: String, 
      enum: ["pending", "preparing", "dispatched", "in_transit", "delivered", "cancelled"], 
      default: "pending" 
    },
    trackingCode: { type: String, default: null },       // Generado por API o cargado a mano
    trackingUrl: { type: String, default: null }         // Enlace final (Web de Andreani o WhatsApp del chofer)
  }
}, {
  // Mantenemos tus timestamps personalizados de siempre
  timestamps: { createdAt: 'creadoEl', updatedAt: 'actualizadoEl' }
});

// Índices optimizados para las consultas en tiempo real del Dashboard
DefaultShippingSchema.index({ "shipping.status": 1 });
DefaultShippingSchema.index({ usuarioId: 1 });

export default model("DefaultShipping", DefaultShippingSchema);