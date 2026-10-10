import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Groq from 'groq-sdk';

// Configurar Groq (alternativa gratuita a OpenAI)
// Obtén tu API key gratis en: https://console.groq.com
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

// Tipos de insights disponibles
type InsightType = 
  | 'tendencias-ventas'      // Productos con tendencia al alza
  | 'estacionalidad'         // Patrones estacionales
  | 'oportunidades-compra'   // Qué comprar para maximizar ganancias
  | 'productos-riesgo'       // Productos con caída en ventas
  | 'analisis-margen'        // Optimización de márgenes
  | 'resumen-general';       // Overview completo

interface AnalyzeRequest {
  insightType: InsightType;
  fechaInicio?: string;
  fechaFin?: string;
  sucursal?: string;
}

/**
 * Obtener datos agregados de ventas para análisis
 */
async function obtenerDatosVentas(fechaInicio: Date, fechaFin: Date, sucursal?: string) {
  try {
    // Obtener boletas del período
    const whereClause: {
      fecha: { gte: Date; lte: Date };
      sucursal_id?: number | null;
    } = {
      fecha: {
        gte: fechaInicio,
        lte: fechaFin,
      },
    };

    if (sucursal && sucursal !== 'todas') {
      whereClause.sucursal_id = sucursal === 'null' ? null : parseFloat(sucursal);
    }

    // Obtener detalles de boletas
    const ventasDetalladas = await prisma.boletas_detalles.findMany({
      where: {
        boletas: whereClause,
      },
      include: {
        boletas: {
          select: {
            fecha: true,
            sucursal_id: true,
          },
        },
      },
      orderBy: {
        boletas: {
          fecha: 'desc',
        },
      },
    });

    // Obtener precios de productos por separado
    const codigosUnicos = [...new Set(ventasDetalladas.map(d => d.codigo).filter(Boolean))];
    const productosConPrecios = await prisma.productos_pos.findMany({
      where: {
        codigo: {
          in: codigosUnicos as string[],
        },
      },
      select: {
        codigo: true,
        preciocompraneto: true,
      },
    });

    // Crear mapa de precios
    const preciosMap = new Map(
      productosConPrecios.map(p => [p.codigo, p.preciocompraneto])
    );

    // Agrupar por producto
    const productoMap = new Map();

    ventasDetalladas.forEach((detalle) => {
      const codigo = detalle.codigo;
      
      if (!codigo) return; // Skip si no hay código
      
      if (!productoMap.has(codigo)) {
        productoMap.set(codigo, {
          codigo,
          nombre: detalle.nombre || 'Sin nombre',
          unidadesVendidas: 0,
          ingresosSinIVA: 0,
          costoTotal: 0,
          frecuencia: 0,
          ventasPorMes: new Map(),
        });
      }

      const producto = productoMap.get(codigo);
      const cantidad = Number(detalle.cantidad) || 0;
      const precio = Number(detalle.precio) || 0;
      const precioSinIVA = precio / 1.19;
      const costoUnitario = Number(preciosMap.get(codigo)) || 0;

      producto.unidadesVendidas += cantidad;
      producto.ingresosSinIVA += cantidad * precioSinIVA;
      producto.costoTotal += cantidad * costoUnitario;
      producto.frecuencia += 1;

      // Agrupar por mes para detectar tendencias
      if (detalle.boletas?.fecha) {
        const mes = detalle.boletas.fecha.toISOString().substring(0, 7); // YYYY-MM
        const ventasMes = producto.ventasPorMes.get(mes) || 0;
        producto.ventasPorMes.set(mes, ventasMes + cantidad);
      }
    });

    // Convertir a array y calcular métricas
    const productos = Array.from(productoMap.values()).map((p) => {
      const ventasMesuales: Array<{ mes: string; ventas: number }> = [];
      p.ventasPorMes.forEach((ventas: number, mes: string) => {
        ventasMesuales.push({ mes, ventas });
      });
      
      return {
        ...p,
        margenDinero: p.ingresosSinIVA - p.costoTotal,
        margenPorcentaje:
          p.ingresosSinIVA > 0 ? ((p.ingresosSinIVA - p.costoTotal) / p.ingresosSinIVA) * 100 : 0,
        ventasPorMes: ventasMesuales,
      };
    });

    return productos;
  } catch (error) {
    console.error('Error al obtener datos de ventas:', error);
    throw error;
  }
}

