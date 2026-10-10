-- Consultas SQL para Dashboard de Farmacia
-- Basadas en las tablas: boletas, boletas_detalles, boletas_pagos
-- Estructura actualizada con folio como PK

-- =============================================================================
-- 1. MÉTRICAS GENERALES DEL DASHBOARD
-- =============================================================================

-- Estadísticas totales por período
-- Retorna: total_boletas, ingresos_totales, total_iva, ticket_promedio, productos_unicos
SELECT 
    COUNT(DISTINCT b.folio) as total_boletas,
    COALESCE(SUM(b.montototal), 0) as ingresos_totales,
    COALESCE(SUM(b.montoiva), 0) as total_iva,
    CASE 
        WHEN COUNT(DISTINCT b.folio) > 0 
        THEN COALESCE(SUM(b.montototal), 0) / COUNT(DISTINCT b.folio)
        ELSE 0 
    END as ticket_promedio,
    COUNT(DISTINCT bd.nombre) as productos_unicos
FROM boletas b
LEFT JOIN boletas_detalles bd ON b.folio = bd.boleta_folio
WHERE b.fecha >= $1 
  AND b.fecha <= $2
;

-- =============================================================================
-- 2. EVOLUCIÓN TEMPORAL DE VENTAS
-- =============================================================================

-- Tendencias diarias de ventas e ingresos
-- Retorna: fecha, total_boletas, ingresos_diarios
SELECT 
    b.fecha::date as fecha,
    COUNT(DISTINCT b.folio) as total_boletas,
    COALESCE(SUM(b.montototal), 0) as ingresos_diarios
FROM boletas b
WHERE b.fecha >= $1 
  AND b.fecha <= $2
GROUP BY b.fecha::date
ORDER BY b.fecha::date
;

-- =============================================================================
-- 3. PRODUCTOS MÁS VENDIDOS
-- =============================================================================

-- Top productos por cantidad vendida
-- Retorna: nombre_producto, categoria_estimada, cantidad_total, ingresos_producto, numero_boletas
SELECT 
    bd.nombre as nombre_producto,
    SPLIT_PART(bd.nombre, ' ', 1) as categoria_estimada,
    SUM(bd.cantidad) as cantidad_total,
    SUM(bd.cantidad * bd.precio) as ingresos_producto,
    COUNT(DISTINCT bd.boleta_folio) as numero_boletas
FROM boletas_detalles bd
INNER JOIN boletas b ON bd.boleta_folio = b.folio
WHERE b.fecha >= $1 
  AND b.fecha <= $2
GROUP BY bd.nombre
ORDER BY cantidad_total DESC
LIMIT 20
;

-- Variación de productos (comparando con período anterior)
-- Retorna: nombre_producto, categoria_estimada, cantidad_actual, cantidad_anterior, cambio_porcentual
WITH periodo_actual AS (
    SELECT 
        bd.nombre,
        SUM(bd.cantidad) as cantidad_actual
    FROM boletas_detalles bd
    INNER JOIN boletas b ON bd.boleta_folio = b.folio
    WHERE b.fecha >= $1 AND b.fecha <= $2
    GROUP BY bd.nombre
),
periodo_anterior AS (
    SELECT 
        bd.nombre,
        SUM(bd.cantidad) as cantidad_anterior
    FROM boletas_detalles bd
    INNER JOIN boletas b ON bd.boleta_folio = b.folio
    WHERE b.fecha >= ($1::date - ($2::date - $1::date)) 
      AND b.fecha < $1
    GROUP BY bd.nombre
)
SELECT 
    pa.nombre as nombre_producto,
    SPLIT_PART(pa.nombre, ' ', 1) as categoria_estimada,
    COALESCE(pa.cantidad_actual, 0) as cantidad_actual,
    COALESCE(ant.cantidad_anterior, 0) as cantidad_anterior,
    CASE 
        WHEN COALESCE(ant.cantidad_anterior, 0) > 0 
        THEN ((COALESCE(pa.cantidad_actual, 0) - COALESCE(ant.cantidad_anterior, 0)) * 100.0 / ant.cantidad_anterior)
        ELSE 0 
    END as cambio_porcentual
FROM periodo_actual pa
LEFT JOIN periodo_anterior ant ON pa.nombre = ant.nombre
ORDER BY pa.cantidad_actual DESC
LIMIT 20
;

