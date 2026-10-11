/**
 * prisma/seed.ts — Datos mock para MairaAnalytics
 *
 * Qué hace (todo es idempotente, se puede re-ejecutar):
 *   1. Roles, permisos y role_permissions
 *   2. Usuarios demo (Supabase Auth Admin API + public.users + user_profiles)
 *   3. Catálogo mock: productos_pos, stock_minimo, products, providers, provider_prices
 *   4. Mensajes de ejemplo
 *   5. Boletas, detalles y pagos (cantidad según SEED_BOLETAS)
 *
 * Uso (PowerShell, desde la raíz del proyecto):
 *   $env:SEED_BOLETAS=0;     npx tsx prisma/seed.ts   # solo configuración + catálogo
 *   $env:SEED_BOLETAS=15000; npx tsx prisma/seed.ts   # además genera boletas
 *   $env:SEED_RESET="true";  npx tsx prisma/seed.ts   # borra boletas y las regenera
 *
 * Variables requeridas en .env.local (NUNCA subir a git):
 *   NEXT_PUBLIC_SUPABASE_URL, DATABASE_URL, DIRECT_URL
 *   SUPABASE_SECRET_KEY         (sb_secret_...; también acepta SUPABASE_SERVICE_ROLE_KEY. Solo local, nunca con prefijo NEXT_PUBLIC_)
 *   SEED_EXPECTED_REF           (Project ID del proyecto NUEVO; evita sembrar otra base)
 *   SEED_ADMIN_PASSWORD         (contraseña del admin, privada)
 *   SEED_DEMO_PASSWORD          (contraseña de las cuentas demo públicas)
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config()

import { randomUUID } from 'node:crypto'
import { PrismaClient, Prisma } from '@prisma/client'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker/locale/es'

const prisma = new PrismaClient()
faker.seed(2026)

// ───────────────────────── Configuración ─────────────────────────
const N_BOLETAS = Number(process.env.SEED_BOLETAS ?? 15000)
const RESET = process.env.SEED_RESET === 'true'
const BATCH = 1000
const BODEGAS = [1, 2] // ids mock de bodega

const EXPECTED_REF = process.env.SEED_EXPECTED_REF
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD

/** Aborta si faltan variables o si alguna URL apunta a otro proyecto. */
function guard() {
  const required = {
    SEED_EXPECTED_REF: EXPECTED_REF,
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    'SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY)': SERVICE_KEY,
    SEED_ADMIN_PASSWORD: ADMIN_PASSWORD,
    SEED_DEMO_PASSWORD: DEMO_PASSWORD,
  }
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length) throw new Error(`Faltan variables en .env.local: ${missing.join(', ')}`)

  const urls = {
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL!,
    DATABASE_URL: process.env.DATABASE_URL ?? '',
    DIRECT_URL: process.env.DIRECT_URL ?? '',
  }
  for (const [name, value] of Object.entries(urls)) {
    if (!value.includes(EXPECTED_REF!)) {
      throw new Error(`${name} no apunta al proyecto ${EXPECTED_REF}. Abortando para no tocar otra base.`)
    }
  }
}

// ───────────────────────── 1. Roles y permisos ─────────────────────────
const ROLES = [
  { name: 'admin', description: 'Administrador con acceso completo al sistema' },
  { name: 'manager', description: 'Gerente con acceso a reportes y gestión' },
  { name: 'pharmacist', description: 'Farmacéutico con acceso limitado' },
  { name: 'viewer', description: 'Usuario con permisos de solo lectura' },
  { name: 'user', description: 'Usuario básico con acceso limitado' },
]

