# Documento de Requisitos — Plataforma Digital Costa Mar Barra Cevichera

## Introducción

Costa Mar Barra Cevichera (razón social: COSTAMAR LIMITADA) requiere una plataforma digital integral
para gestionar su operación completa: presencia web pública, carta digital, reservas, pedidos online,
inventario, recetas, club de fidelización, CRM y reportes.

La plataforma se desplegará en una instancia AWS Lightsail existente (Ubuntu 24.04 LTS,
IP 3.143.167.192) con Nginx y Cloudflare como proxy/CDN, usando Supabase Cloud como servicio externo
para base de datos y autenticación. El stack es Angular (web pública + admin) + Ionic/Angular (PWA
Club) + NestJS (API) organizado en un monorepo TypeScript.

El primer entregable cubre: estructura del monorepo, autenticación, modelos de usuarios/roles,
infraestructura Docker, endpoints de salud, pantallas iniciales y primer CRUD operativo.

---

## Glosario

- **Platform**: El conjunto completo de aplicaciones y servicios que conforman la plataforma digital Costa Mar.
- **API**: Servicio backend NestJS accesible en `api.restaurantecostamar.cl`, versionado bajo `/api/v1/`.
- **WebApp**: Aplicación Angular con SSR orientada al público general, accesible en `restaurantecostamar.cl`.
- **AdminApp**: Aplicación Angular para gestión interna, accesible en `admin.restaurantecostamar.cl`.
- **ClubApp**: Aplicación Ionic/Angular PWA de fidelización para clientes registrados.
- **Supabase**: Servicio externo en la nube que provee base de datos PostgreSQL, autenticación y almacenamiento. NO se instala en Lightsail.
- **Auth**: Módulo de autenticación basado en Supabase Auth con soporte Google OAuth.
- **JWT**: Token de autenticación emitido por Supabase Auth y validado por la API.
- **Usuario**: Persona autenticada en la plataforma con un rol asignado.
- **Rol**: Conjunto de permisos asociado a un usuario. Valores: `superadmin`, `admin`, `manager`, `kitchen`, `inventory`, `cashier`, `customer`.
- **Superadmin**: Rol con acceso total a todos los módulos y configuraciones del sistema.
- **Admin**: Rol con acceso a todos los módulos operativos excepto configuración de infraestructura.
- **Manager**: Rol con acceso a reportes, reservas, pedidos, carta y club.
- **Kitchen**: Rol con acceso de solo lectura a pedidos activos y recetas.
- **Inventory**: Rol con acceso a gestión de inventario, compras y proveedores.
- **Cashier**: Rol con acceso a pedidos y caja.
- **Customer**: Rol para clientes registrados con acceso al Club y pedidos online propios.
- **Monorepo**: Repositorio único con múltiples aplicaciones y paquetes compartidos gestionado con npm/pnpm workspaces o Nx.
- **Docker_Compose**: Herramienta de orquestación de contenedores usada en entorno de desarrollo y producción.
- **Nginx**: Servidor web y proxy inverso instalado en el servidor Lightsail, versión 1.24.0.
- **Cloudflare**: Servicio de DNS y proxy que gestiona el tráfico hacia `restaurantecostamar.cl`.
- **Lightsail**: Instancia de servidor AWS usada como entorno de producción.
- **Carta**: Conjunto de categorías, productos, variantes y precios disponibles para el cliente.
- **Producto**: Ítem de la carta con nombre, descripción, precio, imágenes y disponibilidad.
- **Categoría**: Agrupación de productos de la carta (ej.: ceviches, entradas, bebidas).
- **Reserva**: Solicitud de un cliente para ocupar una mesa en una fecha y hora determinadas.
- **Pedido**: Solicitud de compra de productos, con modalidad retiro en local o delivery.
- **Carrito**: Conjunto de ítems seleccionados por el cliente antes de confirmar un pedido.
- **Ingrediente**: Insumo con unidad de medida, stock actual y punto de reorden.
- **Receta**: Ficha técnica de un producto que detalla ingredientes, cantidades y rendimiento.
- **Club**: Programa de fidelización con acumulación de puntos, niveles y beneficios.
- **Puntos**: Unidad de recompensa del Club acumulada por consumos y acciones.
- **CRM**: Módulo de gestión de relaciones con clientes, segmentación y campañas.
- **Health_Endpoint**: Endpoint `GET /api/v1/health` que reporta el estado operativo de la API.
- **CRUD**: Operaciones de Crear, Leer, Actualizar y Eliminar sobre una entidad.
- **SSR**: Renderizado del lado del servidor para mejorar el SEO de la WebApp.
- **PWA**: Progressive Web App; la ClubApp debe instalarse en dispositivos móviles sin pasar por tiendas de aplicaciones.
- **CI/CD**: Pipeline de integración y despliegue continuo implementado con GitHub Actions.
- **RLS**: Row Level Security de PostgreSQL/Supabase para control de acceso a nivel de fila.
- **service_role**: Clave secreta de Supabase con acceso sin restricciones RLS. NUNCA debe exponerse en frontend.
- **anon_key**: Clave pública de Supabase para operaciones anónimas y autenticadas desde el frontend.
- **Rollback**: Procedimiento documentado para revertir un despliegue fallido al estado anterior estable.
- **env.example**: Archivo de plantilla de variables de entorno sin valores secretos incluido en el repositorio.

