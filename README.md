# MairaAnalytics

Aplicación web para explorar y analizar información de ventas, productos, inventario y proveedores de una farmacia. Incluye paneles de indicadores, rankings, alertas de stock, comparación de precios, gestión de usuarios y análisis asistidos por IA.

> Este README tiene dos propósitos: explicar cómo ejecutar el proyecto localmente y servir como índice para documentar su alcance y gestión ágil. La segunda parte es una plantilla: completa los marcadores con los datos y evidencias reales del proyecto.

## Contenido

1. [Ejecutar el proyecto localmente](#1-ejecutar-el-proyecto-localmente)
2. [Documentación del proyecto](#2-documentación-del-proyecto)

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
| `EXTERNAL_SALES_API_URL` | No, solo para integración externa | URL base de la API externa de ventas/POS. |
| `EXTERNAL_API_TOKEN` | Según la API externa | Token de autenticación de la API externa de ventas/POS. |
| `EXTERNAL_API_TIMEOUT` | No | Tiempo máximo de espera de la API externa en milisegundos. Por defecto: `30000`. |
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
- `.env.example`: referencia adicional con ejemplos de conexiones y la integración externa.
- `.env.local`: archivo local ignorado por Git; no publiques sus credenciales.

`REDIS_URL` y `NEXT_PUBLIC_APP_URL` también aparecen en `.env.example`, pero actualmente no son leídas por el código de la aplicación.

## Base de datos y ejecución

Configura las conexiones de Supabase en `.env.local`. Luego genera el cliente Prisma, sincroniza el esquema y arranca Next.js:

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

La aplicación autentica las solicitudes API mediante la cookie de sesión de Supabase del mismo origen. Por eso, la sesión iniciada en `/login` se envía automáticamente a `/api`; no es necesario copiar tokens ni configurar un Bearer token en Swagger. Las operaciones que usan Groq o la API externa también requieren las variables correspondientes y servicios disponibles.

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

# 2. Documentación del proyecto

> **Plantilla por completar.** Los apartados siguientes organizan la documentación de alcance, planificación, riesgos y ejecución Scrum/Kanban. Sustituye cada `[Pendiente: ...]` por información verificada y agrega los archivos o enlaces correspondientes. Antes de publicar, elimina credenciales y datos personales, y confirma que puedes divulgar material confidencial del cliente y sus firmas.

## 2.1 Ficha y contexto

- **Problema u oportunidad:** [Pendiente: describir la necesidad que originó el proyecto]
- **Objetivo del producto:** [Pendiente]
- **Usuarios objetivo:** [Pendiente]
- **Cliente / patrocinador:** [Pendiente]
- **Equipo y período de ejecución:** [Pendiente]
- **Criterios de éxito:** [Pendiente: métricas y condiciones de aceptación]

## 2.2 Alcance y requisitos

### Alcance del proyecto

- **Incluido:** [Pendiente: capacidades y entregables acordados]
- **Fuera de alcance:** [Pendiente]
- **Supuestos y restricciones:** [Pendiente]
- **Evidencia de aprobación del alcance:** [Pendiente: documento, fecha y responsable]

### Requerimientos funcionales y no funcionales

Documenta cada requisito con identificador, descripción, prioridad, criterio de aceptación, fuente y estado. Agrega trazabilidad hacia épicas, tareas y pruebas.

- **Requerimientos funcionales:** [Pendiente: archivo o enlace]
- **Requerimientos no funcionales:** [Pendiente: archivo o enlace]
- **Matriz de trazabilidad:** [Pendiente]

### Product Backlog

- **Ubicación del backlog:** [Pendiente: archivo, herramienta o enlace]
- **Criterios de priorización:** [Pendiente]
- **Definition of Ready / Definition of Done:** [Pendiente]
- **Relación entre épicas, historias y tareas:** [Pendiente]

## 2.3 Planificación y estimaciones

- **Carta Gantt:** [Pendiente: archivo o enlace; indicar versión y fecha]
- **Cronograma de épicas:** [Pendiente]
- **Cronograma de tareas e hitos:** [Pendiente]
- **Estimación de costos:** [Pendiente: moneda, supuestos, categorías y método de estimación]
- **Costos reales frente a estimados:** [Pendiente, si corresponde]

## 2.4 Arquitectura y solución

- **Diagrama de arquitectura:** [Pendiente: imagen o enlace]
- **Descripción de componentes y responsabilidades:** [Pendiente]
- **Flujos principales de datos e integraciones:** [Pendiente]
- **Decisiones técnicas relevantes:** [Pendiente: decisión, alternativas y justificación]

## 2.5 Roles del proyecto

| Persona o rol | Responsabilidades | Participación / período |
| --- | --- | --- |
| Product Owner / representante del cliente | [Pendiente] | [Pendiente] |
| Scrum Master / facilitador | [Pendiente] | [Pendiente] |
| Equipo de desarrollo | [Pendiente] | [Pendiente] |
| Cliente y otros interesados | [Pendiente] | [Pendiente] |

Agrega aquí la asignación real de personas, responsabilidades y mecanismo de toma de decisiones: [Pendiente].

## 2.6 Gestión de riesgos e impedimentos

### Plan de gestión de riesgos

- **Método, frecuencia y responsables de revisión:** [Pendiente]
- **Criterios de probabilidad e impacto:** [Pendiente]
- **Estrategias de respuesta y escalamiento:** [Pendiente]
- **Ubicación del plan:** [Pendiente: archivo o enlace]

### Matriz y registro de riesgos

Incluye identificador, causa, evento, consecuencia, probabilidad, impacto, nivel, responsable, respuesta, fecha de revisión y estado.

- **Matriz de riesgo:** [Pendiente: archivo o enlace]
- **Riesgos principales y decisiones tomadas:** [Pendiente]

### Impediment log

Registra cada impedimento con fecha, descripción, impacto, responsable, acciones, fecha de resolución y estado.

- **Ubicación del impediment log:** [Pendiente: archivo o enlace]
- **Impedimentos relevantes y resolución:** [Pendiente]

## 2.7 Gestión de trabajo con Kanban

- **Herramienta y enlace al tablero:** [Pendiente]
- **Columnas y definición de cada estado:** [Pendiente]
- **Políticas explícitas y límites WIP:** [Pendiente]
- **Flujo desde solicitud hasta entrega:** [Pendiente]
- **Métricas revisadas (por ejemplo, lead time o throughput):** [Pendiente]

## 2.8 Marco Scrum y ceremonias

Describe cómo se aplicó Scrum en el proyecto: duración de los sprints, participantes, frecuencia de ceremonias, Definition of Done y herramientas de seguimiento.

- **Duración y calendario de los sprints:** [Pendiente]
- **Participantes y responsabilidades en las ceremonias:** [Pendiente]
- **Criterios de aceptación y Definition of Done:** [Pendiente]
- **Herramientas utilizadas:** [Pendiente]

### Resumen de sprints

| Sprint | Período | Objetivo | Resultado / entregables |
| --- | --- | --- | --- |
| Sprint 0 | [Pendiente] | [Pendiente] | [Pendiente] |
| Sprint 1 | [Pendiente] | [Pendiente] | [Pendiente] |
| Sprint 2 | [Pendiente] | [Pendiente] | [Pendiente] |
| Sprint 3 | [Pendiente] | [Pendiente] | [Pendiente] |

### Sprint 0

- **Objetivo y fechas:** [Pendiente]
- **Planificación y backlog comprometido:** [Pendiente]
- **Daily meetings:** [Pendiente: fechas, asistentes, acuerdos y enlace al registro]
- **Sprint burndown:** [Pendiente: gráfico y lectura de la evolución]
- **Sprint review firmada por el cliente:** [Pendiente: incremento presentado, comentarios y enlace a la evidencia de aprobación]
- **Sprint retrospective:** [Pendiente: aspectos positivos, mejoras y acciones con responsables]
- **Entregables y tareas completadas:** [Pendiente]

### Sprint 1

- **Objetivo y fechas:** [Pendiente]
- **Planificación y backlog comprometido:** [Pendiente]
- **Daily meetings:** [Pendiente: fechas, asistentes, acuerdos y enlace al registro]
- **Sprint burndown:** [Pendiente: gráfico y lectura de la evolución]
- **Sprint review firmada por el cliente:** [Pendiente: incremento presentado, comentarios y enlace a la evidencia de aprobación]
- **Sprint retrospective:** [Pendiente: aspectos positivos, mejoras y acciones con responsables]
- **Entregables y tareas completadas:** [Pendiente]

### Sprint 2

- **Objetivo y fechas:** [Pendiente]
- **Planificación y backlog comprometido:** [Pendiente]
- **Daily meetings:** [Pendiente: fechas, asistentes, acuerdos y enlace al registro]
- **Sprint burndown:** [Pendiente: gráfico y lectura de la evolución]
- **Sprint review firmada por el cliente:** [Pendiente: incremento presentado, comentarios y enlace a la evidencia de aprobación]
- **Sprint retrospective:** [Pendiente: aspectos positivos, mejoras y acciones con responsables]
- **Entregables y tareas completadas:** [Pendiente]

### Sprint 3

- **Objetivo y fechas:** [Pendiente]
- **Planificación y backlog comprometido:** [Pendiente]
- **Daily meetings:** [Pendiente: fechas, asistentes, acuerdos y enlace al registro]
- **Sprint burndown:** [Pendiente: gráfico y lectura de la evolución]
- **Sprint review firmada por el cliente:** [Pendiente: incremento presentado, comentarios y enlace a la evidencia de aprobación]
- **Sprint retrospective:** [Pendiente: aspectos positivos, mejoras y acciones con responsables]
- **Entregables y tareas completadas:** [Pendiente]

## 2.9 Resultados y cierre

- **Objetivos alcanzados frente a los planificados:** [Pendiente]
- **Entregables aceptados por el cliente:** [Pendiente]
- **Desviaciones de alcance, cronograma o costos:** [Pendiente]
- **Lecciones aprendidas y acciones futuras:** [Pendiente]

## 2.10 Estructura sugerida para incorporar evidencias

La siguiente organización es una propuesta para añadir los artefactos al repositorio; todavía no representa archivos incluidos:

```text
docs/
├── project/
│   ├── scope-and-requirements.md
│   ├── product-backlog.md
│   ├── schedule-and-costs.md
│   ├── architecture.md
│   ├── roles.md
│   ├── risk-management-plan.md
│   ├── risk-matrix.md
│   └── impediment-log.md
└── sprints/
    ├── sprint-0.md
    ├── sprint-1.md
    ├── sprint-2.md
    └── sprint-3.md
```

Para cada sprint, incorpora o enlaza el registro de daily meetings, el burndown, la retrospectiva y la review con la aprobación del cliente.
