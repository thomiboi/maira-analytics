import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    // Obtener 10 registros de ejemplo para ver la estructura real
    const detalles = await prisma.boletas_detalles.findMany({
      take: 10,
      where: {
        precio: { not: null },
      },
      include: {
        boletas: {
          select: {
            fecha: true,
          },
        },
      },
    });

    // Analizar cada registro
    const analisis = detalles.map((detalle) => {
      let costoIntentado = null;
      let costoValor = null;
      let errorParsing = null;

      try {
        if (detalle.costo_unitario_neto) {
          costoIntentado = detalle.costo_unitario_neto;
          
          // Intentar diferentes formas de extraer el costo
          if (typeof detalle.costo_unitario_neto === 'string') {
            const parsed = JSON.parse(detalle.costo_unitario_neto);
            costoValor = parsed?.costo_unitario_neto || parsed?.costo || parsed;
          } else if (typeof detalle.costo_unitario_neto === 'object') {
            const obj = detalle.costo_unitario_neto as Record<string, unknown>;
            costoValor = obj?.costo_unitario_neto || obj?.costo || obj;
          }
        }
      } catch (e) {
        errorParsing = (e as Error).message;
      }

      const precioNum = parseFloat(detalle.precio?.toString() || '0');
      const cantidadNum = parseFloat(detalle.cantidad?.toString() || '0');
      const costoNum = parseFloat(String(costoValor || '0').replace(',', '.'));
      
      const ingresos = precioNum * cantidadNum;
      const costoTotal = costoNum * cantidadNum;
      const margen = ingresos > 0 ? ((ingresos - costoTotal) / ingresos) * 100 : 0;

      return {
        codigo: detalle.codigo,
        nombre: detalle.nombre,
        cantidad: cantidadNum,
        precio: precioNum,
        ingresos,
        costo_unitario_neto_raw: costoIntentado,
        costo_extraido: costoValor,
        costo_parseado: costoNum,
        costo_total: costoTotal,
        margen_calculado: Math.round(margen * 100) / 100,
        error: errorParsing,
        fecha: detalle.boletas?.fecha,
      };
    });

    return NextResponse.json({
      success: true,
      registros_analizados: analisis.length,
      datos: analisis,
      notas: {
        mensaje: "Estos son datos reales de tu BD para analizar la estructura del costo",
        campos_importantes: [
          "costo_unitario_neto_raw: Valor original en BD",
          "costo_extraido: Valor después de parsing",
          "costo_parseado: Valor numérico final",
          "margen_calculado: % calculado con estos datos"
        ]
      }
    });

  } catch (error) {
    console.error('Error en debug:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : null,
    }, { status: 500 });
  }
}
