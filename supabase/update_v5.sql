-- supabase/update_v5.sql
-- Tablas para Registro de Horas Extras y Festivos en Pre-Nómina

CREATE TABLE IF NOT EXISTS empleado_horas_extras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empleado UUID REFERENCES empleados(id_empleado) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    cantidad_horas DECIMAL(4,2) NOT NULL CHECK (cantidad_horas > 0),
    motivo TEXT,
    creado_el TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS empleado_festivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empleado UUID REFERENCES empleados(id_empleado) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    creado_el TIMESTAMPTZ DEFAULT now(),
    UNIQUE(id_empleado, fecha)
);

ALTER TABLE empleado_horas_extras ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleado_festivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura horas extras" ON empleado_horas_extras FOR SELECT USING (true);
CREATE POLICY "Escritura horas extras" ON empleado_horas_extras FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Lectura festivos" ON empleado_festivos FOR SELECT USING (true);
CREATE POLICY "Escritura festivos" ON empleado_festivos FOR ALL USING (auth.role() = 'authenticated');
