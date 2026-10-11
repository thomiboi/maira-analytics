import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GROQ_MODEL } from '@/lib/groq-model';
import Groq from 'groq-sdk';

// Configurar Groq (misma API que analytics)
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

type AnalysisType =
  | 'mejores-precios'           // Mejor precio por producto
  | 'oportunidades-ahorro'      // Dónde se puede ahorrar más
  | 'recomendaciones-compra'    // Qué comprar y a quién
  | 'analisis-proveedores'      // Evaluación de proveedores
  | 'alertas-precios'           // Precios sospechosos o muy altos
  | 'resumen-general';          // Overview completo

interface AnalyzeRequest {
  analysisType: AnalysisType;
  providerId?: string;          // Analizar proveedor específico
  productIds?: string[];        // Analizar productos específicos
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Obtener datos de comparación de proveedores
 */
async function obtenerDatosProveedores(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters?: {
    providerId?: string;
    productIds?: string[];
    minPrice?: number;
    maxPrice?: number;
  }
) {
  try {
    // Obtener todos los proveedores
    const { data: providers, error: providersError } = await supabase
      .from('providers')
      .select('*')
      .order('name', { ascending: true });

    if (providersError) throw providersError;

    // Obtener precios con filtros opcionales
    let pricesQuery = supabase
      .from('provider_prices')
      .select('*');

    if (filters?.providerId) {
      pricesQuery = pricesQuery.eq('provider_id', filters.providerId);
    }

    if (filters?.productIds && filters.productIds.length > 0) {
      pricesQuery = pricesQuery.in('product_id', filters.productIds);
    }

    if (filters?.minPrice !== undefined) {
      pricesQuery = pricesQuery.gte('price', filters.minPrice);
    }

    if (filters?.maxPrice !== undefined) {
      pricesQuery = pricesQuery.lte('price', filters.maxPrice);
    }

    const { data: prices, error: pricesError } = await pricesQuery;

    if (pricesError) throw pricesError;

    // Agrupar precios por producto
    const productMap = new Map<string, {
      productId: string;
      productName: string;
      prices: Array<{
        providerId: string;
        providerName: string;
        price: number;
        lastUpdated: string;
      }>;
    }>();

    (prices || []).forEach((price: {
      product_id: string;
      product_name: string;
      provider_id: string;
      price: number;
      updated_at: string;
    }) => {
      const provider = providers?.find((p: { id: string }) => p.id === price.provider_id);

      if (!productMap.has(price.product_id)) {
        productMap.set(price.product_id, {
          productId: price.product_id,
          productName: price.product_name,
          prices: [],
        });
      }

      const product = productMap.get(price.product_id)!;
      product.prices.push({
        providerId: price.provider_id,
        providerName: provider?.name || 'Desconocido',
        price: Number(price.price),
        lastUpdated: price.updated_at,
      });
    });

    // Convertir a array y calcular estadísticas
    const productsData = Array.from(productMap.values()).map((product) => {
      const priceValues = product.prices.map((p) => p.price);
      const minPrice = Math.min(...priceValues);
      const maxPrice = Math.max(...priceValues);
      const avgPrice = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;

      // Calcular ahorro potencial
      const cheapestProvider = product.prices.find((p) => p.price === minPrice);
      const mostExpensiveProvider = product.prices.find((p) => p.price === maxPrice);
      const savingsPotential = maxPrice - minPrice;
      const savingsPercentage = maxPrice > 0 ? ((savingsPotential / maxPrice) * 100) : 0;

      return {
        ...product,
        minPrice,
        maxPrice,
        avgPrice,
        cheapestProvider,
        mostExpensiveProvider,
        savingsPotential,
        savingsPercentage,
        priceVariance: maxPrice - minPrice,
        supplierCount: product.prices.length,
      };
    });

    // Calcular estadísticas de proveedores
    const providerStats = (providers || []).map((provider: { id: string; name: string }) => {
      const providerPrices = (prices || []).filter(
        (p: { provider_id: string }) => p.provider_id === provider.id
      );

      const priceValues = providerPrices.map((p: { price: number }) => Number(p.price));
      const avgPrice = priceValues.length > 0
        ? priceValues.reduce((a: number, b: number) => a + b, 0) / priceValues.length
        : 0;

      return {
        providerId: provider.id,
        providerName: provider.name,
        productCount: providerPrices.length,
        avgPrice,
        minPrice: priceValues.length > 0 ? Math.min(...priceValues) : 0,
        maxPrice: priceValues.length > 0 ? Math.max(...priceValues) : 0,
      };
    });

    return {
      products: productsData,
      providers: providerStats,
      totalProducts: productsData.length,
      totalProviders: providers?.length || 0,
    };
  } catch (error) {
    console.error('Error al obtener datos de proveedores:', error);
    throw error;
  }
}

/**
 * Construir contexto para la IA según el tipo de análisis
 */
function construirContextoIA(
  analysisType: AnalysisType,
  data: {
    products: Array<{
      productId: string;
      productName: string;
      minPrice: number;
      maxPrice: number;
      avgPrice: number;
      cheapestProvider?: { providerName: string; price: number };
      mostExpensiveProvider?: { providerName: string; price: number };
      savingsPotential: number;
      savingsPercentage: number;
      supplierCount: number;
    }>;
    providers: Array<{
      providerId: string;
      providerName: string;
      productCount: number;
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
    }>;
  }
): string {
  let contexto = `Eres un experto en compras y gestión de proveedores para farmacias en Chile.
Analiza los siguientes datos de comparación de precios entre proveedores.

CONTEXTO:
- Empresa: Farmacias Maira, Viña del Mar, Chile 🇨🇱
- Total de productos comparados: ${data.products.length}
- Total de proveedores: ${data.providers.length}
- Moneda: Pesos chilenos (CLP)

`;

  switch (analysisType) {
    case 'mejores-precios':
      contexto += `Tarea: Identifica los MEJORES PRECIOS por producto.

Top 15 productos con mayor diferencia de precios:
${JSON.stringify(
        data.products
          .sort((a, b) => b.savingsPotential - a.savingsPotential)
          .slice(0, 15),
        null,
        2
      )}

Analiza:
1. Productos con mejor precio y proveedor
2. Diferencia porcentual vs. otros proveedores
3. Ahorro potencial al cambiar de proveedor
4. Recomendaciones de compra

Formato de respuesta:
{
  "mejores_oportunidades": [
    {
      "producto": "Nombre del producto",
      "proveedor_recomendado": "Nombre del proveedor",
      "precio_recomendado": 5000,
      "ahorro_vs_mas_caro": 2000,
      "porcentaje_ahorro": 28.5,
      "razon": "Por qué es la mejor opción"
    }
  ],
  "resumen": "Resumen ejecutivo"
}`;
      break;

    case 'oportunidades-ahorro':
      contexto += `Tarea: Encuentra las mayores OPORTUNIDADES DE AHORRO.

Productos con mayor potencial de ahorro:
${JSON.stringify(
        data.products
          .filter((p) => p.savingsPercentage > 10)
          .sort((a, b) => b.savingsPotential - a.savingsPotential)
          .slice(0, 20),
        null,
        2
      )}

Analiza:
1. Productos donde se puede ahorrar más dinero
2. Ahorro total potencial si se cambia de proveedor
3. Priorización por impacto económico
4. Plan de acción concreto

Formato de respuesta:
{
  "oportunidades": [
    {
      "producto": "Nombre",
      "proveedor_actual_probable": "Proveedor más caro",
      "proveedor_sugerido": "Proveedor más barato",
      "ahorro_por_unidad": 1500,
      "ahorro_mensual_estimado": 45000,
      "prioridad": "alta|media|baja",
      "accion": "Acción específica a tomar"
    }
  ],
  "ahorro_total_potencial": 500000,
  "resumen": "Resumen ejecutivo"
}`;
      break;

    case 'recomendaciones-compra':
      contexto += `Tarea: Genera RECOMENDACIONES DE COMPRA estratégicas.

Datos de productos y proveedores:
Productos: ${JSON.stringify(data.products.slice(0, 20), null, 2)}
Proveedores: ${JSON.stringify(data.providers, null, 2)}

Analiza:
1. Qué productos comprar a cada proveedor
2. Consolidación de pedidos para reducir logística
3. Balance entre precio y diversificación de riesgo
4. Estrategia de negociación

Formato de respuesta:
{
  "recomendaciones_por_proveedor": [
    {
      "proveedor": "Nombre del proveedor",
      "productos_recomendados": ["Producto 1", "Producto 2"],
      "valor_total_estimado": 150000,
      "ventajas": "Por qué comprar a este proveedor",
      "productos_a_negociar": ["Productos donde el precio no es competitivo"]
    }
  ],
  "estrategia_general": "Estrategia de compra sugerida",
  "resumen": "Resumen ejecutivo"
}`;
      break;

    case 'analisis-proveedores':
      contexto += `Tarea: Evalúa el DESEMPEÑO DE CADA PROVEEDOR.

Datos de proveedores:
${JSON.stringify(data.providers, null, 2)}

Comparación de precios por producto:
${JSON.stringify(data.products.slice(0, 15), null, 2)}

Analiza:
1. Competitividad de precios por proveedor
2. Amplitud de catálogo (cuántos productos ofrecen)
3. Proveedores más y menos competitivos
4. Recomendaciones de gestión de relaciones

Formato de respuesta:
{
  "evaluacion_proveedores": [
    {
      "proveedor": "Nombre",
      "calificacion": "excelente|bueno|regular|mejorar",
      "precio_promedio_vs_mercado": "10% más barato|5% más caro",
      "fortalezas": "Qué hace bien",
      "debilidades": "Qué puede mejorar",
      "recomendacion": "Mantener|Negociar|Buscar alternativa"
    }
  ],
  "ranking_proveedores": ["Proveedor 1", "Proveedor 2"],
  "resumen": "Resumen ejecutivo"
}`;
      break;

    case 'alertas-precios':
      contexto += `Tarea: Detecta PRECIOS ANÓMALOS o sospechosos.

Productos con alta variación de precios:
${JSON.stringify(
        data.products
          .filter((p) => p.savingsPercentage > 30 || p.supplierCount === 1)
          .slice(0, 20),
        null,
        2
      )}

Analiza:
1. Precios significativamente más altos que el promedio
2. Productos con un solo proveedor (riesgo)
3. Diferencias de precio superiores al 30%
4. Posibles errores de carga o precios desactualizados

Formato de respuesta:
{
  "alertas": [
    {
      "tipo": "precio_alto|proveedor_unico|diferencia_extrema",
      "producto": "Nombre",
      "proveedor": "Nombre",
      "precio": 10000,
      "precio_promedio_mercado": 6000,
      "diferencia": "67% más caro",
      "severidad": "alta|media|baja",
      "accion_sugerida": "Verificar precio|Buscar alternativas"
    }
  ],
  "resumen": "Resumen ejecutivo"
}`;
      break;

    case 'resumen-general':
    default:
      contexto += `Tarea: Genera un RESUMEN GENERAL del estado de proveedores.

Estadísticas generales:
- Total productos: ${data.products.length}
- Total proveedores: ${data.providers.length}
- Productos con múltiples proveedores: ${data.products.filter((p) => p.supplierCount > 1).length}
- Ahorro potencial total: $${data.products.reduce((sum, p) => sum + p.savingsPotential, 0).toFixed(0)}

Top 5 productos con mejor ahorro:
${JSON.stringify(
        data.products
          .sort((a, b) => b.savingsPotential - a.savingsPotential)
          .slice(0, 5),
        null,
        2
      )}

Top proveedores:
${JSON.stringify(data.providers, null, 2)}

Genera un resumen ejecutivo que incluya:
1. Top 3 insights más importantes
2. 3 acciones inmediatas recomendadas
3. Oportunidades de ahorro detectadas
4. Riesgos identificados

Formato de respuesta:
{
  "insights_principales": ["Insight 1", "Insight 2", "Insight 3"],
  "acciones_inmediatas": ["Acción 1", "Acción 2", "Acción 3"],
  "ahorro_potencial_total": 350000,
  "productos_criticos": ["Productos que requieren atención"],
  "proveedores_destacados": ["Mejores proveedores"],
  "resumen": "Resumen ejecutivo en 3-4 líneas"
}`;
      break;
  }

  contexto += `

IMPORTANTE: 
- Responde SOLO con JSON válido, sin texto adicional
- Usa precios en pesos chilenos (CLP)
- Sé específico con nombres de productos y proveedores reales
- Incluye números concretos y porcentajes
- Las recomendaciones deben ser accionables`;

  return contexto;
}

/**
 * POST /api/providers/analyze
 * Analiza datos de proveedores con IA
 */
export async function POST(request: NextRequest) {
  try {
    // Validar que existe API key
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        {
          error: 'No se ha configurado la API key de Groq. Agrega GROQ_API_KEY en .env.local',
          success: false,
        },
        { status: 500 }
      );
    }

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

    const body: AnalyzeRequest = await request.json();
    const { analysisType, providerId, productIds, minPrice, maxPrice } = body;

    console.log('📊 Obteniendo datos de proveedores...');

    // Obtener datos de proveedores
    const data = await obtenerDatosProveedores(supabase, {
      providerId,
      productIds,
      minPrice,
      maxPrice,
    });

    if (data.products.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No hay datos suficientes para realizar el análisis',
      });
    }

    // Construir contexto para la IA
    const contexto = construirContextoIA(analysisType, data);

    console.log('🤖 Consultando a Groq IA...');

    // Llamar a Groq IA
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'Eres un experto en compras y gestión de proveedores. Respondes SOLO con JSON válido, sin markdown ni texto adicional.',
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

    // Parsear respuesta JSON
    const insights = JSON.parse(respuestaIA);

    console.log('✅ Análisis generado exitosamente');

    return NextResponse.json({
      success: true,
      data: {
        analysisType,
        insights,
        metadata: {
          totalProducts: data.totalProducts,
          totalProviders: data.totalProviders,
          generatedAt: new Date().toISOString(),
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