---

## Requisitos

### Requisito 1: Estructura del Monorepo

**Historia de usuario:** Como desarrollador, quiero un monorepo TypeScript bien estructurado, para que todos los equipos trabajen en el mismo repositorio con código y tipos compartidos.

#### Criterios de Aceptación

1. THE Monorepo SHALL organizar el código en al menos las carpetas `apps/web`, `apps/admin`, `apps/club`, `apps/api` y `packages/shared`.
2. THE Monorepo SHALL compartir tipos TypeScript, utilidades y constantes a través del paquete `packages/shared` sin duplicación entre aplicaciones.
3. THE Monorepo SHALL proveer un comando único desde la raíz para instalar todas las dependencias de todas las aplicaciones.
4. THE Monorepo SHALL proveer scripts de arranque individuales para cada aplicación en el `package.json` raíz.
5. WHEN se agrega un tipo o interfaz al paquete `packages/shared`, THE Monorepo SHALL permitir su uso inmediato en cualquier aplicación sin pasos de compilación manuales adicionales.
6. THE Monorepo SHALL incluir un archivo `.env.example` en la raíz y en cada aplicación que requiera variables de entorno, sin contener valores secretos reales.
7. THE Monorepo SHALL incluir un archivo `.gitignore` que excluya archivos `.env`, `node_modules`, artefactos de build y claves privadas.

---

### Requisito 2: Infraestructura Docker

**Historia de usuario:** Como operador de sistemas, quiero contenedores Docker para cada aplicación, para que el despliegue en Lightsail sea reproducible y aislado.

#### Criterios de Aceptación

1. THE Platform SHALL proveer un `Dockerfile` individual y optimizado para cada una de las cuatro aplicaciones (`web`, `admin`, `club`, `api`).
2. THE Platform SHALL proveer un archivo `docker-compose.yml` en la raíz del monorepo que defina todos los servicios de la plataforma.
3. WHEN se ejecuta `docker-compose up`, THE Docker_Compose SHALL levantar todos los servicios definidos y hacer que la API responda en el Health_Endpoint en menos de 60 segundos.
4. THE Platform SHALL utilizar imágenes base oficiales y fijas (con versión específica, no `latest`) en todos los Dockerfiles.
5. IF una variable de entorno requerida no está definida al iniciar un contenedor, THEN THE Docker_Compose SHALL detener el arranque de ese servicio y registrar un mensaje de error descriptivo.
6. THE Platform SHALL configurar Nginx como proxy inverso en el servidor Lightsail para enrutar tráfico hacia los contenedores según el subdominio correspondiente.
7. WHERE el entorno sea producción, THE Docker_Compose SHALL usar una red interna Docker que no exponga puertos de las aplicaciones directamente, solo a través de Nginx.
8. THE Platform SHALL incluir un procedimiento de Rollback documentado que permita revertir un despliegue fallido al estado anterior en menos de 10 minutos.