const PERMISOS: Array<[name: string, description: string]> = [
  ['home.read', 'Ver página principal'],
  ['dashboard.read', 'Ver dashboard'],
  ['analytics.read', 'Ver analytics y reportes'],
  ['ranking.read', 'Ver rankings y estadísticas'],
  ['proveedores.read', 'Ver proveedores'],
  ['proveedores.write', 'Crear y editar proveedores'],
  ['usuarios.read', 'Ver usuarios del sistema'],
  ['usuarios.write', 'Gestionar usuarios del sistema'],
  ['configuracion.read', 'Ver configuración del sistema'],
  ['configuracion.write', 'Modificar configuración del sistema'],
  ['config.read', 'Ver configuración del sistema'],
  ['config.write', 'Modificar configuración del sistema'],
  ['inventory.read', 'Ver inventario'],
  ['inventory.write', 'Gestionar inventario'],
  ['pharmacy.read', 'Ver información de farmacia'],
  ['pharmacy.write', 'Gestionar información de farmacia'],
  ['mensajes.read', 'Ver mensajes internos'],
  ['mensajes.write', 'Enviar y gestionar mensajes internos'],
]

// admin, pharmacist y viewer replican la lógica del seed original del proyecto:
//   - admin: todos los permisos
//   - pharmacist: home, dashboard, pharmacy, inventory y mensajes
//   - viewer: home, dashboard y cualquier permiso de lectura que no sea de configuración
// SUPUESTO: manager y user no estaban en ese seed; su reparto es una propuesta razonable.
const PERMISOS_POR_ROL: Record<string, string[] | 'all'> = {
  admin: 'all',
  manager: [
    'home.read', 'dashboard.read', 'analytics.read', 'ranking.read',
    'proveedores.read', 'proveedores.write', 'usuarios.read',
    'inventory.read', 'pharmacy.read', 'mensajes.read', 'mensajes.write',
  ],
  pharmacist: [
    'home.read', 'dashboard.read', 'inventory.read', 'inventory.write',
    'pharmacy.read', 'pharmacy.write', 'mensajes.read', 'mensajes.write',
  ],
  viewer: [
    'home.read', 'dashboard.read', 'analytics.read', 'ranking.read',
    'proveedores.read', 'usuarios.read', 'inventory.read', 'pharmacy.read', 'mensajes.read',
  ],
  user: ['home.read', 'mensajes.read', 'mensajes.write'],
}

async function seedAcceso() {
  console.log('→ Roles y permisos')
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { name: r.name },
      update: { description: r.description },
      create: r,
    })
  }
  const [resource, action] = [(n: string) => n.split('.')[0], (n: string) => n.split('.')[1]]
  for (const [name, description] of PERMISOS) {
    await prisma.permission.upsert({
      where: { name },
      update: { description },
      create: { name, description, resource: resource(name), action: action(name) },
    })
  }

  const roles = await prisma.role.findMany()
  const permisos = await prisma.permission.findMany()
  const rows: Prisma.RolePermissionCreateManyInput[] = []
  for (const role of roles) {
    const asignados = PERMISOS_POR_ROL[role.name]
    if (!asignados) continue
    for (const p of permisos) {
      if (asignados === 'all' || asignados.includes(p.name)) {
        rows.push({ roleId: role.id, permissionId: p.id })
      }
    }
  }
  await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true })
}

// ───────────────────────── 2. Usuarios ─────────────────────────
const USUARIOS_DEMO = [
  { email: 'admin@demo.com', role: 'admin', firstName: 'Ana', lastName: 'Administradora', admin: true },
  { email: 'manager@demo.com', role: 'manager', firstName: 'Marcos', lastName: 'Gerente', admin: false },
  { email: 'farmaceutico@demo.com', role: 'pharmacist', firstName: 'Fernanda', lastName: 'Farmacéutica', admin: false },
  { email: 'viewer@demo.com', role: 'viewer', firstName: 'Vicente', lastName: 'Visitante', admin: false },
]

