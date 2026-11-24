# Backend Distribuidora de Gas El Volcan - Fase A

## Alcance y referencias

Spring Boot 4.1.0, Java 21, Maven y springdoc 3.1.1, conforme a las guias 3.1.2 y 3.2.2 actualizadas. H2 en archivo es suficiente para evaluacion local y conserva datos. La rubrica exige backend, REST y Swagger; integracion Axios y JWT quedan para fases B/C.

No se modificaron los servicios React. No se importan automaticamente datos de localStorage. Los productos iniciales son los cuatro existentes; no se generan pedidos ni clientes ficticios.

## Ejecutar en IntelliJ

1. Abrir `backend/pom.xml` como proyecto Maven (o agregarlo al proyecto actual).
2. Configurar Project SDK y Maven Runner JRE en Java 21. En este equipo existe `C:/Users/benja/.jdks/ms-21.0.10`.
3. Configurar directorio de trabajo `backend` para que H2 use siempre la misma carpeta.
4. Definir `BOOTSTRAP_ADMIN_PASSWORD` y `BOOTSTRAP_OPERADOR_PASSWORD` con claves locales elegidas por el estudiante (minimo seis caracteres, sin guardarlas en Git). Crean las cuentas `admin` y `operador` solo si no existen. No cambian claves existentes.
5. Ejecutar `cl.elvolcan.ElVolcanApplication`.
6. Abrir http://localhost:8080/swagger-ui.html o http://localhost:8080/swagger-ui/index.html. OpenAPI: http://localhost:8080/v3/api-docs.

PowerShell desde backend:

```powershell
$env:JAVA_HOME='C:/Users/benja/.jdks/ms-21.0.10'
& "$env:JAVA_HOME/bin/java.exe" -version
.\mvnw.cmd -version
.\mvnw.cmd verify
.\mvnw.cmd spring-boot:run
```

La terminal global puede mostrar Java 17: no cambia el requisito del proyecto. Se usa Java 21 mediante JAVA_HOME. No se requiere instalar otro JDK en este equipo. Maven Wrapper descarga Maven/dependencias cuando faltan.

## Base de datos

URL predeterminada: `jdbc:h2:file:./data/elvolcan;LOCK_TIMEOUT=10000;WRITE_DELAY=0`.
Usuario local `sa`, clave vacia por defecto, configurables con `DB_URL`, `DB_USER`, `DB_PASSWORD`. Servidor enlazado solamente a 127.0.0.1. WRITE_DELAY=0 solicita escritura inmediata, tambien usada en la prueba de reinicio forzado en Windows. Archivo `data/elvolcan.mv.db`, excluido de Git. No iniciar dos procesos sobre el mismo archivo.

Se usa `ddl-auto=update` como en la guia de H2 persistente. Antes de despliegue o cambios de esquema con datos reales se debe adoptar migraciones SQL versionadas. No se habilita la consola web H2; Swagger cubre la evaluacion de endpoints. La base puede inspeccionarse desde IntelliJ, deteniendo primero la aplicacion.

## Entidades

- Usuario: ID generado, usuario unico, nombre, hash BCrypt, rol CLIENTE/OPERADOR/ADMINISTRADOR, activo.
- Producto: ID comercial inmutable (5KG, 11KG, 15KG, 45KG), nombre, descripcion, precio entero positivo, activo y version.
- Inventario: relacion uno a uno con Producto mediante clave compartida; stock fisico no negativo y version.
- Pedido: relacion muchos a uno con Usuario, datos de entrega, fecha Instant UTC, estado y version.
- DetallePedido: muchos a uno con Pedido y Producto, cantidad, nombre/precio historicos y cancelado; producto unico por pedido.

RefreshToken se reserva para Fase C: relacion muchos a uno con Usuario, hash de token unico, expiracion, revocacion y familia para rotacion. No existe tabla ni emision de tokens en Fase A.

No se serializan entidades JPA: todos los endpoints usan DTO que excluyen hashes y claves. El frontend futuro mapeara ADMINISTRADOR a su actual `admin` y estados tecnicos a etiquetas en espanol.