---

### Requisito 3: Autenticación e Identidad

**Historia de usuario:** Como usuario del sistema, quiero autenticarme de forma segura, para que solo yo pueda acceder a las funciones y datos que me corresponden según mi rol.

#### Criterios de Aceptación

1. WHEN un usuario envía credenciales válidas de email y contraseña, THE Auth SHALL emitir un JWT firmado por Supabase Auth con el rol del usuario incluido en los claims.
2. WHEN un usuario inicia sesión mediante Google OAuth, THE Auth SHALL crear o actualizar el perfil del usuario en Supabase y emitir un JWT equivalente al flujo de email/contraseña.
3. WHEN un JWT expirado es enviado a la API, THE API SHALL rechazar la solicitud con código HTTP 401 y un mensaje descriptivo.
4. WHEN un JWT válido es enviado a la API, THE API SHALL extraer el rol del usuario desde los claims del token sin consultar la base de datos en cada solicitud.
5. THE Auth SHALL almacenar contraseñas exclusivamente a través de Supabase Auth, nunca en texto plano ni con hash propio en la base de datos de la aplicación.
6. THE Platform SHALL nunca enviar ni exponer la clave `service_role` de Supabase en ningún cliente frontend (WebApp, AdminApp, ClubApp).
7. WHEN un usuario cierra sesión, THE Auth SHALL invalidar el token de sesión activo en Supabase y eliminar cualquier token almacenado en el cliente.
8. IF un usuario no autenticado intenta acceder a una ruta protegida de AdminApp, THEN THE AdminApp SHALL redirigir al usuario a la pantalla de login sin exponer datos de la ruta protegida.
9. THE Auth SHALL soportar recuperación de contraseña mediante envío de email con enlace de restablecimiento.

---

### Requisito 4: Gestión de Usuarios y Roles

**Historia de usuario:** Como superadmin, quiero gestionar usuarios y sus roles, para que cada persona tenga acceso únicamente a las funciones que le corresponden.

#### Criterios de Aceptación

1. THE Platform SHALL definir exactamente siete roles: `superadmin`, `admin`, `manager`, `kitchen`, `inventory`, `cashier` y `customer`.
2. WHEN un superadmin crea un usuario interno, THE API SHALL asignar un rol distinto de `customer` y registrar al usuario en Supabase Auth y en la tabla de perfiles.
3. WHEN se intenta asignar un rol no definido en el sistema, THE API SHALL rechazar la operación con código HTTP 400 y listar los roles válidos.
4. WHILE un usuario con rol `kitchen` está autenticado, THE API SHALL permitir únicamente operaciones de lectura sobre pedidos activos y recetas.
5. WHILE un usuario con rol `inventory` está autenticado, THE API SHALL permitir operaciones CRUD completas sobre ingredientes, stock y proveedores.
6. WHILE un usuario con rol `cashier` está autenticado, THE API SHALL permitir únicamente operaciones sobre pedidos y caja.
7. THE Platform SHALL implementar RLS en Supabase de modo que ningún usuario pueda leer ni modificar datos de otro usuario fuera de los permisos de su rol.
8. WHEN un superadmin modifica el rol de un usuario, THE API SHALL aplicar el cambio de permisos en la siguiente solicitud autenticada del usuario afectado.
9. THE API SHALL proveer un endpoint para listar, crear, actualizar y desactivar usuarios, accesible únicamente para los roles `superadmin` y `admin`.

---

### Requisito 5: API — Salud y Versionado

