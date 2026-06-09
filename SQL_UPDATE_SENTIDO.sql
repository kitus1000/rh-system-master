-- ==========================================
-- ACTUALIZACIÓN PARA SENTIDO DE RUTA (IDA/VUELTA)
-- ==========================================

ALTER TABLE logistica_local_asignaciones ADD COLUMN IF NOT EXISTS sentido TEXT DEFAULT 'Ida';
