import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * DELETE /api/providers/[id]
 * 
 * Elimina un proveedor de la base de datos.
 * Esta operación también eliminará automáticamente todos los precios asociados
 * gracias a la restricción ON DELETE CASCADE.
 * 
 * @param request - Request de Next.js
 * @param params - Parámetros de la ruta dinámica { id: string }
 * @returns Response JSON con el resultado de la operación
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 1️⃣ Crear cliente de Supabase con la sesión del usuario
        const supabase = await createClient();

        // 2️⃣ Verificar autenticación
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

        // 3️⃣ Obtener el ID del proveedor desde los parámetros (ahora es async)
        const { id: providerId } = await params;

        if (!providerId) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'ID de proveedor no proporcionado.'
                },
                { status: 400 }
            );
        }

        // 4️⃣ Verificar que el proveedor existe antes de eliminarlo
        const { data: existingProvider, error: fetchError } = await supabase
            .from('providers')
            .select('id, name')
            .eq('id', providerId)
            .single();

        if (fetchError || !existingProvider) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Proveedor no encontrado.'
                },
                { status: 404 }
            );
        }

        // 5️⃣ Obtener estadísticas antes de eliminar (opcional, para informar al usuario)
        const { count: pricesCount } = await supabase
            .from('provider_prices')
            .select('*', { count: 'exact', head: true })
            .eq('provider_id', providerId);

        // 6️⃣ Eliminar el proveedor (esto también eliminará todos los precios asociados por CASCADE)
        const { error: deleteError } = await supabase
            .from('providers')
            .delete()
            .eq('id', providerId);

        if (deleteError) {
            console.error('❌ Error al eliminar proveedor:', deleteError);
            return NextResponse.json(
                {
                    success: false,
                    error: 'Error al eliminar el proveedor de la base de datos.',
                    details: deleteError.message
                },
                { status: 500 }
            );
        }

        // 7️⃣ Éxito: devolver respuesta con información adicional
        console.log(`✅ Proveedor eliminado: ${existingProvider.name} (${providerId})`);
        console.log(`   Precios asociados eliminados: ${pricesCount || 0}`);

        return NextResponse.json(
            {
                success: true,
                message: 'Proveedor eliminado exitosamente.',
                deletedProvider: {
                    id: existingProvider.id,
                    name: existingProvider.name,
                },
                stats: {
                    pricesDeleted: pricesCount || 0,
                },
            },
            { status: 200 }
        );

    } catch (error) {
        console.error('❌ Error inesperado al eliminar proveedor:', error);

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
 * GET /api/providers/[id]
 * 
 * Obtiene información detallada de un proveedor específico.
 * Incluye estadísticas de productos y precios.
 * 
 * @param request - Request de Next.js
 * @param params - Parámetros de la ruta dinámica { id: string }
 * @returns Response JSON con los datos del proveedor
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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
                    error: 'No autenticado.'
                },
                { status: 401 }
            );
        }

        // Obtener el ID del proveedor desde los parámetros (ahora es async)
        const { id: providerId } = await params;

        // Obtener datos del proveedor
        const { data: provider, error: providerError } = await supabase
            .from('providers')
            .select('*')
            .eq('id', providerId)
            .single();

        if (providerError || !provider) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Proveedor no encontrado.'
                },
                { status: 404 }
            );
        }

        // Obtener estadísticas
        const { count: productsCount } = await supabase
            .from('provider_prices')
            .select('product_id', { count: 'exact', head: true })
            .eq('provider_id', providerId);

        const { data: avgPrice } = await supabase
            .from('provider_prices')
            .select('price')
            .eq('provider_id', providerId);

        const averagePrice = avgPrice && avgPrice.length > 0
            ? avgPrice.reduce((sum: number, item: { price: number }) => sum + Number(item.price), 0) / avgPrice.length
            : 0;

        return NextResponse.json({
            success: true,
            provider,
            stats: {
                productsCount: productsCount || 0,
                averagePrice: averagePrice.toFixed(2),
            },
        });

    } catch (error) {
        console.error('❌ Error al obtener proveedor:', error);

        return NextResponse.json(
            {
                success: false,
                error: 'Error interno del servidor.'
            },
            { status: 500 }
        );
    }
}
