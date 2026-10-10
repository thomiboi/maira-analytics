import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const codigo = searchParams.get('codigo');
    const sucursalId = searchParams.get('sucursal');
    const fechaInicioParam = searchParams.get('fechaInicio');
    const fechaFinParam = searchParams.get('fechaFin');

    if (!codigo) {
      return NextResponse.json(
        { error: 'Se requiere el código del producto' },
        { status: 400 }
      );
    }

    // Usar fechas proporcionadas o últimos 30 días por defecto
    const fechaFin = fechaFinParam ? new Date(fechaFinParam) : new Date();
    const fechaInicio = fechaInicioParam ? new Date(fechaInicioParam) : (() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date;
    })();

    // Construir filtro base
    const whereBoletasFilter = {
      fecha: {
        gte: fechaInicio,
        lte: fechaFin,
      },
      ...(sucursalId && sucursalId !== 'todas' && sucursalId !== '0' && {
        sucursal_id: sucursalId === 'null' ? null : Number.parseFloat(sucursalId)
      }),
    };

    // Obtener ventas del producto
    const detalles = await prisma.boletas_detalles.findMany({
      where: {
        codigo: codigo,
        boletas: whereBoletasFilter,
      },
      include: {
        boletas: {
          select: {
            fecha: true,
          },
        },
      },
    });

    // Agrupar por fecha con cantidad e ingreso
    const salesByDate = new Map<string, { quantity: number; revenue: number }>();
    
    for (const detalle of detalles) {
      if (detalle.boletas?.fecha) {
        const dateStr = detalle.boletas.fecha.toISOString().split('T')[0];
        const quantity = Number(detalle.cantidad) || 0;
        const precioConIVA = Number(detalle.precio) || 0;
        
        // Calcular precio sin IVA (precio / 1.19) según la lógica del ranking
        const precioSinIVA = precioConIVA / 1.19;
        const revenue = quantity * precioSinIVA;
        
        const existing = salesByDate.get(dateStr) || { quantity: 0, revenue: 0 };
        salesByDate.set(dateStr, {
          quantity: existing.quantity + quantity,
          revenue: existing.revenue + revenue,
        });
      }
    }

    // Convertir a array y ordenar
    const formattedSales = Array.from(salesByDate.entries())
      .map(([date, data]) => ({ 
        date, 
        quantity: Math.round(data.quantity),
        revenue: Math.round(data.revenue),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json(formattedSales);
  } catch (error) {
    console.error('Error al obtener ventas diarias del producto:', error);
    return NextResponse.json(
      { error: 'Error al obtener las ventas del producto' },
      { status: 500 }
    );
  }
}
