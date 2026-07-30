-- =========================================================================
-- MIGRACIÓN: Agregar columna observaciones a transporte_personal_solicitudes
-- Necesaria para la funcionalidad "Viajar por mi cuenta"
-- =========================================================================

ALTER TABLE transporte_personal_solicitudes
ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- Comentario descriptivo de la columna
COMMENT ON COLUMN transporte_personal_solicitudes.observaciones 
IS 'Notas opcionales del solicitante, ej: fecha de regreso o motivo del viaje independiente';
