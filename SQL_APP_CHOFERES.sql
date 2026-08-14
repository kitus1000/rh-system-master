-- ==========================================
-- MÓDULO DE APP DE CHOFERES (MODO OFFLINE Y SINCRONIZACIÓN)
-- ==========================================

-- 1. Tabla de configuración de Checklists (Preguntas)
CREATE TABLE IF NOT EXISTS app_checklists_config (
    id_pregunta UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pregunta TEXT NOT NULL,
    activa BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE app_checklists_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a app_checklists_config" ON app_checklists_config FOR ALL USING (true);

-- 2. Tabla de Viajes Activos (App Android)
-- Almacena los viajes reportados por la App.
CREATE TABLE IF NOT EXISTS app_viajes_activos (
    id_viaje UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_viaje_local TEXT NOT NULL, -- ID generado en la tablet (SQLite) para mapeo offline
    id_chofer UUID REFERENCES empleados(id_empleado) ON DELETE CASCADE,
    ruta_origen TEXT NOT NULL,
    ruta_destino TEXT NOT NULL,
    hora_inicio_real TIMESTAMP WITH TIME ZONE,
    hora_fin_real TIMESTAMP WITH TIME ZONE,
    estado VARCHAR(50) DEFAULT 'En Progreso', -- En Progreso, Finalizado
    sincronizado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE app_viajes_activos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a app_viajes_activos" ON app_viajes_activos FOR ALL USING (true);

-- 3. Tabla de Pasajeros por Viaje (App Android)
CREATE TABLE IF NOT EXISTS app_pasajeros_viaje (
    id_registro UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_registro_local TEXT NOT NULL, -- ID generado en la tablet
    id_viaje UUID REFERENCES app_viajes_activos(id_viaje) ON DELETE CASCADE,
    id_empleado UUID REFERENCES empleados(id_empleado) ON DELETE SET NULL, -- Puede ser null si se metió manual y no coincide
    id_manual TEXT, -- Por si meten el ID a mano o no existe en la base de datos local aún
    metodo_registro VARCHAR(50) NOT NULL, -- 'QR', 'Huella', 'Manual'
    hora_subida TIMESTAMP WITH TIME ZONE NOT NULL,
    sincronizado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE app_pasajeros_viaje ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a app_pasajeros_viaje" ON app_pasajeros_viaje FOR ALL USING (true);

-- 4. Tabla de Respuestas del Checklist (App Android)
CREATE TABLE IF NOT EXISTS app_checklists_respuestas (
    id_respuesta UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_viaje UUID REFERENCES app_viajes_activos(id_viaje) ON DELETE CASCADE,
    respuestas_json JSONB NOT NULL, -- Ej: [{"id_pregunta": "uuid", "respuesta": true/false}]
    sincronizado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE app_checklists_respuestas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a app_checklists_respuestas" ON app_checklists_respuestas FOR ALL USING (true);
