-- =========================================================================
-- SCRIPT DE BASE DE DATOS - FIX DE TIPOS DE CHECADA RETORNOS
-- Ejecutar en el Editor SQL de Supabase
-- Proyecto: El Expediente (rh-system)
-- =========================================================================

-- INSERTAR NUEVOS TIPOS DE REGRESO PARA PERMISOS
INSERT INTO cat_tipos_checada (tipo, label, requiere_codigo, color, ordinal) 
VALUES
  ('REGRESO_PERMISO_PERSONAL', 'PERMISO REGRESO', false, 'bg-blue-500', 7),
  ('REGRESO_OPERACIONES', 'OP. REGRESO', false, 'bg-indigo-500', 8)
ON CONFLICT (tipo) DO UPDATE 
SET requiere_codigo = EXCLUDED.requiere_codigo, label = EXCLUDED.label;
