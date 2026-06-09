// helpers/geminiHelper.js
import { GoogleGenAI } from '@google/genai';

// Inicializamos el SDK con tu API Key de entorno
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Genera un embedding vectorial basado en los datos del producto
 */
export const generarProductEmbedding = async (name, description) => {
  try {
    console.log("🤖 IA: Intentando generar embedding para:", name); // 🔍 LOG 1

    if (!process.env.GEMINI_API_KEY) {
      console.warn("⚠️ GEMINI_API_KEY no configurada en las variables de entorno.");
      return [];
    }

    const textoParaVector = `Producto: ${name}. Descripción: ${description}`;

    const response = await ai.models.embedContent({
      model: 'text-embedding-004',
      contents: textoParaVector,
    });

    console.log("✅ IA: Vector generado con éxito. Dimensiones:", response.embedding.values.length); // 🔍 LOG 2
    return response.embedding.values;
    
  } catch (error) {
    console.error("❌ ERROR_GENERATING_EMBEDDING:", error);
    return [];
  }
};