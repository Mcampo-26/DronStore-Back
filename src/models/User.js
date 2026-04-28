import { Schema, model } from "mongoose";

const UsuarioSchema = new Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false }, // Mantenemos seguridad
  telefono: { type: String, default: "" },
  role: { type: Schema.Types.ObjectId, ref: 'Role', default: null },
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String, default: null },
  estado: { type: String, enum: ["activo", "inactivo"], default: "activo" },
}, {
  timestamps: { createdAt: 'creadoEl', updatedAt: 'actualizadoEl' }
});

export default model("Usuario", UsuarioSchema);