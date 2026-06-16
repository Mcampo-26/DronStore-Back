import { simuladoAdapter } from './simuladoAdapter.js';

export const obtenerCotizacionesDeEnvio = async (datosDespacho) => {
  const proveedorActivo = process.env.SHIPPING_PROVIDER || 'SIMULADO';

  switch (proveedorActivo) {
    case 'SIMULADO':
    default:
      // Devuelve una lista de opciones disponibles para el Checkout
      const opcionEnvio = await simuladoAdapter.cotizar(datosDespacho);
      return opcionEnvio ? [opcionEnvio] : [];
  }
};