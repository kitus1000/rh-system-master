-- ==========================================
-- SISTEMA DE RESERVAS DE TRANSPORTE
-- ==========================================

-- 1. Tabla de Viajes Programados (Autobuses, Avionetas, Camionetas)
CREATE TABLE IF NOT EXISTS transporte_personal_viajes (
    id_viaje UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_vehiculo VARCHAR(50) NOT NULL, -- 'Autobús', 'Avioneta', 'Camioneta'
    nombre_ruta VARCHAR(255) NOT NULL, -- Ej. "Mina a Ciudad"
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    capacidad_total INTEGER NOT NULL, -- Ej. 37 para Autobús
    estado VARCHAR(50) DEFAULT 'Programado', -- 'Programado', 'En Ruta', 'Completado', 'Cancelado'
    creado_por UUID REFERENCES empleados(id_empleado) ON DELETE SET NULL,
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE transporte_personal_viajes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a transporte_personal_viajes" ON transporte_personal_viajes;
CREATE POLICY "Permitir todo a transporte_personal_viajes" ON transporte_personal_viajes FOR ALL USING (true);

-- 2. Tabla de Asientos Reservados
CREATE TABLE IF NOT EXISTS transporte_personal_asientos (
    id_reserva UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_viaje UUID REFERENCES transporte_personal_viajes(id_viaje) ON DELETE CASCADE,
    id_empleado UUID REFERENCES empleados(id_empleado) ON DELETE CASCADE,
    numero_asiento INTEGER NOT NULL,
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(id_viaje, numero_asiento), -- Un asiento no puede ser ocupado por dos personas en el mismo viaje
    UNIQUE(id_viaje, id_empleado) -- Un empleado no puede ocupar dos asientos en el mismo viaje
);

ALTER TABLE transporte_personal_asientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a transporte_personal_asientos" ON transporte_personal_asientos;
CREATE POLICY "Permitir todo a transporte_personal_asientos" ON transporte_personal_asientos FOR ALL USING (true);

-- 3. Forzar refresco de caché
NOTIFY pgrst, 'reload schema';
