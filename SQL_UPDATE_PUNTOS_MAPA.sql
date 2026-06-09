-- ==========================================
-- ACTUALIZACIÓN PARA EL MAPA INTERACTIVO
-- ==========================================

-- Agregar coordenadas X e Y a los puntos de la mina para poder guardarlos en el mapa visual
ALTER TABLE logistica_puntos_mina ADD COLUMN IF NOT EXISTS posicion_x FLOAT DEFAULT 0;
ALTER TABLE logistica_puntos_mina ADD COLUMN IF NOT EXISTS posicion_y FLOAT DEFAULT 0;