async function seedUsuarios(supabase: SupabaseClient) {
  console.log('→ Usuarios demo')
  const { data: lista, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listError) throw listError
  const existentes = new Map(lista.users.map((u) => [u.email, u.id]))
  const roles = new Map((await prisma.role.findMany()).map((r) => [r.name, r.id]))

  const ids: Record<string, string> = {}
  for (const u of USUARIOS_DEMO) {
    let id = existentes.get(u.email)
    if (!id) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.admin ? ADMIN_PASSWORD! : DEMO_PASSWORD!,
        email_confirm: true,
        user_metadata: { firstName: u.firstName, lastName: u.lastName, full_name: `${u.firstName} ${u.lastName}` },
      })
      if (error) throw error
      id = data.user.id
    }
    ids[u.email] = id

    // public.users no tiene FK a auth.users: comparten el mismo id.
    await prisma.user.upsert({
      where: { id },
      update: { roleId: roles.get(u.role), isActive: true },
      create: { id, email: u.email, roleId: roles.get(u.role) },
    })
    await prisma.userProfile.upsert({
      where: { userId: id },
      update: { firstName: u.firstName, lastName: u.lastName },
      create: { userId: id, firstName: u.firstName, lastName: u.lastName },
    })
  }
  return ids
}

// ───────────────────────── 3. Catálogo ─────────────────────────
type Base = { nombre: string; categoria: string; costo: [number, number]; variantes: boolean }
const MED = (nombre: string, min: number, max: number): Base => ({ nombre, categoria: 'MEDICAMENTO', costo: [min, max], variantes: true })
const CUI = (nombre: string, min: number, max: number): Base => ({ nombre, categoria: 'CUIDADO PERSONAL', costo: [min, max], variantes: false })
const INS = (nombre: string, min: number, max: number): Base => ({ nombre, categoria: 'INSUMO MEDICO', costo: [min, max], variantes: false })

const BASES: Base[] = [
  MED('PARACETAMOL 500 MG X 16 COMP', 150, 400),
  MED('IBUPROFENO 400 MG X 20 COMP', 300, 700),
  MED('IBUPROFENO 600 MG X 20 COMP', 400, 900),
  MED('NAPROXENO 550 MG X 10 COMP', 500, 1000),
  MED('DICLOFENACO GEL 1,16% X 30 G', 350, 900),
  MED('LORATADINA 10 MG X 30 COMP', 250, 600),
  MED('CLORFENAMINA 4 MG X 20 COMP', 120, 300),
  MED('DESLORATADINA 5 MG X 30 COMP', 900, 1800),
  MED('OMEPRAZOL 20 MG X 30 CAP', 400, 900),
  MED('FAMOTIDINA 40 MG X 10 COMP', 200, 500),
  MED('AMOXICILINA 500 MG X 21 CAP', 1500, 3200),
  MED('AZITROMICINA 500 MG X 3 COMP', 700, 1500),
  MED('CIPROFLOXACINO 500 MG X 6 COMP', 300, 800),
  MED('LOSARTAN 50 MG X 30 COMP', 400, 900),
  MED('ENALAPRIL 10 MG X 20 COMP', 200, 500),
  MED('AMLODIPINO 10 MG X 30 COMP', 200, 600),
  MED('ATORVASTATINA 20 MG X 30 COMP', 400, 1200),
  MED('METFORMINA 850 MG X 60 COMP', 800, 1800),
  MED('LEVOTIROXINA 50 MCG X 56 COMP', 1800, 2800),
  MED('SALBUTAMOL INHALADOR 100 MCG X 200 DOSIS', 800, 1500),
  MED('PREDNISONA 20 MG X 20 COMP', 700, 1300),
  MED('LOPERAMIDA 2 MG X 6 COMP', 150, 400),
  MED('KETOPROFENO 200 MG X 10 COMP', 600, 1200),
  MED('JARABE PARA LA TOS 120 ML', 1500, 3000),
  MED('SOBRES ANTIGRIPALES X 10', 2500, 4500),
  MED('SUERO ORAL SABOR FRUTILLA 500 ML', 500, 900),
  CUI('PASTA DENTAL TRIPLE ACCION 75 ML', 400, 900),
  CUI('CEPILLO DENTAL SUAVE', 300, 800),
  CUI('SHAMPOO ANTICAIDA 400 ML', 2000, 4000),
  CUI('PROTECTOR SOLAR FPS 50 100 ML', 4000, 8000),
  CUI('CREMA HIDRATANTE 200 ML', 1500, 3500),
  CUI('DESODORANTE ROLL ON 50 ML', 800, 1800),
  CUI('JABON LIQUIDO 750 ML', 900, 1600),
  CUI('PAÑALES ETAPA 3 X 40 UND', 5000, 8000),
  CUI('TOALLAS HUMEDAS BEBE X 80', 800, 1500),
  CUI('TOALLAS HIGIENICAS X 8', 500, 1000),
  CUI('PAÑUELOS DESECHABLES PACK X 6', 500, 1000),
  CUI('VITAMINA C 1000 MG X 20 TAB EFERVESCENTES', 1000, 2000),
  CUI('VITAMINA D 800 UI X 30 CAP', 900, 2000),
  CUI('MULTIVITAMINICO X 60 COMP', 1800, 3500),
  CUI('COLAGENO + VITAMINA C X 20 TAB', 2500, 4500),
  INS('ALCOHOL GEL 500 ML', 900, 1800),
  INS('ALCOHOL 70% 250 ML', 500, 900),
  INS('ALGODON 50 G', 200, 500),
  INS('TERMOMETRO DIGITAL', 1500, 3500),
  INS('JERINGA 5 CC X 1', 100, 250),
  INS('MASCARILLAS DESECHABLES X 50', 1500, 3000),
  INS('PARCHES CURITAS X 20', 300, 800),
  INS('TENSIOMETRO DIGITAL', 12000, 25000),
  INS('AEROCAMARA UNIVERSAL', 1200, 2500),
  INS('TEST DE EMBARAZO X 1', 600, 1500),
]

