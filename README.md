# Maira Analytics

Maira Analytics es una plataforma web de inteligencia de negocios para una farmacia local. Reúne análisis de ventas, ranking de productos, comparación de precios entre proveedores, insights asistidos por IA y alertas de stock bajo. El proyecto fue desarrollado por un equipo de tres personas como proyecto de título para una clienta real.

Este README combina la guía para instalar y ejecutar la aplicación con la descripción del proyecto y la experiencia de trabajo del equipo. Los datos reales de la farmacia no forman parte de este repositorio; la versión pública utiliza datos ficticios. Para proteger al cliente, no se incluyen nombres personales ni documentos internos, actas o capturas.

## Contenido

1. [Ejecutar el proyecto localmente](#1-ejecutar-el-proyecto-localmente)
2. [El proyecto](#parte-1-el-proyecto)
3. [Documentación de gestión realizada](#documentación-de-gestión-realizada)
4. [Mi experiencia](#parte-2-mi-experiencia)

---
# 1. Ejecutar el proyecto localmente

## Funcionalidades

- Inicio de sesión y sesiones mediante Supabase Auth.
- Paneles de ventas y analítica farmacéutica.
- Ranking de productos e insights de ventas.
- Comparación de precios y análisis de proveedores.
- Alertas de inventario y stock mínimo.
- Gestión de usuarios, roles y permisos.
- Mensajería interna.
- Análisis con IA mediante Groq (requiere API key).

## Tecnologías

- Next.js 15 y React 19 con TypeScript.
- Supabase Auth y PostgreSQL.
- Prisma ORM.
- Tailwind CSS.
- Groq para las funciones de análisis con IA.
- Swagger UI con una especificación OpenAPI para explorar y probar endpoints.

## Requisitos

- Node.js 20 LTS recomendado (el proyecto usa Next.js 15).
- npm.
- Un proyecto de Supabase con PostgreSQL.
- Credenciales de Groq para probar los análisis con IA.

## Instalación

Clona el repositorio e instala las dependencias:

```bash
git clone <URL_DEL_REPOSITORIO>
cd maira-analytics
npm ci
```

Crea `.env.local` desde el archivo de ejemplo. En macOS/Linux:

```bash
cp .env.local.example .env.local
```

En PowerShell:

```powershell
Copy-Item .env.local.example .env.local
```

Completa las variables requeridas antes de iniciar la aplicación.

## Variables de entorno

### Aplicación

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí | Clave pública/anon de Supabase usada por el cliente. Configura las políticas RLS apropiadas en la base de datos. |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí para funciones administrativas y seed | Clave privada usada en el servidor para operaciones administrativas. No uses el prefijo `NEXT_PUBLIC_` ni la expongas al navegador. |
| `DATABASE_URL` | Sí | Conexión a PostgreSQL usada por Prisma. Para entornos serverless puede utilizarse la URL del pooler de Supabase. |
| `DIRECT_URL` | Sí | Conexión directa a PostgreSQL para operaciones de Prisma que requieren conexión directa. |
| `GROQ_API_KEY` | No, solo para análisis con IA | API key de Groq. Sin ella, las funciones de IA no estarán disponibles. |
| `GROQ_MODEL` | No | Identificador de modelo de Groq. Por defecto: `openai/gpt-oss-20b`. Cámbialo por un modelo disponible en tu cuenta. |
| `NEXT_PUBLIC_BASE_URL` | No | URL base que utiliza un endpoint de análisis para consultar la API interna. Por defecto: `http://localhost:3000`. |

Las variables `NEXT_PUBLIC_*` quedan disponibles en el bundle del navegador. No guardes secretos en ellas. `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL` y `GROQ_API_KEY` deben permanecer del lado del servidor.

### Variables para poblar datos de demostración

Estas variables se utilizan al ejecutar `npm run db:seed`; no son necesarias para iniciar la aplicación con una base de datos ya preparada.

| Variable | Requerida para el seed | Descripción |
| --- | --- | --- |
| `SEED_EXPECTED_REF` | Sí | Project Reference de Supabase. El seed comprueba que las URLs de Supabase y de la base de datos apunten a ese proyecto. |
| `SEED_ADMIN_PASSWORD` | Sí | Contraseña que se asignará a la cuenta de demostración administradora. |
| `SEED_DEMO_PASSWORD` | Sí | Contraseña para las demás cuentas de demostración. |
| `SEED_BOLETAS` | No | Número de boletas ficticias a generar. Por defecto: `15000`. Usa `0` para omitir la generación de boletas. |
| `SEED_RESET` | No | Si se establece en `true`, elimina las boletas existentes antes de generarlas de nuevo. No lo uses en una base con datos que quieras conservar. |
| `SUPABASE_SECRET_KEY` | No | Alias aceptado por el seed para la clave administrativa; también acepta `SUPABASE_SERVICE_ROLE_KEY`. |
| `SUPABASE_URL` | No | Alias aceptado por el seed para `NEXT_PUBLIC_SUPABASE_URL`. |

### Archivos de ejemplo

- `.env.local.example`: plantilla compacta para configuración local.
- `.env.example`: referencia adicional para configurar el entorno.
- `.env.local`: archivo local ignorado por Git; no publiques sus credenciales.

## Base de datos y ejecución

Configura las conexiones de Supabase en `.env.local`. En una base vacía, ejecuta en el SQL Editor de Supabase las migraciones de `supabase/migrations` en orden: primero `20261010235016_init_schema.sql` y luego `20261013000000_harden_public_access.sql`. Si tu base ya tiene el esquema inicial, ejecuta solo la migración de hardening. Esta segunda migración revoca el acceso anónimo y configura RLS; `prisma db push` no aplica políticas ni permisos SQL.

Luego genera el cliente Prisma, sincroniza el esquema y arranca Next.js:

```bash
npx prisma generate
npx prisma db push
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La documentación interactiva de la API con Swagger UI está en [http://localhost:3000/docs](http://localhost:3000/docs).

### Explorar y probar la API con Swagger UI

La ruta `/docs` muestra la especificación OpenAPI integrada en `src/app/docs/page.tsx`. Desde Swagger UI puedes revisar los endpoints documentados, sus parámetros y respuestas, y ejecutar solicitudes con **Try it out** y **Execute**. La especificación es mantenida manualmente y cubre una selección de la API; no se genera automáticamente a partir de todos los `route.ts`.

Para probar endpoints que requieren autenticación:

1. Inicia sesión en [http://localhost:3000/login](http://localhost:3000/login) con un usuario de Supabase. Si ejecutaste el seed, usa `admin@demo.com` con la contraseña configurada en `SEED_ADMIN_PASSWORD`, o una de las otras cuentas demo con `SEED_DEMO_PASSWORD`.
2. Sin cerrar esa sesión ni cambiar de navegador, abre [http://localhost:3000/docs](http://localhost:3000/docs).
3. Selecciona la operación, pulsa **Try it out**, completa los parámetros y el cuerpo cuando corresponda, y pulsa **Execute**.

La aplicación autentica las solicitudes API mediante la cookie de sesión de Supabase del mismo origen. Por eso, la sesión iniciada en `/login` se envía automáticamente a `/api`; no es necesario copiar tokens ni configurar un Bearer token en Swagger. Las operaciones que usan Groq requieren las variables correspondientes y el servicio disponible.

`prisma db push` sincroniza los modelos declarados en `prisma/schema.prisma`; una base vacía también debe contar con las tablas y objetos de Supabase que utiliza la aplicación.

### Datos de demostración (opcional)

El seed crea roles y permisos, cuentas de demostración, datos de catálogo, mensajes y, por defecto, 15.000 boletas ficticias. Configura primero las variables de seed indicadas arriba y revisa que `SEED_EXPECTED_REF` coincida con el proyecto de desarrollo.

```bash
npm run db:seed
```

Para omitir la generación de boletas, establece `SEED_BOLETAS=0` en `.env.local`. `SEED_RESET=true` trunca las tablas de boletas antes de regenerarlas; úsalo solo en una base desechable o de desarrollo.

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Inicia Next.js en modo desarrollo. |
| `npm run build` | Genera Prisma y compila la aplicación para producción. |
| `npm run start` | Inicia la versión compilada. |
| `npm run lint` | Ejecuta ESLint. |
| `npm run db:seed` | Crea datos de demostración. |
| `npm run db:push` | Sincroniza el esquema Prisma con la base de datos. |
| `npm run db:studio` | Abre Prisma Studio. |

---

---

# Parte 1. El proyecto

## 1.1 La organización y el problema

Farmacias Maira es una pequeña empresa farmacéutica local. Su primera sucursal abrió en 2023 y atiende a la comunidad de Viña del Mar. La empresa tiene dos dueñas; la clienta directa del proyecto estaba encargada de compras y gestión. Su identidad se omite por privacidad. La apertura de una segunda sucursal aumentó la carga operativa, que antes recaía principalmente en una sola persona.

Según lo explicado por la clienta, el POS de Farmacias Maira se usaba para registrar ventas, pagos y entradas de stock, pero el análisis de productos estrella, la detección de reposiciones y la comparación de precios se hacían manualmente. La clienta calculaba ventas y revisaba proveedores con anticipación porque los envíos podían tardar alrededor de dos semanas. El equipo identificó que duplicar ese trabajo entre sucursales dificultaba comparar rendimiento, reconocer productos con mayor frecuencia o margen y revisar la evolución mensual de ventas con rapidez.

## 1.2 Lo que la clienta necesitaba

Las necesidades identificadas fueron:

- Centralizar la información de ventas, productos y proveedores.
- Agilizar las cotizaciones y la comparación de precios.
- Contar con análisis de ventas y de productos.
- Disponer de una herramienta mantenible, que pudiera adaptarse a nuevas necesidades y fuentes de datos.

El propósito de Maira Analytics fue apoyar las decisiones de compra, stock y análisis comercial mediante una aplicación web con ranking de productos, filtros e informes, cotización centralizada, insights asistidos por IA y alertas de stock bajo.

## 1.3 Alternativas investigadas e impedimentos

**Tipo de solución.** En primer lugar se consultó sobre el tipo de solución requerida. Como la clienta viaja con frecuencia y necesita revisar el negocio en cualquier lugar y momento, decidimos construir una plataforma web, accesible desde cualquier parte.

**Ventas.** El POS ofrecía una API que permitía consultar las boletas individualmente por número de folio, pero por ningún otro filtro. Esta fue la mayor limitación que identificamos al comienzo. El equipo preparó un proceso ETL de extracción secuencial por folio, con una forma de conservar el avance para reanudar una descarga interrumpida. El detalle técnico de ese proceso se describe en la explicación del ETL.

La planificación inicial contempló ponernos al día con las boletas y luego automatizar su carga nocturna mediante Supabase Edge Functions. Se estimó que el volumen diario no superaría las 1.000 boletas, pero esa cifra fue una estimación de planificación, no una métrica de producción. Las Edge Functions no se habilitaron en producción porque estaba pendiente la autorización de la clienta, por lo que la ingesta nocturna no llegó a estar operativa ni desplegada.

**Cotizaciones.** Primero se pensó en consumir las APIs de los portales de compra de los proveedores. Lamentablemente, ninguno de los proveedores que usaba la clienta tenía APIs que el sistema pudiera consumir. También se pensó en automatizar el proceso mediante scraping, pero decidimos desistir de esa solución porque todas las plataformas tenían un sistema de login con cuentas que se habilitaban después de múltiples comprobaciones.

Conversamos el problema con la clienta y terminamos decidiendo una solución a partir de los archivos Excel con cotizaciones que ella recibía todas las semanas. Creamos una forma de subir esos archivos, extraer la información, guardarla en la base de datos y usarla para centralizar un portal de proveedores con cada medicamento y la comparación de precios entre proveedores.

## 1.4 La solución que propusimos y construimos

Construimos una plataforma web de inteligencia de negocios para una farmacia. Su objetivo es ayudar a tomar mejores decisiones de compra y de venta a partir de los datos que ya existen en las boletas. Con ella se pueden rankear los productos según distintos criterios, consultar a la vez los catálogos de varios proveedores, comparar la rentabilidad de los medicamentos entre sucursales y procesar las cotizaciones en Excel que se reciben por correo electrónico.

**Dashboard.** Es la pantalla de inicio. Muestra las sucursales y el dinero que generó cada una durante el periodo que la persona considere conveniente, de modo que se puede ver de un vistazo cómo viene el negocio.

**Ranking de productos.** Los productos se ordenan según cuatro criterios: mayor margen de ganancia, mayor cantidad de ventas, mayor porcentaje de crecimiento y mayor frecuencia de aparición en las boletas. Cada ranking se puede revisar con ayuda de la inteligencia artificial y exportar a PDF, para analizarlo con detalle junto a los compañeros de trabajo. La IA también identifica productos que se canibalizan entre sí, es decir, que se quitan ventas unos a otros, y realiza un análisis de venta cruzada para detectar qué productos se compran juntos.

**Analytics con IA.** Este apartado (que durante los sprints llamamos *insights*) entrega una visión general del negocio en el periodo que se defina con los filtros. Incluye un resumen, las tendencias de ventas, el análisis estacional, las oportunidades de compra, los productos en riesgo y propuestas para optimizar los márgenes.

**Proveedores.** Permite filtrar por producto y por proveedor, y muestra una tabla comparativa con el nombre del producto, su código y el precio que ofrece cada proveedor. El mejor precio se marca en verde, junto con la diferencia respecto de los demás, y se incluye un análisis del ahorro posible. Dentro de esta sección hay dos herramientas más:

- **Gestión de catálogos.** Se importa el catálogo de cada proveedor desde Excel arrastrando el archivo. Los datos se ordenan solos y se suben a Supabase, y los catálogos ya importados se pueden administrar y eliminar. Como los catálogos nuevos llegaban cada 7 días, cada uno muestra un semáforo según su antigüedad:
  - **Días 1 a 3, verde:** datos actualizados.
  - **Días 4 y 5, amarillo:** es momento de revisar si siguen vigentes.
  - **Días 6 y 7, rojo:** los precios posiblemente están desactualizados y se debe subir la nueva cotización.
- **Asistente con IA.** Un chatbot que busca precios y los compara entre proveedores. Se puede preguntar, por ejemplo, por «paracetamol» sin dar más especificaciones, y la IA se encarga de encontrar las presentaciones y compararlas.

**Alertas de stock.** Cada producto puede tener un stock mínimo. El stock se gestiona desde la propia plataforma, donde se puede fijar una cantidad específica, y cuando el stock existente baja del mínimo se genera una alerta.

**Usuarios, roles y permisos.** Hay un listado con todos los usuarios, su estado (activo o inactivo), su rol y sus permisos. Quien tenga rol de administrador puede deshabilitar, editar o eliminar usuarios, y crear nuevos con los roles y permisos que necesite. También se pueden crear y eliminar roles y permisos, aunque un permiso nuevo solo se puede crear si existe la funcionalidad a la que corresponde.

**Mensajería y notificaciones.** Los usuarios pueden enviarse mensajes dentro de la plataforma y reciben una notificación cuando envían o reciben uno.

**Configuración y navegación.** La configuración permite cambiar el tema de la página entre claro y oscuro. La barra superior muestra el usuario con sesión iniciada, permite cerrar sesión y tiene una campana donde se reúnen todas las notificaciones recibidas.

## 1.5 Cómo organizamos el trabajo

Éramos un equipo de tres personas y, al tratarse de un proyecto de título, teníamos un plazo total de 16 semanas. De ellas, once fueron de desarrollo y las cinco restantes las dedicamos a prepararnos para la presentación final ante el comité. Ese marco lo fijaba el profesor encargado, que definía el alcance general, los plazos y las presentaciones de avance ante la clase. Dentro de esa estructura trabajamos con Scrum de forma regular, a lo largo de cuatro sprints: un Sprint 0 de una semana para preparar el entorno y tres sprints de tres a cuatro semanas, que suman las once semanas de desarrollo.

Realizamos todas las ceremonias (daily meetings, retrospectiva y sprint review) y mantuvimos sus artefactos: product backlog, historias de usuario con sus criterios de aceptación, burndown chart, registro de impedimentos y pruebas documentadas. Todo estaba coordinado en Jira. A eso sumamos gestión de alcance y de presupuesto, además de un plan de gestión de riesgos con su matriz. Por eso, al comenzar cada sprint teníamos claro qué íbamos a entregar y, en general, la carga de trabajo no excedió la capacidad del equipo.

## 1.6 Cómo avanzaron los sprints

El alcance avanzó desde preparar el entorno e integrar los datos del POS hasta desarrollar el análisis de ventas y la comparación de proveedores. La retroalimentación recibida en la review del Sprint 1 llevó a corregir y ampliar el ranking durante el Sprint 2.

| Sprint | Duración | Objetivo | Resultado / entregables |
| --- | --- | --- | --- |
| 0 | 1 semana | Preparar entorno, accesos y backend inicial. | Configuración de GitHub y entornos locales; dependencias base; prueba de conexión a la API; inicio de sesión, registro y autenticación por correo; roles y permisos; backend inicial. |
| 1 | 3 semanas | Integrar inicialmente el POS y construir el ranking. | Integración básica del POS; tablas y modelos Prisma iniciales; ranking y dashboards básico y avanzado; interfaz del sistema; filtros avanzados; generación y exportación de reportes; pruebas y artefactos Scrum. La review recibió correcciones de la clienta para el ranking. |
| 2 | 3 semanas | Incorporar insights iniciales y comparación de proveedores. | Insights básicos en el ranking; integración de listas Excel; interfaz de cotización y comparador de precios; carga drag and drop y parser de Excel; alertas por antigüedad; cotización con al menos dos proveedores; correcciones del ranking; backlog, burndown y pruebas documentadas. |
| 3 | 4 semanas | Ampliar proveedores, análisis, alertas y materiales de entrega. | Cotización de siete proveedores; filtros avanzados; documentación de la API en Swagger UI; insights avanzados en ranking y proveedores; alertas de stock bajo; manual, documentación final, video tutorial, guía interactiva en JavaScript, mejoras de seguridad, capacitación y mensajería. Insights de IA y alertas de stock bajo operativos. |

La secuencia siguió una lógica de menos a más. Primero construimos la base (accesos, roles y datos), luego lo que más valor tenía para la clienta, que era el ranking y el dashboard, y después las funciones que se apoyaban en esos datos, como los insights con IA y la comparación de proveedores. La comparación pasó de cotizar con dos proveedores en el Sprint 2 a siete en el Sprint 3, lo que permitió validar primero el flujo con un caso pequeño antes de escalarlo. El último sprint, además, no se limitó a código: entregamos manual, documentación, video tutorial, guía interactiva y capacitación, porque una herramienta solo sirve si quien la usa sabe cómo hacerlo.

## 1.7 Estado al cierre

Al cierre del proyecto se reportaron operativos los insights de IA y las alertas de stock bajo. Quedó pendiente autorizar la puesta en producción de las Edge Functions nocturnas.

La explicación técnica del ETL describe una herramienta que consulta el POS del cliente por folio, conserva las boletas en el IndexedDB del navegador y permite exportarlas como JSON, CSV o SQL. La carga del archivo exportado a otra base de datos es manual. El flujo de extracción por folio y reanudación documentado allí no equivale a la ingesta productiva nocturna mediante Edge Functions, que no se habilitó.

---
# Documentación de gestión realizada

Durante el proyecto se trabajó mediante Scrum y se prepararon documentos de gestión tomando como referencia áreas y prácticas de dirección de proyectos asociadas a PMBOK. Por privacidad del cliente, aquí se explica el propósito y alcance de los documentos sin adjuntar sus archivos, actas, firmas, capturas ni datos confidenciales.

## Alcance y requisitos

Se preparó un plan de alcance, se documentaron los requerimientos funcionales y no funcionales y se elaboró una matriz de trazabilidad para relacionar las necesidades y requisitos con el desarrollo y su seguimiento.

## Planificación y costos

Se elaboró una Carta Gantt, un cronograma organizado por épicas y tareas atómicas y un plan de costos. No se publican fechas detalladas, montos ni supuestos financieros.

## Arquitectura y solución técnica

Se realizó un diagrama de arquitectura para representar los componentes y flujos principales. La solución utiliza Next.js, React, TypeScript, Supabase, PostgreSQL, Prisma, Tailwind CSS y Groq. La documentación interactiva de una selección de endpoints está disponible en la aplicación mediante Swagger UI (`/docs`).

El POS del cliente permitía consultar boletas por folio. El proceso ETL descrito en la documentación consulta folios secuencialmente, guarda datos localmente en IndexedDB y permite exportarlos para una carga posterior. La aplicación también contempla una carga planificada durante la noche mediante Supabase Edge Functions; esa automatización no se habilitó en producción porque estaba pendiente la autorización de la clienta. El ETL local y la ingesta nocturna son procesos distintos.

## Scrum y seguimiento

Se realizaron las ceremonias de Scrum y se mantuvieron artefactos de planificación y seguimiento: product backlog, historias de usuario y criterios de aceptación, sprint backlogs, burndown charts, impediment log y pruebas documentadas. El trabajo se coordinó en Jira. También se prepararon materiales de entrega y uso, entre ellos documentación final, manual de usuario y video tutorial. No se adjuntan los documentos ni se publican datos que identifiquen al cliente.
# Parte 2. Mi experiencia

## 2.1 Mis roles en el proyecto

Este proyecto fue una experiencia de aprendizaje que para mí no se limitó a desarrollar. Además de mi rol como desarrollador full stack, asumí un pseudo-rol de Product Owner y el rol de Scrum Master, lo que implicó entender el problema de la clienta, decidir qué construir y cuidar que el equipo pudiera hacerlo de forma ordenada.

### Product Owner

Asumí este rol por una razón práctica: era quien vivía más cerca de la sucursal donde estaba la clienta. Mis compañeros vivían demasiado lejos para ir, y ella se hacía un tiempo para atendernos en medio de su jornada de trabajo. En esas reuniones conversaba con ella, entendía su problema, le planteaba posibles soluciones y las negociábamos juntos. Con su aprobación, grababa la conversación para compartirla con mi equipo, así todos escuchaban directamente lo que necesitaba, sin depender solo de mi resumen. Esa práctica fue importante: al ser yo el único canal con la clienta, la grabación evitaba que la información se deformara o quedara solo en mi cabeza.

Con el equipo traducíamos esas necesidades en requerimientos, historias de usuario y tareas técnicas, y yo decidía qué funcionalidades priorizar en cada entregable.

### Scrum Master y liderazgo con consenso

Como era quien se reunía con la clienta y quien mejor entendía el problema, terminé actuando como líder del equipo: coordinaba las reuniones, incluidas las daily meetings, y daba la idea final de lo que íbamos a construir. Mi criterio siempre fue buscar un equilibrio entre cumplir lo que la clienta necesitaba y cuidar el trabajo que eso significaba para mis compañeros.

Las decisiones, sin embargo, no eran impuestas. Todos queríamos reunirnos y mis compañeros querían escuchar mi propuesta. Les explicaba qué creía que debíamos hacer y por qué, les preguntaba su opinión y escuchaba sus ideas. Varias funcionalidades nacieron de ellos, como la interfaz de mensajes y el apartado de stock: las consultamos con la clienta, quien las aprobó porque realmente las necesitaba.

### Desarrollador full stack

Desarrollé los módulos de integración con inteligencia artificial (los insights), el apartado de ranking y el dashboard, además del diseño completo del sitio web y el sistema de roles y permisos. El resto de las funcionalidades las desarrollé junto a mi equipo.

## 2.2 Lo que no fue estricto

Aunque seguimos el marco con regularidad, hubo dos desvíos respecto de Scrum.

**Los roles.** En la práctica no fueron estrictos, porque yo concentraba el de Product Owner, el de Scrum Master y el de desarrollador. En un Scrum tradicional, el Product Owner es quien empuja el alcance y los plazos, pero en nuestro caso eso venía de fuera: el profesor fijaba el plazo y las presentaciones, y la clienta nos planteaba lo que necesitaba. Mi trabajo fue más bien de puente: encajar lo que necesitaba la clienta dentro de lo que se podía entregar en el plazo y con la capacidad real de mis compañeros. Lo sostuvimos con decisiones por consenso y con la planificación anticipada de cada sprint. Aun así, tener una sola persona como canal con la clienta concentraba información y decisiones, y fue un riesgo que mitigamos grabando las reuniones y compartiéndolas.

**La Definition of Done.** Cada historia de usuario tenía sus criterios de aceptación, y se daba por cumplida cuando la historia estaba completa. Esos criterios se presentaban en el sprint review, y el visto bueno de la clienta cerraba el entregable. Lo que no teníamos era una *Definition of Done* formal, es decir, un estándar de calidad común a todas las historias, acordado de antemano (por ejemplo, pruebas ejecutadas, código revisado, documentación actualizada). En la práctica, esos requisitos de calidad quedaban implícitos y la validación final de la clienta llegaba al cierre del sprint.

## 2.3 Qué aprendí

- **Escuchar bien a la clienta tiene un efecto multiplicador.** Grabar las reuniones y compartirlas con el equipo hizo que todos trabajáramos sobre la misma comprensión del problema.
- **Liderar no es imponer.** Las mejores ideas, como los mensajes y el stock, vinieron del equipo y se validaron con la clienta. Mi trabajo fue conectar ambas partes.
- **Trabajar con restricciones que no controlas.** Con un plazo fijo y presentaciones ante la clase, aprendí a priorizar y a negociar el alcance con la clienta sin comprometer la capacidad del equipo.

## 2.4 Qué haría distinto en un próximo proyecto

**Mostrar avances a la clienta antes de la review.** Validar solo al cierre del sprint significaba que las correcciones llegaban tarde: por ejemplo, la review del Sprint 1 nos dio correcciones para el ranking que recién pudimos atender en el Sprint 2. En un próximo proyecto le mostraría versiones parciales a mitad de sprint, para ajustar a tiempo y no cuando ya estaba todo cerrado.

**Darle más espacio a la base de datos.** El proyecto era grande y nos concentramos sobre todo en las funcionalidades. La base de datos funcionó correctamente y sin problemas, pero siento que pudo haberse diseñado mejor. Lo comprobé al retomar el proyecto para publicarlo: al revisar el esquema con calma encontré varias cosas por mejorar. Por ejemplo, teníamos dos catálogos de productos (el del punto de venta y el de proveedores) relacionados solo por código de barras, sin una relación formal entre ellos; el identificador de sucursal estaba guardado como número decimal; había un índice duplicado, y la seguridad a nivel de fila solo estaba activada en la mensajería. Ninguno de estos puntos afectó el funcionamiento durante el desarrollo, pero son decisiones que conviene pensar desde el diseño y no corregir después.

**Pensar desde el inicio en cómo seguiría creciendo el sistema.** En un proyecto futuro desarrollaría con la siguiente etapa en mente: cómo escalaría el sistema si se suman más sucursales o más volumen de datos, y qué pasos vienen después de la entrega. Cada proyecto es un mundo y cada cliente necesita pasos distintos, por eso lo importante es dejar la puerta abierta y saber explicárselo: presentarlo como una hoja de ruta clara de lo que podría venir y no solo como un producto terminado.
