import { Schema, model } from 'mongoose';

const CategorySchema = new Schema({
  name: {
    type: String,
    required: [true, 'El nombre de la categoría es obligatorio'],
    unique: true, // Evita que crees dos categorías duplicadas
    trim: true,   // Limpia espacios en blanco al inicio/final
    maxlength: [50, 'El nombre no puede exceder los 50 caracteres']
  },
  active: {
    type: Boolean,
    default: true // Permite desactivar categorías sin borrarlas físicamente
  }
}, { 
  timestamps: true // Crea campos createdAt y updatedAt automáticamente
});

/**
 * Middleware: Formato consistente
 * Convierte el nombre a: "Primera letra mayúscula y el resto minúscula"
 * Al no pasar 'next' como argumento, Mongoose entiende que es una función sincrónica
 * o que debe esperar a que termine la ejecución automáticamente.
 */
CategorySchema.pre('save', function() {
  if (this.name) {
    this.name = this.name.charAt(0).toUpperCase() + this.name.slice(1).toLowerCase();
  }
});

const Category = model('Category', CategorySchema);
export default Category;