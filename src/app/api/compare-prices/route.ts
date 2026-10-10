// API Route: GET /api/compare-prices
// Obtiene todos los productos con sus precios de todos los proveedores
// Transforma los datos de formato "largo" a formato "pivote/ancho"

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 📊 Tipo para el precio de un proveedor (resultado de la consulta)
 */
interface ProviderPriceRow {
    price: number;
    products: {
        id: string;
        name: string;
        ean: string | null;
    } | null;
    providers: {
        id: string;
        name: string;
        created_at: string;
    } | null;
}

/**
 * 🗄️ Tipo para el producto unificado (formato pivote)
 */
interface UnifiedProduct {
    productId: string;
    productName: string;
    ean: string | null;
    prices: Record<string, number>; // { "MEDIVEN": 1500, "Ethon": 1450 }
}

/**
 * 📋 Tipo para la respuesta final de la API
 */
interface CompareResponse {
    providerNames: string[];
    productsData: UnifiedProduct[];
}

/**
 * GET /api/compare-prices
 * Obtiene productos con precios de todos los proveedores en formato pivote
 */
export async function GET() {
    try {
        console.log('📊 Iniciando consulta de comparación de precios...');
        const startTime = Date.now();

        // 1️⃣ Crear cliente de Supabase
        const supabase = await createClient();

        // 2️⃣ Consultar provider_prices con JOIN implícito a products y providers
        console.log('🔍 Consultando precios con JOIN...');
        const { data: priceRows, error: pricesError } = await supabase
            .from('provider_prices')
            .select('price, products (id, name, ean), providers (id, name)')
            .order('products(name)'); // Ordenar por nombre de producto

        if (pricesError) {
            console.error('❌ Error al consultar precios:', pricesError);
            return NextResponse.json(
                { error: 'Error al consultar precios.', details: pricesError },
                { status: 500 }
            );
        }

        if (!priceRows || priceRows.length === 0) {
            console.log('⚠️ No hay precios en la base de datos');
            return NextResponse.json(
                {
                    providerNames: [],
                    productsData: []
                } as CompareResponse,
                { status: 200 }
            );
        }

        console.log(`✅ Obtenidos ${priceRows.length} registros de precios`);

        // 3️⃣ Transformar datos: de formato "largo" a formato "pivote"
        console.log('🔄 Transformando datos a formato pivote...');

        // Map para almacenar productos unificados
        // Clave: productId, Valor: UnifiedProduct
        const productsMap = new Map<string, UnifiedProduct>();

        // Iterar sobre cada registro de precio
        for (const row of priceRows as unknown as ProviderPriceRow[]) {
            // Validar que los datos relacionados existen
            if (!row.products || !row.providers) {
                console.warn('⚠️ Registro sin producto o proveedor:', row);
                continue;
            }

            const { id: productId, name: productName, ean } = row.products;
            const { name: providerName } = row.providers;
            const price = row.price;

            // Si el producto no está en el mapa, agregarlo
            if (!productsMap.has(productId)) {
                productsMap.set(productId, {
                    productId,
                    productName,
                    ean,
                    prices: {}
                });
            }

            // Obtener el producto del mapa y agregar el precio del proveedor
            const existingProduct = productsMap.get(productId)!;
            existingProduct.prices[providerName] = price;
        }

        console.log(`✅ ${productsMap.size} productos únicos encontrados`);

        // 4️⃣ Obtener lista de todos los proveedores
        console.log('🔍 Consultando proveedores...');
        const { data: providers, error: providersError } = await supabase
            .from('providers')
            .select('name')
            .order('name');

        if (providersError) {
            console.error('❌ Error al consultar proveedores:', providersError);
            return NextResponse.json(
                { error: 'Error al consultar proveedores.', details: providersError },
                { status: 500 }
            );
        }

        const providerNames = providers?.map(p => p.name) || [];
        console.log(`✅ ${providerNames.length} proveedores encontrados:`, providerNames);

        // 5️⃣ Convertir el Map a arreglo
        const productsData: UnifiedProduct[] = Array.from(productsMap.values());

        // 6️⃣ Ordenar productos por nombre (alfabéticamente)
        productsData.sort((a, b) => a.productName.localeCompare(b.productName));

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log(`✅ Comparación completada en ${duration}s`);
        console.log(`📊 Estadísticas:`);
        console.log(`   - ${productsData.length} productos`);
        console.log(`   - ${providerNames.length} proveedores`);
        console.log(`   - ${priceRows.length} precios totales`);

        // 7️⃣ Respuesta final en formato pivote
        const response: CompareResponse = {
            providerNames,
            productsData
        };

        return NextResponse.json(response, { status: 200 });

    } catch (error) {
        console.error('❌ Error en GET /api/compare-prices:', error);

        return NextResponse.json(
            {
                error: 'Error interno del servidor.',
                details: error instanceof Error ? error.message : 'Error desconocido'
            },
            { status: 500 }
        );
    }
}
