/**
 * Script de Prueba para Sistema de Notificaciones
 * 
 * Este script crea proveedores de prueba con diferentes antigüedades
 * para verificar el funcionamiento del sistema de notificaciones.
 * 
 * USO:
 * 1. Asegúrate de tener las variables de entorno configuradas (.env.local)
 * 2. Ejecuta: npx tsx test-notifications-system.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: Variables de entorno no configuradas');
    console.error('Asegúrate de tener NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface TestProvider {
    name: string;
    daysAgo: number;
    shouldNotify: boolean;
}

const testProviders: TestProvider[] = [
    // Proveedores QUE DEBEN aparecer en notificaciones (> 7 días)
    { name: 'Test - Proveedor Muy Antiguo', daysAgo: 30, shouldNotify: true },
    { name: 'Test - Proveedor Antiguo', daysAgo: 15, shouldNotify: true },
    { name: 'Test - Proveedor 8 días', daysAgo: 8, shouldNotify: true },

    // Proveedores que NO deben aparecer en notificaciones (<= 7 días)
    { name: 'Test - Proveedor 7 días exacto', daysAgo: 7, shouldNotify: false },
    { name: 'Test - Proveedor 5 días', daysAgo: 5, shouldNotify: false },
    { name: 'Test - Proveedor 2 días', daysAgo: 2, shouldNotify: false },
    { name: 'Test - Proveedor Nuevo', daysAgo: 0, shouldNotify: false },
];

async function crearProveedoresDePrueba() {
    console.log('🧪 Iniciando script de prueba...\n');

    // Limpiar proveedores de prueba anteriores
    console.log('🧹 Limpiando proveedores de prueba anteriores...');
    const { error: deleteError } = await supabase
        .from('providers')
        .delete()
        .like('name', 'Test -%');

    if (deleteError) {
        console.error('⚠️  Advertencia al limpiar:', deleteError.message);
    } else {
        console.log('✅ Proveedores de prueba anteriores eliminados\n');
    }

    // Crear proveedores con diferentes antigüedades
    console.log('📝 Creando proveedores de prueba...\n');

    for (const testProvider of testProviders) {
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - testProvider.daysAgo);

        const { error } = await supabase
            .from('providers')
            .insert({
                name: testProvider.name,
                created_at: createdAt.toISOString(),
            })
            .select()
            .single();

        if (error) {
            console.error(`❌ Error creando "${testProvider.name}":`, error.message);
        } else {
            const emoji = testProvider.shouldNotify ? '🔔' : '✨';
            const status = testProvider.shouldNotify ? 'DEBE NOTIFICAR' : 'No debe notificar';
            console.log(`${emoji} Creado: ${testProvider.name}`);
            console.log(`   📅 Fecha: ${createdAt.toLocaleDateString('es-CL')}`);
            console.log(`   ⏰ Hace: ${testProvider.daysAgo} días`);
            console.log(`   📊 Estado: ${status}\n`);
        }
    }

    // Verificar resultados
    console.log('🔍 Verificando resultados...\n');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: outdatedProviders, error: queryError } = await supabase
        .from('providers')
        .select('*')
        .like('name', 'Test -%')
        .lt('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

    if (queryError) {
        console.error('❌ Error consultando proveedores desactualizados:', queryError.message);
        return;
    }

    console.log('📊 RESULTADOS:');
    console.log('─'.repeat(60));
    console.log(`Total de proveedores de prueba creados: ${testProviders.length}`);
    console.log(`Proveedores que deben notificar (> 7 días): ${testProviders.filter(p => p.shouldNotify).length}`);
    console.log(`Proveedores encontrados por la query: ${outdatedProviders?.length || 0}`);
    console.log('─'.repeat(60));

    if (outdatedProviders && outdatedProviders.length > 0) {
        console.log('\n🔔 PROVEEDORES EN NOTIFICACIONES:\n');
        outdatedProviders.forEach((provider, index) => {
            const createdDate = new Date(provider.created_at);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - createdDate.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            console.log(`${index + 1}. ${provider.name}`);
            console.log(`   📅 Creado: ${createdDate.toLocaleDateString('es-CL')}`);
            console.log(`   ⏰ Hace: ${diffDays} días`);
            console.log(`   🆔 ID: ${provider.id}\n`);
        });
    }

    // Verificar endpoint API (requiere servidor corriendo)
    console.log('🌐 Para probar el endpoint API:\n');
    console.log('1. Asegúrate de que el servidor esté corriendo: npm run dev');
    console.log('2. Visita: http://localhost:3000/api/providers/outdated');
    console.log('3. Navega al dashboard y observa la campana de notificaciones 🔔\n');

    // Instrucciones para limpiar
    console.log('🧹 Para limpiar los datos de prueba:\n');
    console.log('Opción 1 - SQL en Supabase:');
    console.log("  DELETE FROM providers WHERE name LIKE 'Test -%';\n");
    console.log('Opción 2 - Volver a ejecutar este script (limpia automáticamente)\n');

    console.log('✅ Script de prueba completado exitosamente!');
}

// Ejecutar script
crearProveedoresDePrueba().catch((error) => {
    console.error('❌ Error ejecutando script:', error);
    process.exit(1);
});
