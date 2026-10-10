import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
        "codigo": "código del producto",
        "nombre": "nombre completo",
        "ventas": número,
        "margen": número (porcentaje)
      },
      "producto_b": {
        "codigo": "código del producto",
        "nombre": "nombre completo", 
        "ventas": número,
        "margen": número (porcentaje)
      },
      "tipo_relacion": "mismo principio activo / misma categoría / competencia directa",
      "nivel_canibalización": "alto / medio / bajo",
      "impacto_economico": {
        "perdida_mensual_estimada": número en CLP,
        "explicacion": "cómo se calcula"
      },
      "recomendacion": {
        "accion": "descripción clara de qué hacer",
        "producto_favorecer": "código del producto a favorecer",
        "razon": "por qué favorecer este producto",
        "ganancia_proyectada": número en CLP mensual
      }
    }
  ],
  "total_casos": número,
  "impacto_total_mensual": número en CLP
}

IMPORTANTE:
- Enfócate en productos con nombres similares (ej: Ibuprofeno 400mg vs 600mg)
- Prioriza casos donde la diferencia de margen sea significativa (>10%)
- Sé específico con los números y cálculos
- Máximo 5 casos más relevantes`;

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
        model: 'llama-3.3-70b-versatile',
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
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
        const productos = boleta.boletas_detalles.map(d => d.codigo).filter(Boolean) as string[];
        
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
          const confianza1 = count1 > 0 ? (count / count1) * 100 : 0; // % de veces que A implica B
          const confianza2 = count2 > 0 ? (count / count2) * 100 : 0;
          const confianzaPromedio = (confianza1 + confianza2) / 2;

          const info1 = productosMap.get(codigo1);
          const info2 = productosMap.get(codigo2);

          if (!info1 || !info2) return null;

          const precio1 = info1.precioPromedio;
          const precio2 = info2.precioPromedio;
          const costo1 = info1.costo;
          const costo2 = info2.costo;

          return {
            producto1: {
              codigo: codigo1,
              nombre: info1.nombre,
              ventas: count1,
              precio: precio1,
              costo: costo1,
              margen: precio1 > 0 ? ((precio1 - costo1) / precio1) * 100 : 0,
            },
            producto2: {
              codigo: codigo2,
              nombre: info2.nombre,
              ventas: count2,
              precio: precio2,
              costo: costo2,
              margen: precio2 > 0 ? ((precio2 - costo2) / precio2) * 100 : 0,
            },
            soporte,
            confianza: confianzaPromedio,
            ticketPromedio: precio1 + precio2,
            margenCombinado: ((precio1 - costo1) + (precio2 - costo2)),
          };
        })
        .filter(Boolean)
        .filter(p => p!.soporte >= 5 && p!.confianza >= 15) // Filtros mínimos
        .sort((a, b) => b!.confianza - a!.confianza)
        .slice(0, 20); // Top 20 pares

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

DEBES RESPONDER EN JSON con esta estructura EXACTA:
{
  "resumen": "Resumen de los patrones detectados (2-3 líneas)",
  "patrones_detectados": [
    {
      "nombre_patron": "Nombre descriptivo del patrón (ej: Kit Resfriado)",
      "productos": [
        {
          "codigo": "código",
          "nombre": "nombre",
          "rol": "producto ancla / complemento"
        }
      ],
      "confianza": número (porcentaje),
      "soporte": número (veces comprados juntos),
      "metricas": {
        "ticket_promedio_actual": número (PRECIO DEL PRODUCTO ANCLA SOLO - usa producto1.precio),
        "ticket_con_combo": número (PRECIO ANCLA + COMPLEMENTARIO - usa producto1.precio + producto2.precio),
        "incremento_ticket": número (PORCENTAJE: ((ticket_con_combo - ticket_promedio_actual) / ticket_promedio_actual) * 100),
        "margen_combinado": número
      },
      "estrategias": [
        {
          "tipo": "sugerencia en caja / pack promocional / ubicación física / descuento combo",
          "descripcion": "Explicación detallada de cómo implementar",
          "ejemplo_frase": "Frase específica que el vendedor debe usar",
          "descuento_sugerido": número (porcentaje, si aplica),
          "precio_pack": número (si es pack),
          "conversion_esperada": número (porcentaje de incremento en ventas),
          "ganancia_mensual_proyectada": número en CLP,
          "facilidad_implementacion": "fácil / media / difícil"
        }
      ],
      "impacto_total": número en CLP mensual
    }
  ],
  "top_estrategias": [
    {
      "patron": "nombre",
      "estrategia": "descripción breve",
      "impacto": número en CLP,
      "prioridad": "alta / media / baja"
    }
  ],
  "impacto_total_mensual": número en CLP
}

EJEMPLO DE CÁLCULO CORRECTO:
Si producto ancla (PARACETAMOL) cuesta $1000 y complemento (TAPSIN) cuesta $2000:
- ticket_promedio_actual: 1000 (solo el ancla)
- ticket_con_combo: 3000 (ancla + complemento = 1000 + 2000)
- incremento_ticket: 200 (porque 3000 es 200% más que 1000)

IMPORTANTE:
- Enfócate en patrones con alta confianza (>30%) y soporte (>10)
- Sé creativo con los nombres de patrones (ej: "Kit Dolor de Cabeza", "Combo Diabetes")
- Las estrategias deben ser ESPECÍFICAS y ACCIONABLES
- Prioriza estrategias de bajo costo de implementación
- SIEMPRE calcula ticket_promedio_actual como el precio del producto ancla SOLO`;

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
        model: 'llama-3.3-70b-versatile',
        temperature: 0.4,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
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