-- =============================================================================
-- 4. ANÁLISIS POR CATEGORÍAS
-- =============================================================================

-- Ventas por categoría de productos (estimada desde nombre)
-- Retorna: categoria_estimada, total_productos, cantidad_vendida, ingresos_categoria, participacion_porcentual
WITH totales AS (
    SELECT SUM(bd.cantidad) as total_general
    FROM boletas_detalles bd
    INNER JOIN boletas b ON bd.boleta_folio = b.folio
    WHERE b.fecha >= $1 AND b.fecha <= $2
)
SELECT 
    SPLIT_PART(bd.nombre, ' ', 1) as categoria_estimada,
    COUNT(DISTINCT bd.nombre) as total_productos,
    SUM(bd.cantidad) as cantidad_vendida,
    SUM(bd.cantidad * bd.precio) as ingresos_categoria,
    CASE 
        WHEN t.total_general > 0 
        THEN (SUM(bd.cantidad) * 100.0 / t.total_general)
        ELSE 0 
    END as participacion_porcentual
FROM boletas_detalles bd
INNER JOIN boletas b ON bd.boleta_folio = b.folio
CROSS JOIN totales t
WHERE b.fecha >= $1 
  AND b.fecha <= $2
GROUP BY SPLIT_PART(bd.nombre, ' ', 1), t.total_general
ORDER BY cantidad_vendida DESC
;

-- =============================================================================
-- 5. ANÁLISIS DE CLIENTES
-- =============================================================================

-- Top clientes por número de boletas y monto total
-- Retorna: rut_cliente, total_boletas, monto_total, ticket_promedio, ultima_compra
SELECT 
    b.rut,
    COUNT(DISTINCT b.boleta_folio) as total_boletas,
    SUM(b.montototal) as monto_total,
    AVG(b.montototal) as ticket_promedio,
    MAX(b.fecha) as ultima_compra
FROM boletas b
WHERE b.fecha >= $1 
  AND b.fecha <= $2
  AND b.rut IS NOT NULL
GROUP BY b.rut
ORDER BY monto_total DESC
LIMIT 20
;

-- =============================================================================
-- 6. MEDIOS DE PAGO
-- =============================================================================

-- Análisis de medios de pago más utilizados
-- Retorna: medio_pago, total_transacciones, monto_total, participacion_porcentual
WITH totales AS (
    SELECT 
        COUNT(*) as transacciones_totales,
        SUM(bp.monto) as monto_total_general
    FROM boletas_pagos bp
    INNER JOIN boletas b ON bp.boleta_folio = b.folio
    WHERE b.fecha >= $1 AND b.fecha <= $2
)
SELECT 
    bp.mediopago as medio_pago,
    COUNT(*) as total_transacciones,
    SUM(bp.monto) as monto_total,
    CASE 
        WHEN t.transacciones_totales > 0 
        THEN (COUNT(*) * 100.0 / t.transacciones_totales)
        ELSE 0 
    END as participacion_transacciones,
    CASE 
        WHEN t.monto_total_general > 0 
        THEN (SUM(bp.monto) * 100.0 / t.monto_total_general)
        ELSE 0 
    END as participacion_monto
FROM boletas_pagos bp
INNER JOIN boletas b ON bp.boleta_folio = b.folio
CROSS JOIN totales t
WHERE b.fecha >= $1 
  AND b.fecha <= $2
GROUP BY bp.mediopago, t.transacciones_totales, t.monto_total_general
ORDER BY monto_total DESC
;

-- =============================================================================
-- 7. BOLETAS RECIENTES
-- =============================================================================

-- Últimas boletas emitidas con detalles del cliente y productos
-- Retorna: folio, rut, fecha, total_productos, monto_total, tipo_documento
SELECT 
    b.folio,
    b.rut,
    b.fecha,
    COUNT(bd.nombre) as total_productos,
    b.montototal as monto_total,
    COALESCE(b.tipodoc, 'regular') as tipo_documento
FROM boletas b
LEFT JOIN boletas_detalles bd ON b.folio = bd.boleta_folio
WHERE b.fecha >= $1 
  AND b.fecha <= $2
GROUP BY b.folio, b.rut, b.fecha, b.montototal, b.tipodoc
ORDER BY b.fecha DESC, b.folio DESC
LIMIT 20
;

