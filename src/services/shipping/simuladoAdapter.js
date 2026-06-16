import ManualTariff from '../../models/ManualTariff.js';

export const simuladoAdapter = {
  cotizar: async ({ codigoPostalDestino, pesoTotalKg }) => {
    try {
      // 1. Primero buscamos si hay una tarifa manual cargada para ese CP y rango de peso
      const tarifaManual = await ManualTariff.findOne({
        destinationZipCode: codigoPostalDestino,
        minWeightKg: { $lte: pesoTotalKg },
        maxWeightKg: { $gte: pesoTotalKg }
      });

      // Si existe un transportista local cargado en tu DB para esa zona, lo priorizamos
      if (tarifaManual) {
        return {
          id: `manual_${tarifaManual._id}`,
          providerName: tarifaManual.providerName,
          serviceType: pesoTotalKg > 25 ? "Carga Pesada / Logística Campo" : "Paquetería Regional",
          cost: tarifaManual.baseCost,
          deliveryEstimate: tarifaManual.deliveryEstimate,
          trackingBaseUrl: tarifaManual.trackingBaseUrl
        };
      }

      // 2. LOGICA SIMULADA POR DEFECTO (Si no hay nada en ManualTariff, calcula dinámicamente)
      // Simulamos tarifas base según región (Cercanía NOA vs resto del país)
      const esRegionalNOA = codigoPostalDestino.startsWith('4'); // CP 4000 (Tucumán), 4400 (Salta), etc.
      let costoBase = esRegionalNOA ? 4 : 7;
      let plazo = esRegionalNOA ? "Llega en 24/48 hs hábiles" : "Llega en 3 a 5 días hábiles";
      let proveedor = esRegionalNOA ? "La Sevillanita (Simulado)" : "Andreani (Simulado)";

      // Recargo por peso (Tarifa por kilo excedente)
      const precioPorKilo = 2;
      const costoPeso = Math.ceil(pesoTotalKg * precioPorKilo);
      
      // Si pasa los 30kg sumamos un recargo estructural por bulto pesado
      const recargoEstructural = pesoTotalKg > 30 ? 3000 : 0;
      const costoFinal = costoBase + costoPeso + recargoEstructural;

      return {
        id: proveedor.toLowerCase().includes("andreani") ? "andreani_default" : "sevillanita_default",
        providerName: proveedor,
        serviceType: pesoTotalKg > 25 ? "Distribución Industrial Drones" : "Envío Express Repuestos",
        cost: costoFinal,
        deliveryEstimate: plazo,
        // URLs base oficiales de tracking para cuando el cliente haga clic en su perfil
        trackingBaseUrl: proveedor.includes("Andreani") 
          ? "https://vtracking.andreani.com/home?numeroGuia=" 
          : "https://www.lasevillanita.com.ar/tracking?guia="
      };
    } catch (error) {
      console.error("Error en simuladoAdapter:", error);
      return null;
    }
  }
};