**Historia de usuario:** Como desarrollador y operador, quiero un endpoint de salud y un esquema de versionado estable, para verificar el estado de la API y gestionar cambios sin romper clientes existentes.

#### Criterios de Aceptación

1. THE API SHALL exponer un endpoint `GET /api/v1/health` de acceso público que retorne código HTTP 200 y un objeto JSON con al menos los campos `status`, `timestamp` y `version`.
2. WHEN la conexión con Supabase no está disponible, THE Health_Endpoint SHALL retornar código HTTP 503 con el campo `status` igual a `"degraded"` y descripción del componente afectado.
3. THE API SHALL versionar todos los endpoints bajo el prefijo `/api/v1/`.
4. WHEN se lanza una versión nueva de la API con cambios incompatibles, THE API SHALL mantener la versión anterior activa bajo su prefijo hasta que todos los clientes hayan migrado.
5. THE API SHALL retornar errores estructurados con los campos `statusCode`, `message` y `timestamp` en todas las respuestas de error.
6. THE API SHALL registrar logs estructurados en formato JSON para cada solicitud, incluyendo método, ruta, código de respuesta y duración en milisegundos.

---

### Requisito 6: Web Pública (WebApp)

**Historia de usuario:** Como visitante del restaurante, quiero acceder a una web moderna y rápida, para conocer el restaurante, ver la carta y encontrar información de contacto.

#### Criterios de Aceptación

1. THE WebApp SHALL renderizar todas las páginas públicas con SSR para garantizar indexabilidad por motores de búsqueda.
2. THE WebApp SHALL mostrar al menos: página de inicio con identidad visual del restaurante, carta digital, sección de reservas, sección de pedidos online y acceso al Club.
3. WHEN un motor de búsqueda indexa la WebApp, THE WebApp SHALL incluir metaetiquetas `title`, `description` y Open Graph en cada página con contenido específico de esa página.
4. THE WebApp SHALL ser responsive y funcionar correctamente en dispositivos móviles con ancho de pantalla desde 320px hasta 2560px.
5. WHEN un visitante accede a `restaurantecostamar.cl`, THE WebApp SHALL cargar la página de inicio en menos de 3 segundos en una conexión de 10 Mbps.
6. THE WebApp SHALL mostrar los datos de contacto del restaurante: dirección, teléfono y redes sociales en el footer de todas las páginas.
7. WHEN la Carta no está disponible por fallo de la API, THE WebApp SHALL mostrar un mensaje informativo al visitante sin mostrar errores técnicos internos.

---

### Requisito 7: Panel Administrativo (AdminApp)

**Historia de usuario:** Como administrador del restaurante, quiero un panel centralizado seguro, para gestionar todos los módulos operativos del negocio.

#### Criterios de Aceptación

1. THE AdminApp SHALL requerir autenticación mediante JWT válido antes de mostrar cualquier contenido del panel.
2. THE AdminApp SHALL mostrar únicamente las secciones del menú de navegación a las que el rol del usuario autenticado tiene acceso.
3. WHEN un usuario con rol `kitchen` accede a AdminApp, THE AdminApp SHALL mostrar exclusivamente la vista de pedidos activos y recetas, sin opciones de edición de inventario, finanzas ni configuración.
4. THE AdminApp SHALL proveer un dashboard inicial que muestre métricas clave del día: reservas del día, pedidos activos, alertas de stock bajo y resumen de ventas.
5. WHEN la sesión del usuario expira mientras usa AdminApp, THE AdminApp SHALL mostrar un modal informativo y redirigir al login sin pérdida de datos en formularios activos.
6. THE AdminApp SHALL funcionar correctamente en los navegadores Chrome, Firefox, Safari y Edge en sus dos últimas versiones principales.

---

### Requisito 8: Carta Digital

**Historia de usuario:** Como administrador, quiero gestionar la carta del restaurante digitalmente, para que los cambios de precios y disponibilidad se reflejen de inmediato en la web pública.

#### Criterios de Aceptación

