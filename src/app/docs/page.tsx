"use client";

import dynamic from "next/dynamic";
import Head from "next/head";
import "swagger-ui-react/swagger-ui.css";

// Importar SwaggerUI dinámicamente para evitar problemas con SSR
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

// Especificación de la API
const spec = {
  openapi: "3.0.0",
  info: {
    title: "Documentación de API - Maira Analytics",
    version: "1.0.0",
    description: `API REST para el sistema de análisis de productos farmacéuticos y proveedores.

**⚠️ IMPORTANTE - Autenticación:**
- El **login** NO se realiza mediante un endpoint de esta API
- La autenticación se maneja directamente con **Supabase Auth** en la página /login
- Para probar los endpoints protegidos:
  1. Inicia sesión en: http://localhost:3000/login
  2. Usa las credenciales: admin@example.com / password123
  3. Copia el token de sesión desde las cookies o DevTools
  4. Haz clic en "Authorize" 🔓 y pega el token

**Endpoints Disponibles:**
- ✅ /api/auth/logout - Cerrar sesión y limpiar caché
- ✅ /api/user/permissions - Obtener permisos del usuario
- ✅ /api/users/sync - Sincronizar usuario con base de datos
- ✅ /api/providers/* - Gestión de proveedores
- ✅ /api/messages/* - Sistema de mensajería
- ✅ Y más...`,
    contact: {
      name: "Soporte Técnico",
      email: "soporte@maira-analytics.com",
    },
  },
  servers: [
    {
      url: "/api",
      description: "Servidor de API",
    },
  ],
  tags: [
    {
      name: "Autenticación",
      description:
        "Endpoints relacionados con autenticación de usuarios (⚠️ NOTA: El login se maneja directamente con Supabase Auth en /login, no existe endpoint /api/auth/login)",
    },
    {
      name: "Dashboard",
      description: "Endpoints para obtener datos del dashboard",
    },
    {
      name: "Proveedores",
      description: "Gestión de proveedores y sus productos",
    },
    {
      name: "Mensajes",
      description: "Sistema de mensajería interna",
    },
    {
      name: "Notificaciones",
      description: "Gestión de notificaciones del sistema",
    },
    {
      name: "Productos",
      description: "Gestión y búsqueda de productos",
    },
    {
      name: "Ranking",
      description: "Rankings y comparaciones de productos",
    },
    {
      name: "Farmacia",
      description: "Operaciones específicas de farmacia",
    },
    {
      name: "Usuarios",
      description: "Gestión de usuarios del sistema",
    },
  ],
  paths: {
    "/auth/logout": {
      post: {
        tags: ["Autenticación"],
        summary: "Cerrar sesión y limpiar caché",
        description:
          "Limpia el caché de permisos del usuario autenticado. La autenticación se maneja a través de Supabase Auth.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Caché limpiado exitosamente",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    message: {
                      type: "string",
                      example: "Caché limpiado exitosamente",
                    },
                    email: { type: "string", example: "usuario@example.com" },
                    wasInvalidated: { type: "boolean", example: true },
                  },
                },
              },
            },
          },
          "401": {
            description: "Usuario no autenticado",
          },
          "500": {
            description: "Error interno del servidor",
          },
        },
      },
    },
    "/user/permissions": {
      get: {
        tags: ["Usuarios"],
        summary: "Obtener permisos del usuario actual",
        description:
          "Retorna los permisos y rol del usuario autenticado desde el caché o base de datos",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Permisos obtenidos exitosamente",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    permissions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          resource: { type: "string" },
                          action: { type: "string" },
                        },
                      },
                    },
                    role: {
                      type: "object",
                      nullable: true,
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        description: { type: "string", nullable: true },
                      },
                    },
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        email: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "Usuario no autenticado",
          },
          "500": {
            description: "Error al obtener permisos",
          },
        },
      },
    },
    "/users/sync": {
      post: {
        tags: ["Usuarios"],
        summary: "Sincronizar usuario con base de datos",
        description: "Crea o actualiza el usuario en la base de datos Prisma",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["id", "email"],
                properties: {
                  id: {
                    type: "string",
                    example: "123e4567-e89b-12d3-a456-426614174000",
                    description: "ID del usuario de Supabase",
                  },
                  email: {
                    type: "string",
                    format: "email",
                    example: "usuario@example.com",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Usuario sincronizado exitosamente",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        email: { type: "string" },
                        profile: { type: "object", nullable: true },
                        _count: {
                          type: "object",
                          properties: {
                            posts: { type: "number" },
                          },
                        },
                      },
                    },
                    message: {
                      type: "string",
                      example: "User synced successfully",
                    },
                  },
                },
              },
            },
          },
          "401": {
            description: "No autorizado",
          },
          "403": {
            description:
              "Prohibido - El ID no coincide con el usuario autenticado",
          },
          "500": {
            description: "Error interno del servidor",
          },
        },
      },
    },
    "/dashboard/metrics": {
      get: {
        tags: ["Dashboard"],
        summary: "Obtener métricas del dashboard",
        description: "Retorna métricas generales del sistema",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Métricas obtenidas exitosamente",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    totalProviders: { type: "number" },
                    totalProducts: { type: "number" },
                    totalSales: { type: "number" },
                    averagePrice: { type: "number" },
                  },
                },
              },
            },
          },
          "401": {
            description: "No autorizado",
          },
        },
      },
    },
    "/providers": {
      get: {
        tags: ["Proveedores"],
        summary: "Listar proveedores",
        description: "Obtiene la lista completa de proveedores",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
            description: "Número de página",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10 },
            description: "Cantidad de resultados por página",
          },
          {
            name: "search",
            in: "query",
            schema: { type: "string" },
            description: "Búsqueda por nombre de proveedor",
          },
        ],
        responses: {
          "200": {
            description: "Lista de proveedores",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    providers: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          name: { type: "string" },
                          email: { type: "string" },
                          phone: { type: "string" },
                          status: { type: "string" },
                          lastUpdate: { type: "string", format: "date-time" },
                        },
                      },
                    },
                    total: { type: "number" },
                    page: { type: "number" },
                    totalPages: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Proveedores"],
        summary: "Crear proveedor",
        description: "Registra un nuevo proveedor en el sistema",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email"],
                properties: {
                  name: { type: "string", example: "Proveedor XYZ" },
                  email: { type: "string", format: "email" },
                  phone: { type: "string" },
                  address: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Proveedor creado exitosamente",
          },
          "400": {
            description: "Datos inválidos",
          },
          "401": {
            description: "No autorizado",
          },
        },
      },
    },
    "/providers/{id}": {
      get: {
        tags: ["Proveedores"],
        summary: "Obtener proveedor por ID",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
            description: "ID del proveedor",
          },
        ],
        responses: {
          "200": {
            description: "Detalles del proveedor",
          },
          "404": {
            description: "Proveedor no encontrado",
          },
        },
      },
      put: {
        tags: ["Proveedores"],
        summary: "Actualizar proveedor",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  status: { type: "string", enum: ["active", "inactive"] },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Proveedor actualizado",
          },
          "404": {
            description: "Proveedor no encontrado",
          },
        },
      },
      delete: {
        tags: ["Proveedores"],
        summary: "Eliminar proveedor",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Proveedor eliminado",
          },
          "404": {
            description: "Proveedor no encontrado",
          },
        },
      },
    },
    "/providers/outdated": {
      get: {
        tags: ["Proveedores"],
        summary: "Proveedores desactualizados",
        description:
          "Lista proveedores que no han actualizado sus productos recientemente",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "days",
            in: "query",
            schema: { type: "integer", default: 30 },
            description: "Días sin actualización",
          },
        ],
        responses: {
          "200": {
            description: "Lista de proveedores desactualizados",
          },
        },
      },
    },
    "/providers/search-product": {
      get: {
        tags: ["Proveedores"],
        summary: "Buscar producto en proveedores",
        description:
          "Busca un producto específico entre todos los proveedores usando IA",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "query",
            in: "query",
            required: true,
            schema: { type: "string" },
            description: "Término de búsqueda del producto",
          },
        ],
        responses: {
          "200": {
            description: "Resultados de búsqueda con comparación de precios",
          },
        },
      },
    },
    "/messages/inbox": {
      get: {
        tags: ["Mensajes"],
        summary: "Bandeja de entrada",
        description: "Obtiene mensajes recibidos",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Lista de mensajes",
          },
        },
      },
    },
    "/messages/sent": {
      get: {
        tags: ["Mensajes"],
        summary: "Mensajes enviados",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Lista de mensajes enviados",
          },
        },
      },
    },
    "/messages/send": {
      post: {
        tags: ["Mensajes"],
        summary: "Enviar mensaje",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["receiverId", "subject", "content"],
                properties: {
                  receiverId: { type: "string" },
                  subject: { type: "string" },
                  content: { type: "string" },
                  attachments: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Mensaje enviado",
          },
        },
      },
    },
    "/messages/unread-count": {
      get: {
        tags: ["Mensajes"],
        summary: "Contador de mensajes no leídos",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Cantidad de mensajes no leídos",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    count: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/notifications": {
      get: {
        tags: ["Notificaciones"],
        summary: "Listar notificaciones",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["read", "unread", "all"] },
          },
        ],
        responses: {
          "200": {
            description: "Lista de notificaciones",
          },
        },
      },
    },
    "/notifications/mark-read": {
      post: {
        tags: ["Notificaciones"],
        summary: "Marcar notificación como leída",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  notificationId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Notificación marcada",
          },
        },
      },
    },
    "/catalog": {
      get: {
        tags: ["Productos"],
        summary: "Catálogo de productos",
        description: "Obtiene el catálogo completo de productos",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "category",
            in: "query",
            schema: { type: "string" },
          },
          {
            name: "search",
            in: "query",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Catálogo de productos",
          },
        },
      },
    },
    "/ranking/productos": {
      get: {
        tags: ["Ranking"],
        summary: "Ranking de productos",
        description:
          "Obtiene el ranking de productos más vendidos o mejor valorados",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "type",
            in: "query",
            schema: { type: "string", enum: ["sales", "rating", "price"] },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10 },
          },
        ],
        responses: {
          "200": {
            description: "Ranking de productos",
          },
        },
      },
    },
    "/pharmacy/validate-products": {
      post: {
        tags: ["Farmacia"],
        summary: "Validar productos farmacéuticos",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  products: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        code: { type: "string" },
                        name: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Productos validados",
          },
        },
      },
    },
    "/pharmacy/diagnose": {
      get: {
        tags: ["Farmacia"],
        summary: "Diagnóstico del sistema",
        description: "Verifica el estado de la base de datos y configuración",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Diagnóstico completado",
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Token JWT de autenticación",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "Mensaje de error",
          },
          code: {
            type: "string",
            description: "Código de error",
          },
        },
      },
    },
  },
};

export default function DocsPage() {
  return (
    <>
      <Head>
        <title>Documentación de API</title>
        <meta
          name="description"
          content="Documentación completa de la API de Maira Analytics"
        />
      </Head>
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto py-8 px-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Documentación de API
            </h1>
            <p className="text-gray-600">
              Explora y prueba los endpoints de la API de Maira Analytics
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <SwaggerUI spec={spec} />
          </div>
        </div>
      </div>
    </>
  );
}
