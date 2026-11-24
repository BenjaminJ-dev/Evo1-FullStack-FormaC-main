import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { SesionProvider } from '../context/SesionContext';
import { MensajeProvider } from '../context/MensajeContext';
import { guardarSesion } from '../services/usuariosServicio';
import { obtenerProducto } from '../services/productosServicio';
const abrir = rol => {
  guardarSesion({ rol, nombre: 'Prueba', usuario: 'prueba' });
  render(<MemoryRouter initialEntries={['/admin']}><SesionProvider><MensajeProvider><App /></MensajeProvider></SesionProvider></MemoryRouter>);
};
it('navega por secciones, muestra vacios y desactiva con confirmacion', async () => {
  const usuario = userEvent.setup();
  abrir('admin');
  expect(screen.getByText('Clientes registrados')).toBeInTheDocument();
  await usuario.click(screen.getByRole('button', { name: 'Pedidos', exact: true }));
  expect(screen.getByText('No hay pedidos registrados.')).toBeInTheDocument();
  await usuario.click(screen.getByRole('button', { name: 'Usuarios', exact: true }));
  expect(screen.queryByText('admin123')).not.toBeInTheDocument();
  await usuario.click(screen.getByRole('button', { name: 'Inventario', exact: true }));
  expect(screen.getByText('Total (bodega)')).toBeInTheDocument();
  await usuario.click(screen.getByRole('button', { name: 'Productos', exact: true }));
  const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
  await usuario.click(screen.getByRole('button', { name: 'Desactivar 5KG', exact: true }));
  expect(obtenerProducto('5KG').activo).toBe(true);
  confirmar.mockReturnValue(true);
  await usuario.click(screen.getByRole('button', { name: 'Desactivar 5KG', exact: true }));
  expect(obtenerProducto('5KG').activo).toBe(false);
  confirmar.mockRestore();
});
it.each(['cliente','operador'])('impide abrir administracion como %s', rol => {
  abrir(rol);
  expect(screen.queryByRole('button', { name: 'Crear producto' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument();
});
