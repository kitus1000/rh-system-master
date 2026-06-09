-- 1. Renombrar la columna fecha a fecha_inicio en la tabla logistica_local_asignaciones
ALTER TABLE logistica_local_asignaciones
RENAME COLUMN fecha TO fecha_inicio;

-- 2. Agregar la nueva columna fecha_fin
ALTER TABLE logistica_local_asignaciones
ADD COLUMN fecha_fin DATE;

-- 3. Actualizar todos los registros existentes para que su fecha de fin sea la misma que la fecha de inicio
UPDATE logistica_local_asignaciones
SET fecha_fin = fecha_inicio
WHERE fecha_fin IS NULL;

-- 4. Opcionalmente (recomendado), establecer fecha_fin como no nula ahora que tiene datos
ALTER TABLE logistica_local_asignaciones
ALTER COLUMN fecha_fin SET NOT NULL;
