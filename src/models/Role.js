import mongoose from "mongoose";

const RoleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "El nombre del rol es obligatorio"],
      unique: true,
      trim: true,
      uppercase: true, 
    },
    permissions: {
      viewDash: { type: Boolean, default: false },
      viewUsuarios: { type: Boolean, default: false },
      viewRoles: { type: Boolean, default: false },
      viewStock: { type: Boolean, default: false },
      viewCarga: { type: Boolean, default: false },
      viewAuditoria: { type: Boolean, default: false },
      viewVentas: { type: Boolean, default: false },
      viewCategorias: { type: Boolean, default: false },
      // 🚀 AGREGAMOS LOS DOS CAMPOS LOGÍSTICOS FALTANTES ACÁ:
      viewProveedores: { type: Boolean, default: false },
      viewAlmacenes: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

RoleSchema.pre("save", function () {
  if (this.name) {
    this.name = this.name.trim().toUpperCase();
  }
});

const Role = mongoose.models.Role || mongoose.model("Role", RoleSchema);

export default Role;