-- =============================================================================
-- 8. MÉTRICAS DE RENDIMIENTO (KPIS)
-- =============================================================================

-- Análisis de rendimiento por hora del día
-- Retorna: hora, total_boletas, ingresos_hora, ticket_promedio_hora
SELECT 
    EXTRACT(hour FROM b.fecha) as hora,
    COUNT(DISTINCT b.boleta_folio) as total_boletas,
    SUM(b.montototal) as ingresos_hora,
    AVG(b.montototal) as ticket_promedio_hora
FROM boletas b
WHERE b.fecha >= $1 
  AND b.fecha <= $2
GROUP BY EXTRACT(hour FROM b.fecha)
ORDER BY hora
;

-- Productos con stock crítico (asumiendo campo stock en boletas_detalles)
-- Retorna: nombre_producto, categoria, ventas_recientes, stock_actual
SELECT 
    bd.nombre as nombre_producto,
    bd.categoria,
    SUM(bd.cantidad) as ventas_recientes
    -- Descomentar si existe campo stock:
    -- bd.stock_actual
FROM boletas_detalles bd
INNER JOIN boletas b ON bd.boleta_folio = b.boleta_folio
WHERE b.fecha >= $1 
  AND b.fecha <= $2
GROUP BY bd.nombre, bd.categoria
-- Descomentar para filtrar productos con stock bajo:
-- HAVING bd.stock_actual < (SUM(bd.cantidad) / 7) -- stock menor a ventas promedio semanal
ORDER BY ventas_recientes DESC
;

-- =============================================================================
-- 9. CONSULTA CONSOLIDADA PARA DASHBOARD
-- =============================================================================

-- Consulta principal que combina todas las métricas esenciales
WITH metricas_generales AS (
    SELECT 
        COUNT(DISTINCT b.boleta_folio) as total_boletas,
        COALESCE(SUM(b.montototal), 0) as ingresos_totales,
        COALESCE(SUM(b.montoiva), 0) as total_iva,
        COUNT(DISTINCT bd.nombre) as productos_unicos,
        COUNT(DISTINCT b.rut) as clientes_unicos
    FROM boletas b
    LEFT JOIN boletas_detalles bd ON b.boleta_folio = bd.boleta_folio
    WHERE b.fecha >= $1 AND b.fecha <= $2
),
top_productos AS (
    SELECT 
        bd.nombre,
        bd.categoria,
        SUM(bd.cantidad) as cantidad,
        SUM(bd.cantidad * bd.precio_unitario) as ingresos
    FROM boletas_detalles bd
    INNER JOIN boletas b ON bd.boleta_folio = b.boleta_folio
    WHERE b.fecha >= $1 AND b.fecha <= $2
    GROUP BY bd.nombre, bd.categoria
    ORDER BY cantidad DESC
    LIMIT 5
),
top_categorias AS (
    SELECT 
        COALESCE(bd.categoria, 'Sin categoría') as categoria,
        SUM(bd.cantidad) as cantidad
    FROM boletas_detalles bd
    INNER JOIN boletas b ON bd.boleta_folio = b.boleta_folio
    WHERE b.fecha >= $1 AND b.fecha <= $2
    GROUP BY bd.categoria
    ORDER BY cantidad DESC
    LIMIT 5
)
SELECT 
    'metricas' as tipo,
    json_build_object(
        'total_boletas', mg.total_boletas,
        'ingresos_totales', mg.ingresos_totales,
        'total_iva', mg.total_iva,
        'productos_unicos', mg.productos_unicos,
        'clientes_unicos', mg.clientes_unicos,
        'ticket_promedio', CASE WHEN mg.total_boletas > 0 THEN mg.ingresos_totales / mg.total_boletas ELSE 0 END
    ) as datos
FROM metricas_generales mg

UNION ALL

SELECT 
    'productos' as tipo,
    json_agg(
        json_build_object(
            'nombre', tp.nombre,
            'categoria', tp.categoria,
            'cantidad', tp.cantidad,
            'ingresos', tp.ingresos
        )
    ) as datos
FROM top_productos tp

UNION ALL

SELECT 
    'categorias' as tipo,
    json_agg(
        json_build_object(
            'categoria', tc.categoria,
            'cantidad', tc.cantidad
        )
    ) as datos
FROM top_categorias tc
;