## Reglas transaccionales

Maximo cuatro unidades sumando detalles; cantidades positivas, sin productos duplicados. El servidor obtiene el usuario autenticado y el precio/nombre del catalogo. `precioEsperado` se compara con el precio vigente; si cambio, devuelve 409 para volver a confirmar. No es una fuente de precio.

Stock comprometido se calcula sobre detalles no cancelados de pedidos PENDIENTE o EN_CAMINO. Disponible = fisico - comprometido. No se duplica reserva en otra columna. Pedido nuevo reserva sin descontar fisico. Solo ENTREGADO descuenta fisico. Solo PENDIENTE permite cancelar; cancelar el ultimo detalle cancela todo el pedido.

Transacciones READ_COMMITTED con bloqueo pesimista de Producto e Inventario por ID ascendente. El calculo de reserva ocurre despues de adquirir bloqueos. Cancelacion/avance bloquean primero la cabecera del pedido y luego los mismos productos. Edicion/desactivacion bloquean Producto. Dos compras no pueden consumir simultaneamente la ultima unidad. Un error revierte el pedido completo. El precio usa BigDecimal.

DELETE desactiva; no elimina registros fisicos ni historiales. Los pedidos existentes siguen pudiendo entregarse aunque se desactive un producto.

## Seguridad provisional

HTTP Basic contra usuarios persistidos y BCrypt, exclusivamente para Swagger/Postman local; no JWT, login con tokens, refresh ni sesiones persistentes. Swagger permite Authorize con las cuentas inicializadas por variables de entorno. El registro publico siempre asigna CLIENTE y no acepta un rol como autoridad. El usuario del pedido se obtiene del contexto de seguridad.

Se comprueban roles en servicios y rutas administrativas; tambien propiedad del pedido. Administrador consulta pedidos, pero no los cancela ni avanza. Cliente solo ve/cancela los propios. Operador consulta inventario y pedidos, cancela pendientes y avanza estados.

CSRF deshabilitado para esta API provisional de herramientas locales; NO es una configuracion para integrar Basic en el navegador o desplegar publicamente. CORS permite solo http://localhost:5173. Fase C sustituira Basic por JWT validado, manteniendo ActorActual, autorizaciones y DTO. No confiar en localStorage ni cabeceras de rol.

## Endpoints

Prefijo `/api/v1`:

| Metodo | Ruta | Acceso |
|---|---|---|
| GET | /productos, /productos/{id} | Publico, activos |
| GET | /admin/productos | Administrador, todos |
| POST | /admin/productos | Administrador, crear con stock inicial |
| PUT | /admin/productos/{id} | Administrador, nombre/descripcion/precio |
| DELETE | /admin/productos/{id} | Administrador, desactivacion logica |
| GET | /inventario | Operador/administrador |
| POST | /pedidos | Cliente |
| GET | /pedidos | Operador/administrador |
| GET | /mis-pedidos | Cliente, propios |
| GET | /pedidos/{id} | Propietario/operador/administrador |
| PATCH | /pedidos/{id}/estado | Operador |
| PATCH | /pedidos/{id}/cancelacion | Propietario/operador |
| PATCH | /pedidos/{id}/detalles/{detalleId}/cancelacion | Propietario/operador |
| POST | /auth/registro | Publico, cliente |
| GET | /auth/me | Autenticado |
| GET | /admin/usuarios | Administrador, sin secretos |
| GET | /admin/indicadores | Administrador |

Codigos: 200 consultas/ediciones, 201 creacion, 204 desactivacion, 400 validacion, 401 sin credenciales, 403 permisos, 404 inexistente, 409 conflicto de negocio/persistencia. Errores de negocio usan ProblemDetail y `code`. Los errores de campos no revelan valores recibidos.

Ejemplo POST /pedidos autenticado como cliente:

```json
{"nombre":"Destinatario","telefono":"912345678","direccion":"Direccion de entrega","items":[{"productoId":"5KG","cantidad":2,"precioEsperado":6000}]}
```

## Validacion