/**
 * Obtener información estacional de Chile (hemisferio sur)
 */
function getEstacionChile(mes: number): {
  nombre: string;
  descripcion: string;
  productosRelevantes: string;
} {
  // Estaciones en Chile (hemisferio sur)
  if (mes === 12 || mes === 1 || mes === 2) {
    return {
      nombre: 'Verano',
      descripcion: 'Temperaturas altas (20-30°C), alta demanda de protector solar, hidratación, productos de verano',
      productosRelevantes: 'Protectores solares, hidratantes corporales, antihistamínicos (alergias), vitaminas, suplementos deportivos',
    };
  } else if (mes >= 3 && mes <= 5) {
    return {
      nombre: 'Otoño',
      descripcion: 'Temperaturas descendentes (10-20°C), inicio de enfermedades respiratorias leves, cambios inmunológicos',
      productosRelevantes: 'Vitamina C, jarabes para la tos, antigripales preventivos, analgésicos, antiinflamatorios',
    };
  } else if (mes >= 6 && mes <= 8) {
    return {
      nombre: 'Invierno',
      descripcion: 'Temperaturas bajas (5-15°C), PEAK de gripes, resfríos, enfermedades respiratorias. Mayor demanda farmacéutica',
      productosRelevantes: 'Antigripales, paracetamol, ibuprofeno, jarabes expectorantes, descongestionantes, antibióticos (con receta), vitaminas',
    };
  } else {
    return {
      nombre: 'Primavera',
      descripcion: 'Temperaturas en ascenso (15-25°C), alta incidencia de alergias estacionales, polinización',
      productosRelevantes: 'Antihistamínicos (loratadina, cetirizina), colirios antialérgicos, corticoides nasales, vitaminas',
    };
  }
}

/**
 * Construir contexto para la IA según el tipo de insight
 */
