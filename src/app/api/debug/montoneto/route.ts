import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    // Obtener 3 boletas completas con sus detalles para verificar la relación precio/montoneto
    const boletas = await prisma.boletas.findMany({
      take: 3,
      where: {
        montoneto: { not: null },
      },
      include: {
        boletas_detalles: true,
      },
    });

    const analisis = boletas.map((boleta) => {
      const sumaDetalles = boleta.boletas_detalles.reduce((sum, d) => {
        const cantidad = parseFloat(d.cantidad?.toString() || '0');
        const precio = parseFloat(d.precio?.toString() || '0');
        return sum + (cantidad * precio);
      }, 0);

      return {
        folio: boleta.folio,
        fecha: boleta.fecha,
        montoneto_boleta: parseFloat(boleta.montoneto?.toString() || '0'),
        montoiva_boleta: parseFloat(boleta.montoiva?.toString() || '0'),
        montototal_boleta: parseFloat(boleta.montototal?.toString() || '0'),
        suma_precio_x_cantidad_detalles: Math.round(sumaDetalles),
        detalles: boleta.boletas_detalles.map(d => ({
          codigo: d.codigo,
          nombre: d.nombre,
          cantidad: parseFloat(d.cantidad?.toString() || '0'),
          precio: parseFloat(d.precio?.toString() || '0'),
          subtotal: parseFloat(d.cantidad?.toString() || '0') * parseFloat(d.precio?.toString() || '0'),
        })),
        coincide: Math.abs(sumaDetalles - parseFloat(boleta.montoneto?.toString() || '0')) < 1,
      };
    });

    return NextResponse.json({
      success: true,
      mensaje: "Análisis de la relación entre precio en detalles y montoneto en boletas",
      analisis,
      conclusiones: {
        pregunta: "¿El campo 'precio' en boletas_detalles ya es sin IVA?",
        verificar: "Si suma(precio × cantidad) ≈ montoneto, entonces precio ya es neto",
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 });
  }
}
