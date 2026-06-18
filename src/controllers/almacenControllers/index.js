import Almacen from '../../models/Almacen.js';


export const createAlmacen = async (req, res) => {
  try {
    const { nombre, calle, ciudad, provincia, longitud, latitud } = req.body;

    if (!nombre || !longitud || !latitud) {
      return res.status(400).json({ 
        success: false, 
        message: "El nombre y las coordenadas geográficas son obligatorios." 
      });
    }

    const nuevoAlmacen = new Almacen({
      nombre,
      direccion: { calle, ciudad, provincia },
      ubicacion: {
        type: 'Point',
        coordinates: [parseFloat(longitud), parseFloat(latitud)]
      },
      existencias: []
    });

    await nuevoAlmacen.save();
    
    return res.status(201).json({ 
      success: true, 
      message: "Almacén creado con éxito.", 
      payload: nuevoAlmacen 
    });
  } catch (error) {
    console.error("❌ Error en createAlmacen:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAlmacenes = async (req, res) => {
  try {
    const almacenes = await Almacen.find();
    return res.status(200).json({ success: true, payload: almacenes });
  } catch (error) {
    console.error("❌ Error en getAlmacenes:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAlmacenById = async (req, res) => {
  try {
    const { id } = req.params;
    const almacen = await Almacen.findById(id).populate('existencias.productoId', 'name price image');
    
    if (!almacen) {
      return res.status(404).json({ success: false, message: "Almacén no encontrado." });
    }

    return res.status(200).json({ success: true, payload: almacen });
  } catch (error) {
    console.error("❌ Error en getAlmacenById:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const buscarStockPorCercania = async (req, res) => {
  try {
    const { productId, lat, lng } = req.query;

    if (!productId || !lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        message: "Faltan parámetros requeridos (productId, lat, lng)." 
      });
    }

    const almacenesCercanos = await Almacen.find({
      ubicacion: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)]
          }
        }
      },
      "existencias": {
        $elemMatch: {
          productoId: productId,
          cantidad: { $gt: 0 }
        }
      }
    }).populate('existencias.productoId', 'name price');

    const resultadoFormateado = almacenesCercanos.map(almacen => {
      const itemStock = almacen.existencias.find(e => String(e.productoId._id) === String(productId));
      return {
        almacenId: almacen._id,
        nombre: almacen.nombre,
        direccion: almacen.direccion,
        cantidad: itemStock ? itemStock.cantidad : 0,
        posicionFisica: itemStock ? itemStock.posicionFisica : "No especificado"
      };
    });

    return res.status(200).json({ success: true, payload: resultadoFormateado });
  } catch (error) {
    console.error("❌ Error en buscarStockPorCercania:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};