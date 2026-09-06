-- ====================================================================
-- MÓDULO DE LOCKERS Y CASILLEROS (PLANTA DE BENEFICIO)
-- ====================================================================

-- 1. Tabla de Módulos Físicos (Muebles / Baterías)
CREATE TABLE IF NOT EXISTS lockers_modulos (
    id_modulo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_modulo VARCHAR(50) NOT NULL UNIQUE, -- ej: 'PB-M01', 'PB-M02'
    area VARCHAR(100) NOT NULL DEFAULT 'Planta de Beneficio',
    bateria VARCHAR(50) DEFAULT 'Batería 1',   -- 'Batería 1', 'Batería 2', 'Batería 3', 'Batería 4 (Módulos Dobles Grandes)'
    tipo_modulo VARCHAR(50) NOT NULL DEFAULT '3_niveles', -- '3_niveles' (90%) o '2_niveles' (10%)
    ubicacion_detalle VARCHAR(255) DEFAULT 'Planta de Beneficio - Vestidor Principal',
    orden INTEGER DEFAULT 1,
    activo BOOLEAN DEFAULT true,
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Tabla de Casilleros Individuales (Puertas)
CREATE TABLE IF NOT EXISTS lockers_casilleros (
    id_casillero UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_modulo UUID REFERENCES lockers_modulos(id_modulo) ON DELETE CASCADE,
    codigo_casillero VARCHAR(50) NOT NULL UNIQUE, -- ej: 'PB-M01-A', 'PB-M01-B', 'PB-M01-C'
    posicion_nivel VARCHAR(50) NOT NULL,          -- 'Superior', 'Medio', 'Inferior' (en 3 niv) o 'Superior Grande', 'Inferior Grande' (en 2 niv)
    numero_en_modulo INTEGER NOT NULL,            -- 1, 2 o 3
    id_empleado UUID REFERENCES empleados(id_empleado) ON DELETE SET NULL,
    nombre_provisional VARCHAR(200),              -- Para trabajadores nuevos aún no capturados en el sistema
    numero_empleado_provisional VARCHAR(50),
    estatus VARCHAR(50) NOT NULL DEFAULT 'Disponible', -- 'Disponible', 'Asignado', 'En Reparacion', 'Inservible'
    condicion_llave VARCHAR(50) DEFAULT 'Sin Asignar', -- 'Tiene Llave', 'Candado Personal', 'Sin Llave', 'Copia en RH', 'Sin Asignar'
    numero_llave VARCHAR(50),
    descripcion_dano TEXT,
    observaciones TEXT,
    fecha_asignacion TIMESTAMP WITH TIME ZONE,
    fecha_reporte_dano TIMESTAMP WITH TIME ZONE,
    actualizado_el TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Políticas de Seguridad (RLS)
ALTER TABLE lockers_modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a lockers_modulos" ON lockers_modulos FOR ALL USING (true);

ALTER TABLE lockers_casilleros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir todo a lockers_casilleros" ON lockers_casilleros FOR ALL USING (true);

-- 4. POBLADO AUTOMÁTICO DE LOS 42 MÓDULOS Y 120 CASILLEROS (PLANTA DE BENEFICIO)
-- 90% en módulos de 3 casilleros: 36 módulos = 108 casilleros (PB-M01 al PB-M36)
-- 10% en módulos de 2 casilleros: 6 módulos = 12 casilleros (PB-M37 al PB-M42)
DO $$
DECLARE
    v_mod_id UUID;
    v_mod_num INT;
    v_mod_code VARCHAR(50);
    v_bateria VARCHAR(50);
BEGIN
    -- Módulos de 3 Casilleros (1 a 36)
    FOR v_mod_num IN 1..36 LOOP
        v_mod_code := 'PB-M' || LPAD(v_mod_num::text, 2, '0');
        
        IF v_mod_num <= 12 THEN
            v_bateria := 'Batería 1';
        ELSIF v_mod_num <= 24 THEN
            v_bateria := 'Batería 2';
        ELSE
            v_bateria := 'Batería 3';
        END IF;

        -- Insertar módulo si no existe
        INSERT INTO lockers_modulos (codigo_modulo, area, bateria, tipo_modulo, orden)
        VALUES (v_mod_code, 'Planta de Beneficio', v_bateria, '3_niveles', v_mod_num)
        ON CONFLICT (codigo_modulo) DO UPDATE 
            SET tipo_modulo = '3_niveles', bateria = v_bateria
        RETURNING id_modulo INTO v_mod_id;

        -- Si ya existía y no retornó por update, lo buscamos
        IF v_mod_id IS NULL THEN
            SELECT id_modulo INTO v_mod_id FROM lockers_modulos WHERE codigo_modulo = v_mod_code;
        END IF;

        -- Nivel Superior (A)
        INSERT INTO lockers_casilleros (id_modulo, codigo_casillero, posicion_nivel, numero_en_modulo, estatus)
        VALUES (v_mod_id, v_mod_code || '-A', 'Superior', 1, 'Disponible')
        ON CONFLICT (codigo_casillero) DO NOTHING;

        -- Nivel Medio (B)
        INSERT INTO lockers_casilleros (id_modulo, codigo_casillero, posicion_nivel, numero_en_modulo, estatus)
        VALUES (v_mod_id, v_mod_code || '-B', 'Medio', 2, 'Disponible')
        ON CONFLICT (codigo_casillero) DO NOTHING;

        -- Nivel Inferior (C)
        INSERT INTO lockers_casilleros (id_modulo, codigo_casillero, posicion_nivel, numero_en_modulo, estatus)
        VALUES (v_mod_id, v_mod_code || '-C', 'Inferior', 3, 'Disponible')
        ON CONFLICT (codigo_casillero) DO NOTHING;
    END LOOP;

    -- Módulos de 2 Casilleros (Grandes) (37 a 42)
    FOR v_mod_num IN 37..42 LOOP
        v_mod_code := 'PB-M' || LPAD(v_mod_num::text, 2, '0');
        v_bateria := 'Batería 4 (Módulos Dobles Grandes)';

        INSERT INTO lockers_modulos (codigo_modulo, area, bateria, tipo_modulo, orden)
        VALUES (v_mod_code, 'Planta de Beneficio', v_bateria, '2_niveles', v_mod_num)
        ON CONFLICT (codigo_modulo) DO UPDATE 
            SET tipo_modulo = '2_niveles', bateria = v_bateria
        RETURNING id_modulo INTO v_mod_id;

        IF v_mod_id IS NULL THEN
            SELECT id_modulo INTO v_mod_id FROM lockers_modulos WHERE codigo_modulo = v_mod_code;
        END IF;

        -- Nivel Superior Grande (A)
        INSERT INTO lockers_casilleros (id_modulo, codigo_casillero, posicion_nivel, numero_en_modulo, estatus)
        VALUES (v_mod_id, v_mod_code || '-A', 'Superior Grande', 1, 'Disponible')
        ON CONFLICT (codigo_casillero) DO NOTHING;

        -- Nivel Inferior Grande (B)
        INSERT INTO lockers_casilleros (id_modulo, codigo_casillero, posicion_nivel, numero_en_modulo, estatus)
        VALUES (v_mod_id, v_mod_code || '-B', 'Inferior Grande', 2, 'Disponible')
        ON CONFLICT (codigo_casillero) DO NOTHING;
    END LOOP;
END $$;