const MARCAS = [
  { tag: 'LAB ANDES', factor: 1.0 },
  { tag: 'LAB PACIFICO', factor: 0.9 },
  { tag: 'GENERICO', factor: 0.7 },
]

type Producto = {
  id: bigint
  codigo: string
  nombre: string
  categoria: string
  costo: number
  precio: number
}

function construirCatalogo(): Producto[] {
  const productos: Producto[] = []
  let i = 0
  for (const base of BASES) {
    const variantes = base.variantes ? MARCAS : [{ tag: '', factor: 1 }]
    for (const v of variantes) {
      i++
      const costo = Math.round(faker.number.int({ min: base.costo[0], max: base.costo[1] }) * v.factor)
      const bruto = costo * faker.number.float({ min: 1.3, max: 2.2 })
      const precio = Math.max(190, Math.ceil(bruto / 100) * 100 - 10) // termina en 90
      productos.push({
        id: BigInt(100000 + i),
        codigo: `780${String(i).padStart(10, '0')}`, // códigos mock (sin dígito verificador)
        nombre: v.tag ? `${base.nombre} [${v.tag}]` : base.nombre,
        categoria: base.categoria,
        costo,
        precio,
      })
    }
  }
  return productos
}

async function seedCatalogo(): Promise<Producto[]> {
  console.log('→ Catálogo (productos_pos, stock_minimo, products, providers, provider_prices)')
  const productos = construirCatalogo()

  await prisma.productos_pos.createMany({
    skipDuplicates: true,
    data: productos.map((p): Prisma.productos_posCreateManyInput => ({
      id: p.id,
      nombre: p.nombre,
      codigo: p.codigo,
      unidad: 'Unidad',
      exento: false,
      fraccionable: false,
      activo: true,
      param1: p.categoria,
      preciocompraneto: p.costo,
      precioventabruto: p.precio,
      stocks: BODEGAS.map((b) => ({
        maximo: null,
        critico: faker.number.int({ min: 3, max: 15 }),
        cantidad: faker.number.int({ min: 0, max: 60 }),
        reservas: true,
        bodega_id: b,
        ubicacion: '',
      })),
      atributos: [],
      otrosprecios: [],
    })),
  })

  await prisma.stock_minimo.createMany({
    skipDuplicates: true,
    data: productos
      .filter(() => faker.number.int({ min: 1, max: 100 }) <= 60)
      .map((p) => ({
        producto_id: p.id,
        bodega_id: BigInt(BODEGAS[0]),
        stock_minimo: faker.number.int({ min: 2, max: 12 }),
      })),
  })

  // Proveedores mock
  const nombresProveedores = [
    'Droguería Andina', 'Distribuidora Pacífico', 'Laboratorios Austral',
    'FarmaSur Mayorista', 'Importadora Cordillera', 'Cosméticos del Valle',
  ]
  const proveedores = []
  for (const name of nombresProveedores) {
    proveedores.push(await prisma.providers.upsert({ where: { name }, update: {}, create: { name } }))
  }

  // Catálogo de proveedores
  await prisma.products.createMany({
    skipDuplicates: true,
    data: productos.map((p) => ({ id: randomUUID(), ean: p.codigo, name: p.nombre })),
  })
  const enDb = await prisma.products.findMany({
    where: { ean: { in: productos.map((p) => p.codigo) } },
    select: { id: true, ean: true },
  })
  const costoPorEan = new Map(productos.map((p) => [p.codigo, p.costo]))
  const precios: Prisma.provider_pricesCreateManyInput[] = []
  for (const prod of enDb) {
    const costo = costoPorEan.get(prod.ean!) ?? 1000
    const cuantos = faker.number.int({ min: 2, max: 4 })
    for (const prov of faker.helpers.arrayElements(proveedores, cuantos)) {
      precios.push({
        product_id: prod.id,
        provider_id: prov.id,
        price: Math.round(costo * faker.number.float({ min: 0.9, max: 1.15 })),
      })
    }
  }
  await prisma.provider_prices.createMany({ data: precios, skipDuplicates: true })

  return productos
}

