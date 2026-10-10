import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ProductRanking {
  ranking: number;
  codigo: string;
  nombre: string;
  unidades: number;
  ingresos: number;
  costo: number;
  margen: number;          // % de margen
  margenDinero: number;    // Margen en $ (beneficio bruto)
  frecuencia: number;
  crecimiento: number;
}

interface RankingStats {
  productoMasVendido: {
    codigo: string;
    nombre: string;
    unidades: number;
    crecimiento: number;
  } | null;
  mayorMargen: {
    codigo: string;
    nombre: string;
    margen: number;
    crecimiento: number;
  } | null;
  totalProductos: number;
  ventasTotales: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sucursalId = searchParams.get('sucursal');
    const fechaInicioParam = searchParams.get('fechaInicio');
    const fechaFinParam = searchParams.get('fechaFin');
    const viewMode = searchParams.get('viewMode') || 'mas-vendidos';
    const searchQuery = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '50', 10);

    console.log('🔍 [RANKING API] Parámetros recibidos:', {
      sucursalId,
      fechaInicio: fechaInicioParam,
      fechaFin: fechaFinParam,
      viewMode,
      searchQuery,
      page,
      pageSize
    });

    // Usar fechas proporcionadas o últimos 30 días por defecto
    const fechaFin = fechaFinParam ? new Date(fechaFinParam) : new Date();
    const fechaInicio = fechaInicioParam ? new Date(fechaInicioParam) : (() => {
      const date = new Date();
      date.setDate(date.getDate() - 30);
      return date;
    })();

    // Calcular duración del período en días para el período anterior
    const duracionPeriodo = Math.ceil((fechaFin.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24));

    // Fecha para período anterior (para calcular crecimiento)
    const fechaInicioAnterior = new Date(fechaInicio);
    fechaInicioAnterior.setDate(fechaInicioAnterior.getDate() - duracionPeriodo);

    // Construir filtro base para período actual
    // Para sucursal NULL (Casa Matriz), comparamos con null
    // Para sucursal con código (FM Villa Independencia), comparamos con el ID
    const whereBoletasActual = {
      fecha: {
        gte: fechaInicio,
        lte: fechaFin,
      },
      ...(sucursalId && sucursalId !== 'todas' && {
        sucursal_id: sucursalId === 'null' ? null : parseFloat(sucursalId)
      }),
    };

    console.log('📊 [RANKING API] Filtro para período actual:', JSON.stringify(whereBoletasActual, null, 2));

    // Construir filtro base para período anterior
    const whereBoletasAnterior = {
      fecha: {
        gte: fechaInicioAnterior,
        lt: fechaInicio,
      },
      ...(sucursalId && sucursalId !== 'todas' && {
        sucursal_id: sucursalId === 'null' ? null : parseFloat(sucursalId)
      }),
    };

    // Consulta principal: obtener datos del período actual con JOIN a productos_pos para obtener costo
    const detallesPeriodoActual = await prisma.boletas_detalles.findMany({
      where: {
        boletas: whereBoletasActual,
      },
      select: {
        codigo: true,
        nombre: true,
        cantidad: true,
        precio: true,
        boletas: {
          select: {
            folio: true,
            fecha: true,
            sucursal_id: true,
          },
        },
      },
    });

    // Obtener costos de productos desde productos_pos
    const codigosUnicos = [...new Set(detallesPeriodoActual.map(d => d.codigo).filter(Boolean))] as string[];
    const productosConCosto = await prisma.productos_pos.findMany({
      where: {
        codigo: { in: codigosUnicos },
      },
      select: {
        codigo: true,
        nombre: true,
        preciocompraneto: true, // Costo de compra
      },
    });

    // Crear mapa de costos por código
    const costosMap = new Map<string, number>();
    productosConCosto.forEach((p) => {
      if (p.codigo && p.preciocompraneto) {
        costosMap.set(p.codigo, parseFloat(p.preciocompraneto.toString()));
      }
    });

    // Agrupar por producto (período actual)
    const productosMap = new Map<string, {
      codigo: string;
      nombre: string;
      unidades: number;
      ingresos: number;
      costo: number;
      folios: Set<number>;
    }>();

    // Procesar productos del período actual
    // IMPORTANTE: El campo 'precio' en boletas_detalles INCLUYE IVA
    // Para obtener ingresos sin IVA, dividimos entre 1.19 (IVA 19%)
    detallesPeriodoActual.forEach((detalle) => {
      const codigo = detalle.codigo || 'SIN_CODIGO';
      const cantidad = parseFloat(detalle.cantidad?.toString() || '0');
      const precioConIVA = parseFloat(detalle.precio?.toString() || '0');
      
      // Calcular precio sin IVA (precio / 1.19)
      const precioSinIVA = precioConIVA / 1.19;
      
      // Obtener costo real desde productos_pos
      const costoUnitario = costosMap.get(codigo) || 0;

      if (!productosMap.has(codigo)) {
        productosMap.set(codigo, {
          codigo,
          nombre: detalle.nombre || 'Producto sin nombre',
          unidades: 0,
          ingresos: 0,
          costo: 0,
          folios: new Set(),
        });
      }

      const producto = productosMap.get(codigo)!;
      producto.unidades += cantidad;
      
      // Ingresos sin IVA: precio neto × cantidad
      producto.ingresos += cantidad * precioSinIVA;
      
      // Costo total: costo unitario × cantidad
      producto.costo += cantidad * costoUnitario;
      
      if (detalle.boletas?.folio) {
        producto.folios.add(detalle.boletas.folio);
      }
    });

    // Agrupar período anterior por producto (calculando ingresos para comparar crecimiento)
    // Necesitamos obtener también el precio para calcular correctamente
    const detallesPeriodoAnteriorCompletos = await prisma.boletas_detalles.findMany({
      where: {
        boletas: whereBoletasAnterior,
      },
      select: {
        codigo: true,
        cantidad: true,
        precio: true, // Precio incluye IVA
      },
    });

    const productosAnteriorMap = new Map<string, { unidades: number; ingresos: number }>();
    
    detallesPeriodoAnteriorCompletos.forEach((detalle) => {
      const codigo = detalle.codigo || 'SIN_CODIGO';
      const cantidad = parseFloat(detalle.cantidad?.toString() || '0');
      const precioConIVA = parseFloat(detalle.precio?.toString() || '0');
      
      // Calcular precio sin IVA (precio / 1.19)
      const precioSinIVA = precioConIVA / 1.19;
      const ingresos = cantidad * precioSinIVA;
      
      const existente = productosAnteriorMap.get(codigo) || { unidades: 0, ingresos: 0 };
      productosAnteriorMap.set(codigo, {
        unidades: existente.unidades + cantidad,
        ingresos: existente.ingresos + ingresos,
      });
    });

    // Convertir a array y calcular métricas
    const productos: ProductRanking[] = Array.from(productosMap.values()).map((producto) => {
      // Calcular margen REAL: % de beneficio sobre el precio de venta
      // Margen = ((Ingresos - Costo) / Ingresos) × 100
      // Si no hay costo o no hay ingresos, el margen es 0
      let margen = 0;
      if (producto.ingresos > 0 && producto.costo > 0) {
        margen = ((producto.ingresos - producto.costo) / producto.ingresos) * 100;
      }

      // Calcular crecimiento comparando INGRESOS (ventas) con período anterior
      const dataAnterior = productosAnteriorMap.get(producto.codigo);
      let crecimiento = 0;
      
      if (dataAnterior && dataAnterior.ingresos > 0) {
        // Comparar ingresos: cuánto crecieron las ventas en $
        crecimiento = ((producto.ingresos - dataAnterior.ingresos) / dataAnterior.ingresos) * 100;
      } else if (producto.ingresos > 0) {
        // Producto nuevo (no tenía ventas en período anterior)
        crecimiento = 100;
      }
      // Si no hay ventas en ningún período, crecimiento queda en 0

      // Calcular margen en dinero (beneficio bruto)
      const margenDinero = producto.ingresos - producto.costo;

      return {
        ranking: 0, // Se asignará después de ordenar
        codigo: producto.codigo,
        nombre: producto.nombre,
        unidades: Math.round(producto.unidades),
        ingresos: Math.round(producto.ingresos),
        costo: Math.round(producto.costo),
        margen: Math.round(margen * 10) / 10,
        margenDinero: Math.round(margenDinero), // Beneficio bruto en $
        frecuencia: producto.folios.size,
        crecimiento: Math.round(crecimiento * 10) / 10,
      };
    });

    // Ordenar según el modo de vista
    const productosOrdenados = [...productos];
    switch (viewMode) {
      case 'mas-vendidos':
        productosOrdenados.sort((a, b) => b.unidades - a.unidades);
        break;
      case 'mayor-margen':
        productosOrdenados.sort((a, b) => b.margen - a.margen);
        break;
      case 'frecuencia':
        productosOrdenados.sort((a, b) => b.frecuencia - a.frecuencia);
        break;
      case 'crecimiento':
        productosOrdenados.sort((a, b) => b.crecimiento - a.crecimiento);
        break;
      default:
        productosOrdenados.sort((a, b) => b.unidades - a.unidades);
    }

    // Asignar ranking a TODOS los productos
    productosOrdenados.forEach((producto, index) => {
      producto.ranking = index + 1;
    });

    // Filtrar por búsqueda si hay un query
    let productosFiltrados = productosOrdenados;
    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase();
      productosFiltrados = productosOrdenados.filter(p => 
        p.nombre.toLowerCase().includes(queryLower) || 
        p.codigo.toLowerCase().includes(queryLower)
      );
    }

    // Calcular paginación
    const totalProductos = productosFiltrados.length;
    const totalPages = Math.ceil(totalProductos / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const productosPaginados = productosFiltrados.slice(startIndex, endIndex);

    // Calcular estadísticas generales (basadas en TODOS los productos, no solo los paginados)
    const productoConMayorMargen = productosOrdenados.length > 0 
      ? [...productosOrdenados].sort((a, b) => b.margen - a.margen)[0]
      : null;

    const stats: RankingStats = {
      productoMasVendido: productosOrdenados[0] ? {
        codigo: productosOrdenados[0].codigo,
        nombre: productosOrdenados[0].nombre,
        unidades: productosOrdenados[0].unidades,
        crecimiento: productosOrdenados[0].crecimiento,
      } : null,
      mayorMargen: productoConMayorMargen ? {
        codigo: productoConMayorMargen.codigo,
        nombre: productoConMayorMargen.nombre,
        margen: productoConMayorMargen.margen,
        crecimiento: productoConMayorMargen.crecimiento,
      } : null,
      totalProductos: productos.length,
      ventasTotales: Math.round(productos.reduce((sum, p) => sum + p.ingresos, 0)),
    };

    return NextResponse.json({
      success: true,
      data: {
        productos: productosPaginados,
        stats,
        periodo: {
          dias: duracionPeriodo,
          fechaInicio: fechaInicio.toISOString(),
          fechaFin: fechaFin.toISOString(),
        },
        pagination: {
          currentPage: page,
          pageSize: pageSize,
          totalItems: totalProductos,
          totalPages: totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });

  } catch (error) {
    console.error('Error en API de ranking:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener ranking de productos',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
