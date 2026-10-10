import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/providers/search-product
 * Busca un producto específico y devuelve comparación de precios entre proveedores
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { productName } = body;

    if (!productName || typeof productName !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Debes proporcionar el nombre del producto',
        },
        { status: 400 }
      );
    }

    console.log(`🔍 Buscando producto: "${productName}"`);

    // Buscar productos que coincidan con el nombre (case-insensitive, búsqueda parcial)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name')
      .ilike('name', `%${productName}%`)
      .limit(10);

    if (productsError) {
      throw new Error(`Error al buscar productos: ${productsError.message}`);
    }

    if (!products || products.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          found: false,
          message: `No se encontraron productos con el nombre "${productName}"`,
          suggestions: [],
        },
      });
    }

    console.log(`✅ Encontrados ${products.length} productos`);

    // Para cada producto encontrado, obtener los precios de todos los proveedores
    const productsWithPrices = await Promise.all(
      products.map(async (product) => {
        // Obtener precios de todos los proveedores para este producto
        const { data: prices, error: pricesError } = await supabase
          .from('provider_prices')
          .select(`
            price,
            providers!provider_prices_provider_id_fkey (
              id,
              name
            )
          `)
          .eq('product_id', product.id);

        if (pricesError) {
          console.error(`Error al obtener precios para ${product.name}:`, pricesError);
          return null;
        }

        if (!prices) return null;

        // Filtrar y formatear datos (todos los proveedores que tengan precio)
        const validPrices = prices
          .filter((p) => {
            const prov = Array.isArray(p.providers) ? p.providers[0] : p.providers;
            return prov && typeof prov === 'object' && 'name' in prov;
          })
          .map((p) => {
            const prov = Array.isArray(p.providers) ? p.providers[0] : p.providers;
            return {
              provider: (prov as { name: string }).name,
              providerId: (prov as { id: string }).id,
              price: Number(p.price),
            };
          })
          .sort((a, b) => a.price - b.price); // Ordenar por precio ascendente

        if (validPrices.length === 0) {
          return null;
        }

        // Calcular estadísticas
        const prices_only = validPrices.map((p) => p.price);
        const minPrice = Math.min(...prices_only);
        const maxPrice = Math.max(...prices_only);
        const avgPrice = prices_only.reduce((a, b) => a + b, 0) / prices_only.length;
        const priceDifference = maxPrice - minPrice;
        const percentageDifference = ((priceDifference / minPrice) * 100).toFixed(2);

        const cheapestProvider = validPrices.find((p) => p.price === minPrice);
        const mostExpensiveProvider = validPrices.find((p) => p.price === maxPrice);

        return {
          productId: product.id,
          productName: product.name,
          pricesCount: validPrices.length,
          prices: validPrices,
          statistics: {
            minPrice,
            maxPrice,
            avgPrice: Math.round(avgPrice),
            priceDifference,
            percentageDifference: parseFloat(percentageDifference),
            cheapestProvider: cheapestProvider?.provider,
            mostExpensiveProvider: mostExpensiveProvider?.provider,
          },
          comparison: validPrices.map((p) => ({
            provider: p.provider,
            price: p.price,
            differenceFromCheapest: p.price - minPrice,
            percentageFromCheapest: (((p.price - minPrice) / minPrice) * 100).toFixed(2),
            isCheapest: p.price === minPrice,
            isMostExpensive: p.price === maxPrice,
          })),
        };
      })
    );

    // Filtrar productos que tengan precios válidos
    const validProducts = productsWithPrices.filter((p) => p !== null);

    if (validProducts.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          found: false,
          message: `Se encontraron productos con el nombre "${productName}", pero no tienen precios registrados.`,
          suggestions: products.map((p) => p.name),
        },
      });
    }

    // Si se encontró exactamente un producto, devolver respuesta enfocada
    if (validProducts.length === 1) {
      const product = validProducts[0];
      return NextResponse.json({
        success: true,
        data: {
          found: true,
          exactMatch: true,
          product: product,
          message: `Comparación de precios para "${product?.productName}"`,
        },
      });
    }

    // Si se encontraron múltiples productos, devolver lista
    return NextResponse.json({
      success: true,
      data: {
        found: true,
        exactMatch: false,
        products: validProducts,
        message: `Se encontraron ${validProducts.length} productos que coinciden con "${productName}"`,
      },
    });
  } catch (error) {
    console.error('❌ Error al buscar producto:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
