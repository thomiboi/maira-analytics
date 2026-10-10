// API Route: POST /api/catalog
// Guarda catálogos de proveedores en Supabase con normalización de productos

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 🔍 Verifica si un código es un EAN válido (12-13 dígitos).
 */
function isEan(code: string): boolean {
    if (!code) return false;

    const cleaned = code.trim();
    // EAN-13: 13 dígitos, EAN-12 (UPC): 12 dígitos
    const eanRegex = /^\d{12,13}$/;

    return eanRegex.test(cleaned);
}

/**
 * 🔑 Crea un "fingerprint" único para productos sin EAN.
 * Normaliza el nombre y el principio activo para crear una llave consistente.
 */
function createFingerprint(
    name: string,
    activeIngredient?: string
): string {
    const normalize = (str: string) => {
        return str
            .toLowerCase()
            .trim()
            // Eliminar caracteres especiales y espacios extra
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, '_');
    };

    const normalizedName = normalize(name);
    const normalizedIngredient = activeIngredient
        ? normalize(activeIngredient)
        : '';

    // Combinar nombre y principio activo
    return normalizedIngredient
        ? `${normalizedName}__${normalizedIngredient}`
        : normalizedName;
}

/**
 * 📊 Tipo para el producto de entrada
 */
interface ProductInput {
    productName: string;
    price: number;
    ean: string;
    activeIngredient?: string;
}

/**
 * 📦 Tipo para el payload del request
 */
interface CatalogRequest {
    providerName: string;
    products: ProductInput[];
    clearPrevious?: boolean; // Opcional: si es true, elimina todos los precios anteriores del proveedor
}

/**
 * 🗄️ Tipo para la tabla providers
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Provider {
    id: string;
    name: string;
    created_at?: string;
}

/**
 * 🗄️ Tipo para la tabla products
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Product {
    id: string;
    ean: string | null;
    fingerprint: string | null;
    name: string;
    active_ingredient: string | null;
    created_at?: string;
}

/**
 * 🗄️ Tipo para la tabla provider_prices
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ProviderPrice {
    id: number;
    product_id: string;
    provider_id: string;
    price: number;
    last_updated_at?: string;
}

/**
 * POST /api/catalog
 * Guarda o actualiza un catálogo de proveedor en Supabase usando BULK UPSERTS
 */
