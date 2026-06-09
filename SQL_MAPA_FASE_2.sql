-- ==========================================
-- ACTUALIZACIÓN PARA EL MAPA (FASE 2: RELIEVE Y GPS)
-- ==========================================

-- 1. Actualización a la tabla de Puntos
ALTER TABLE logistica_puntos_mina ADD COLUMN IF NOT EXISTS es_central BOOLEAN DEFAULT FALSE;
ALTER TABLE logistica_puntos_mina ADD COLUMN IF NOT EXISTS km_al_centro FLOAT DEFAULT 0;
ALTER TABLE logistica_puntos_mina ADD COLUMN IF NOT EXISTS tipo_relieve TEXT DEFAULT 'Plano';

-- 2. Actualización a la tabla de Asignaciones (Transporte Local)
ALTER TABLE logistica_local_asignaciones ADD COLUMN IF NOT EXISTS hora_salida TIME;
ALTER TABLE logistica_local_asignaciones ADD COLUMN IF NOT EXISTS hora_llegada TIME;
