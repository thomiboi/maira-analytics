import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/providers/outdated
 * 
 * Obtiene la lista de proveedores con más de 7 días desde su registro.
 * Estos proveedores podrían necesitar actualización de sus catálogos.
 * 
 * @returns Response JSON con la lista de proveedores desactualizados
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

        // Calcular la fecha de hace 7 días
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Obtener proveedores registrados hace más de 7 días
        const { data: providers, error: providersError } = await supabase
            .from('providers')
            .select('id, name, created_at')
            .lt('created_at', sevenDaysAgo.toISOString())
            .order('created_at', { ascending: true });

        if (providersError) {
            console.error('❌ Error al obtener proveedores desactualizados:', providersError);
            return NextResponse.json(
                {
                    success: false,
                    error: 'Error al obtener proveedores desactualizados.',
                    details: providersError.message
                },
                { status: 500 }
            );
        }

        // Calcular días desde el registro para cada proveedor
        const providersWithDays = (providers || []).map((provider) => {
            const createdDate = new Date(provider.created_at);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - createdDate.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            return {
                ...provider,
                daysOld: diffDays,
            };
        });

        return NextResponse.json({
            success: true,
            providers: providersWithDays,
            total: providersWithDays.length,
        });

    } catch (error) {
        console.error('❌ Error al obtener proveedores desactualizados:', error);

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