`mvnw.cmd verify`: nueve pruebas de integracion con H2 en memoria aislada. Cubren CRUD, semilla no destructiva, desactivacion, precios/nombres historicos, reservas/cancelaciones, entrega unica, validaciones, permisos/propiedad, compra concurrente, respuestas HTTP y Swagger.

`python verificar_persistencia.py`: prueba de humo adicional del JAR, servidor HTTP real, Swagger y H2 en archivo tras dos arranques; usa puerto 18081 y directorio temporal aislado. Requiere Python y JAVA_HOME apuntando a JDK 21. No toca data/.

Frontend: ejecutar `npm.cmd test` y `npm.cmd run build` desde la raiz.

## Rubrica y pendientes

IE3.1.1: implementado backend/base/modelos/reglas. IE3.2.1: implementado REST CRUD y Swagger (DELETE logico justificado por historial). IE3.2.2: pendiente Fase B. IE3.3.1: parcial, roles comprobados pero JWT/renovacion pendientes. IE3.3.2/3: frontend existente aun local, integracion segura pendiente. IE3.3.5/6 son indicadores de presentacion, pendientes de demostracion final.

No hay paginacion ni claves de idempotencia para reintentos de creacion todavia; un reintento HTTP puede crear un segundo pedido valido si queda stock. No hay reposicion/ajuste de stock (igual que el alcance actual). H2 local no sustituye validar concurrencia en otra base si se migra. Manual con capturas, documento de integracion y repositorios publicos frontend/backend son entregables de la rubrica aun pendientes. No se publicaron repositorios.

## Archivos

```text
.gitignore
.mvn/wrapper/maven-wrapper.properties
mvnw
mvnw.cmd
pom.xml
src/main/java/cl/elvolcan/config/DatosIniciales.java
src/main/java/cl/elvolcan/config/OpenApiConfig.java
src/main/java/cl/elvolcan/config/SeguridadConfig.java
src/main/java/cl/elvolcan/controller/AdministracionController.java
src/main/java/cl/elvolcan/controller/InventarioController.java
src/main/java/cl/elvolcan/controller/PedidosController.java
src/main/java/cl/elvolcan/controller/ProductosController.java
src/main/java/cl/elvolcan/controller/UsuariosController.java
src/main/java/cl/elvolcan/dto/Contratos.java
src/main/java/cl/elvolcan/ElVolcanApplication.java
src/main/java/cl/elvolcan/entity/DetallePedido.java
src/main/java/cl/elvolcan/entity/EstadoPedido.java
src/main/java/cl/elvolcan/entity/Inventario.java
src/main/java/cl/elvolcan/entity/Pedido.java
src/main/java/cl/elvolcan/entity/Producto.java
src/main/java/cl/elvolcan/entity/Rol.java
src/main/java/cl/elvolcan/entity/Usuario.java
src/main/java/cl/elvolcan/exception/ErroresApi.java
src/main/java/cl/elvolcan/exception/NegocioException.java
src/main/java/cl/elvolcan/repository/DetallePedidoRepository.java
src/main/java/cl/elvolcan/repository/InventarioRepository.java
src/main/java/cl/elvolcan/repository/PedidoRepository.java
src/main/java/cl/elvolcan/repository/ProductoRepository.java
src/main/java/cl/elvolcan/repository/UsuarioRepository.java
src/main/java/cl/elvolcan/security/ActorActual.java
src/main/java/cl/elvolcan/service/IndicadoresService.java
src/main/java/cl/elvolcan/service/InventarioService.java
src/main/java/cl/elvolcan/service/PedidosService.java
src/main/java/cl/elvolcan/service/ProductosService.java
src/main/java/cl/elvolcan/service/UsuariosService.java
src/main/resources/application.properties
src/test/java/cl/elvolcan/BackendTest.java
verificar_persistencia.py
```

Resultados verificados en esta entrega: 9 pruebas backend aprobadas sin fallos, prueba de humo de persistencia aprobada, 39 pruebas frontend aprobadas en 9 archivos y build Vite exitoso. JAR ejecutable generado en target/backend-0.1.0.jar.
