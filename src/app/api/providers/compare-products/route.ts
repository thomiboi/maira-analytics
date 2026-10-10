import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/providers/compare-products
 * Compara productos similares (mismo principio activo o nombre similar)
 * y muestra la mejor opción de compra
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

        console.log(`🔍 Buscando productos relacionados con: "${productName}"`);

        // 🆕 PASO 1: Intentar búsqueda EXACTA primero
        let mainProduct = null;
        let searchMode = '';

        const { data: exactMatch } = await supabase
            .from('products')
            .select('id, name, active_ingredient, ean, fingerprint')
            .ilike('name', productName)
            .limit(1);

        if (exactMatch && exactMatch.length > 0) {
            mainProduct = exactMatch[0];
            searchMode = 'exact';
            console.log(`✅ Coincidencia EXACTA encontrada:`, mainProduct.name);
        } else {
            // PASO 2: Si no hay coincidencia exacta, buscar parcialmente
            const { data: partialMatch, error: mainError } = await supabase
                .from('products')
                .select('id, name, active_ingredient, ean, fingerprint')
                .ilike('name', `%${productName}%`)
                .limit(1);

            if (mainError) {
                throw new Error(`Error al buscar producto: ${mainError.message}`);
            }

            if (partialMatch && partialMatch.length > 0) {
                mainProduct = partialMatch[0];
                searchMode = 'partial';
                console.log(`✅ Coincidencia PARCIAL encontrada:`, mainProduct.name);
            }
        }

        if (!mainProduct) {
            return NextResponse.json({
                success: true,
                data: {
                    found: false,
                    message: `No se encontró el producto "${productName}"`,
                },
            });
        }

        console.log(`✅ Producto principal (modo: ${searchMode}):`, mainProduct);

        // 🆕 Decidir estrategia de búsqueda según el modo
        let relatedProducts: Array<{
            id: string;
            name: string;
            active_ingredient: string | null;
            ean: string | null;
        }> = [];

        if (searchMode === 'exact') {
            // Si es búsqueda EXACTA, solo mostrar ese producto específico
            // pero buscar también productos similares para comparar
            relatedProducts = [mainProduct];
            console.log(`🎯 Búsqueda exacta: mostrando producto específico`);

            // Opcional: agregar productos similares del mismo principio activo
            if (mainProduct.active_ingredient) {
                const { data: similarProducts } = await supabase
                    .from('products')
                    .select('id, name, active_ingredient, ean')
                    .eq('active_ingredient', mainProduct.active_ingredient)
                    .neq('id', mainProduct.id) // Excluir el producto principal
                    .limit(10);

                if (similarProducts && similarProducts.length > 0) {
                    relatedProducts = [mainProduct, ...similarProducts];
                    console.log(`✅ Agregados ${similarProducts.length} productos similares para comparar`);
                }
            }
        } else if (mainProduct.active_ingredient) {
            // Buscar por principio activo
            const { data: byIngredient } = await supabase
                .from('products')
                .select('id, name, active_ingredient, ean')
                .eq('active_ingredient', mainProduct.active_ingredient)
                .limit(20);

            if (byIngredient) {
                relatedProducts = byIngredient;
                console.log(`✅ Encontrados ${byIngredient.length} productos con principio activo: ${mainProduct.active_ingredient}`);
            }
        } else {
            // Si no hay principio activo, buscar por nombre similar
            const baseName = productName.split(' ')[0]; // Tomar primera palabra
            const { data: byName } = await supabase
                .from('products')
                .select('id, name, active_ingredient, ean')
                .ilike('name', `%${baseName}%`)
                .limit(20);

            if (byName) {
                relatedProducts = byName;
                console.log(`✅ Encontrados ${byName.length} productos con nombre similar`);
            }
        }

        if (relatedProducts.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    found: false,
                    message: `No se encontraron productos similares a "${productName}"`,
                },
            });
        }

        // Obtener precios de todos los productos relacionados
        const productsWithBestPrices = await Promise.all(
            relatedProducts.map(async (product) => {
                const { data: prices } = await supabase
                    .from('provider_prices')
                    .select(`
            price,
            providers!provider_prices_provider_id_fkey (
              id,
              name
            )
          `)
                    .eq('product_id', product.id);

                if (!prices || prices.length === 0) return null;

                // Obtener el precio más bajo
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
                    });

                if (validPrices.length === 0) return null;

                const sortedPrices = validPrices.sort((a, b) => a.price - b.price);
                const bestPrice = sortedPrices[0];
                const avgPrice = validPrices.reduce((sum, p) => sum + p.price, 0) / validPrices.length;

                return {
                    productId: product.id,
                    productName: product.name,
                    activeIngredient: product.active_ingredient,
                    ean: product.ean,
                    bestPrice: bestPrice.price,
                    bestProvider: bestPrice.provider,
                    avgPrice: Math.round(avgPrice),
                    priceCount: validPrices.length,
                    allPrices: sortedPrices,
                };
            })
        );

        // Filtrar productos válidos y ordenar por mejor precio
        const validProducts = productsWithBestPrices
            .filter((p) => p !== null)
            .sort((a, b) => a!.bestPrice - b!.bestPrice);

        if (validProducts.length === 0) {
            return NextResponse.json({
                success: true,
                data: {
                    found: false,
                    message: `Los productos encontrados no tienen precios registrados`,
                },
            });
        }

        // Calcular estadísticas de comparación
        const allBestPrices = validProducts.map((p) => p!.bestPrice);
        const minPrice = Math.min(...allBestPrices);
        const maxPrice = Math.max(...allBestPrices);
        const avgBestPrice = allBestPrices.reduce((a, b) => a + b, 0) / allBestPrices.length;
        const priceDifference = maxPrice - minPrice;
        const savingsPercentage = ((priceDifference / maxPrice) * 100).toFixed(2);

        // Identificar la mejor opción (más barato)
        const bestOption = validProducts[0];
        const worstOption = validProducts[validProducts.length - 1];

        // Crear comparaciones con alternativas
        const comparisons = validProducts.map((product, index) => {
            const diffFromBest = product!.bestPrice - minPrice;
            const percentFromBest = minPrice > 0 ? (((product!.bestPrice - minPrice) / minPrice) * 100).toFixed(2) : '0';

            return {
                rank: index + 1,
                productName: product!.productName,
                activeIngredient: product!.activeIngredient,
                bestPrice: product!.bestPrice,
                bestProvider: product!.bestProvider,
                avgPrice: product!.avgPrice,
                providerCount: product!.priceCount,
                differenceFromBest: diffFromBest,
                percentageFromBest: parseFloat(percentFromBest),
                isBestOption: product!.bestPrice === minPrice,
                isWorstOption: product!.bestPrice === maxPrice,
                allPrices: product!.allPrices,
            };
        });

        return NextResponse.json({
            success: true,
            data: {
                found: true,
                searchMode: searchMode, // 🆕 Indicar tipo de búsqueda
                exactMatch: searchMode === 'exact', // 🆕 Flag para búsqueda exacta
                searchedProduct: mainProduct.name,
                activeIngredient: mainProduct.active_ingredient,
                totalProductsFound: validProducts.length,
                bestOption: {
                    productName: bestOption!.productName,
                    price: bestOption!.bestPrice,
                    provider: bestOption!.bestProvider,
                    avgPrice: bestOption!.avgPrice,
                },
                worstOption: {
                    productName: worstOption!.productName,
                    price: worstOption!.bestPrice,
                    provider: worstOption!.bestProvider,
                },
                statistics: {
                    minPrice,
                    maxPrice,
                    avgBestPrice: Math.round(avgBestPrice),
                    priceDifference,
                    savingsPercentage: parseFloat(savingsPercentage),
                    potentialSavings: priceDifference,
                },
                comparisons,
            },
        });
    } catch (error) {
        console.error('❌ Error al comparar productos:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Error desconocido',
            },
            { status: 500 }
        );
    }
}
