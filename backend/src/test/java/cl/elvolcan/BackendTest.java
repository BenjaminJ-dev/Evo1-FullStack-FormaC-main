package cl.elvolcan;
import cl.elvolcan.entity.*;
import cl.elvolcan.repository.*;
import cl.elvolcan.service.*;
import cl.elvolcan.config.DatosIniciales;
import cl.elvolcan.dto.Contratos.*;
import cl.elvolcan.exception.NegocioException;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
@SpringBootTest(properties={"spring.datasource.url=jdbc:h2:mem:pruebas;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000","spring.jpa.hibernate.ddl-auto=create-drop"})
@AutoConfigureMockMvc
class BackendTest {
 @Autowired MockMvc mvc; @Autowired ProductosService productos; @Autowired PedidosService pedidos; @Autowired InventarioService stock;
 @Autowired UsuarioRepository usuarios; @Autowired ProductoRepository catalogo; @Autowired InventarioRepository inventarios; @Autowired PedidoRepository pedidoRepo; @Autowired DetallePedidoRepository detalleRepo; @Autowired PasswordEncoder encoder; @Autowired DatosIniciales semilla;
 @BeforeEach void preparar(){detalleRepo.deleteAll();pedidoRepo.deleteAll();inventarios.deleteAll();catalogo.deleteAll();usuarios.deleteAll();semilla.run();cuenta("cliente",Rol.CLIENTE);cuenta("otro",Rol.CLIENTE);cuenta("admin",Rol.ADMINISTRADOR);cuenta("operador",Rol.OPERADOR);actor("admin");}
 @AfterEach void limpiar(){SecurityContextHolder.clearContext();}
 void cuenta(String nombre,Rol rol){var u=new Usuario();u.setUsuario(nombre);u.setNombre(nombre);u.setRol(rol);u.setActivo(true);u.setPasswordHash(encoder.encode("prueba123"));usuarios.save(u);}
 void actor(String nombre){SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(nombre,"",List.of()));}
 CrearPedido compra(String id,int cantidad,int precio){return new CrearPedido("Cliente","912345678","Calle 1",List.of(new Linea(id,cantidad,BigDecimal.valueOf(precio))));}
 @Test void crudPersistenteYSemillaNoSobrescribe(){assertEquals(4,catalogo.count());productos.editar("5KG",new EditarProducto("Editado","Descripcion",BigDecimal.valueOf(7000)));semilla.run();assertEquals("Editado",catalogo.findById("5KG").orElseThrow().getNombre());productos.crear(new CrearProducto("NUEVO","Cilindro","Descripcion",BigDecimal.TEN,2));assertEquals(2,inventarios.findById("NUEVO").orElseThrow().getStockFisico());productos.desactivar("NUEVO");assertFalse(catalogo.findById("NUEVO").orElseThrow().getActivo());assertEquals(4,productos.listar(false).size());}
 @Test void historialYDesactivacion(){actor("cliente");var p=pedidos.crear(compra("5KG",2,6000));actor("admin");productos.editar("5KG",new EditarProducto("Nuevo nombre","Descripcion",BigDecimal.valueOf(9000)));productos.desactivar("5KG");assertEquals("Cilindro GLP 5KG",pedidos.obtener(p.id()).items().getFirst().nombre());assertEquals(0,BigDecimal.valueOf(6000).compareTo(pedidos.obtener(p.id()).items().getFirst().precioUnitario()));actor("cliente");assertThrows(NegocioException.class,()->pedidos.crear(compra("5KG",1,9000)));}
 @Test void cancelacionParcialYTotalLiberaReservas(){actor("cliente");var p=pedidos.crear(new CrearPedido("Cliente","912345678","Calle",List.of(new Linea("5KG",1,BigDecimal.valueOf(6000)),new Linea("11KG",1,BigDecimal.valueOf(11000)))));pedidos.cancelar(p.id(),p.items().getFirst().id());assertEquals(0,stock.comprometido("5KG"));assertEquals(EstadoPedido.PENDIENTE,pedidos.obtener(p.id()).estado());pedidos.cancelar(p.id(),null);assertEquals(EstadoPedido.CANCELADO,pedidos.obtener(p.id()).estado());assertEquals(0,stock.comprometido("11KG"));assertEquals(25,inventarios.findById("5KG").orElseThrow().getStockFisico());}
 @Test void entregaDescuentaUnaVezYBloqueaCancelacion(){actor("cliente");var p=pedidos.crear(compra("5KG",2,6000));actor("operador");pedidos.avanzar(p.id(),EstadoPedido.EN_CAMINO);assertThrows(NegocioException.class,()->pedidos.cancelar(p.id(),null));pedidos.avanzar(p.id(),EstadoPedido.ENTREGADO);assertEquals(23,inventarios.findById("5KG").orElseThrow().getStockFisico());assertEquals(0,stock.comprometido("5KG"));assertThrows(NegocioException.class,()->pedidos.avanzar(p.id(),EstadoPedido.ENTREGADO));}
 @Test void rechazaPrecioCantidadDuplicadosYNoReservaParcial(){actor("cliente");assertThrows(NegocioException.class,()->pedidos.crear(compra("5KG",1,1)));assertThrows(NegocioException.class,()->pedidos.crear(compra("5KG",5,6000)));var l=new Linea("5KG",1,BigDecimal.valueOf(6000));assertThrows(NegocioException.class,()->pedidos.crear(new CrearPedido("Nombre","912345678","Calle",List.of(l,l))));actor("admin");productos.crear(new CrearProducto("SIN","Vacio","Sin stock",BigDecimal.TEN,0));actor("cliente");assertThrows(NegocioException.class,()->pedidos.crear(new CrearPedido("Nombre","912345678","Calle",List.of(l,new Linea("SIN",1,BigDecimal.TEN)))));assertEquals(0,pedidoRepo.count());assertEquals(0,stock.comprometido("5KG"));}
 @Test void propiedadYRoles(){actor("cliente");var p=pedidos.crear(compra("5KG",1,6000));assertThrows(NegocioException.class,()->productos.desactivar("5KG"));actor("otro");assertThrows(NegocioException.class,()->pedidos.cancelar(p.id(),null));assertThrows(NegocioException.class,()->pedidos.obtener(p.id()));actor("admin");assertThrows(NegocioException.class,()->pedidos.avanzar(p.id(),EstadoPedido.EN_CAMINO));}
 @Test void comprasSimultaneasNoSobrevenden() throws Exception {
  productos.crear(new CrearProducto("ULTIMO","Ultimo","Prueba concurrencia",BigDecimal.TEN,1));
  var inicio=new CountDownLatch(1);var pool=Executors.newFixedThreadPool(2);
  Callable<Boolean> tarea=()->{actor("cliente");inicio.await();try{pedidos.crear(compra("ULTIMO",1,10));return true;}catch(NegocioException e){assertEquals("SIN_STOCK",e.codigo);return false;}finally{SecurityContextHolder.clearContext();}};
  try{var a=pool.submit(tarea);var b=pool.submit(tarea);inicio.countDown();assertNotEquals(a.get(20,TimeUnit.SECONDS),b.get(20,TimeUnit.SECONDS));assertEquals(1,stock.comprometido("ULTIMO"));assertEquals(1,pedidoRepo.count());}finally{pool.shutdownNow();}
 }
 @Test void httpPublicoSwaggerYPermisos() throws Exception {
  mvc.perform(get("/api/v1/productos")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(4));
  mvc.perform(get("/v3/api-docs")).andExpect(status().isOk()).andExpect(jsonPath("$.paths['/api/v1/admin/productos/{id}'].delete").exists());
  mvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
  mvc.perform(get("/api/v1/admin/usuarios")).andExpect(status().isUnauthorized());
  mvc.perform(get("/api/v1/admin/usuarios").with(httpBasic("cliente","prueba123"))).andExpect(status().isForbidden());
  mvc.perform(get("/api/v1/admin/usuarios").with(httpBasic("admin","prueba123"))).andExpect(status().isOk()).andExpect(jsonPath("$[0].passwordHash").doesNotExist()).andExpect(jsonPath("$[0].password").doesNotExist());
 }
 @Test void httpCrudValidacionYRegistro() throws Exception {
  mvc.perform(post("/api/v1/admin/productos").with(httpBasic("admin","prueba123")).contentType("application/json").content("{\"id\":\"API\",\"nombre\":\"Cilindro\",\"descripcion\":\"Nuevo\",\"precio\":100,\"stock\":1}")).andExpect(status().isCreated());
  mvc.perform(put("/api/v1/admin/productos/API").with(httpBasic("admin","prueba123")).contentType("application/json").content("{\"nombre\":\"Editado\",\"descripcion\":\"Nuevo\",\"precio\":200}")).andExpect(status().isOk()).andExpect(jsonPath("$.id").value("API"));
  mvc.perform(delete("/api/v1/admin/productos/API").with(httpBasic("admin","prueba123"))).andExpect(status().isNoContent());
  mvc.perform(get("/api/v1/productos/API")).andExpect(status().isNotFound());
  mvc.perform(post("/api/v1/auth/registro").contentType("application/json").content("{\"usuario\":\"nuevo\",\"nombre\":\"Nombre\",\"password\":\"clave123\"}")).andExpect(status().isCreated()).andExpect(jsonPath("$.rol").value("CLIENTE")).andExpect(jsonPath("$.password").doesNotExist());
  assertTrue(encoder.matches("clave123",usuarios.findByUsuario("nuevo").orElseThrow().getPasswordHash()));
  mvc.perform(post("/api/v1/pedidos").with(httpBasic("cliente","prueba123")).contentType("application/json").content("{\"nombre\":\"Nombre\",\"telefono\":\"mal\",\"direccion\":\"Calle\",\"items\":[]}")).andExpect(status().isBadRequest());
 }
}
