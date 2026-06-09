-- =========================================================================
-- SCRIPT DE MIGRACIÓN - AÑADIR TOLERANCIA A TIPOS DE CHECADA Y ESTATUS COMPLETADO
-- Proyecto: El Expediente (rh-system)
-- =========================================================================

-- 1. Añadimos la columna para configurar tolerancia en retornos (en minutos). Ej: 5 min, 10 min.
ALTER TABLE cat_tipos_checada 
ADD COLUMN IF NOT EXISTS tolerancia_retorno_min INT DEFAULT 5;

-- 2. Aseguramos que los tipos que son de SALIDA (que requieren retorno) tengan al menos una configuración inicial.
UPDATE cat_tipos_checada 
SET tolerancia_retorno_min = 5 
WHERE tipo IN ('PERMISO_PERSONAL', 'SALIDA_OPERACIONES');

-- Nota: El estatus "Completado" no requiere DDL ya que en Supabase la columna 'estatus' de permisos_autorizados
-- probablemente es de tipo TEXT o VARCHAR, por lo que acepta libremente 'Completado'.
-- (Si es un ENUM, habría que hacer un ALTER TYPE, pero por tu estructura asumo que es TEXT).
