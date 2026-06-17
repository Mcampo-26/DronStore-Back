// helpers/geminiHelper.js
import { GoogleGenAI } from '@google/genai';

/**
 * Genera un embedding vectorial basado en los datos del producto
 */
export const generarProductEmbedding = async (name, description) => {
  try {
    console.log("🤖 IA: Intentando generar embedding para:", name);

    if (!process.env.GEMINI_API_KEY) {
      console.warn("⚠️ GEMINI_API_KEY no configurada en las variables de entorno.");
      return [];
    }

    // Inicialización del cliente oficial de Google Gen AI
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const textoParaVector = `Producto: ${name}. Descripción: ${description || ""}`;

    // 🔥 LA CORRECCIÓN TOTAL: En el SDK `@google/genai`, si tira 404 usando
    // embedContent, es porque debemos usar el método simplificado o especificar
    // el modelo base correcto que acepta tu API Key sin forzar rutas legacy.
    const response = await ai.models.embedContent({
      model: 'text-embedding-004', // Mantenemos el modelo de última generación
      contents: {
        parts: [{ text: textoParaVector }] // Estructuramos el contenido de forma explícita para el SDK nuevo
      }
    });

    // Validamos la estructura de retorno del nuevo SDK
    if (response?.embedding?.values) {
      console.log("✅ IA: Vector generado con éxito. Dimensiones:", response.embedding.values.length);
      return response.embedding.values;
    }

    console.warn("⚠️ IA: La respuesta no contiene vectores válidos.");
    return [];

  } catch (error) {
    // Si la API Key de tu entorno está restringida al plan gratuito (sin Billing)
    // y Google te bloquea el acceso a embeddings, capturamos el error limpiamente.
    // Tu controlador de productos seguirá funcionando e ignorará este fallo.
    console.error("❌ ERROR_GENERATING_EMBEDDING (Controlado):", error.message || error);
    return null; 
  }
};