-- ✅ SCRIPT SEGURO: Agregar columna is_active a la tabla users
-- Este script NO borra datos, solo agrega una columna

-- 1. Agregar columna is_active si no existe
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Actualizar usuarios existentes a activos (por si acaso)
UPDATE users 
SET is_active = true 
WHERE is_active IS NULL;

-- 3. Verificar que se agregó correctamente
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name = 'is_active';

-- 4. Ver todos los usuarios con su estado
SELECT id, email, is_active, created_at 
FROM users 
ORDER BY created_at DESC;
