-- Add medical profile columns to perfiles table
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS cedula_profesional TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS universidad TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS especialidad TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS domicilio_consultorio TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS telefono_consultorio TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS firma TEXT; -- Storing base64 drawn signatures

-- Add optional custom columns to pases_medicos table
ALTER TABLE pases_medicos ADD COLUMN IF NOT EXISTS antiguedad TEXT;

-- Add companion column to pacientes table
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS acompanante TEXT;

-- Add dosis column to dispensacion_medicamentos table to store custom prescription dosages
ALTER TABLE dispensacion_medicamentos ADD COLUMN IF NOT EXISTS dosis TEXT;