// ───────────────────────── 4. Mensajes ─────────────────────────
async function seedMensajes(ids: Record<string, string>) {
  if ((await prisma.mensajes.count()) > 0) return
  console.log('→ Mensajes de ejemplo')
  const admin = ids['admin@demo.com']
  const manager = ids['manager@demo.com']
  const farm = ids['farmaceutico@demo.com']
  const viewer = ids['viewer@demo.com']

  const mensajes = [
    { de: admin, a: [manager, farm, viewer], asunto: 'Bienvenidos a MairaAnalytics', cuerpo: 'Este es un entorno de demostración con datos ficticios. Explora el dashboard, el ranking de productos y el catálogo de proveedores.' },
    { de: manager, a: [farm], asunto: 'Revisión de stock crítico', cuerpo: 'Por favor revisa los productos con stock bajo el mínimo antes del cierre de la semana.' },
    { de: farm, a: [manager], asunto: 'Re: Revisión de stock crítico', cuerpo: 'Listo, ya generé la lista de reposición para los proveedores habituales.' },
  ]
  for (const m of mensajes) {
    await prisma.mensajes.create({
      data: {
        remitente_id: m.de,
        asunto: m.asunto,
        cuerpo: m.cuerpo,
        mensaje_destinatarios: { create: m.a.map((destinatario_id) => ({ destinatario_id })) },
      },
    })
  }
}

// ───────────────────────── 5. Boletas ─────────────────────────
function fechaAleatoria(desde: Date, hasta: Date): Date {
  // Más ventas en invierno (jun-ago) y menos los domingos.
  while (true) {
    const d = faker.date.between({ from: desde, to: hasta })
    const mes = d.getUTCMonth()
    let peso = mes >= 5 && mes <= 7 ? 1 : 0.7
    if (d.getUTCDay() === 0) peso *= 0.5
    if (faker.number.float({ min: 0, max: 1 }) <= peso) {
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    }
  }
}

