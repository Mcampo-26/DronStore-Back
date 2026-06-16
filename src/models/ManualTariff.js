import { Schema, model } from "mongoose";

/**
 * 🗺️ ESQUEMA: ManualTariff
 * Almacena la matriz de costos y logística para transportes locales sin API.
 */
const ManualTariffSchema = new Schema({
  providerName: { type: String, required: true },       // Ej: "Transporte El Tucumanito"
  destinationZipCode: { type: String, required: true }, // Ej: "4113" (Trancas)
  destinationLocalities: [{ type: String }],            // Array de localidades que cubre ese CP (Ej: ["Trancas", "San Pedro"])
  
  // Rango de peso para segmentar repuestos chicos vs drones pesados
  minWeightKg: { type: Number, required: true, default: 0 },
  maxWeightKg: { type: Number, required: true, default: 5 },
  
  baseCost: { type: Number, required: true },           // Ej: 3500
  deliveryEstimate: { type: String, default: "Llega en 24 hs (Próximo viaje)" },
  
  // Link dinámico para soporte por WhatsApp que servirá de tracking
  trackingBaseUrl: { 
    type: String, 
    default: "https://wa.me/549381XXXXXXX?text=Hola,%20quiero%20saber%20el%20estado%20del%20envio%20guia%20" 
  }
}, {
  // Mantenemos tus mismos nombres de timestamps personalizados
  timestamps: { createdAt: 'creadoEl', updatedAt: 'actualizadoEl' }
});

// Índice compuesto para acelerar las búsquedas del cotizador en el checkout
ManualTariffSchema.index({ destinationZipCode: 1, minWeightKg: 1, maxWeightKg: 1 });

export default model("ManualTariff", ManualTariffSchema);