import Proveedor from "../../models/Proveedor.js";

export const createProveedor = async (req, res) => {
  try {
    const { razonSocial, cuit, contactoNombre, email, telefono, calle, ciudad, provincia, condicionIva } = req.body;

    if (!razonSocial || !cuit || !email) {
      return res.status(400).json({
        success: false,
        message: "La razón social, el CUIT y el email son campos obligatorios."
      });
    }

    const existeCuit = await Proveedor.findOne({ cuit });
    if (existeCuit) {
      return res.status(400).json({
        success: false,
        message: "Ya existe un proveedor registrado con ese CUIT."
      });
    }

    const nuevoProveedor = new Proveedor({
      razonSocial,
      cuit,
      contactoNombre,
      email,
      telefono,
      direccion: { calle, ciudad, provincia },
      condicionIva
    });

    await nuevoProveedor.save();

    return res.status(201).json({
      success: true,
      message: "Proveedor registrado con éxito.",
      payload: nuevoProveedor
    });
  } catch (error) {
    console.error("❌ Error en createProveedor:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getProveedores = async (req, res) => {
  try {
    // Traemos solo los proveedores activos (borrado lógico)
    const proveedores = await Proveedor.find({ activo: true }).sort({ razonSocial: 1 });
    return res.status(200).json({ success: true, payload: proveedores });
  } catch (error) {
    console.error("❌ Error en getProveedores:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
 };

export const updateProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const { razonSocial, contactoNombre, email, telefono, calle, ciudad, provincia, condicionIva } = req.body;

    const proveedor = await Proveedor.findById(id);
    if (!proveedor) {
      return res.status(404).json({ success: false, message: "Proveedor no encontrado." });
    }

    proveedor.razonSocial = razonSocial || proveedor.razonSocial;
    proveedor.contactoNombre = contactoNombre || proveedor.contactoNombre;
    proveedor.email = email || proveedor.email;
    proveedor.telefono = telefono || proveedor.telefono;
    if (calle || ciudad || provincia) {
      proveedor.direccion = {
        calle: calle || proveedor.direccion.calle,
        ciudad: ciudad || proveedor.direccion.ciudad,
        provincia: provincia || proveedor.direccion.provincia
      };
    }
    proveedor.condicionIva = condicionIva || proveedor.condicionIva;

    await proveedor.save();

    return res.status(200).json({
      success: true,
      message: "Proveedor actualizado correctamente.",
      payload: proveedor
    });
  } catch (error) {
    console.error("❌ Error en updateProveedor:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteProveedor = async (req, res) => {
  try {
    const { id } = req.params;

    // Aplicamos borrado lógico para no romper el historial de compras/ventas pasadas
    const proveedor = await Proveedor.findByIdAndUpdate(id, { activo: false }, { new: true });
    
    if (!proveedor) {
      return res.status(404).json({ success: false, message: "Proveedor no encontrado." });
    }

    return res.status(200).json({
      success: true,
      message: "Proveedor dado de baja correctamente."
    });
  } catch (error) {
    console.error("❌ Error en deleteProveedor:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};