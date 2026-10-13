# Scripts de mantenimiento y corrección

Esta carpeta reúne scripts puntuales de diagnóstico, sincronización y corrección que no forman parte del flujo normal de la aplicación.

| Archivo | Propósito |
| --- | --- |
| `check-users.ts` | Muestra usuarios, roles y estados en la base de datos. Ejecuta con `npm run check:users`. |
| `compare-users.ts` | Compara usuarios de Supabase Auth con los registros de Prisma. |
| `sync-user-ids.ts` | Sincroniza usuarios y sus IDs entre Supabase Auth y Prisma. Ejecuta con `npm run sync:users`; modifica la base de datos. |
| `add_is_active_column.sql` | Agrega y verifica la columna `is_active` en `users`. |
| `fix-prisma.bat` | Detiene procesos Node, limpia el cliente Prisma local y lo regenera. |

Los scripts que consultan o modifican datos requieren variables de entorno válidas. Revisa su contenido antes de ejecutarlos y usa una base de desarrollo para las operaciones que escriben datos.
