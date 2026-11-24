import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { SesionProvider } from './context/SesionContext';
import { MensajeProvider } from './context/MensajeContext';
import { CLAVES, ROLES } from './constantes';

function abrir(ruta, rol = null) {
  if (rol) {
    sessionStorage.setItem(CLAVES.SESION, JSON.stringify({
      usuario: 'prueba', nombre: 'Usuario de prueba', rol,
    }));
  }
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <SesionProvider>
        <MensajeProvider><App /></MensajeProvider>
      </SesionProvider>
    </MemoryRouter>,
  );
}

describe('Navegación pública y rutas privadas', () => {
  it('permite navegar desde Inicio al catálogo sin sesión y muestra los precios', async () => {
    const usuario = userEvent.setup();
    abrir('/');
    expect(screen.getByRole('heading', { name: 'Gas el volcán' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Registrarse' })).toHaveAttribute('href', '/registro');
    expect(screen.queryByRole('link', { name: 'Mis pedidos' })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('link', { name: 'Productos' }));
    for (const [nombre, precio] of [
      ['Cilindro GLP 5KG', '$6.000'], ['Cilindro GLP 11KG', '$11.000'],
      ['Cilindro GLP 15KG', '$14.500'], ['Cilindro GLP 45KG', '$40.000'],
    ]) {
      expect(screen.getByRole('heading', { name: nombre })).toBeInTheDocument();
      expect(screen.getByText(`Precio: ${precio}`)).toBeInTheDocument();
    }
  });

  it('permite entrar directamente al catálogo y permite preparar el pedido', async () => {
    const usuario = userEvent.setup();
    abrir('/productos');
    expect(screen.getByRole('heading', { name: 'Nuestros productos' })).toBeInTheDocument();
    await usuario.click(screen.getAllByRole('button', { name: 'Comprar' })[0]);
    expect(screen.getByRole('heading', { name: 'Realizar pedido' })).toBeInTheDocument();
  });

  it.each(['/mis-pedidos', '/operador', '/admin'])(
    'redirige al login al visitante que intenta abrir %s', (ruta) => {
      abrir(ruta);
      expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    },
  );

  it.each(['/operador', '/admin'])(
    'impide al cliente acceder a %s', (ruta) => {
      abrir(ruta, ROLES.CLIENTE);
      expect(screen.getByRole('heading', { name: 'Gas el volcán' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Panel de administración' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Pedidos realizados' })).not.toBeInTheDocument();
    },
  );

  it.each([
    ['/operador', ROLES.OPERADOR, 'Pedidos realizados'],
    ['/admin', ROLES.ADMIN, 'Panel de administración'],
    ['/pedido', ROLES.CLIENTE, 'Realizar pedido'],
  ])('mantiene el acceso autorizado a %s', (ruta, rol, titulo) => {
    abrir(ruta, rol);
    expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });
});


describe('Carrito de visitante', () => {
  it('conserva cantidades al recargar y exige sesión solo al confirmar', async () => {
    const usuario = userEvent.setup();
    const vista = abrir('/pedido?cilindro=5KG');
    await usuario.click(screen.getByRole('button', { name: 'Agregar al carrito' }));
    await usuario.click(screen.getByRole('button', { name: 'Agregar una unidad de Cilindro GLP 5KG' }));
    expect(screen.getByText('2 de 4 cilindros')).toBeInTheDocument();
    vista.unmount();
    abrir('/pedido');
    expect(screen.getByText('2 de 4 cilindros')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('regresa desde registro y login al carrito seleccionado', async () => {
    const usuario = userEvent.setup();
    abrir('/pedido?cilindro=5KG');
    await usuario.click(screen.getByRole('button', { name: 'Agregar al carrito' }));
    await usuario.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await usuario.click(screen.getByRole('link', { name: 'Regístrate aquí' }));
    await usuario.type(screen.getByLabelText('Nombre completo'), 'Cliente Prueba');
    await usuario.type(screen.getByLabelText('Nombre de usuario'), 'clienteprueba');
    await usuario.type(screen.getByLabelText('Contraseña', { exact: true }), 'clave123');
    await usuario.type(screen.getByLabelText('Confirmar contraseña'), 'clave123');
    await usuario.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await screen.findByRole('heading', { name: 'Iniciar sesión' }, { timeout: 3000 });
    await usuario.type(screen.getByLabelText('Usuario'), 'clienteprueba');
    await usuario.type(screen.getByLabelText('Contraseña'), 'clave123');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(screen.getByRole('heading', { name: 'Realizar pedido' })).toBeInTheDocument();
    expect(screen.getByText('1 de 4 cilindros')).toBeInTheDocument();
  });
});

it('permite abrir pedido directamente como visitante', () => {
  abrir('/pedido');
  expect(screen.getByRole('heading', { name: 'Realizar pedido' })).toBeInTheDocument();
});
