import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { GROQ_MODEL } from '@/lib/groq-model';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      insightType, 
      fechaInicio, 
      fechaFin, 
      sucursal = 'todas'
    } = body;

    // Validar API key
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'API key de Groq no configurada. Agrega GROQ_API_KEY en .env.local',
      }, { status: 500 });
    }

    // Validar tipo de insight
    const validTypes = ['canibalización', 'cross-sell'];
    if (!validTypes.includes(insightType)) {
      return NextResponse.json({
        success: false,
        error: `Tipo de insight inválido. Usa: ${validTypes.join(', ')}`,
      }, { status: 400 });
    }

    // Construir filtros de fecha y sucursal
    const whereClause: {
      fecha: { gte: Date; lte: Date };
      sucursal_id?: number | null;
    } = {
      fecha: {
        gte: new Date(fechaInicio),
        lte: new Date(fechaFin),
      },
    };

    if (sucursal !== 'todas') {
      whereClause.sucursal_id = sucursal === 'null' ? null : Number.parseInt(sucursal);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let insights: any = null;

    // ====================
    // INSIGHT 1: CANIBALIZACIÓN
    // ====================
    if (insightType === 'canibalización') {
      // Obtener detalles de ventas con precios reales
      const detallesVentas = await prisma.boletas_detalles.findMany({
        where: {
          boletas: whereClause,
        },
        select: {
          codigo: true,
          nombre: true,
          cantidad: true,
          precio: true, // Precio unitario con IVA de la venta real
        },
      });

      // Obtener información de costos desde productos_pos
      const codigosProductos = [...new Set(detallesVentas.map(d => d.codigo).filter(Boolean))];
      const productosInfo = await prisma.productos_pos.findMany({
        where: {
          codigo: { in: codigosProductos as string[] },
        },
        select: {
          codigo: true,
          preciocompraneto: true,
          atributos: true,
        },
      });

      const costosMap = new Map(productosInfo.map(p => [p.codigo, p]));

      // Agrupar por producto y calcular métricas
      const productosMapTemp = new Map<string, {
        codigo: string;
        nombre: string;
        unidades: number;
        ingresos: number;
        costo: number;
      }>();

      for (const detalle of detallesVentas) {
        const codigo = detalle.codigo || 'SIN_CODIGO';
        const cantidad = Number.parseFloat(detalle.cantidad?.toString() || '0');
        const precioConIVA = Number.parseFloat(detalle.precio?.toString() || '0');
        
        // Calcular precio sin IVA (precio / 1.19) - igual que el ranking
        const precioSinIVA = precioConIVA / 1.19;
        
        // Obtener costo real desde productos_pos
        const info = costosMap.get(codigo);
        const costoUnitario = info?.preciocompraneto ? Number.parseFloat(info.preciocompraneto.toString()) : 0;

        if (!productosMapTemp.has(codigo)) {
          productosMapTemp.set(codigo, {
            codigo,
            nombre: detalle.nombre || 'Producto sin nombre',
            unidades: 0,
            ingresos: 0,
            costo: 0,
          });
        }

        const producto = productosMapTemp.get(codigo)!;
        producto.unidades += cantidad;
        producto.ingresos += cantidad * precioSinIVA;
        producto.costo += cantidad * costoUnitario;
      }

      // Construir datos enriquecidos
      const datosProductos = Array.from(productosMapTemp.values())
        .map(producto => {
          const precioPromedio = producto.unidades > 0 ? producto.ingresos / producto.unidades : 0;
          const costoPromedio = producto.unidades > 0 ? producto.costo / producto.unidades : 0;
          const margen = precioPromedio > 0 ? ((precioPromedio - costoPromedio) / precioPromedio) * 100 : 0;
          const info = costosMap.get(producto.codigo);

          return {
            codigo: producto.codigo,
            nombre: producto.nombre,
            unidadesVendidas: producto.unidades,
            costo: costoPromedio,
            precio: precioPromedio,
            margen,
            atributos: info?.atributos || null,
          };
        })
        .filter(p => p.unidadesVendidas > 0);

      // Llamar a Groq para análisis de canibalización
      const prompt = `Eres un experto analista de retail farmacéutico en Chile.

DATOS DE PRODUCTOS:
${JSON.stringify(datosProductos.slice(0, 50), null, 2)}

TAREA: Analiza estos productos y detecta patrones de CANIBALIZACIÓN.

La canibalización ocurre cuando:
1. Dos productos similares (mismo principio activo, misma categoría)
2. Se roban ventas entre sí
3. Uno tiene mejor margen que el otro

DEBES RESPONDER EN JSON con esta estructura EXACTA:
{
  "resumen": "Breve descripción del análisis (2-3 líneas)",
  "casos_detectados": [
    {
      "producto_a": {
        "codigo": "código",
        "nombre": "nombre completo",
        "ventas": 0,
        "margen": 0
      },
      "producto_b": {
        "codigo": "código",
        "nombre": "nombre completo",
        "ventas": 0,
        "margen": 0
      },
      "tipo_relacion": "mismo principio activo / misma categoría / competencia directa",
      "nivel_canibalización": "alto / medio / bajo",
      "impacto_economico": {
        "perdida_mensual_estimada": 0,
        "explicacion": "cómo se calcula"
      },
      "recomendacion": {
        "accion": "descripción clara de qué hacer",
        "producto_favorecer": "código del producto a favorecer",
        "razon": "por qué favorecer este producto",
        "ganancia_proyectada": 0
      }
    }
  ],
  "total_casos": 0,
  "impacto_total_mensual": 0
}

IMPORTANTE:
- Enfócate en productos con nombres similares (ej: Ibuprofeno 400mg vs 600mg)
- Prioriza casos donde la diferencia de margen sea significativa (>10%)
- Sé específico con los números y cálculos
- Máximo 5 casos más relevantes
- Si no hay casos razonables, devuelve "casos_detectados": [] y usa 0 en los totales
- Los campos numéricos deben ser números, no textos con unidades ni símbolos de moneda`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en análisis de retail farmacéutico. Respondes SOLO en JSON válido, sin markdown ni explicaciones adicionales.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: GROQ_MODEL,
        temperature: 0.3,
        max_completion_tokens: 6000,
        reasoning_effort: 'low',
        include_reasoning: false,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'analisis_canibalizacion',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                resumen: { type: 'string' },
                casos_detectados: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      producto_a: {
                        type: 'object',
                        properties: {
                          codigo: { type: 'string' },
                          nombre: { type: 'string' },
                          ventas: { type: 'number' },
                          margen: { type: 'number' },
                        },
                        required: ['codigo', 'nombre', 'ventas', 'margen'],
                        additionalProperties: false,
                      },
                      producto_b: {
                        type: 'object',
                        properties: {
                          codigo: { type: 'string' },
                          nombre: { type: 'string' },
                          ventas: { type: 'number' },
                          margen: { type: 'number' },
                        },
                        required: ['codigo', 'nombre', 'ventas', 'margen'],
                        additionalProperties: false,
                      },
                      tipo_relacion: { type: 'string' },
                      'nivel_canibalización': { type: 'string' },
                      impacto_economico: {
                        type: 'object',
                        properties: {
                          perdida_mensual_estimada: { type: 'number' },
                          explicacion: { type: 'string' },
                        },
                        required: ['perdida_mensual_estimada', 'explicacion'],
                        additionalProperties: false,
                      },
                      recomendacion: {
                        type: 'object',
                        properties: {
                          accion: { type: 'string' },
                          producto_favorecer: { type: 'string' },
                          razon: { type: 'string' },
                          ganancia_proyectada: { type: 'number' },
                        },
                        required: ['accion', 'producto_favorecer', 'razon', 'ganancia_proyectada'],
                        additionalProperties: false,
                      },
                    },
                    required: [
                      'producto_a',
                      'producto_b',
                      'tipo_relacion',
                      'nivel_canibalización',
                      'impacto_economico',
                      'recomendacion',
                    ],
                    additionalProperties: false,
                  },
                },
                total_casos: { type: 'integer' },
                impacto_total_mensual: { type: 'number' },
              },
              required: ['resumen', 'casos_detectados', 'total_casos', 'impacto_total_mensual'],
              additionalProperties: false,
            },
          },
        },
      });

      insights = JSON.parse(completion.choices[0]?.message?.content || '{}');
    }

    // ====================
    // INSIGHT 2: CROSS-SELL (Compra Complementaria)
    // ====================
    else if (insightType === 'cross-sell') {
      // Obtener boletas con sus productos
      const boletas = await prisma.boletas.findMany({
        where: whereClause,
        include: {
          boletas_detalles: {
            select: {
              codigo: true,
              cantidad: true,
            },
          },
        },
        orderBy: { fecha: 'desc' },
        take: 5000, // Limitar para performance
      });

      // Obtener info de productos únicos y sus precios reales promedio
      const todosCodigosSet = new Set<string>();
      for (const b of boletas) {
        for (const d of b.boletas_detalles) {
          if (d.codigo) todosCodigosSet.add(d.codigo);
        }
      }

      const codigosUnicos = Array.from(todosCodigosSet);

      // Obtener detalles con precios reales
      const detallesPrecios = await prisma.boletas_detalles.findMany({
        where: {
          codigo: { in: codigosUnicos },
          boletas: whereClause,
        },
        select: {
          codigo: true,
          nombre: true,
          cantidad: true,
          precio: true,
        },
      });

      // Obtener costos
      const productosInfo = await prisma.productos_pos.findMany({
        where: {
          codigo: { in: codigosUnicos },
        },
        select: {
          codigo: true,
          nombre: true,
          preciocompraneto: true,
        },
      });

      // Calcular precios promedio reales (sin IVA) y costos
      const productosMap = new Map<string, {
        nombre: string;
        precioPromedio: number;
        costo: number;
        sumaPrecio: number;
        totalCantidad: number;
      }>();

      for (const detalle of detallesPrecios) {
        if (!detalle.codigo) continue;
        
        const cantidad = Number.parseFloat(detalle.cantidad?.toString() || '0');
        const precioConIVA = Number.parseFloat(detalle.precio?.toString() || '0');
        const precioSinIVA = precioConIVA / 1.19;

        if (!productosMap.has(detalle.codigo)) {
          const info = productosInfo.find(p => p.codigo === detalle.codigo);
          productosMap.set(detalle.codigo, {
            nombre: detalle.nombre || info?.nombre || 'Desconocido',
            precioPromedio: 0,
            costo: info?.preciocompraneto ? Number.parseFloat(info.preciocompraneto.toString()) : 0,
            sumaPrecio: 0,
            totalCantidad: 0,
          });
        }

        const producto = productosMap.get(detalle.codigo)!;
        // Acumular precio total y cantidad para calcular promedio después
        producto.sumaPrecio += precioSinIVA * cantidad;
        producto.totalCantidad += cantidad;
      }

      // Calcular promedios finales
      for (const producto of productosMap.values()) {
        if (producto.totalCantidad > 0) {
          producto.precioPromedio = producto.sumaPrecio / producto.totalCantidad;
        }
      }

      // Construir pares de productos que se compran juntos
      const pares = new Map<string, number>();
      const productosCount = new Map<string, number>();

      for (const boleta of boletas) {
        // Una boleta cuenta una sola vez por producto, aunque tenga líneas duplicadas.
        const productos = [...new Set(
          boleta.boletas_detalles.map(d => d.codigo).filter(Boolean) as string[]
        )];
        
        // Contar productos individuales
        for (const codigo of productos) {
          productosCount.set(codigo, (productosCount.get(codigo) || 0) + 1);
        }

        // Crear pares (combinaciones)
        for (let i = 0; i < productos.length; i++) {
          for (let j = i + 1; j < productos.length; j++) {
            const par = [productos[i], productos[j]].sort((a, b) => a.localeCompare(b)).join('|');
            pares.set(par, (pares.get(par) || 0) + 1);
          }
        }
      }

      // Calcular confianza y soporte para cada par
      const paresAnalizados = Array.from(pares.entries())
        .map(([par, count]) => {
          const [codigo1, codigo2] = par.split('|');
          const count1 = productosCount.get(codigo1) || 0;
          const count2 = productosCount.get(codigo2) || 0;
          
          const soporte = count; // Veces que se compraron juntos
          const info1 = productosMap.get(codigo1);
          const info2 = productosMap.get(codigo2);

          if (!info1 || !info2) return null;

          // El ancla es el producto que aparece en más boletas; confianza = soporte / boletas del ancla.
          const producto1EsAncla = count1 >= count2;
          const productoAncla = producto1EsAncla ? info1 : info2;
          const productoComplementario = producto1EsAncla ? info2 : info1;
          const codigoAncla = producto1EsAncla ? codigo1 : codigo2;
          const codigoComplementario = producto1EsAncla ? codigo2 : codigo1;
          const ventasAncla = Math.max(count1, count2);
          const precioAncla = productoAncla.precioPromedio;
          const precioComplementario = productoComplementario.precioPromedio;
          const costoAncla = productoAncla.costo;
          const costoComplementario = productoComplementario.costo;

          return {
            producto1: {
              codigo: codigoAncla,
              nombre: productoAncla.nombre,
              ventas: ventasAncla,
              precio: precioAncla,
              costo: costoAncla,
              margen: precioAncla > 0 ? ((precioAncla - costoAncla) / precioAncla) * 100 : 0,
            },
            producto2: {
              codigo: codigoComplementario,
              nombre: productoComplementario.nombre,
              ventas: producto1EsAncla ? count2 : count1,
              precio: precioComplementario,
              costo: costoComplementario,
              margen: precioComplementario > 0
                ? ((precioComplementario - costoComplementario) / precioComplementario) * 100
                : 0,
            },
            soporte,
            confianza: ventasAncla > 0 ? (soporte / ventasAncla) * 100 : 0,
            ticketPromedioActual: precioAncla,
            ticketConCombo: precioAncla + precioComplementario,
            margenCombinado: (precioAncla - costoAncla) + (precioComplementario - costoComplementario),
          };
        })
        .filter(Boolean)
        // Solo se presentan patrones con soporte >10 y confianza >30%.
        .filter(p => p!.soporte > 10 && p!.confianza > 30)
        .sort((a, b) => b!.confianza - a!.confianza || b!.soporte - a!.soporte)
        .slice(0, 10); // Top 10 pares para mantener acotada la respuesta

      if (paresAnalizados.length === 0) {
        const resumen = boletas.length === 0
          ? 'No hay boletas en el período seleccionado para calcular patrones de compra conjunta.'
          : `Se analizaron ${boletas.length.toLocaleString('es-CL')} boletas del período, pero ningún par superó simultáneamente los umbrales de confianza mayor a 30% y soporte mayor a 10 boletas. Esto significa que no hay evidencia suficiente para recomendar un combo con esos criterios; no demuestra que los productos nunca se compren juntos.`;

        return NextResponse.json({
          success: true,
          data: {
            insightType,
            insights: {
              resumen,
              patrones_detectados: [],
              top_estrategias: [],
              impacto_total_mensual: 0,
            },
            metadata: {
              fechaInicio,
              fechaFin,
              sucursal,
              boletasAnalizadas: boletas.length,
              generadoEn: new Date().toISOString(),
            },
          },
        });
      }

      const prompt = `Eres un experto en merchandising y estrategias de venta cruzada para farmacias.

PARES DE PRODUCTOS QUE SE COMPRAN JUNTOS:
${JSON.stringify(paresAnalizados, null, 2)}

CONTEXTO:
- Soporte: Número de veces que se compraron juntos
- Confianza: % de probabilidad de compra conjunta
- producto1: Producto ANCLA (el más vendido o principal)
- producto2: Producto COMPLEMENTARIO (se vende junto al ancla)

IMPORTANTE PARA MÉTRICAS:
- ticket_promedio_actual: Precio del producto ANCLA solo (producto1.precio)
- ticket_con_combo: Precio del ANCLA + COMPLEMENTARIO (producto1.precio + producto2.precio)
- incremento_ticket: Porcentaje de incremento al vender el combo vs solo el ancla
  Cálculo: ((ticket_con_combo - ticket_promedio_actual) / ticket_promedio_actual) * 100

TAREA: Analiza estos patrones y genera ESTRATEGIAS DE CROSS-SELL accionables.

Devuelve el objeto JSON según el esquema solicitado. Propón como máximo 5 patrones y una estrategia práctica por patrón.

EJEMPLO DE CÁLCULO CORRECTO:
Si producto ancla (PARACETAMOL) cuesta $1000 y complemento (TAPSIN) cuesta $2000:
- ticket_promedio_actual: 1000 (solo el ancla)
- ticket_con_combo: 3000 (ancla + complemento = 1000 + 2000)
- incremento_ticket: 200 (porque 3000 es 200% más que 1000)

IMPORTANTE:
- Enfócate en patrones con alta confianza (>30%) y soporte (>10)
- Usa exclusivamente los pares, el soporte y la confianza entregados en los datos; no inventes pares ni métricas
- Sé creativo con los nombres de patrones (ej: "Kit Dolor de Cabeza", "Combo Diabetes")
- Las estrategias deben ser ESPECÍFICAS y ACCIONABLES
- Prioriza estrategias de bajo costo de implementación
- SIEMPRE calcula ticket_promedio_actual como el precio del producto ancla SOLO
- ticket_con_combo = precio del ancla + precio del complemento
- Los campos numéricos deben ser números sin símbolos de moneda; usa 0 cuando un descuento o precio de pack no aplique`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'Eres un experto en estrategias de cross-selling. Respondes SOLO en JSON válido.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: GROQ_MODEL,
        temperature: 0.4,
        max_completion_tokens: 6000,
        reasoning_effort: 'low',
        include_reasoning: false,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'analisis_venta_cruzada',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                resumen: { type: 'string' },
                patrones_detectados: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      nombre_patron: { type: 'string' },
                      productos: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            codigo: { type: 'string' },
                            nombre: { type: 'string' },
                            rol: { type: 'string' },
                          },
                          required: ['codigo', 'nombre', 'rol'],
                          additionalProperties: false,
                        },
                      },
                      confianza: { type: 'number' },
                      soporte: { type: 'integer' },
                      metricas: {
                        type: 'object',
                        properties: {
                          ticket_promedio_actual: { type: 'number' },
                          ticket_con_combo: { type: 'number' },
                          incremento_ticket: { type: 'number' },
                          margen_combinado: { type: 'number' },
                        },
                        required: [
                          'ticket_promedio_actual',
                          'ticket_con_combo',
                          'incremento_ticket',
                          'margen_combinado',
                        ],
                        additionalProperties: false,
                      },
                      estrategias: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            tipo: { type: 'string' },
                            descripcion: { type: 'string' },
                            ejemplo_frase: { type: 'string' },
                            descuento_sugerido: { type: 'number' },
                            precio_pack: { type: 'number' },
                            conversion_esperada: { type: 'number' },
                            ganancia_mensual_proyectada: { type: 'number' },
                            facilidad_implementacion: { type: 'string' },
                          },
                          required: [
                            'tipo',
                            'descripcion',
                            'ejemplo_frase',
                            'descuento_sugerido',
                            'precio_pack',
                            'conversion_esperada',
                            'ganancia_mensual_proyectada',
                            'facilidad_implementacion',
                          ],
                          additionalProperties: false,
                        },
                      },
                      impacto_total: { type: 'number' },
                    },
                    required: [
                      'nombre_patron',
                      'productos',
                      'confianza',
                      'soporte',
                      'metricas',
                      'estrategias',
                      'impacto_total',
                    ],
                    additionalProperties: false,
                  },
                },
                top_estrategias: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      patron: { type: 'string' },
                      estrategia: { type: 'string' },
                      impacto: { type: 'number' },
                      prioridad: { type: 'string' },
                    },
                    required: ['patron', 'estrategia', 'impacto', 'prioridad'],
                    additionalProperties: false,
                  },
                },
                impacto_total_mensual: { type: 'number' },
              },
              required: ['resumen', 'patrones_detectados', 'top_estrategias', 'impacto_total_mensual'],
              additionalProperties: false,
            },
          },
        },
      });

      insights = JSON.parse(completion.choices[0]?.message?.content || '{}');
    }

    // Retornar respuesta exitosa
    return NextResponse.json({
      success: true,
      data: {
        insightType,
        insights,
        metadata: {
          fechaInicio,
          fechaFin,
          sucursal,
          generadoEn: new Date().toISOString(),
        },
      },
    });

  } catch (error: unknown) {
    console.error('Error en API de insights de ranking:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Error al generar insights';
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}
