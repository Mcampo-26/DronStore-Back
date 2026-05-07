import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    // El nombre del contador (ej: "numeroVenta", "numeroRemito")
    name: { 
      type: String, 
      required: true, 
      unique: true 
    },
    // El valor actual del contador
    value: { 
      type: Number, 
      default: 0 
    },
  },
  { 
    timestamps: true,
    versionKey: false // Opcional: elimina el __v de los documentos
  }
);

// Creamos el modelo
const Counter = mongoose.model("Counter", counterSchema);

export default Counter;