import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    // Listar todas las tablas disponibles en la base de datos
    const result = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    return NextResponse.json({
      success: true,
      mensaje: "Todas las tablas disponibles en Supabase",
      tablas: result.map(r => r.tablename),
      total: result.length,
      nota: "Necesitamos encontrar si hay una tabla de productos, inventario, o artículos con costos"
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    }, { status: 500 });
  }
}
