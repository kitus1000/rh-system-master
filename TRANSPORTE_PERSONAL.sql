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

-- 3. Tabla de Solicitudes de Viaje (Auto-Servicio)
CREATE TABLE IF NOT EXISTS transporte_personal_solicitudes (
    id_solicitud UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_completo VARCHAR(255) NOT NULL,
    departamento VARCHAR(255) NOT NULL,
    celular_whatsapp VARCHAR(50) NOT NULL,
    tipo_vehiculo VARCHAR(50) NOT NULL, -- 'Autobús', 'Avioneta'
    fecha_sugerida DATE NOT NULL,
    estatus VARCHAR(50) DEFAULT 'Pendiente', -- 'Pendiente', 'Asignado', 'Rechazado'
    clave_confirmacion VARCHAR(50), -- La clave que le envían por whatsapp
    id_viaje UUID REFERENCES transporte_personal_viajes(id_viaje) ON DELETE SET NULL,
    numero_asiento INTEGER,
    chofer_nombre VARCHAR(255),
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE transporte_personal_solicitudes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo a transporte_personal_solicitudes" ON transporte_personal_solicitudes;
CREATE POLICY "Permitir todo a transporte_personal_solicitudes" ON transporte_personal_solicitudes FOR ALL USING (true);

-- 4. Permitir que id_empleado sea nulo en las reservas y guardar campos de texto
ALTER TABLE transporte_personal_asientos ALTER COLUMN id_empleado DROP NOT NULL;
ALTER TABLE transporte_personal_asientos ADD COLUMN IF NOT EXISTS nombre_pasajero VARCHAR(255);
ALTER TABLE transporte_personal_asientos ADD COLUMN IF NOT EXISTS departamento_pasajero VARCHAR(255);

-- 5. Forzar refresco de caché
NOTIFY pgrst, 'reload schema';
