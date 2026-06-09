-- Run this in Supabase SQL Editor
ALTER TABLE empleado_adscripciones ADD COLUMN IF NOT EXISTS es_jefe BOOLEAN DEFAULT FALSE;
