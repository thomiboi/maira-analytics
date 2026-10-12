-- CONSULTA DE PRUEBA RÁPIDA (archivo de testing)
-- Ejecuta esto primero para verificar que tienes datos

-- 1. Verificar si hay datos en las tablas
SELECT 
    'boletas' as tabla, 
    COUNT(*) as registros,
    MIN(fecha) as fecha_minima,
    MAX(fecha) as fecha_maxima
FROM boletas
UNION ALL
SELECT 
    'boletas_detalles' as tabla,
    COUNT(*) as registros,
    NULL as fecha_minima,
    NULL as fecha_maxima
FROM boletas_detalles
UNION ALL
SELECT 
    'boletas_pagos' as tabla,
    COUNT(*) as registros,
    NULL as fecha_minima,
    NULL as fecha_maxima
FROM boletas_pagos;

-- 2. Ver estructura de campos de la tabla boletas
SELECT 
    folio,
    fecha,
    rut,
    montototal,
    montoiva,
    tipodoc
FROM boletas 
ORDER BY fecha DESC 
LIMIT 5;

-- 3. Ver estructura de campos de boletas_detalles
SELECT 
    boleta_folio,
    nombre,
    cantidad,
    precio
FROM boletas_detalles 
LIMIT 5;

-- 4. Consulta de métricas básicas para últimos 30 días
WITH fecha_limite AS (
    SELECT CURRENT_DATE - INTERVAL '30 days' as inicio,
           CURRENT_DATE as fin
)
SELECT 
    COUNT(DISTINCT b.folio) as total_boletas,
    SUM(b.montototal) as ingresos_totales,
    SUM(b.montoiva) as total_iva,
    AVG(b.montototal) as ticket_promedio,
    COUNT(DISTINCT bd.nombre) as productos_unicos
FROM boletas b
LEFT JOIN boletas_detalles bd ON b.folio = bd.boleta_folio
CROSS JOIN fecha_limite fl
WHERE b.fecha >= fl.inicio 
  AND b.fecha <= fl.fin;