1. THE API SHALL proveer endpoints CRUD completos para Categorías y Productos de la Carta.
2. WHEN un administrador crea un Producto, THE API SHALL requerir al menos: nombre, descripción, precio, categoría y estado de disponibilidad.
3. WHEN un administrador actualiza la disponibilidad de un Producto, THE WebApp SHALL reflejar el cambio en menos de 30 segundos sin requerir recarga manual de la página.
4. THE API SHALL soportar variantes por Producto (ej.: tamaño, temperatura) con precios independientes por variante.
5. WHEN se elimina una Categoría que contiene Productos, THE API SHALL rechazar la operación con código HTTP 409 y listar los productos afectados.
6. THE Platform SHALL almacenar imágenes de Productos en Supabase Storage y retornar URLs públicas firmadas con caducidad configurable.
7. WHEN se consulta la Carta desde la WebApp, THE API SHALL retornar únicamente los productos con disponibilidad activa, ordenados por categoría y posición definida.

---

### Requisito 9: Sistema de Reservas

**Historia de usuario:** Como cliente, quiero reservar una mesa en línea, para asegurar mi lugar sin necesidad de llamar al restaurante.

#### Criterios de Aceptación

1. THE API SHALL proveer endpoints para crear, consultar, modificar y cancelar Reservas.
2. WHEN un cliente solicita una Reserva, THE API SHALL requerir: nombre, teléfono de contacto, fecha, hora, número de personas y confirmación de disponibilidad.
3. WHEN un cliente solicita una Reserva en una franja horaria sin disponibilidad, THE API SHALL rechazar la solicitud con código HTTP 409 e indicar las franjas horarias disponibles más próximas.
4. WHEN una Reserva es confirmada, THE API SHALL enviar una notificación de confirmación al email del cliente con los detalles de la reserva.
5. WHEN un cliente cancela una Reserva con más de 2 horas de anticipación, THE API SHALL cambiar el estado a `cancelada` y liberar la disponibilidad de la mesa.
6. WHILE el restaurante está fuera del horario de atención configurado, THE API SHALL rechazar nuevas solicitudes de Reserva e informar el próximo horario disponible.
7. THE API SHALL permitir al manager configurar: horarios de atención, número de mesas disponibles por franja y máximo de comensales simultáneos.

---

### Requisito 10: Pedidos Online

**Historia de usuario:** Como cliente, quiero hacer pedidos en línea con opción de retiro o delivery, para recibir comida de Costa Mar sin ir presencialmente.

#### Criterios de Aceptación

1. THE WebApp SHALL permitir a clientes agregar Productos al Carrito y modificar cantidades antes de confirmar el Pedido.
2. WHEN un cliente confirma un Pedido, THE API SHALL requerir: modalidad (retiro/delivery), datos de contacto, productos seleccionados y método de pago.
3. WHEN un Pedido es creado, THE API SHALL asignar un identificador único, estado inicial `recibido` y registrar la marca de tiempo de creación.
4. THE API SHALL gestionar el ciclo de vida de un Pedido a través de los estados: `recibido`, `en_preparacion`, `listo`, `entregado` y `cancelado`.
5. WHEN el estado de un Pedido cambia, THE API SHALL actualizar la marca de tiempo del cambio y registrar el usuario que realizó la transición.
6. WHILE un Pedido tiene estado `en_preparacion` o `listo`, THE API SHALL rechazar solicitudes de cancelación del cliente e indicar que debe contactar al local.
7. WHEN se solicita un Producto que no está disponible en la Carta al momento de confirmar el Pedido, THE API SHALL rechazar el Pedido con código HTTP 409 e indicar los productos no disponibles.
8. THE API SHALL exponer el estado actual del Pedido en un endpoint público accesible mediante el identificador único del Pedido sin requerir autenticación.

---

### Requisito 11: Gestión de Inventario

**Historia de usuario:** Como encargado de inventario, quiero registrar y controlar el stock de ingredientes, para evitar desabastecimiento y reducir mermas.

