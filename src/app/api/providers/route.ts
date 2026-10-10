import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/providers
 * 
 * Obtiene la lista completa de proveedores con sus estadísticas.
 * 
 * @returns Response JSON con la lista de proveedores
 */
export async function GET() {
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
                    error: 'No autenticado. Por favor, inicia sesión.'
                },
                { status: 401 }
            );
        }

        // Obtener todos los proveedores
        const { data: providers, error: providersError } = await supabase
            .from('providers')
            .select('*')
            .order('name', { ascending: true });

        if (providersError) {
            console.error('❌ Error al obtener proveedores:', providersError);
            return NextResponse.json(
                {
                    success: false,
                    error: 'Error al obtener proveedores de la base de datos.',
                    details: providersError.message
                },
                { status: 500 }
            );
        }

        // Obtener estadísticas para cada proveedor
        const providersWithStats = await Promise.all(
            (providers || []).map(async (provider) => {
                // Contar productos únicos
                const { count: productsCount } = await supabase
                    .from('provider_prices')
                    .select('product_id', { count: 'exact', head: true })
                    .eq('provider_id', provider.id);

                // Obtener precio promedio
                const { data: prices } = await supabase
                    .from('provider_prices')
                    .select('price')
                    .eq('provider_id', provider.id);

                let averagePrice = 0;
                let minPrice = 0;
                let maxPrice = 0;

                if (prices && prices.length > 0) {
                    const priceValues = prices.map((p: { price: number }) => Number(p.price));
                    averagePrice = priceValues.reduce((sum: number, price: number) => sum + price, 0) / priceValues.length;
                    minPrice = Math.min(...priceValues);
                    maxPrice = Math.max(...priceValues);
                }

                return {
                    ...provider,
                    stats: {
                        productsCount: productsCount || 0,
                        averagePrice: Number(averagePrice.toFixed(2)),
                        minPrice: Number(minPrice.toFixed(2)),
                        maxPrice: Number(maxPrice.toFixed(2)),
                    },
                };
            })
        );

        return NextResponse.json({
            success: true,
            providers: providersWithStats,
            total: providersWithStats.length,
        });

    } catch (error) {
        console.error('❌ Error al listar proveedores:', error);

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

/**
 * POST /api/providers
 * 
 * Crea un nuevo proveedor en la base de datos.
 * 
 * @param request - Request con el body { name: string }
 * @returns Response JSON con el proveedor creado
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
                    error: 'No autenticado. Por favor, inicia sesión.'
                },
                { status: 401 }
            );
        }

        // Obtener datos del body
        const body = await request.json();
        const { name } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Nombre de proveedor requerido y debe ser un string válido.'
                },
                { status: 400 }
            );
        }

        // Verificar que no exista un proveedor con ese nombre
        const { data: existingProvider } = await supabase
            .from('providers')
            .select('id, name')
            .eq('name', name.trim())
            .single();

        if (existingProvider) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Ya existe un proveedor con ese nombre.'
                },
                { status: 409 }
            );
        }

        // Crear el proveedor
        const { data: newProvider, error: insertError } = await supabase
            .from('providers')
            .insert({ name: name.trim() })
            .select()
            .single();

        if (insertError) {
            console.error('❌ Error al crear proveedor:', insertError);
            return NextResponse.json(
                {
                    success: false,
                    error: 'Error al crear el proveedor.',
                    details: insertError.message
                },
                { status: 500 }
            );
        }

        console.log(`✅ Proveedor creado: ${newProvider.name} (${newProvider.id})`);

        return NextResponse.json(
            {
                success: true,
                message: 'Proveedor creado exitosamente.',
                provider: newProvider,
            },
            { status: 201 }
        );

    } catch (error) {
        console.error('❌ Error al crear proveedor:', error);

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
