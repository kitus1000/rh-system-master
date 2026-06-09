-- 1. Asegurar que la tabla de viajes exista
CREATE TABLE IF NOT EXISTS logistica_viajes_programados (
    id_viaje UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empleado UUID REFERENCES empleados(id_empleado) ON DELETE CASCADE,
    destino VARCHAR(255) NOT NULL,
    fecha_esperada DATE NOT NULL,
    hora_esperada TIME NOT NULL,
    estado VARCHAR(50) DEFAULT 'Programado',
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE logistica_viajes_programados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a logistica_viajes_programados" ON logistica_viajes_programados;
CREATE POLICY "Permitir todo a logistica_viajes_programados" ON logistica_viajes_programados FOR ALL USING (true);

-- 2. Asegurar que TODAS las columnas existan en los reportes
ALTER TABLE logistica_reportes_diarios 
ADD COLUMN IF NOT EXISTS id_viaje UUID REFERENCES logistica_viajes_programados(id_viaje) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS gasolina_inicio VARCHAR(50),
ADD COLUMN IF NOT EXISTS gasolina_fin VARCHAR(50),
ADD COLUMN IF NOT EXISTS litros_cargados NUMERIC,
ADD COLUMN IF NOT EXISTS firma_rh_nombre VARCHAR(255);

-- 3. Forzar a Supabase a refrescar su memoria caché
NOTIFY pgrst, 'reload schema';
