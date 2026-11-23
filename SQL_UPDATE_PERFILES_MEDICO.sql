-- ==============================================================================
-- ACTUALIZACIÓN DE ESQUEMA: CAMPOS MÉDICOS Y COFEPRIS EN TABLA PERFILES
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- ==============================================================================

-- 1. Agregar columnas requeridas por COFEPRIS y perfil de doctores a la tabla perfiles
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS institucion_titulo TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS cedula_profesional TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS especialidad TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS firma TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS apodo TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS id_clinica UUID;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS es_dr_principal BOOLEAN DEFAULT FALSE;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS telefono_consultorio TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS domicilio_consultorio TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS titulo_consultorio TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS categoria_emisor TEXT;

-- 2. Recargar la caché del esquema de PostgREST para que Supabase reconozca las nuevas columnas inmediatamente
NOTIFY pgrst, 'reload schema';