function construirContextoIA(
  insightType: InsightType,
  productos: Array<{
    codigo: string;
    nombre: string;
    unidadesVendidas: number;
    margenDinero: number;
    margenPorcentaje: number;
    ventasPorMes: Array<{ mes: string; ventas: number }>;
  }>,
  fechaInicio: string,
  fechaFin: string
): string {
  const totalProductos = productos.length;
  const top10Unidades = productos
    .toSorted((a, b) => b.unidadesVendidas - a.unidadesVendidas)
    .slice(0, 10);
  const top10Margen = productos
    .toSorted((a, b) => b.margenDinero - a.margenDinero)
    .slice(0, 10);

  const mesActual = new Date().getMonth() + 1;
  const mesNombre = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ][mesActual - 1];

  // Determinar estación del año en Chile (hemisferio sur)
  const estacionInfo = getEstacionChile(mesActual);

  let contexto = `Eres un analista de datos especializado en farmacias en Chile. Analiza los siguientes datos de Farmacias Maira.

CONTEXTO GEOGRÁFICO Y TEMPORAL:
- Ubicación: Viña del Mar, Región de Valparaíso, Chile 🇨🇱
- Clima: Mediterráneo costero (templado)
- Período analizado: ${fechaInicio} hasta ${fechaFin}
- Mes actual: ${mesNombre} (${mesActual})
- Estación actual: ${estacionInfo.nombre}
- Características estacionales: ${estacionInfo.descripcion}
- Productos típicos de la estación: ${estacionInfo.productosRelevantes}

INFORMACIÓN DE LA EMPRESA:
- Empresa: Farmacias Maira (2 sucursales en Viña del Mar)
- Total de productos únicos vendidos: ${totalProductos}
- Mercado: Retail farmacéutico chileno

IMPORTANTE: Ten en cuenta que Chile está en el hemisferio sur, por lo que las estaciones son:
- Verano: Diciembre-Febrero (calor, vacaciones)
- Otoño: Marzo-Mayo (cambios de temperatura, inicio enfermedades respiratorias)
- Invierno: Junio-Agosto (frío, peak de gripes y resfríos)
- Primavera: Septiembre-Noviembre (alergias, cambio de estación)

`;

  switch (insightType) {
    case 'tendencias-ventas':
      contexto += `Tarea: Identifica productos con TENDENCIA AL ALZA en ventas.

Datos de productos (top 10 por unidades):
${JSON.stringify(top10Unidades, null, 2)}

Analiza:
1. Productos cuyas ventas mensuales están creciendo consistentemente
2. Porcentaje de crecimiento mes a mes
3. Factores estacionales que podrían explicar el crecimiento
4. Recomendación de stock para el próximo mes

Formato de respuesta:
{
  "productos_tendencia_alza": [
    {
      "nombre": "Nombre del producto",
      "crecimiento_porcentual": 25,
      "razon": "Explicación breve",
      "recomendacion_stock": "Aumentar inventario en X%"
    }
  ],
  "resumen": "Resumen ejecutivo en 2-3 líneas"
}`;
      break;

    case 'estacionalidad':
      contexto += `Tarea: Detecta patrones ESTACIONALES en las ventas considerando el clima de Chile (hemisferio sur).

CONTEXTO ESTACIONAL ESPECÍFICO:
- Estación actual: ${estacionInfo.nombre}
- Productos típicos esperados: ${estacionInfo.productosRelevantes}
- Mes actual: ${mesNombre}

Datos completos de productos con ventas mensuales:
${JSON.stringify(productos.slice(0, 20), null, 2)}

Analiza considerando las estaciones de Chile:
1. Productos que típicamente suben en ${estacionInfo.nombre} (mes actual: ${mesNombre})
2. Comparación con meses anteriores del mismo tipo estacional
3. Productos estacionales específicos:
   - Invierno (Jun-Ago): Antigripales, paracetamol, jarabes
   - Primavera (Sep-Nov): Antihistamínicos, colirios alérgicos
   - Verano (Dic-Feb): Protectores solares, hidratantes
   - Otoño (Mar-May): Vitaminas, preventivos
4. Predicción para los próximos 2-3 meses basada en cambios estacionales

IMPORTANTE: Si detectas que algún producto NO se comporta según lo esperado para la estación actual, 
menciónalo como anomalía o oportunidad.

Formato de respuesta:
{
  "productos_estacionales": [
    {
      "nombre": "Nombre del producto",
      "patron": "Descripción del patrón estacional",
      "estacion_pico": "Invierno|Primavera|Verano|Otoño",
      "meses_pico": ["Junio", "Julio"],
      "comportamiento_actual": "normal|por_encima|por_debajo de lo esperado",
      "recomendacion": "Acción sugerida considerando próxima estación"
    }
  ],
  "prediccion_proxima_estacion": "Qué esperar en los próximos meses",
  "resumen": "Resumen ejecutivo con contexto estacional chileno"
}`;
      break;

    case 'oportunidades-compra':
      contexto += `Tarea: Identifica OPORTUNIDADES DE COMPRA para maximizar ganancias.

Top 10 productos por margen de ganancia:
${JSON.stringify(top10Margen, null, 2)}

Analiza:
1. Productos con alto margen Y alta rotación (ganar más)
2. Productos con bajo margen pero alta rotación (aumentar precio o cambiar proveedor)
3. Productos con alto costo que no se venden (evitar comprar)
4. Balance óptimo entre margen y volumen

Formato de respuesta:
{
  "oportunidades": [
    {
      "tipo": "alta_prioridad|revisar_precio|evitar",
      "producto": "Nombre",
      "razon": "Explicación",
      "accion": "Acción específica"
    }
  ],
  "ahorro_potencial_estimado": "Monto en CLP",
  "resumen": "Resumen ejecutivo"
}`;
      break;

    case 'productos-riesgo':
      contexto += `Tarea: Identifica productos EN RIESGO (caída de ventas).

Datos de todos los productos con ventas mensuales:
${JSON.stringify(productos.slice(0, 30), null, 2)}

Analiza:
1. Productos con tendencia decreciente en ventas
2. Productos que antes vendían bien pero ahora no
3. Posibles causas (estacionalidad, competencia, obsolescencia)
4. Recomendaciones (descuento, promoción, dejar de comprar)

Formato de respuesta:
{
  "productos_riesgo": [
    {
      "nombre": "Nombre",
      "caida_porcentual": -30,
      "posible_causa": "Explicación",
      "recomendacion": "Acción sugerida"
    }
  ],
  "resumen": "Resumen ejecutivo"
}`;
      break;

    case 'analisis-margen':
      contexto += `Tarea: Analiza la OPTIMIZACIÓN DE MÁRGENES.

Todos los productos con margen:
${JSON.stringify(productos.slice(0, 50), null, 2)}

Analiza:
1. Productos con margen muy bajo (<15%) - ¿Vale la pena venderlos?
2. Productos con margen muy alto (>40%) - ¿Oportunidad de bajar precio y vender más?
3. Balance entre margen y volumen
4. Estrategias de pricing por categoría

Formato de respuesta:
{
  "optimizaciones": [
    {
      "producto": "Nombre",
      "margen_actual": 12,
      "problema": "Margen muy bajo",
      "sugerencia": "Negociar con proveedor o aumentar precio en X%",
      "impacto_estimado": "+$50,000/mes"
    }
  ],
  "resumen": "Resumen ejecutivo"
}`;
      break;

    case 'resumen-general':
    default:
      contexto += `Tarea: Genera un RESUMEN GENERAL y RECOMENDACIONES ACCIONABLES.

Top 10 productos más vendidos:
${JSON.stringify(top10Unidades.slice(0, 5), null, 2)}

Top 10 productos con mejor margen:
${JSON.stringify(top10Margen.slice(0, 5), null, 2)}

Genera un resumen ejecutivo que incluya:
1. Top 3 insights más importantes del período
2. 3 acciones inmediatas recomendadas
3. Oportunidades detectadas
4. Riesgos a mitigar

Formato de respuesta:
{
  "insights_principales": [
    "Insight 1",
    "Insight 2",
    "Insight 3"
  ],
  "acciones_inmediatas": [
    "Acción 1",
    "Acción 2",
    "Acción 3"
  ],
  "oportunidades": ["Oportunidad 1", "Oportunidad 2"],
  "riesgos": ["Riesgo 1", "Riesgo 2"],
  "resumen": "Resumen ejecutivo en 3-4 líneas"
}`;
      break;
  }

  contexto += `

IMPORTANTE: 
- Responde SOLO con JSON válido, sin texto adicional
- Usa términos farmacéuticos cuando sea relevante
- Considera estacionalidad (Chile, hemisferio sur)
- Sé específico con números y porcentajes
- Menciona nombres de productos reales de los datos`;

  return contexto;
}

