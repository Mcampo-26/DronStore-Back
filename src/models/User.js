import { Schema, model } from "mongoose";

// Sub-schema para manejar múltiples domicilios de entrega o facturación
const DomicilioSchema = new Schema({
  alias: { type: String, default: "Mi Campo / Lote" }, // Ej: "Finca Leales", "Oficina Central"
  calle: { type: String, required: true },
  numero: { type: String, required: true },
  pisoDepto: { type: String, default: "" },
  localidad: { type: String, required: true },        // Ej: "Trancas", "San Miguel de Tucumán"
  provincia: { type: String, required: true },        // Ej: "Tucumán"
  codigoPostal: { type: String, required: true },     // ¡Clave absoluta para Andreani / OCA!
  indicaciones: { type: String, default: "" },       // Ej: "Entrada por portón verde frente a la ruta"
  esPrincipal: { type: Boolean, default: false }      // Para precargar automáticamente en el Checkout
});

const UsuarioSchema = new Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false }, 
  telefono: { type: String, default: "" },             // Teléfono principal que impactará en el checkout
  role: { type: Schema.Types.ObjectId, ref: 'Role', default: null },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String, default: null },
  estado: { type: String, enum: ["activo", "inactivo"], default: "activo" },
  
  // 🚀 Definimos el tipo como array de DomicilioSchema y le clavamos el default vacío.
  // Esto blinda tu panel de administración al crear usuarios sin direcciones iniciales.
  domicilios: { type: [DomicilioSchema], default: [] }
}, {
  timestamps: { createdAt: 'creadoEl', updatedAt: 'actualizadoEl' }
});

export default model("Usuario", UsuarioSchema);