#### Criterios de Aceptación

1. THE API SHALL proveer endpoints CRUD completos para Ingredientes, incluyendo nombre, unidad de medida, stock actual, punto de reorden y costo unitario.
2. WHEN el stock de un Ingrediente cae por debajo del punto de reorden, THE API SHALL registrar una alerta de stock bajo asociada al Ingrediente.
3. THE API SHALL registrar cada movimiento de inventario con: tipo (`entrada`, `salida`, `merma`, `ajuste`), cantidad, fecha, usuario responsable y motivo.
4. WHEN se registra una salida de inventario que resulte en stock negativo, THE API SHALL rechazar la operación con código HTTP 409 e indicar el stock disponible actual.
5. THE API SHALL proveer un endpoint de consulta de alertas de stock bajo activas, accesible para los roles `inventory`, `manager`, `admin` y `superadmin`.
6. WHEN se registra la recepción de una orden de compra, THE API SHALL incrementar el stock de los Ingredientes correspondientes y registrar el costo unitario del lote recibido.
7. THE API SHALL soportar agrupación de movimientos por lote para trazabilidad de ingredientes desde recepción hasta consumo.

---

### Requisito 12: Compras y Proveedores

**Historia de usuario:** Como encargado de inventario, quiero gestionar proveedores y órdenes de compra, para controlar los costos de insumos y mantener el abastecimiento.

#### Criterios de Aceptación

1. THE API SHALL proveer endpoints CRUD completos para Proveedores, incluyendo nombre, RUT, contacto, teléfono, email y condiciones de pago.
2. THE API SHALL proveer endpoints para crear, consultar y actualizar Órdenes de Compra asociadas a un Proveedor.
3. WHEN se crea una Orden de Compra, THE API SHALL requerir: proveedor, lista de ingredientes con cantidades y precios unitarios, y fecha estimada de entrega.
4. WHEN se registra la recepción parcial de una Orden de Compra, THE API SHALL actualizar el estado a `recibida_parcial` e indicar los ítems pendientes.
5. WHEN se recibe la totalidad de una Orden de Compra, THE API SHALL actualizar el estado a `recibida_completa` y disparar la actualización de stock del Requisito 11.
6. THE API SHALL calcular y almacenar el costo total de cada Orden de Compra como la suma de (cantidad × precio unitario) de todos sus ítems.

---

### Requisito 13: Recetas y Costos

**Historia de usuario:** Como administrador, quiero definir las fichas técnicas de cada plato, para calcular automáticamente el costo por porción y proteger el margen del negocio.

#### Criterios de Aceptación

1. THE API SHALL proveer endpoints CRUD completos para Recetas asociadas a Productos de la Carta.
2. WHEN se crea o actualiza una Receta, THE API SHALL requerir: producto asociado, lista de Ingredientes con cantidad y unidad de medida, y rendimiento en porciones.
3. WHEN se guarda una Receta, THE API SHALL calcular automáticamente el costo por porción como la suma de (cantidad × costo unitario del ingrediente) dividida entre el rendimiento.
4. WHEN el costo unitario de un Ingrediente es actualizado, THE API SHALL recalcular automáticamente el costo por porción de todas las Recetas que lo utilizan.
5. THE API SHALL retornar en la consulta de una Receta: costo por porción, precio de venta del Producto asociado y margen bruto calculado como (precio_venta - costo_porcion) / precio_venta.
6. IF un Ingrediente utilizado en una Receta es eliminado, THEN THE API SHALL rechazar la eliminación con código HTTP 409 e indicar las Recetas afectadas.

---

### Requisito 14: Club de Fidelización (Club Costa Mar)

**Historia de usuario:** Como cliente frecuente, quiero acumular puntos por mis consumos y acceder a beneficios exclusivos, para sentirme valorado y tener incentivos para volver.

#### Criterios de Aceptación

