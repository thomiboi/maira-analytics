# Scripts de pruebas y diagnóstico

Estos archivos son comprobaciones manuales/adhoc; el proyecto no configura un framework de pruebas automatizadas ni un comando `npm test`.

| Archivo | Propósito |
| --- | --- |
| `test-user-status.js` | Comprueba el flujo de estado de usuarios y documenta una prueba manual del panel. |
| `test-time-periods.js` | Consulta el dashboard de farmacia con distintos períodos. |
| `test-singleton.js` | Smoke test de `dashboardFetchManager`. |
| `test-notifications-system.ts` | Crea y elimina proveedores `Test -...` para comprobar antigüedad y notificaciones. Modifica la base configurada; úsalo solo con datos de desarrollo. |
| `validate-units.js` | Inspecciona y compara agregaciones de unidades vendidas. |
| `validate-products.js` | Cuenta y muestra nombres de productos únicos desde datos de ventas. |
| `DIAGNOSTICO_DATOS.sql` | Consultas de diagnóstico sobre boletas, detalles, pagos y períodos disponibles. |
| `CONSULTA_PRUEBA.sql` | Consultas de prueba para revisar tablas y métricas de ventas. |

Los scripts que consultan Supabase requieren variables de entorno válidas. Ejecuta las consultas SQL únicamente en una base de desarrollo o lectura segura.
