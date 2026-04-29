import mongoose from "mongoose";

const RoleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre del rol es obligatorio"],
      unique: true,
      trim: true,
      uppercase: true, // Esto ya lo intenta formatear, pero el middleware asegura el tiro
    },
    permissions: {
      viewDash: { type: Boolean, default: false },
      viewUsuarios: { type: Boolean, default: false },
      viewRoles: { type: Boolean, default: false },
      viewStock: { type: Boolean, default: false },
      viewCarga: { type: Boolean, default: false },
      viewAuditoria: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/**
 * Middleware Pre-Save (Estándar 2026)
 * Limpia y estandariza el nombre antes de guardarlo en la DB.
 * Al no usar 'next', Mongoose entiende que es una operación síncrona
 * o basada en promesas y continúa automáticamente.
 */
RoleSchema.pre("save", function () {
  if (this.name) {
    this.name = this.name.trim().toUpperCase();
  }
});

const Role = mongoose.models.Role || mongoose.model("Role", RoleSchema);

export default Role;