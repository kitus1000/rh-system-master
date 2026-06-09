ALTER TABLE logistica_reportes_diarios 
ADD COLUMN IF NOT EXISTS gasolina_inicio VARCHAR(50),
ADD COLUMN IF NOT EXISTS gasolina_fin VARCHAR(50),
ADD COLUMN IF NOT EXISTS litros_cargados NUMERIC,
ADD COLUMN IF NOT EXISTS firma_rh_nombre VARCHAR(255);
