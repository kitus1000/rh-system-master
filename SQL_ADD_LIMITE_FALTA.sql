-- Agregar columna limite_falta_min a la tabla turnos
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS limite_falta_min INT NOT NULL DEFAULT 60;
