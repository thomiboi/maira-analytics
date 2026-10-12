// Script de prueba para verificar el estado de usuarios
// Ejecutar con: node testing/test-user-status.js

const testUserStatus = async () => {
  console.log('🧪 Probando sistema de habilitación/deshabilitación de usuarios\n');

  try {
    // 1. Verificar endpoint de check-status
    console.log('1️⃣ Probando endpoint /api/user/check-status...');
    const statusResponse = await fetch('http://localhost:3000/api/user/check-status');
    console.log('   Status:', statusResponse.status);
    const statusData = await statusResponse.json();
    console.log('   Respuesta:', statusData);

    // 2. Verificar endpoint de toggle-status (requiere autenticación)
    console.log('\n2️⃣ Para probar el toggle de estado:');
    console.log('   - Inicia sesión en http://localhost:3000/login');
    console.log('   - Ve a http://localhost:3000/dashboard/usuarios');
    console.log('   - Click en "Deshabilitar" en un usuario de prueba');
    console.log('   - Intenta iniciar sesión con ese usuario');
    console.log('   - Deberías ver el mensaje: "Tu cuenta ha sido deshabilitada"');

    console.log('\n✅ Script completado');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

testUserStatus();