async function seedBoletas(productos: Producto[]) {
  if (RESET) {
    console.log('→ Borrando boletas existentes (SEED_RESET=true)')
    await prisma.$executeRawUnsafe('TRUNCATE TABLE boletas, boletas_detalles, boletas_pagos RESTART IDENTITY CASCADE')
  } else if ((await prisma.boletas.count()) > 0) {
    console.log('→ Ya hay boletas; se omite (usa SEED_RESET=true para regenerarlas)')
    return
  }

  console.log(`→ Generando ${N_BOLETAS} boletas`)
  // Popularidad tipo Zipf: pocos productos concentran la mayoría de las ventas.
  const ordenados = faker.helpers.shuffle(productos)
  const pesos = ordenados.map((_, i) => 1 / Math.pow(i + 1, 0.8))
  const acumulado: number[] = []
  pesos.reduce((acc, w, i) => (acumulado[i] = acc + w), 0)
  const totalPeso = acumulado[acumulado.length - 1]
  const elegirProducto = () => {
    const r = faker.number.float({ min: 0, max: totalPeso })
    const idx = acumulado.findIndex((a) => a >= r)
    return ordenados[idx === -1 ? ordenados.length - 1 : idx]
  }

  const fechas = Array.from({ length: N_BOLETAS }, () =>
    fechaAleatoria(new Date('2025-01-01T00:00:00Z'), new Date()),
  ).sort((a, b) => a.getTime() - b.getTime())

  for (let inicio = 0; inicio < N_BOLETAS; inicio += BATCH) {
    const tamano = Math.min(BATCH, N_BOLETAS - inicio)
    const boletas: Prisma.boletasCreateManyInput[] = []
    const detalles: Prisma.boletas_detallesCreateManyInput[] = []
    const pagos: Prisma.boletas_pagosCreateManyInput[] = []

    for (let i = 0; i < tamano; i++) {
      const folio = inicio + i + 1
      const fecha = fechas[folio - 1]
      const nItems = faker.helpers.weightedArrayElement([
        { weight: 45, value: 1 }, { weight: 28, value: 2 }, { weight: 15, value: 3 },
        { weight: 8, value: 4 }, { weight: 4, value: 5 },
      ])
      const descuento = faker.number.int({ min: 1, max: 100 }) <= 5 ? 10 : 0 // % por ítem
      let total = 0

      for (let k = 0; k < nItems; k++) {
        const p = elegirProducto()
        const cantidad = faker.helpers.weightedArrayElement([
          { weight: 80, value: 1 }, { weight: 15, value: 2 }, { weight: 5, value: 3 },
        ])
        total += cantidad * p.precio * (1 - descuento / 100)
        detalles.push({
          boleta_folio: folio,
          item_index: k + 1,
          codigo: p.codigo,
          nombre: p.nombre,
          cantidad,
          unidad: 'ud',
          precio: p.precio,
          descuento,
          exento: 0,
          bodega: BODEGAS[0],
          costo_unitario_neto: { ultimo: p.costo },
        })
      }

      total = Math.round(total)
      const neto = Math.round(total / 1.19)
      const medioPago = faker.number.int({ min: 1, max: 100 }) <= 60 ? 1 : 2 // 1 efectivo, 2 tarjeta

      // sucursal_id NULL = "matriz": las funciones del dashboard filtran así por defecto.
      boletas.push({
        folio,
        id: 50000000 + folio,
        sucursal_id: null,
        tipodoc: '39',
        fecha,
        rut: '666666666',
        rs: null,
        montoneto: neto,
        montoexento: 0,
        montoiva: total - neto,
        montonf: 0,
        montototal: total,
        estado: 'acepta',
        trackid: faker.string.numeric(10),
        referencias: [],
        timestamp_descarga: new Date(),
      })
      pagos.push({
        boleta_folio: folio,
        fecha,
        mediopago: medioPago,
        monto: total,
        glosa: medioPago === 2 ? '01' : null,
        cobrar: 0,
      })
    }

    await prisma.boletas.createMany({ data: boletas })
    await prisma.boletas_detalles.createMany({ data: detalles })
    await prisma.boletas_pagos.createMany({ data: pagos })
    console.log(`   ${Math.min(inicio + tamano, N_BOLETAS)} / ${N_BOLETAS}`)
  }
}

// ───────────────────────── Main ─────────────────────────
async function main() {
  guard()
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  await seedAcceso()
  const usuarios = await seedUsuarios(supabase)
  const productos = await seedCatalogo()
  await seedMensajes(usuarios)
  if (N_BOLETAS > 0) await seedBoletas(productos)

  console.log('✔ Seed completado')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
