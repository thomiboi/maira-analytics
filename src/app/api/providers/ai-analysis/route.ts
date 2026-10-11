import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GROQ_MODEL } from '@/lib/groq-model';
import Groq from 'groq-sdk';

// Configurar Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

type AnalysisType =
  | 'oportunidades-ahorro'
  | 'anomalias-precios'
  | 'recomendaciones-negociacion'
  | 'analisis-diversificacion'
  | 'optimizacion-pedidos'
  | 'resumen-general';

interface AnalyzeRequest {
  analysisType: AnalysisType;
}

/**
 * Obtener datos de comparación de proveedores desde la API
 */
async function obtenerDatosProveedores() {
  try {
    // Obtener datos del endpoint existente
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/compare-prices`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Error al obtener datos de proveedores');
    }

    const data = await response.json();

    // Transformar datos a formato más manejable
    const productos = data.productsData.map((product: {
      productId: string;
      productName: string;
      prices: Record<string, number>;
    }) => {
      const preciosArray = Object.entries(product.prices).map(([proveedor, precio]) => ({
        proveedor,
        precio: Number(precio),
      }));

      const precios = preciosArray.map(p => p.precio);
      const minPrecio = Math.min(...precios);
      const maxPrecio = Math.max(...precios);
      const promedioPrecio = precios.reduce((a, b) => a + b, 0) / precios.length;

      return {
        id: product.productId,
        nombre: product.productName,
        precios: preciosArray,
        precioMinimo: minPrecio,
        precioMaximo: maxPrecio,
        precioPromedio: promedioPrecio,
        diferenciaMaxima: maxPrecio - minPrecio,
        porcentajeDiferencia: ((maxPrecio - minPrecio) / minPrecio) * 100,
        proveedorMasBarato: preciosArray.find(p => p.precio === minPrecio)?.proveedor || '',
        proveedorMasCaro: preciosArray.find(p => p.precio === maxPrecio)?.proveedor || '',
      };
    });

    // Calcular estadísticas por proveedor
    const proveedoresMap = new Map<string, {
      nombre: string;
      totalProductos: number;
      precioPromedio: number;
      precioTotal: number;
      vecesEsMasBarato: number;
      vecesEsMasCaro: number;
    }>();

    productos.forEach((producto: typeof productos[0]) => {
      producto.precios.forEach((precio: { proveedor: string; precio: number }) => {
        if (!proveedoresMap.has(precio.proveedor)) {
          proveedoresMap.set(precio.proveedor, {
            nombre: precio.proveedor,
            totalProductos: 0,
            precioPromedio: 0,
            precioTotal: 0,
            vecesEsMasBarato: 0,
            vecesEsMasCaro: 0,
          });
        }

        const prov = proveedoresMap.get(precio.proveedor)!;
        prov.totalProductos++;
        prov.precioTotal += precio.precio;

        if (precio.proveedor === producto.proveedorMasBarato) {
          prov.vecesEsMasBarato++;
        }
        if (precio.proveedor === producto.proveedorMasCaro) {
          prov.vecesEsMasCaro++;
        }
      });
    });

    const proveedores = Array.from(proveedoresMap.values()).map(p => ({
      ...p,
      precioPromedio: p.precioTotal / p.totalProductos,
      porcentajeCompetitivo: (p.vecesEsMasBarato / p.totalProductos) * 100,
    }));

    return {
      productos,
      proveedores,
      totalProveedores: proveedores.length,
      totalProductos: productos.length,
    };
  } catch (error) {
    console.error('Error al obtener datos:', error);
    throw error;
  }
}

/**
 * Construir contexto para la IA según el tipo de análisis
 */
function construirContextoIA(
  analysisType: AnalysisType,
  datos: {
    productos: Array<{
      nombre: string;
      precioMinimo: number;
      precioMaximo: number;
      diferenciaMaxima: number;
      porcentajeDiferencia: number;
      proveedorMasBarato: string;
      proveedorMasCaro: string;
    }>;
    proveedores: Array<{
      nombre: string;
      totalProductos: number;
      precioPromedio: number;
      vecesEsMasBarato: number;
      porcentajeCompetitivo: number;
    }>;
  }
): string {
  const { productos, proveedores } = datos;

  let contexto = `Eres un experto en compras y análisis de proveedores para farmacias en Chile.

DATOS GENERALES:
- Total de proveedores activos: ${proveedores.length}
- Total de productos analizados: ${productos.length}
- Ubicación: Farmacias Maira, Viña del Mar, Chile 🇨🇱

PROVEEDORES:
${JSON.stringify(proveedores.slice(0, 10), null, 2)}

PRODUCTOS CON MAYORES DIFERENCIAS DE PRECIO:
${JSON.stringify(productos.sort((a, b) => b.diferenciaMaxima - a.diferenciaMaxima).slice(0, 15), null, 2)}

`;

  switch (analysisType) {
    case 'oportunidades-ahorro':
      contexto += `TAREA: Identifica las MEJORES OPORTUNIDADES DE AHORRO.

Analiza:
1. Productos con mayor diferencia de precio entre proveedores
2. Calcula ahorro potencial si se compra al más barato
3. Prioriza por productos de alto volumen/rotación
4. Considera si vale la pena cambiar de proveedor

Formato de respuesta JSON:
{
  "oportunidades": [
    {
      "producto": "Nombre del producto",
      "proveedor_actual_probable": "Nombre actual",
      "proveedor_sugerido": "Nombre sugerido",
      "precio_actual": 10000,
      "precio_sugerido": 8000,
      "ahorro_por_unidad": 2000,
      "porcentaje_ahorro": 20,
      "prioridad": "alta|media|baja",
      "razon": "Explicación breve"
    }
  ],
  "ahorro_potencial_total": 500000,
  "resumen": "Resumen ejecutivo en 2-3 líneas"
}`;
      break;

    case 'anomalias-precios':
      contexto += `TAREA: Detecta ANOMALÍAS Y ERRORES EN PRECIOS.

Analiza:
1. Precios extremadamente altos o bajos (outliers)
2. Diferencias mayores al 100% entre proveedores
3. Posibles errores de digitación (ej: $10000 vs $100000)
4. Inconsistencias sospechosas

Formato de respuesta JSON:
{
  "anomalias": [
    {
      "producto": "Nombre del producto",
      "proveedor": "Nombre del proveedor",
      "precio": 150000,
      "precio_esperado": 15000,
      "tipo_anomalia": "precio_excesivo|posible_error|inconsistencia",
      "nivel_riesgo": "alto|medio|bajo",
      "recomendacion": "Acción sugerida"
    }
  ],
  "total_anomalias": 5,
  "resumen": "Resumen ejecutivo"
}`;
      break;

    case 'recomendaciones-negociacion':
      contexto += `TAREA: Genera ESTRATEGIA DE NEGOCIACIÓN con proveedores.

Analiza:
1. Proveedores con precios consistentemente altos
2. Productos donde hay margen de negociación
3. Argumentos basados en precios de competencia
4. Prioridad de negociación por impacto económico

Formato de respuesta JSON:
{
  "negociaciones_priorizadas": [
    {
      "proveedor": "Nombre del proveedor",
      "productos_a_negociar": 25,
      "ahorro_potencial": 120000,
      "estrategia": "Descripción de estrategia",
      "argumento_clave": "Argumento para negociar",
      "prioridad": "alta|media|baja"
    }
  ],
  "resumen": "Resumen ejecutivo con plan de acción"
}`;
      break;

    case 'analisis-diversificacion':
      contexto += `TAREA: Analiza RIESGO DE DEPENDENCIA y sugerencias de diversificación.

Analiza:
1. Concentración de compras en pocos proveedores
2. Riesgo de depender de un solo proveedor
3. Productos sin alternativas
4. Sugerencias de proveedores alternativos

Formato de respuesta JSON:
{
  "analisis_riesgo": {
    "nivel_riesgo_global": "alto|medio|bajo",
    "proveedor_mayor_dependencia": "Nombre",
    "porcentaje_concentracion": 65,
    "productos_sin_alternativa": 15
  },
  "recomendaciones_diversificacion": [
    {
      "area_riesgo": "Descripción del riesgo",
      "accion_sugerida": "Acción específica",
      "impacto": "alto|medio|bajo"
    }
  ],
  "resumen": "Resumen ejecutivo sobre diversificación"
}`;
      break;

    case 'optimizacion-pedidos':
      contexto += `TAREA: Optimiza QUÉ COMPRAR A CADA PROVEEDOR para maximizar ahorro.

Analiza:
1. Productos que conviene comprar a cada proveedor
2. Balance entre precio y conveniencia
3. Considera costos de tener múltiples pedidos
4. Plan de compra optimizado

Formato de respuesta JSON:
{
  "plan_compras_optimizado": [
    {
      "proveedor": "Nombre del proveedor",
      "productos_recomendados": [
        {
          "producto": "Nombre",
          "razon": "Por qué comprarlo aquí",
          "ahorro_vs_otros": 2000
        }
      ],
      "total_productos": 45,
      "ahorro_estimado": 85000
    }
  ],
  "resumen": "Resumen con estrategia de compra optimizada"
}`;
      break;

    case 'resumen-general':
    default:
      contexto += `TAREA: Genera un RESUMEN GENERAL con los insights más importantes.

Incluye:
1. Top 3 oportunidades de ahorro más grandes
2. Proveedores más competitivos
3. Riesgos o problemas detectados
4. Recomendaciones accionables inmediatas

Formato de respuesta JSON:
{
  "insights_principales": [
    "Insight 1",
    "Insight 2", 
    "Insight 3"
  ],
  "proveedor_recomendado": {
    "nombre": "Nombre",
    "razon": "Por qué es el mejor"
  },
  "top_ahorros": [
    {
      "producto": "Nombre",
      "ahorro": 5000,
      "accion": "Cambiar de X a Y"
    }
  ],
  "alertas": ["Alerta 1", "Alerta 2"],
  "resumen": "Resumen ejecutivo completo"
}`;
      break;
  }

  contexto += `

IMPORTANTE:
- Responde SOLO con JSON válido, sin markdown
- Usa precios en CLP (pesos chilenos)
- Sé específico con números y porcentajes
- Prioriza por impacto económico real
- Considera el contexto de farmacia chilena`;

  return contexto;
}

/**
 * POST /api/providers/ai-analysis
 * Genera análisis inteligente de proveedores con IA
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar autenticación
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json(
        {
          success: false,
          error: 'No autenticado. Por favor, inicia sesión.',
        },
        { status: 401 }
      );
    }

    // Validar API key de Groq
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No se ha configurado la API key de Groq. Agrega GROQ_API_KEY en .env.local',
        },
        { status: 500 }
      );
    }

    const body: AnalyzeRequest = await request.json();
    const { analysisType } = body;

    console.log(`🤖 Iniciando análisis: ${analysisType}`);

    // Obtener datos de proveedores
    console.log('📊 Obteniendo datos de proveedores...');
    const datos = await obtenerDatosProveedores();

    if (datos.productos.length === 0) {
      return NextResponse.json({
        success: false,
        error:
          'No hay datos suficientes. Asegúrate de haber cargado catálogos de proveedores.',
      });
    }

    // Construir contexto para IA
    const contexto = construirContextoIA(analysisType, datos);

    console.log('🤖 Consultando a Groq IA...');

    // Llamar a Groq IA
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Eres un experto en compras y optimización de costos para farmacias. Respondes SOLO con JSON válido.',
        },
        {
          role: 'user',
          content: contexto,
        },
      ],
      temperature: 0.3,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
    });

    const respuestaIA = completion.choices[0]?.message?.content;

    if (!respuestaIA) {
      throw new Error('No se recibió respuesta de la IA');
    }

    const insights = JSON.parse(respuestaIA);

    console.log('✅ Análisis generado exitosamente');

    return NextResponse.json({
      success: true,
      data: {
        analysisType,
        insights,
        metadata: {
          proveedoresAnalizados: datos.totalProveedores,
          productosAnalizados: datos.totalProductos,
          generadoEn: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('❌ Error al generar análisis:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
