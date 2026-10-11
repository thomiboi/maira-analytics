# Mi App - Next.js con Supabase

Una aplicación moderna construida con Next.js 14, TypeScript, Supabase y TailwindCSS que implementa un sistema completo de autenticación y dashboard.

## 🚀 Características

- ✅ **Autenticación con Supabase**: Sistema de login seguro sin registro público
- ✅ **Rutas protegidas**: Middleware que protege páginas privadas
- ✅ **Menú lateral responsivo**: Navegación intuitiva con diseño adaptable
- ✅ **Dashboard completo**: Panel de control con métricas y estadísticas reales
- ✅ **Prisma ORM**: Gestión de datos type-safe con PostgreSQL
- ✅ **Gestión de sesiones**: Manejo automático de estado de usuario
- ✅ **API Routes**: Endpoints RESTful para operaciones de datos
- ✅ **Diseño minimalista**: UI/UX moderno con TailwindCSS
- ✅ **TypeScript**: Desarrollo type-safe con tipos generados automáticamente
- ✅ **Server Side Rendering**: Optimización con App Router de Next.js

## 🛠️ Tecnologías Utilizadas

- **Next.js 14** - Framework de React con App Router
- **TypeScript** - Tipado estático
- **Supabase** - Backend-as-a-Service con PostgreSQL
- **Prisma ORM** - Object-Relational Mapping para PostgreSQL
- **TailwindCSS** - Framework de CSS utility-first
- **Supabase Auth** - Sistema de autenticación
- **React Context** - Manejo de estado global

## 📋 Prerrequisitos

- Node.js 18.17 o superior
- npm, yarn, pnpm o bun
- Cuenta de Supabase

## ⚙️ Configuración de Supabase

### 1. Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Crea una nueva cuenta o inicia sesión
3. Crea un nuevo proyecto
4. Anota la URL y la API Key (anon/public)

### 2. Configurar Base de Datos

Ejecuta el siguiente SQL en el editor de consultas de Supabase:

```sql
-- Crear tabla de usuarios (si no existe)
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    encrypted_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sign_in_at TIMESTAMP WITH TIME ZONE,
    email_confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar usuario de prueba
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES (
    'admin@example.com',
    crypt('password123', gen_salt('bf')),
    NOW()
) ON CONFLICT (email) DO NOTHING;
```

### 3. Configurar Variables de Entorno

1. Copia el archivo `.env.local.example` a `.env.local`
2. Reemplaza los valores con los de tu proyecto Supabase:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-anonima-aqui

# Prisma Database Configuration
# Usa la URL de conexión directa de Supabase (Settings > Database > Connection string)
DATABASE_URL=postgresql://postgres:tu-password@db.tu-proyecto.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:tu-password@db.tu-proyecto.supabase.co:5432/postgres
```

### 4. Configurar Prisma

```bash
# Generar cliente de Prisma
npx prisma generate

# Ejecutar migraciones (opcional - las tablas se crearán automáticamente)
npx prisma db push

# Opcional: Ver la base de datos con Prisma Studio
npx prisma studio
```

## 🚀 Instalación y Ejecución

### 1. Instalar dependencias

```bash
npm install
# o
yarn install
# o
pnpm install
```

### 2. Configurar variables de entorno

Para los análisis con Groq, configura `GROQ_API_KEY`. El modelo se puede cambiar con `GROQ_MODEL`; si no se define, se usa `openai/gpt-oss-20b`. Usa el identificador de modelo que Groq tenga disponible en tu cuenta.

```bash
# Copia el archivo de ejemplo
cp .env.local.example .env.local

# Edita .env.local con tus credenciales de Supabase y Prisma
```

### 3. Configurar Prisma

```bash
# Generar cliente de Prisma
npx prisma generate

# Sincronizar esquema con la base de datos
npx prisma db push
```

### 4. Ejecutar en modo desarrollo

```bash
npm run dev
# o
yarn dev
# o
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 🔐 Credenciales de Prueba

```
Email: admin@example.com
Contraseña: password123
```

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── dashboard/
│   │   │   └── route.ts          # API endpoint para estadísticas
│   │   ├── posts/
│   │   │   └── route.ts          # API endpoints para posts
│   │   └── users/
│   │       └── sync/
│   │           └── route.ts      # API para sincronización de usuarios
│   ├── dashboard/
│   │   └── page.tsx              # Página del dashboard
│   ├── login/
│   │   └── page.tsx              # Página de login
│   ├── globals.css               # Estilos globales
│   ├── layout.tsx                # Layout principal
│   └── page.tsx                  # Página de inicio
├── components/
│   └── SidebarLayout.tsx         # Layout con menú lateral
├── contexts/
│   └── AuthContext.tsx           # Context de autenticación
├── hooks/
│   └── useUserSync.ts            # Hook para sincronización de usuarios
├── lib/
│   ├── prisma.ts                 # Cliente de Prisma
│   └── supabase/
│       ├── client.ts             # Cliente de Supabase para browser
│       ├── server.ts             # Cliente de Supabase para server
│       └── middleware.ts         # Cliente de Supabase para middleware
├── services/
│   ├── UserService.ts            # Servicio para operaciones de usuarios
│   └── PostService.ts            # Servicio para operaciones de posts
└── prisma/
    └── schema.prisma             # Esquema de base de datos de Prisma
```

## 🔒 Sistema de Autenticación

### Flujo de Autenticación

1. **Login**: Usuario ingresa credenciales en `/login`
2. **Validación**: Supabase valida contra la base de datos
3. **Sesión**: Se crea una sesión y se redirige a home
4. **Protección**: Middleware protege rutas privadas
5. **Logout**: Limpia sesión y redirige a login

### Rutas Protegidas

- `/` - Página de inicio (requiere autenticación)
- `/dashboard` - Panel de control (requiere autenticación)
- `/login` - Página de login (redirige si ya está autenticado)

## 🚀 Despliegue

### Vercel (Recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Desplegar
vercel

# Agregar variables de entorno en Vercel dashboard
```

## 📖 Scripts Disponibles

```bash
npm run dev          # Ejecutar en desarrollo
npm run build        # Compilar para producción
npm run start        # Ejecutar versión de producción
npm run lint         # Ejecutar linter
```

## 🐛 Solución de Problemas

### Error: "Invalid login credentials"

- Verifica que las credenciales sean correctas
- Asegúrate de que el usuario exista en Supabase
- Revisa la configuración de variables de entorno

### Error: "Missing environment variables"

- Verifica que `.env.local` exista
- Confirma que las URLs y keys sean correctas
- Reinicia el servidor de desarrollo

---

**Nota**: Este es un proyecto de demostración. Para uso en producción, considera implementar características adicionales como recuperación de contraseña, validación de email, roles de usuario, etc.
