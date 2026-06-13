-- ==========================================
-- EL EXPEDIENTE - CONTROL DE ACCESOS VEHÍCULOS
-- ==========================================

-- 1. Tabla de Manifiestos de Acceso (Viaje completo)
CREATE TABLE IF NOT EXISTS logistica_accesos (
    id_acceso UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('Entrada', 'Salida')),
    id_camion UUID REFERENCES logistica_camiones(id_camion),
    id_chofer UUID REFERENCES empleados(id_empleado),
    fecha_hora TIMESTAMPTZ DEFAULT now(),
    codigo_acceso TEXT UNIQUE,
    estatus TEXT DEFAULT 'Pendiente' CHECK (estatus IN ('Pendiente', 'Aprobado', 'Completado', 'Cancelado')),
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- 2. Pasajeros asignados al acceso
CREATE TABLE IF NOT EXISTS logistica_acceso_pasajeros (
    id_pasajero UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_acceso UUID REFERENCES logistica_accesos(id_acceso) ON DELETE CASCADE,
    id_empleado UUID REFERENCES empleados(id_empleado),
    id_departamento UUID REFERENCES cat_departamentos(id_departamento)
);

-- 3. Firmas de Autorización por Departamento
CREATE TABLE IF NOT EXISTS logistica_acceso_firmas (
    id_firma UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_acceso UUID REFERENCES logistica_accesos(id_acceso) ON DELETE CASCADE,
    id_departamento UUID REFERENCES cat_departamentos(id_departamento),
    firma_base64 TEXT, -- Guardaremos la firma dibujada aquí por simplicidad en esta fase
    fecha_firma TIMESTAMPTZ
);

-- 4. SEGURIDAD (RLS)
ALTER TABLE logistica_accesos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth All Accesos" ON logistica_accesos FOR ALL USING (true);

ALTER TABLE logistica_acceso_pasajeros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth All Pasajeros" ON logistica_acceso_pasajeros FOR ALL USING (true);

ALTER TABLE logistica_acceso_firmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth All Firmas" ON logistica_acceso_firmas FOR ALL USING (true);