export async function POST(request: NextRequest) {
    try {
        // 1️⃣ Parsear el body del request
        const body: CatalogRequest = await request.json();
        const { providerName, products, clearPrevious = false } = body;

        // Validaciones básicas
        if (!providerName || !products || !Array.isArray(products)) {
            return NextResponse.json(
                { error: 'Payload inválido. Se requiere providerName y products[].' },
                { status: 400 }
            );
        }

        if (products.length === 0) {
            return NextResponse.json(
                { error: 'El arreglo de productos está vacío.' },
                { status: 400 }
            );
        }

        console.log(`📦 Procesando catálogo de ${providerName}: ${products.length} productos recibidos (BULK MODE)${clearPrevious ? ' - REEMPLAZANDO PRECIOS ANTERIORES' : ' - AÑADIENDO/ACTUALIZANDO'}`);

        // 🔧 DE-DUPLICACIÓN: Eliminar productos duplicados basados en EAN, guardando el precio más bajo
        console.log('🔍 Iniciando de-duplicación de productos por EAN (guardando el precio más bajo)...');

        const productMap = new Map<string, ProductInput>();
        let duplicatesFound = 0;

        for (const product of products) {
            const { ean } = product;

            // Normalizar el EAN (eliminar espacios, convertir a minúsculas)
            const normalizedEan = ean ? ean.trim().toLowerCase() : '';

            // Si el EAN está vacío o no existe, usar el nombre del producto como clave
            // Esto permite que productos sin EAN no se eliminen entre sí
            const key = normalizedEan || `no_ean_${product.productName.trim().toLowerCase()}`;

            // Si ya existe, comparar precios y quedarse con el más barato
            if (productMap.has(key)) {
                const existingProduct = productMap.get(key)!;

                // 💰 Comparar precios: quedarse con el más barato
                if (product.price < existingProduct.price) {
                    console.log(`💰 Duplicado encontrado - usando precio más barato: EAN="${normalizedEan}", Producto="${product.productName}"`);
                    console.log(`   Anterior: $${existingProduct.price} → Nuevo: $${product.price} (ahorro: $${(existingProduct.price - product.price).toFixed(2)})`);
                    productMap.set(key, product); // Reemplazar con el más barato
                } else {
                    console.log(`💰 Duplicado encontrado - manteniendo precio más barato: EAN="${normalizedEan}", Producto="${product.productName}"`);
                    console.log(`   Manteniendo: $${existingProduct.price} (descartando: $${product.price})`);
                }

                duplicatesFound++;
            } else {
                // Guardar el producto por primera vez
                productMap.set(key, product);
            }
        }

        // Convertir el Map de vuelta a un arreglo
        const uniqueProducts = Array.from(productMap.values());

        console.log(`✅ De-duplicación completada:`);
        console.log(`   - Productos originales: ${products.length}`);
        console.log(`   - Productos únicos: ${uniqueProducts.length}`);
        console.log(`   - Duplicados eliminados: ${duplicatesFound}`);
        console.log(`   - Estrategia: Siempre se guardó el precio más bajo`);

        const startTime = Date.now();

        // 2️⃣ Crear cliente de Supabase
        const supabase = await createClient();

        // 3️⃣ Obtener o crear el provider
        const { data: existingProvider, error: selectError } = await supabase
            .from('providers')
            .select('id')
            .eq('name', providerName)
            .maybeSingle();

        let providerId: string;

        if (existingProvider) {
            providerId = existingProvider.id;
            console.log(`✅ Provider existente: ${providerId}`);
        } else {
            const { data: newProvider, error: insertError } = await supabase
                .from('providers')
                .insert({ name: providerName })
                .select('id')
                .single();

            if (insertError || !newProvider) {
                console.error('Error al crear provider:', insertError);
                return NextResponse.json(
                    { error: 'Error al procesar el proveedor.', details: insertError },
                    { status: 500 }
                );
            }

            providerId = newProvider.id;
            console.log(`✅ Nuevo provider creado: ${providerId}`);
        }

        if (selectError && selectError.code !== 'PGRST116') {
            console.error('Error al buscar provider:', selectError);
            return NextResponse.json(
                { error: 'Error al buscar el proveedor.', details: selectError },
                { status: 500 }
            );
        }

        // 4️⃣ Preparar datos para BULK UPSERT de productos
        console.log('🔧 Preparando bulk upsert de productos...');

        const productsToUpsert: Array<{
            ean: string | null;
            fingerprint: string | null;
            name: string;
            active_ingredient: string | null;
        }> = [];

        const validProducts: Array<{
            product: ProductInput;
            ean: string | null;
            fingerprint: string | null;
        }> = [];

        for (const product of uniqueProducts) {
            const { productName, price, ean, activeIngredient } = product;

            // Validar datos mínimos
            if (!productName || !price || price <= 0) {
                console.warn(`⚠️ Producto inválido omitido: ${productName || 'Sin nombre'}`);
                continue;
            }

            // Determinar la llave única (EAN o fingerprint)
            const hasValidEan = isEan(ean);
            const fingerprintValue = hasValidEan ? null : createFingerprint(productName, activeIngredient);
            const eanValue = hasValidEan ? ean.trim() : null;

            productsToUpsert.push({
                ean: eanValue,
                fingerprint: fingerprintValue,
                name: productName.trim(),
                active_ingredient: activeIngredient?.trim() || null
            });

            validProducts.push({
                product,
                ean: eanValue,
                fingerprint: fingerprintValue
            });
        }

        if (productsToUpsert.length === 0) {
            return NextResponse.json(
                { error: 'No hay productos válidos para procesar.' },
                { status: 400 }
            );
        }

        console.log(`📊 ${productsToUpsert.length} productos válidos preparados`);

        // 5️⃣ Ejecutar BULK UPSERT de productos
        // SOLUCIÓN: Procesar productos uno por uno para garantizar que no se pierdan
        console.log(`🔄 Procesando ${productsToUpsert.length} productos...`);

        const upsertedProducts: Array<{ id: string; ean: string | null; fingerprint: string | null; name: string }> = [];
        let upsertErrors = 0;

        // Dividir en lotes de 100 para mejor performance
        const BATCH_SIZE = 100;
        const batches = [];
        for (let i = 0; i < productsToUpsert.length; i += BATCH_SIZE) {
            batches.push(productsToUpsert.slice(i, i + BATCH_SIZE));
        }

        console.log(`📦 Procesando ${batches.length} lotes de productos...`);

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            console.log(`🔄 Procesando lote ${batchIndex + 1}/${batches.length} (${batch.length} productos)`);

            // Separar productos con EAN y sin EAN
            const productsWithEan = batch.filter(p => p.ean !== null);
            const productsWithFingerprint = batch.filter(p => p.fingerprint !== null);

            // Procesar productos con EAN
            if (productsWithEan.length > 0) {
                const { data: eanProducts, error: eanError } = await supabase
                    .from('products')
                    .upsert(productsWithEan, {
                        onConflict: 'ean',
                        ignoreDuplicates: false
                    })
                    .select('id, ean, fingerprint, name');

                if (eanError) {
                    console.error(`⚠️ Error en lote con EAN:`, eanError);
                    upsertErrors += productsWithEan.length;
                } else if (eanProducts) {
                    upsertedProducts.push(...eanProducts);
                }
            }

            // Procesar productos con fingerprint
            if (productsWithFingerprint.length > 0) {
                const { data: fpProducts, error: fpError } = await supabase
                    .from('products')
                    .upsert(productsWithFingerprint, {
                        onConflict: 'fingerprint',
                        ignoreDuplicates: false
                    })
                    .select('id, ean, fingerprint, name');

                if (fpError) {
                    console.error(`⚠️ Error en lote con fingerprint:`, fpError);
                    upsertErrors += productsWithFingerprint.length;
                } else if (fpProducts) {
                    upsertedProducts.push(...fpProducts);
                }
            }
        }

        console.log(`✅ ${upsertedProducts.length} productos upsertados en la DB`);
        if (upsertErrors > 0) {
            console.warn(`⚠️ ${upsertErrors} productos tuvieron errores al guardar`);
        }

        // 6️⃣ Crear mapas para acceso rápido: EAN/Fingerprint/Name → Product ID
        console.log('🗺️ Creando mapas de productos...');
        const productIdByEan = new Map<string, string>();
        const productIdByFingerprint = new Map<string, string>();
        const productIdByName = new Map<string, string>();

        for (const product of upsertedProducts) {
            if (product.ean) {
                productIdByEan.set(product.ean.toLowerCase().trim(), product.id);
            }
            if (product.fingerprint) {
                productIdByFingerprint.set(product.fingerprint, product.id);
            }
            if (product.name) {
                productIdByName.set(product.name.toLowerCase().trim(), product.id);
            }
        }

        console.log(`✅ Mapas creados: ${productIdByEan.size} EANs, ${productIdByFingerprint.size} fingerprints, ${productIdByName.size} nombres`);
        // 7️⃣ Preparar datos para BULK UPSERT de precios
        console.log('🔧 Preparando bulk upsert de precios...');

        const pricesToUpsert: Array<{
            product_id: string;
            provider_id: string;
            price: number;
            last_updated_at: string;
        }> = [];

        let missingProducts = 0;
        const currentTimestamp = new Date().toISOString();

        for (const validProduct of validProducts) {
            // Intentar buscar el ID del producto en orden de prioridad
            let productId: string | undefined;

            // 1. Buscar por EAN (más confiable)
            if (validProduct.ean) {
                productId = productIdByEan.get(validProduct.ean.toLowerCase().trim());
            }

            // 2. Si no se encontró, buscar por fingerprint
            if (!productId && validProduct.fingerprint) {
                productId = productIdByFingerprint.get(validProduct.fingerprint);
            }

            // 3. Si aún no se encontró, buscar por nombre (fallback)
            if (!productId) {
                const productName = validProduct.product.productName.toLowerCase().trim();
                productId = productIdByName.get(productName);
            }

            if (!productId) {
                console.warn(`⚠️ No se encontró ID para: ${validProduct.product.productName} (EAN: ${validProduct.ean || 'N/A'}, FP: ${validProduct.fingerprint || 'N/A'})`);
                missingProducts++;
                continue;
            }

            pricesToUpsert.push({
                product_id: productId,
                provider_id: providerId,
                price: validProduct.product.price,
                last_updated_at: currentTimestamp
            });
        }

        if (pricesToUpsert.length === 0) {
            return NextResponse.json(
                { error: 'No se pudieron mapear productos a IDs.' },
                { status: 500 }
            );
        }

        console.log(`📊 ${pricesToUpsert.length} precios preparados (${missingProducts} omitidos)`);

        // 8️⃣ 🔄 UPSERT DE PRECIOS (actualiza o inserta según corresponda)
        console.log(`🔄 ${clearPrevious ? 'Reemplazando' : 'Actualizando/agregando'} precios del proveedor ${providerName}...`);

        // 🗑️ Si clearPrevious es true, eliminar TODOS los precios anteriores del proveedor ANTES del primer lote
        let deletedCount = 0;
        if (clearPrevious) {
            console.log(`🗑️ Eliminando precios anteriores del proveedor ${providerName}...`);

            const { error: deleteError, count } = await supabase
                .from('provider_prices')
                .delete({ count: 'exact' })
                .eq('provider_id', providerId);

            if (deleteError) {
                console.error('Error al eliminar precios anteriores:', deleteError);
                return NextResponse.json(
                    { error: 'Error al eliminar precios anteriores.', details: deleteError },
                    { status: 500 }
                );
            }

            deletedCount = count || 0;
            console.log(`✅ ${deletedCount} precios anteriores eliminados`);
        }

        // 8.5️⃣ ACTUALIZAR LA FECHA DE REGISTRO DEL PROVEEDOR
        if (existingProvider) {
            console.log(`📅 Actualizando fecha de registro del proveedor ${providerName}...`);

            const { error: updateProviderError } = await supabase
                .from('providers')
                .update({ created_at: currentTimestamp })
                .eq('id', providerId);

            if (updateProviderError) {
                console.error('⚠️ Error al actualizar fecha del proveedor:', updateProviderError);
                // No detenemos el proceso, solo advertimos
            } else {
                console.log(`✅ Fecha de registro actualizada`);
            }
        }

        // 9️⃣ Ejecutar BULK UPSERT de precios (no INSERT)
        // Usa onConflict para actualizar si ya existe la combinación product_id + provider_id
        console.log('🔄 Bulk upsert de precios...');

        const { error: pricesError } = await supabase
            .from('provider_prices')
            .upsert(pricesToUpsert, {
                onConflict: 'product_id,provider_id',
                ignoreDuplicates: false
            });

        if (pricesError) {
            console.error('Error en bulk upsert de precios:', pricesError);
            return NextResponse.json(
                { error: 'Error al guardar precios.', details: pricesError },
                { status: 500 }
            );
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        const successRate = pricesToUpsert.length > 0
            ? ((pricesToUpsert.length / uniqueProducts.length) * 100).toFixed(1)
            : '0';

        console.log(`✅ Catálogo procesado en ${duration}s`);
        console.log(`📊 Estadísticas finales:`);
        console.log(`   - Productos recibidos: ${products.length}`);
        console.log(`   - Duplicados eliminados: ${duplicatesFound}`);
        console.log(`   - Productos únicos: ${uniqueProducts.length}`);
        console.log(`   - Productos guardados en DB: ${upsertedProducts.length}`);
        console.log(`   - Precios creados: ${pricesToUpsert.length}/${uniqueProducts.length} (${successRate}%)`);
        console.log(`   - Productos sin mapear: ${missingProducts}`);
        console.log(`   - Errores en upsert: ${upsertErrors}`);
        if (clearPrevious) {
            console.log(`   - Precios anteriores eliminados: ${deletedCount}`);
        }

        // 🔟 Respuesta final
        return NextResponse.json(
            {
                success: true,
                message: `Catálogo de ${providerName} ${existingProvider ? 'actualizado' : 'creado'} exitosamente.`,
                stats: {
                    received: products.length,
                    duplicatesRemoved: duplicatesFound,
                    unique: uniqueProducts.length,
                    processed: pricesToUpsert.length,
                    errors: uniqueProducts.length - pricesToUpsert.length,
                    deleted: clearPrevious ? deletedCount : undefined,
                    duration: `${duration}s`
                },
                action: clearPrevious ? 'replaced' : (existingProvider ? 'updated' : 'created')
            },
            { status: 200 }
        );

    } catch (error) {
        console.error('❌ Error en POST /api/catalog:', error);

        // Logging detallado del error
        if (error instanceof Error) {
            console.error('📋 Error detallado:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        }

        return NextResponse.json(
            {
                success: false,
                error: 'Error interno del servidor.',
                details: error instanceof Error ? error.message : 'Error desconocido',
                errorType: error instanceof Error ? error.name : typeof error
            },
            { status: 500 }
        );
    }
}

/**
 * GET /api/catalog
 * Obtiene el catálogo unificado con todos los precios de proveedores
 */
export async function GET() {
    try {
        const supabase = await createClient();

        // Query para obtener productos con sus precios de todos los proveedores
        const { data, error } = await supabase
            .from('products')
            .select(`
        id,
        name,
        ean,
        active_ingredient,
        provider_prices (
          price,
          provider_id,
          providers (
            name
          )
        )
      `)
            .order('name');

        if (error) {
            console.error('Error al obtener catálogo:', error);
            return NextResponse.json(
                { error: 'Error al obtener el catálogo.', details: error },
                { status: 500 }
            );
        }

        // Transformar los datos para un formato más amigable
        const catalog = data?.map((product) => {
            const providerPrices = product.provider_prices as unknown as Array<{
                price: number;
                provider_id: string;
                providers: { name: string } | { name: string }[];
            }>;

            return {
                id: product.id,
                name: product.name,
                ean: product.ean,
                activeIngredient: product.active_ingredient,
                prices: providerPrices?.map((pp) => {
                    const providerName = Array.isArray(pp.providers)
                        ? pp.providers[0]?.name
                        : pp.providers?.name;

                    return {
                        provider: providerName || 'Desconocido',
                        price: pp.price
                    };
                }) || []
            };
        }) || [];

        return NextResponse.json(
            {
                success: true,
                products: catalog,
                total: catalog.length
            },
            { status: 200 }
        );

    } catch (error) {
        console.error('Error en GET /api/catalog:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Error interno del servidor.',
                details: error instanceof Error ? error.message : 'Error desconocido'
            },
            { status: 500 }
        );
    }
}
