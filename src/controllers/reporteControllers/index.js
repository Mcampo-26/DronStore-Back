import { GoogleGenAI } from '@google/genai';
import Venta from '../../models/Venta.js';
import Product from '../../models/Product.js';
import Usuario from '../../models/User.js';
import { generarExcelStream, generarPDFDoc } from '../../services/Reportes/exportService.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const obtenerReporteHibrido = async (req, res) => {
  try {
    const { modo, coleccion, filtrosManuales, ordenar, limite, peticionIA, formato = 'JSON' } = req.body;
    
    if (!coleccion) {
      return res.status(400).json({ success: false, message: "La colección base es requerida." });
    }

    let queryFinal = {};
    let ordenFinal = ordenar || { createdAt: -1 };
    let limiteFinal = parseInt(limite) || 24;

    // ===================================================
    // 🛡️ CONTROL DE ROLES HÍBRIDO (IDÉNTICO A TU OTRA COMPONENT)
    // ===================================================
    const usuarioLogueado = req.user || {};
    const stringRol = JSON.stringify(usuarioLogueado.role || "").toUpperCase();
    const esAdminGlobal = stringRol.includes("ADMIN") || stringRol.includes("SUPERADMIN");

    // Seguridad de bloqueo inmediato si se deslogueó la sesión
    if (!usuarioLogueado._id) {
      return res.status(401).json({ 
        success: false, 
        message: "No se pudo identificar las credenciales del operador. Verificá el token." 
      });
    }

    // ==========================================
    // 🤖 CONSTRUCCIÓN DEL MODO PREMIUM CON IA
    // ==========================================
    if (modo === 'PREMIUM' && peticionIA) {
      const promptSystem = `
        Actúas como un motor de traducción de lenguaje natural a filtros de MongoDB para la colección "${coleccion}".
        Devuelve estrictamente un objeto JSON con la siguiente estructura:
        { "filtros": { ... }, "ordenar": { "createdAt": -1 }, "limite": 24 }
        No agregues texto markdown, solo el JSON puro.
      `;
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Filtra la colección basado en esto: "${peticionIA}"`,
          config: { systemInstruction: promptSystem, responseMimeType: "application/json" }
        });
        const configIA = JSON.parse(response.text);
        queryFinal = configIA.filtros || {};
        if (configIA.ordenar) ordenFinal = configIA.ordenar;
        if (configIA.limite) limiteFinal = configIA.limite;
      } catch (aiError) {
        queryFinal = filtrosManuales || {};
      }
    } else {
      queryFinal = { ...filtrosManuales };
    }

    // ===================================================
    // 🛡️ ADUANA DE SEGURIDAD HORIZONTAL MULTI-TENANT PRO
    // ===================================================
    if (!esAdminGlobal) {
      if (coleccion === 'usuarios') {
        return res.status(403).json({ success: false, message: "Acceso denegado a la nómina de usuarios." });
      }

      if (coleccion === 'ventas') {
        // Buscamos los drones indexados a este operador
        const misProductos = await Product.find({ usuarioId: usuarioLogueado._id }).select("_id");
        const misProductIds = misProductos.map(p => p._id.toString());

        // Forzamos a que la query (estándar o de la IA) se cruce solo con sus artículos
        queryFinal["items.productId"] = { $in: misProductIds };
      }

      if (coleccion === 'productos') {
        // Si audita productos, solo listamos los suyos
        queryFinal.usuarioId = usuarioLogueado._id;
      }
    }

    // ===================================================
    // 📡 DISPACHO SEGÚN MODELOS EXCLUSIVOS
    // ===================================================
    let data = [];
    
    if (coleccion === 'ventas') {
      data = await Venta.find(queryFinal)
        .populate('usuario', 'nombre email') // Match exacto con tu Schema
        .sort(ordenFinal)
        .limit(limiteFinal);
    } else if (coleccion === 'productos') {
      data = await Product.find(queryFinal)
        .sort(ordenFinal)
        .limit(limiteFinal);
    } else if (coleccion === 'usuarios') {
      if (!Usuario) return res.status(400).json({ success: false, message: "Modelo de usuarios no disponible." });
      data = await Usuario.find(queryFinal)
        .populate('role', 'name')
        .sort(ordenFinal)
        .limit(limiteFinal);
    }

    // ==========================================
    // 🚚 SALIDAS DE FORMATO BINARIO O JSON
    // ==========================================
    if (formato === 'EXCEL') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Reporte_${coleccion}.xlsx`);
      const workbook = await generarExcelStream(data, coleccion);
      return workbook.xlsx.write(res).then(() => res.status(200).end());
    }

    if (formato === 'PDF') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Reporte_${coleccion}.pdf`);
      return generarPDFDoc(data, coleccion, res);
    }

    return res.status(200).json({
      success: true,
      meta: { modo, filtrosAplicados: queryFinal, limite: limiteFinal, coleccion },
      payload: data
    });

  } catch (error) {
    console.error("❌ Error crítico en el motor de analíticas:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};