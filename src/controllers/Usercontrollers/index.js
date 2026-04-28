import Usuario from '../../models/User.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export const createUsuario = async (req, res) => {
  try {
    const { nombre, email, password, telefono, role } = req.body;

    const existe = await Usuario.findOne({ email });
    if (existe) return res.status(400).json({ message: 'El email ya existe' });

    // Hashing manual (estilo tu proyecto anterior, evita error de 'next')
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const nuevoUsuario = new Usuario({
      nombre,
      email,
      telefono,
      password: hashedPassword,
      role: role || null,
      verificationCode
    });

    await nuevoUsuario.save();
    res.status(201).json({ message: "Creado con éxito", usuario: nuevoUsuario });
  } catch (error) {
    res.status(500).json({ message: "Error al crear", error: error.message });
  }
};

export const getUsuarios = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const usuarios = await Usuario.find()
            .populate('role', 'name')
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit));
        
        const total = await Usuario.countDocuments();
        res.json({ usuarios, total, totalPages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json({ message: "Error al obtener" });
    }
};


export const updateUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const datosActualizados = req.body;

        // Si se intenta actualizar el password, hay que hashearlo manualmente
        if (datosActualizados.password) {
            const salt = await bcrypt.genSalt(10);
            datosActualizados.password = await bcrypt.hash(datosActualizados.password, salt);
        }

        const usuarioActualizado = await Usuario.findByIdAndUpdate(
            id,
            { $set: datosActualizados },
            { new: true, runValidators: true }
        ).populate('role', 'name');

        if (!usuarioActualizado) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        res.json({ 
            success: true, 
            message: 'Usuario actualizado correctamente', 
            usuario: usuarioActualizado 
        });

    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
    }
};

// ❌ ELIMINAR usuario
export const deleteUsuario = async (req, res) => {
    try {
        const { id } = req.params;

        const usuarioEliminado = await Usuario.findByIdAndDelete(id);

        if (!usuarioEliminado) {
            return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }

        res.json({ 
            success: true, 
            message: 'Usuario eliminado correctamente' 
        });

    } catch (error) {
        console.error("Error al eliminar usuario:", error);
        res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
    }
};