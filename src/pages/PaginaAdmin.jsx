import { useState } from 'react';
import { Button, Table, Form, Row, Col, Nav, Card, Badge } from 'react-bootstrap';
import TablaInventario from '../components/TablaInventario';
import TablaPedidos from '../components/TablaPedidos';
import { obtenerProductos, guardarProducto, desactivarProducto } from '../services/productosServicio';
import { obtenerPedidos, obtenerResumenInventario, calcularTotalPedido } from '../services/pedidosServicio';
import { obtenerUsuariosAdministracion } from '../services/usuariosServicio';
import { useMensaje } from '../context/MensajeContext';
import { ESTADOS, ROLES, formatearPesos } from '../constantes';

const nuevo = { id: '', nombre: '', descripcion: '', precio: '', stock: '0' };
export default function PaginaAdmin() {
  const [seccion, setSeccion] = useState('Dashboard');
  const [revision, refrescar] = useState(0);
  const [formulario, setFormulario] = useState(null);
  const [editando, setEditando] = useState(null);
  const { mostrarMensaje } = useMensaje();
  const productos = obtenerProductos();
  const pedidos = obtenerPedidos();
  const inventario = obtenerResumenInventario();
  const usuarios = obtenerUsuariosAdministracion();
  const resolver = resultado => {
    mostrarMensaje(resultado.ok ? 'Operación realizada correctamente.' : resultado.error, resultado.ok ? 'exito' : 'error');
    if (resultado.ok) { refrescar(revision + 1); setFormulario(null); }
  };
  const guardar = evento => {
    evento.preventDefault();
    if (!window.confirm('¿Guardar los cambios del producto?')) return;
    resolver(guardarProducto({ ...formulario, precio: Number(formulario.precio), stock: Number(formulario.stock) }, editando));
  };
  const indicadores = {
    'Productos activos': productos.filter(p => p.activo).length,
    'Clientes registrados': usuarios.filter(u => u.rol === ROLES.CLIENTE).length,
    'Pedidos pendientes': pedidos.filter(p => p.estado === ESTADOS.PENDIENTE).length,
    'Pedidos en camino': pedidos.filter(p => p.estado === ESTADOS.EN_CAMINO).length,
    'Pedidos entregados': pedidos.filter(p => p.estado === ESTADOS.ENTREGADO).length,
    'Pedidos cancelados': pedidos.filter(p => p.estado === ESTADOS.CANCELADO).length,
    'Stock disponible': inventario.reduce((n, p) => n + p.disponible, 0),
    'Monto de pedidos entregados': formatearPesos(pedidos.filter(p => p.estado === ESTADOS.ENTREGADO).reduce((n, p) => n + calcularTotalPedido(p), 0)),
  };
  return <>
    <section className="bg-white p-4 rounded border mb-4">
      <h2>Panel de administración</h2>
      <p>Supervisión del catálogo, pedidos e inventario.</p>
      <Nav variant="pills" className="gap-2 flex-wrap" aria-label="Secciones administrativas">
        {['Dashboard', 'Productos', 'Pedidos', 'Inventario', 'Usuarios'].map(nombre => <Nav.Item key={nombre}><Nav.Link as="button" active={seccion === nombre} onClick={() => { setSeccion(nombre); refrescar(revision + 1); }}>{nombre}</Nav.Link></Nav.Item>)}
      </Nav>
    </section>
    <section className="bg-white p-4 rounded border">
      <h3>{seccion}</h3>
      {seccion === 'Dashboard' && <><Row xs={1} md={2} lg={4} className="g-3">{Object.entries(indicadores).map(([nombre, valor]) => <Col key={nombre}><Card className="h-100"><Card.Body><Card.Title className="h6">{nombre}</Card.Title><p className="fs-3 mb-0">{valor}</p></Card.Body></Card></Col>)}</Row><p className="text-muted mt-3">El monto entregado no representa pagos efectivamente cobrados.</p></>}
      {seccion === 'Productos' && <>
        <Button onClick={() => { setEditando(null); setFormulario({ ...nuevo }); }}>Crear producto</Button>
        {formulario && <Form onSubmit={guardar} className="border rounded p-3 my-3">
          <h4>{editando ? 'Editar producto' : 'Nuevo cilindro'}</h4>
          <Row>{[['id','Identificador'], ['nombre','Nombre'], ['descripcion','Descripción'], ['precio','Precio'], ...(!editando ? [['stock','Stock inicial']] : [])].map(([campo, etiqueta]) => <Col md={6} key={campo}><Form.Group className="mb-3" controlId={`producto-${campo}`}><Form.Label>{etiqueta}</Form.Label><Form.Control required disabled={campo === 'id' && !!editando} type={['precio','stock'].includes(campo) ? 'number' : 'text'} min={campo === 'precio' ? 1 : 0} step="1" value={formulario[campo]} onChange={e => setFormulario({ ...formulario, [campo]: e.target.value })} /></Form.Group></Col>)}</Row>
          <Button type="submit">Guardar producto</Button>{' '}<Button variant="secondary" onClick={() => setFormulario(null)}>Cancelar</Button>
        </Form>}
        <Table responsive className="mt-3"><thead><tr><th>ID</th><th>Nombre</th><th>Precio</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{productos.map(p => <tr key={p.id}><td>{p.id}</td><td>{p.nombre}</td><td>{formatearPesos(p.precio)}</td><td><Badge bg={p.activo ? 'success' : 'secondary'}>{p.activo ? 'Activo' : 'Inactivo'}</Badge></td><td><div className="d-flex gap-2 flex-wrap"><Button size="sm" onClick={() => { setEditando(p.id); setFormulario(p); }}>Editar {p.id}</Button><Button size="sm" variant="outline-danger" disabled={!p.activo} onClick={() => { if (window.confirm('¿Desactivar este producto para nuevas compras?')) resolver(desactivarProducto(p.id)); }}>Desactivar {p.id}</Button></div></td></tr>)}</tbody></Table>
        {!productos.length && <p>No hay productos registrados.</p>}
      </>}
      {seccion === 'Pedidos' && (pedidos.length ? <TablaPedidos pedidos={[...pedidos].reverse()} modo="admin" /> : <p>No hay pedidos registrados.</p>)}
      {seccion === 'Inventario' && (inventario.length ? <TablaInventario resumen={inventario} /> : <p>No hay inventario registrado.</p>)}
      {seccion === 'Usuarios' && <><p>Consulta de cuentas registradas e internas.</p><Table responsive><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th></tr></thead><tbody>{usuarios.map(u => <tr key={u.usuario}><td>{u.nombre}</td><td>{u.usuario}</td><td>{u.rol}</td></tr>)}</tbody></Table>{!usuarios.some(u => u.rol === ROLES.CLIENTE) && <p>No hay clientes registrados.</p>}</>}
    </section>
  </>;
}
