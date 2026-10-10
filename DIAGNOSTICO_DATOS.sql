-- DIAGNÓSTICO RÁPIDO DE DATOS
-- Ejecuta estas consultas en Supabase SQL Editor

-- 1. VERIFICAR SI HAY DATOS
SELECT 
    'TOTAL BOLETAS' as descripcion,
    COUNT(*) as cantidad
FROM boletas
UNION ALL
SELECT 
    'TOTAL DETALLES' as descripcion,
    COUNT(*) as cantidad  
FROM boletas_detalles
UNION ALL
SELECT 
    'TOTAL PAGOS' as descripcion,
    COUNT(*) as cantidad
FROM boletas_pagos;

-- 2. RANGO DE FECHAS DISPONIBLES
SELECT 
    MIN(fecha) as fecha_minima,
    MAX(fecha) as fecha_maxima,
    COUNT(DISTINCT fecha) as dias_unicos,
    COUNT(*) as total_boletas
FROM boletas;

-- 3. ÚLTIMAS 10 BOLETAS (para ver si hay datos recientes)
SELECT 
    folio,
    fecha,
    rut,
    montototal,
    tipodoc
FROM boletas 
ORDER BY fecha DESC, folio DESC 
LIMIT 10;

-- 4. DISTRIBUCIÓN POR AÑO/MES (para entender el período de datos)
SELECT 
    EXTRACT(YEAR FROM fecha) as año,
    EXTRACT(MONTH FROM fecha) as mes,
    COUNT(*) as total_boletas,
    SUM(montototal) as ingresos_mes
FROM boletas 
GROUP BY EXTRACT(YEAR FROM fecha), EXTRACT(MONTH FROM fecha)
ORDER BY año DESC, mes DESC
LIMIT 12;

-- 5. VERIFICAR DATOS EN LOS ÚLTIMOS 90 DÍAS
SELECT 
    DATE(fecha) as fecha,
    COUNT(*) as boletas_dia,
    SUM(montototal) as ingresos_dia
FROM boletas 
WHERE fecha >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(fecha)
ORDER BY fecha DESC
LIMIT 10;

-- 6. SI NO HAY DATOS RECIENTES, VER CUÁNDO FUE LA ÚLTIMA ACTIVIDAD
SELECT 
    fecha as ultima_boleta,
    COUNT(*) as boletas_ese_dia,
    SUM(montototal) as ingresos_ese_dia
FROM boletas 
WHERE fecha = (SELECT MAX(fecha) FROM boletas)
GROUP BY fecha;