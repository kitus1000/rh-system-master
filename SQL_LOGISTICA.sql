-- ==========================================
-- MÓDULO DE LOGÍSTICA - SCRIPTS DE TABLAS
-- ==========================================

-- 1. Catálogo de Camiones
CREATE TABLE IF NOT EXISTS logistica_camiones (
    id_camion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_economico TEXT NOT NULL,
    placas TEXT,
    activo BOOLEAN DEFAULT TRUE,
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- 2. Catálogo de Puntos Estratégicos en la Mina
CREATE TABLE IF NOT EXISTS logistica_puntos_mina (
    id_punto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_punto TEXT NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- 3. Transporte Foráneo (Viajes a Durango u otros en el futuro, por ahora Durango)
CREATE TABLE IF NOT EXISTS logistica_foraneo (
    id_viaje UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empleado UUID REFERENCES empleados(id_empleado), -- Chofer
    id_camion UUID REFERENCES logistica_camiones(id_camion),
    destino TEXT DEFAULT 'Durango',
    fecha_salida DATE NOT NULL,
    hora_salida TIME NOT NULL,
    fecha_llegada DATE,
    hora_llegada TIME,
    estado TEXT DEFAULT 'Programado', -- 'Programado', 'En Ruta', 'Completado', 'Cancelado'
    observaciones TEXT,
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- 4. Transporte Local (Asignaciones y Rotaciones)
CREATE TABLE IF NOT EXISTS logistica_local_asignaciones (
    id_asignacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empleado UUID REFERENCES empleados(id_empleado), -- Chofer
    id_camion UUID REFERENCES logistica_camiones(id_camion),
    id_punto UUID REFERENCES logistica_puntos_mina(id_punto),
    turno TEXT NOT NULL, -- Ej: 'Turno 1', 'Turno 2', 'Turno 3'
    fecha DATE NOT NULL,
    observaciones TEXT,
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- 5. SEGURIDAD (RLS)
ALTER TABLE logistica_camiones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated All on logistica_camiones" ON logistica_camiones FOR ALL USING (true);

ALTER TABLE logistica_puntos_mina ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated All on logistica_puntos_mina" ON logistica_puntos_mina FOR ALL USING (true);

ALTER TABLE logistica_foraneo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated All on logistica_foraneo" ON logistica_foraneo FOR ALL USING (true);

ALTER TABLE logistica_local_asignaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated All on logistica_local_asignaciones" ON logistica_local_asignaciones FOR ALL USING (true);
