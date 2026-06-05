// helpers/geminiHelper.js
import { GoogleGenAI } from '@google/genai';

// Inicializamos el SDK con tu API Key de entorno
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Genera un embedding vectorial basado en los datos del producto
 */
export const generarProductEmbedding = async (name, description) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("⚠️ GEMINI_API_KEY no configurada. Saltando embedding.");
      return [];
    }

    // Juntamos los datos clave en un string de contexto semántico
    const textoParaVector = `Producto: ${name}. Descripción: ${description}`;

    const response = await ai.models.embedContent({
      model: 'text-embedding-004', // Modelo oficial para embeddings de Google
      contents: textoParaVector,
    });

    return response.embedding.values; // Retorna el array de números [0.123, -0.456, ...]
  } catch (error) {
    console.error("❌ ERROR_GENERATING_EMBEDDING:", error);
    return []; // Fallback seguro para no romper el flujo principal
  }
};