1. THE API SHALL registrar automáticamente a un cliente en el Club cuando completa su primer Pedido confirmado con cuenta registrada.
2. WHEN un Pedido es marcado como `entregado`, THE API SHALL acreditar puntos al cliente según la regla de puntos vigente (por defecto: 1 punto por cada 100 pesos chilenos del total del pedido).
3. THE API SHALL definir al menos tres niveles del Club con nombres configurables (ej.: Bronce, Plata, Oro) y umbrales de puntos acumulados para cada nivel.
4. WHEN un cliente alcanza el umbral de puntos de un nivel superior, THE API SHALL actualizar su nivel y registrar la fecha del cambio.
5. THE ClubApp SHALL permitir al cliente consultar su saldo de puntos, nivel actual, historial de acumulación y beneficios disponibles.
6. THE API SHALL generar un código QR único por cliente para identificación en el local y acreditación de puntos en consumos presenciales.
7. WHEN el cumpleaños de un cliente registrado coincide con la fecha actual, THE API SHALL registrar un beneficio de cumpleaños activo durante los 7 días siguientes al cumpleaños.
8. THE ClubApp SHALL funcionar como PWA instalable en dispositivos iOS y Android sin requerir distribución por tiendas de aplicaciones.
9. WHEN un cliente canjea puntos, THE API SHALL verificar que el saldo sea suficiente antes de aplicar el descuento y registrar el movimiento de puntos.

---

### Requisito 15: CRM y Marketing

**Historia de usuario:** Como administrador, quiero gestionar perfiles de clientes y ejecutar campañas de comunicación, para aumentar la recurrencia de visitas y el ticket promedio.

#### Criterios de Aceptación

1. THE API SHALL mantener un perfil unificado por cliente con: nombre, email, teléfono, fecha de nacimiento, historial de pedidos y estado en el Club.
2. THE API SHALL proveer endpoints de segmentación de clientes filtrando por: nivel del Club, fecha de último pedido, número de pedidos y monto acumulado.
3. WHEN un administrador crea una campaña de email, THE API SHALL validar que la lista de destinatarios no supere el límite del proveedor de email configurado antes de programar el envío.
4. THE API SHALL soportar la creación de cupones de descuento con: código único, porcentaje o monto fijo, fecha de vencimiento, límite de usos totales y límite de usos por cliente.
5. WHEN un cliente intenta usar un cupón vencido o agotado, THE API SHALL rechazar la aplicación del cupón con código HTTP 422 e indicar el motivo específico.
6. WHEN un cupón es aplicado a un Pedido, THE API SHALL decrementar el contador de usos del cupón e impedir su reutilización por el mismo cliente si alcanzó el límite individual.

---

### Requisito 16: Reportes y Analítica

**Historia de usuario:** Como administrador, quiero acceder a reportes operativos y financieros, para tomar decisiones basadas en datos reales del negocio.

#### Criterios de Aceptación

1. THE API SHALL proveer un endpoint de reporte de ventas filtrable por rango de fechas que retorne: total de pedidos, monto total, ticket promedio y desglose por modalidad (retiro/delivery).
2. THE API SHALL proveer un endpoint de reporte de inventario que muestre: stock actual por ingrediente, movimientos del período y lista de ingredientes con alerta de stock bajo.
3. THE API SHALL proveer un endpoint de reporte de costos que muestre: costo total de ingredientes consumidos, comparación con ingresos del período y margen bruto por producto.
4. THE API SHALL proveer un endpoint de reporte de fidelización que muestre: clientes activos por nivel, puntos emitidos y canjeados en el período, y tasa de retención.
5. WHEN se solicita un reporte para un rango de fechas mayor a 90 días, THE API SHALL procesar la solicitud de forma asíncrona y notificar al usuario cuando el reporte esté disponible.
6. THE API SHALL requerir autenticación y rol mínimo `manager` para acceder a cualquier endpoint de reporte.

---

### Requisito 17: Seguridad y Cumplimiento

