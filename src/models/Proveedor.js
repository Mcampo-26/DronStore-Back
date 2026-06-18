import { Schema, model } from 'mongoose';

const ProveedorSchema = new Schema({
  razonSocial: { 
    type: String, 
    required: true, 
    trim: true 
  },
  cuit: { 
    type: String, 
    required: true, 
    unique: true, 
    trim: true 
  },
  contactoNombre: { 
    type: String, 
    trim: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true,
    trim: true
  },
  telefono: { 
    type: String,
    trim: true 
  },
  direccion: {
    calle: String,
    ciudad: String,
    provincia: String
  },
  condicionIva: { 
    type: String, 
    enum: ['Responsable Inscripto', 'Monotributista', 'Exento'], 
    default: 'Responsable Inscripto' 
  },
  activo: { 
    type: Boolean, 
    default: true 
  }
}, { 
  timestamps: true 
});

const Proveedor = model('Proveedor', ProveedorSchema);
export default Proveedor;