/**
 * POST /api/insights/analyze
 * Analiza datos y genera insights con IA
 */
export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeRequest = await request.json();
    const { insightType, fechaInicio, fechaFin, sucursal } = body;

    // Validar que existe API key
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { 
          error: 'No se ha configurado la API key de Groq. Agrega GROQ_API_KEY en .env.local',
          success: false 
        },
        { status: 500 }
      );
    }

    // Fechas por defecto (últimos 90 días)
    const fin = fechaFin ? new Date(fechaFin) : new Date();
    const inicio = fechaInicio
      ? new Date(fechaInicio)
      : new Date(fin.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Obtener datos de ventas
    console.log('📊 Obteniendo datos de ventas...');
    const productos = await obtenerDatosVentas(inicio, fin, sucursal);

    if (productos.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay datos suficientes en el período seleccionado',
      });
    }

    // Construir contexto para la IA
    const contexto = construirContextoIA(
      insightType,
      productos,
      inicio.toISOString().split('T')[0],
      fin.toISOString().split('T')[0]
    );

    console.log('🤖 Consultando a Groq IA...');

    // Llamar a Groq IA
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile', // Modelo más reciente de Groq (gratis, reemplaza 3.1)
      messages: [
        {
          role: 'system',
          content:
            'Eres un analista de datos experto en retail farmacéutico. Respondes SOLO con JSON válido, sin markdown ni texto adicional.',
        },
        {
          role: 'user',
          content: contexto,
        },
      ],
      temperature: 0.3, // Respuestas más deterministas
      max_tokens: 2000,
      response_format: { type: 'json_object' }, // Forzar respuesta JSON
    });

    const respuestaIA = completion.choices[0]?.message?.content;

    if (!respuestaIA) {
      throw new Error('No se recibió respuesta de la IA');
    }

    // Parsear respuesta JSON
    const insights = JSON.parse(respuestaIA);

    console.log('✅ Insights generados exitosamente');

    return NextResponse.json({
      success: true,
      data: {
        insightType,
        insights,
        metadata: {
          fechaInicio: inicio.toISOString().split('T')[0],
          fechaFin: fin.toISOString().split('T')[0],
          totalProductos: productos.length,
          generadoEn: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('❌ Error al generar insights:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
