import { obtenerProducto } from '../services/productosServicio';
// Pedido disponible para visitantes; confirmar requiere una sesion de cliente.
import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import FormularioPedido from '../components/FormularioPedido';
import Carrito from '../components/Carrito';
import { useCarritoCompartido } from '../context/CarritoContext';
import { useSesion } from '../context/SesionContext';
import { useMensaje } from '../context/MensajeContext';
import { crearPedido } from '../services/pedidosServicio';
import { validarTelefono } from '../services/validaciones';

export default function PaginaPedido() {
  const { sesion } = useSesion();
  const { mostrarMensaje } = useMensaje();
  const carrito = useCarritoCompartido();
  const navigate = useNavigate();

  // Si se llega desde "Comprar" en productos, viene ?cilindro=5KG
  const [parametros] = useSearchParams();
  const cilindroInicial = parametros.get('cilindro') ?? '';

  // El nombre se prellena con el de la sesión; el resto lo escribe el cliente
  const [entrega, setEntrega] = useState({ nombre: sesion?.nombre ?? '', telefono: '', direccion: '' });
  const cambiarEntrega = (campo, valor) =>
    setEntrega((actual) => ({ ...actual, [campo]: valor }));

  // Los errores del carrito (máximo, cantidad inválida...) se avisan en el banner
  const avisarSiHayError = (resultado) => {
    if (!resultado.ok) {
      mostrarMensaje(resultado.error, 'error');
    }
    return resultado;
  };

  const confirmar = () => {
    if (!sesion) {
      navigate('/login', { state: { volverCompra: true } });
      return;
    }
    const nombre = entrega.nombre.trim();
    const direccion = entrega.direccion.trim();

    if (carrito.items.length === 0) {
      mostrarMensaje('Agrega al menos un cilindro al carrito.', 'error');
      return;
    }
    if (nombre === '') {
      mostrarMensaje('Debes ingresar tu nombre.', 'error');
      return;
    }
    if (entrega.telefono === '') {
      mostrarMensaje('Debes ingresar tu teléfono.', 'error');
      return;
    }
    if (!validarTelefono(entrega.telefono)) {
      mostrarMensaje('El teléfono debe tener 9 dígitos numéricos, sin espacios ni guiones (ej: 912345678).', 'error');
      return;
    }
    if (direccion === '') {
      mostrarMensaje('Debes ingresar tu dirección.', 'error');
      return;
    }

    // Recién aquí se revisa el stock. Si falta alguno, el pedido completo
    // se rechaza y el cliente sigue en esta página con su carrito intacto.
    if (carrito.items.some(item => item.precioUnitario !== obtenerProducto(item.cilindro)?.precio && obtenerProducto(item.cilindro)?.activo)) {
      carrito.actualizarPrecios();
      mostrarMensaje('Los precios cambiaron. Revisa el total y confirma nuevamente.', 'error');
      return;
    }
    const resultado = crearPedido({
      usuario: sesion.usuario,
      nombre,
      telefono: entrega.telefono,
      direccion,
      items: carrito.items,
    });
    if (!resultado.ok) {
      mostrarMensaje(
        resultado.error ?? `No hay stock suficiente de: ${resultado.sinStock.join(', ')}. Ajusta tu carrito.`,
        'error',
      );
      return;
    }

    mostrarMensaje('Pedido registrado correctamente.', 'exito');
    carrito.vaciar();
    setEntrega({ nombre: sesion?.nombre ?? '', telefono: '', direccion: '' });
  };

  return (
    <>
      <section className="bg-white p-4 rounded border mb-4">
        <h2>Realizar pedido</h2>
        <p className="mb-0">
          Completa tus datos, agrega los cilindros al carrito y confirma tu pedido.
          Una vez confirmado no se puede modificar (solo cancelar mientras esté Pendiente).
        </p>
      </section>

      <Row className="g-4">
        <Col lg={6}>
          <section className="bg-white p-4 rounded border h-100">
            <FormularioPedido
              entrega={entrega}
              onCambiarEntrega={cambiarEntrega}
              onAgregar={(cilindro, cantidad) => avisarSiHayError(carrito.agregar(cilindro, cantidad))}
              cilindroInicial={cilindroInicial}
              maximo={carrito.maximo}
            />
          </section>
        </Col>
        <Col lg={6}>
          <Carrito
            items={carrito.items}
            total={carrito.total}
            cantidadTotal={carrito.cantidadTotal}
            maximo={carrito.maximo}
            onEditar={(cilindro, cantidad) => avisarSiHayError(carrito.editar(cilindro, cantidad))}
            onQuitar={carrito.quitar}
            onConfirmar={confirmar}
          />
        </Col>
      </Row>
    </>
  );
}
