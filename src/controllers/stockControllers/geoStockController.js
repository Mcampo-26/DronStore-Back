import mongoose from 'mongoose';
import Almacen from '../../models/Almacen.js';
import Stock from '../../models/Stock.js';

export const getGeoStock = async (req, res) => {
  try {
    // Desactivamos caché para datos de geolocalización en tiempo real
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    const { productoId, lat, lng, radioMaxKm = 50 } = req.query;

    if (!productoId || !lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        message: "Faltan parámetros obligatorios: productoId, lat y lng son requeridos." 
      });
    }

    // Convertimos el radio de Kilómetros a Metros para el motor 2dsphere de MongoDB
    const radioMetros = parseFloat(radioMaxKm) * 1000;
    const pId = new mongoose.Types.ObjectId(productoId);

    // 🛰️ PIPELINE GEOLOCALIZACIÓN STOCK (geoStock)
    const localesConStock = await Almacen.aggregate([
      {
        // 1️⃣ Buscamos depósitos dentro del radio esférico y los ordenamos por cercanía
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)] // [Longitud, Latitud]
          },
          distanceField: "distanciaMetros", 
          maxDistance: radioMetros,
          spherical: true
        }
      },
      {
        // 2️⃣ Cruzamos con la colección "stocks" usando el índice compuesto
        $lookup: {
          from: "stocks", 
          let: { almacenId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$producto", pId] },
                    { $eq: ["$almacen", "$$almacenId"] },
                    { $gt: ["$cantidadTotal", 0] } // Solo si hay stock real
                  ]
                }
              }
            }
          ],
          as: "stockInfo"
        }
      },
      {
        // 3️⃣ Descartamos los almacenes que no tienen existencias de este producto
        $match: {
          "stockInfo.0": { $exists: true }
        }
      },
      {
        // 4️⃣ Limpiamos el payload para el Front
        $project: {
          _id: 1,
          nombre: 1,
          direccion: 1,
          distanciaKm: { $round: [{ $divide: ["$distanciaMetros", 1000] }, 1] }, 
          cantidadDisponible: { $arrayElemAt: ["$stockInfo.cantidadTotal", 0] },
          coordenadasAlmacen: "$ubicacion.coordinates"
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      hayStockCerca: localesConStock.length > 0,
      almacenMasCercano: localesConStock[0] || null, // El índice [0] siempre es el más próximo por $geoNear
      sucursalesAlternativas: localesConStock
    });

  } catch (error) {
    console.error("❌ ERROR_GET_GEO_STOCK:", error);
    return res.status(500).json({ success: false, message: "Error interno al calcular la geolocalización del stock." });
  }
};