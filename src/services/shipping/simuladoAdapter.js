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
        // ✨ BUENA PRÁCTICA: Aunque la tarifa esté cargada a mano, le sumamos un pequeño 
        // proporcional por kilo si el bulto excede el peso estándar para cubrir costos de embalaje VIP
        const recargoKiloManual = pesoTotalKg > 5 ? Math.ceil((pesoTotalKg - 5) * 450) : 0;

        return {
          id: `manual_${tarifaManual._id}`,
          providerName: tarifaManual.providerName,
          serviceType: pesoTotalKg > 25 ? "Carga Pesada / Logística Campo" : "Paquetería Regional",
          cost: Number(tarifaManual.baseCost) + recargoKiloManual,
          deliveryEstimate: tarifaManual.deliveryEstimate,
          trackingBaseUrl: tarifaManual.trackingBaseUrl
        };
      }

      // 2. LOGICA SIMULADA POR DEFECTO (Si no hay nada en ManualTariff, calcula dinámicamente)
      // Simulamos tarifas base reales según región (Cercanía NOA vs resto del país)
      const esRegionalNOA = codigoPostalDestino.startsWith('4'); // CP 4000 (Tucumán), 4400 (Salta), etc.
      
      // 💰 TARIFAS ACTUALIZADAS: Valores reales de mercado para paquetería express
      let costoBase = esRegionalNOA ? 4800 : 7200; 
      let plazo = esRegionalNOA ? "Llega en 24/48 hs hábiles" : "Llega en 3 a 5 días hábiles";
      let proveedor = esRegionalNOA ? "La Sevillanita (Simulado)" : "Andreani (Simulado)";

      // 📦 Recargo por peso real por cada kilo (Tarifa por kilo excedente realista)
      const precioPorKilo = 400; // $550 pesos por cada kilo que pese el paquete
      const costoPeso = Math.ceil(pesoTotalKg * precioPorKilo);
      
      // Si pasa los 30kg (Drones industriales o bultos gigantes) sumamos un recargo estructural por logística pesada
      const recargoEstructural = pesoTotalKg > 30 ? 12000 : 0;
      
      // Cálculo del costo final sumando bases actualizadas
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