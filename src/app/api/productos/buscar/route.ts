import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json([]);
    }

    // Buscar en productos_pos por nombre o código
    const productos = await prisma.productos_pos.findMany({
      where: {
        AND: [
          { activo: true },
          {
            OR: [
              {
                nombre: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
              {
                codigo: {
                  contains: query,
                  mode: 'insensitive',
                },
              },
            ],
          },
        ],
      },
      select: {
        codigo: true,
        nombre: true,
      },
      take: 15,
      orderBy: {
        nombre: 'asc',
      },
    });

    // Formatear respuesta con 0 unidades (ya que es solo para búsqueda)
    const formattedProducts = productos.map((p) => ({
      codigo: p.codigo || '',
      nombre: p.nombre,
      unidades: 0, // No calculamos unidades aquí, es solo para búsqueda
    }));

    return NextResponse.json(formattedProducts);
  } catch (error) {
    console.error('Error buscando productos:', error);
    return NextResponse.json(
      { error: 'Error al buscar productos' },
      { status: 500 }
    );
  }
}
