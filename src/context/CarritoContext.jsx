import { obtenerProducto } from '../services/productosServicio';
import { createContext, useContext } from 'react';
import useCarrito from '../hooks/useCarrito';
import { MAX_CANTIDAD } from '../constantes';
import { leerSesionNavegador, guardarSesionNavegador } from '../services/almacenamiento';

export const CLAVE_CARRITO = 'gasVolcan_v2_carrito_temporal';
// Solo se persisten identificadores y cantidades; los precios vienen del cat?logo.
const persistencia = {
  leer(maximo) {
    const datos = leerSesionNavegador(CLAVE_CARRITO, []);
    if (!Array.isArray(datos)) return [];
    const ids = new Set();
    let total = 0;
    const items = [];
    for (const item of datos) {
      const producto = obtenerProducto(item?.cilindro);
      if (!producto || ids.has(item.cilindro) || !Number.isInteger(item.cantidad) || item.cantidad < 1) return [];
      ids.add(item.cilindro);
      total += item.cantidad;
      if (total > maximo) return [];
      items.push({ cilindro: item.cilindro, cantidad: item.cantidad, precioUnitario: producto.precio });
    }
    return items;
  },
  guardar(items) {
    guardarSesionNavegador(CLAVE_CARRITO, items.map(({ cilindro, cantidad }) => ({ cilindro, cantidad })));
  },
};
const CarritoContext = createContext(null);
export function CarritoProvider({ children }) {
  const carrito = useCarrito(MAX_CANTIDAD, persistencia);
  return <CarritoContext.Provider value={carrito}>{children}</CarritoContext.Provider>;
}
export function useCarritoCompartido() {
  return useContext(CarritoContext);
}
