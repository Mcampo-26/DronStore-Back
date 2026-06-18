import Almacen from '../../models/Almacen.js';

// 🏗️ CREAR ALMACÉN (Asigna automáticamente el dueño real)
export const createAlmacen = async (req, res) => {
  try {
    const { nombre, calle, ciudad, provincia, longitud, latitud } = req.body;
    const usuarioLogueadoId = req.user?._id;

    if (!nombre || !longitud || !latitud) {
      return res.status(400).json({ 
        success: false, 
        message: "El nombre y las coordenadas geográficas son obligatorios." 
      });
    }

    // 🚀 BLINDAJE SENIOR: Limpiamos y parseamos las coordenadas
    let lng = parseFloat(longitud);
    let lat = parseFloat(latitud);

    // 🛡️ Si el frontend mandó una longitud de Tucumán sin punto (ej: -65291141) la acomodamos
    if (Math.abs(lng) > 180) {
      // Si empieza con -65... o similar de Tucumán y vino sin punto decimal:
      const lngString = longitud.toString();
      // Insertamos el punto decimal después del segundo dígito (-65.)
      if (lngString.startsWith('-')) {
        lng = parseFloat(lngString.slice(0, 3) + '.' + lngString.slice(3));
      } else {
        lng = parseFloat(lngString.slice(0, 2) + '.' + lngString.slice(2));
      }
    }

    // 🔒 Validación final de rangos para evitar el crash de MongoServerError
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      return res.status(400).json({
        success: false,
        message: `Coordenadas fuera de rango geográfico válido (Lng: ${lng}, Lat: ${lat}).`
      });
    }

    const nuevoAlmacen = new Almacen({
      usuarioId: usuarioLogueadoId,
      nombre,
      direccion: { calle, ciudad, provincia },
      ubicacion: {
        type: 'Point',
        coordinates: [lng, lat] // [longitud, latitud] correctas
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

// 📡 OBTENER ALMACENES (Filtrado inteligente y multi-rol Senior)
export const getAlmacenes = async (req, res) => {
  try {
    const usuarioLogueadoId = req.user?._id;
    const rolUsuario = req.user?.role?.name; // O como manejes el string del rol (ej: "ADMIN", "USUARIO")

    let query = {};

    // 🛡️ Si NO es Administrador, lo obligamos a ver únicamente sus almacenes asignados
    if (rolUsuario !== 'ADMIN' && rolUsuario !== 'SUPERADMIN') {
      query.usuarioId = usuarioLogueadoId;
    }

    // Un único punto de salida de datos optimizado
    const almacenes = await Almacen.find(query).populate('existencias.productoId', 'name price');
    
    return res.status(200).json({ success: true, payload: almacenes });
  } catch (error) {
    console.error("❌ Error en getAlmacenes:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 🔍 OBTENER UN ALMACÉN POR ID (Con doble validación de seguridad)
export const getAlmacenById = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioLogueadoId = req.user?._id;
    const rolUsuario = req.user?.role?.name;

    const almacen = await Almacen.findById(id).populate('existencias.productoId', 'name price image');
    
    if (!almacen) {
      return res.status(404).json({ success: false, message: "Almacén no encontrado." });
    }

    // 🔒 Control de seguridad horizontal: Evita que un proveedor adivine el ID de otro y le robe info
    if (rolUsuario !== 'ADMIN' && rolUsuario !== 'SUPERADMIN' && String(almacen.usuarioId) !== String(usuarioLogueadoId)) {
      return res.status(403).json({ success: false, message: "No tenés permisos para ver este almacén." });
    }

    return res.status(200).json({ success: true, payload: almacen });
  } catch (error) {
    console.error("❌ Error en getAlmacenById:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// 🗺️ BUSCAR STOCK POR CERCANÍA (Mantiene el alcance global para logística del cliente)
export const buscarStockPorCercania = async (req, res) => {
  try {
    const { productId, lat, lng } = req.query;

    if (!productId || !lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        message: "Faltan parámetros requeridos (productId, lat, lng)." 
      });
    }

    // Aquí no filtramos por usuarioId porque el cliente final necesita buscar en TODOS los proveedores disponibles de la plataforma
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
      const itemStock = almacen.existencias.find(e => String(e.productoId?._id || e.productoId) === String(productId));
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