**Historia de usuario:** Como operador, quiero que la plataforma cumpla con estándares de seguridad, para proteger los datos de los clientes y la operación del negocio.

#### Criterios de Aceptación

1. THE Platform SHALL cifrar todas las comunicaciones entre clientes y servidor usando TLS 1.2 o superior, gestionado por Cloudflare y el certificado Origin CA.
2. THE API SHALL implementar rate limiting de al menos 100 solicitudes por minuto por dirección IP en endpoints públicos para mitigar abuso.
3. THE API SHALL validar y sanitizar todos los parámetros de entrada antes de ejecutar cualquier operación en la base de datos.
4. THE Platform SHALL almacenar únicamente los datos personales estrictamente necesarios para la operación del servicio (minimización de datos).
5. THE Platform SHALL nunca registrar en logs los valores de contraseñas, tokens completos, números de tarjeta ni datos sensibles de clientes.
6. IF se detectan 5 intentos fallidos de autenticación consecutivos desde la misma IP en menos de 10 minutos, THEN THE Auth SHALL bloquear temporalmente nuevos intentos desde esa IP por 15 minutos.
7. THE Platform SHALL implementar RLS en todas las tablas de Supabase que contengan datos de clientes o información financiera.
8. THE CI/CD SHALL ejecutar análisis estático de seguridad en cada pull request antes de permitir el merge a la rama principal.

---

### Requisito 18: CI/CD y Despliegue

**Historia de usuario:** Como desarrollador, quiero un pipeline de CI/CD automatizado, para que los cambios se validen y desplieguen de forma segura y repetible.

#### Criterios de Aceptación

1. THE CI/CD SHALL ejecutar automáticamente: instalación de dependencias, compilación, pruebas unitarias y pruebas de integración en cada pull request.
2. WHEN todas las validaciones del CI/CD pasan en la rama principal, THE CI/CD SHALL construir las imágenes Docker y desplegarlas en el servidor Lightsail sin intervención manual.
3. THE CI/CD SHALL almacenar los secretos de despliegue (claves SSH, tokens) exclusivamente en los secrets del repositorio de GitHub, sin incluirlos en el código fuente.
4. WHEN un despliegue en producción falla, THE CI/CD SHALL ejecutar automáticamente el procedimiento de Rollback y notificar al equipo.
5. THE CI/CD SHALL verificar que el Health_Endpoint responda HTTP 200 después de cada despliegue antes de declarar el despliegue como exitoso.
6. THE Platform SHALL documentar el procedimiento completo de instalación local y despliegue en Lightsail en un archivo `docs/deployment.md`.

---

### Requisito 19: Primer Entregable Operativo

**Historia de usuario:** Como equipo de desarrollo, quiero tener un entorno funcional de extremo a extremo desde el primer sprint, para validar la arquitectura y el flujo de trabajo antes de construir funcionalidades complejas.

#### Criterios de Aceptación

1. THE Platform SHALL proveer una pantalla de bienvenida pública en `restaurantecostamar.cl` con la identidad visual del restaurante y acceso a la carta.
2. THE Platform SHALL proveer una pantalla de login en `admin.restaurantecostamar.cl` con autenticación por email/contraseña y Google OAuth funcionales.
3. WHEN un administrador se autentica exitosamente, THE AdminApp SHALL mostrar un dashboard con estructura de navegación por módulos.
4. THE AdminApp SHALL incluir un CRUD completo y funcional de Ingredientes como primer módulo operativo del inventario.
5. THE API SHALL responder correctamente al Health_Endpoint con información de versión y estado de conexión a Supabase.
6. THE Platform SHALL incluir al menos pruebas unitarias básicas para: lógica de autenticación, guard de roles y endpoints del CRUD de Ingredientes.
7. WHEN se ejecuta el comando de pruebas desde la raíz del monorepo, THE Platform SHALL ejecutar todas las pruebas y reportar resultados con indicación clara de éxitos y fallos.
