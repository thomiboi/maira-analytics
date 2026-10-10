import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    // Obtener 5 registros reales para ver TODOS los campos disponibles
    const detalles = await prisma.boletas_detalles.findMany({
      take: 5,
      include: {
        boletas: {
          select: {
            fecha: true,
            folio: true,
          },
        },
      },
    });

    // Obtener información del esquema
    const campos = detalles.length > 0 ? Object.keys(detalles[0]) : [];

    return NextResponse.json({
      success: true,
      mensaje: "Estructura REAL de boletas_detalles desde Supabase",
      total_registros: detalles.length,
      campos_disponibles: campos,
      registros_ejemplo: detalles.map(d => ({
        id: d.id,
        codigo: d.codigo,
        nombre: d.nombre,
        cantidad: d.cantidad?.toString(),
        precio: d.precio?.toString(),
        descuento: d.descuento?.toString(),
        unidad: d.unidad,
        exento: d.exento,
        bodega: d.bodega,
        costo_unitario_neto: d.costo_unitario_neto,
        boleta_folio: d.boleta_folio,
        item_index: d.item_index,
        fecha_boleta: d.boletas?.fecha,
      })),
      nota: "Estos son TODOS los campos que tiene la tabla. Si el costo está en JSON, necesitamos ver su estructura exacta."
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 });
  }
}
