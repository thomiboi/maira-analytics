// Test script to verify time period filtering. Run with: node testing/test-time-periods.js

async function testTimePeriods() {
    const baseUrl = 'http://localhost:3000/api/pharmacy/dashboard';
    
    const periods = [
        { name: '7 días', days: 7 },
        { name: '14 días', days: 14 },
        { name: '30 días', days: 30 },
        { name: '60 días', days: 60 }
    ];
    
    console.log('🧪 Probando diferentes períodos de tiempo...\n');
    
    for (const period of periods) {
        try {
            console.log(`📅 Período: ${period.name}`);
            const response = await globalThis.fetch(`${baseUrl}?days=${period.days}`);
            const data = await response.json();
            
            if (data.topProducts && data.topProducts.length > 0) {
                console.log('Top 3 productos:');
                data.topProducts.slice(0, 3).forEach((product, index) => {
                    console.log(`  ${index + 1}. ${product.name}: ${Math.round(product.sales)} unidades`);
                });
            } else {
                console.log('  No hay productos en este período');
            }
            console.log('---');
        } catch (error) {
            console.error(`❌ Error en período ${period.name}:`, error.message);
        }
    }
}

testTimePeriods();
