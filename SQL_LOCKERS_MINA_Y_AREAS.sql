-- ====================================================================
-- MÓDULO DE LOCKERS Y CASILLEROS (MINA Y NUEVAS ÁREAS)
-- Minas de Bacis - Sistema de Recursos Humanos
-- ====================================================================

-- 1. POBLADO AUTOMÁTICO DE MÓDULOS Y CASILLEROS PARA EL ÁREA DE MINA
-- 30 módulos de 3 casilleros (MIN-M01 al MIN-M30 = 90 casilleros)
-- 6 módulos de 2 casilleros grandes (MIN-M31 al MIN-M36 = 12 casilleros)
-- Total en Mina: 102 casilleros

DO $$
DECLARE
    v_mod_id UUID;
    v_mod_num INT;
    v_mod_code VARCHAR(50);
    v_bateria VARCHAR(50);
BEGIN
    -- Módulos de 3 Casilleros (1 a 30)
    FOR v_mod_num IN 1..30 LOOP
        v_mod_code := 'MIN-M' || LPAD(v_mod_num::text, 2, '0');
        
        IF v_mod_num <= 15 THEN
            v_bateria := 'Batería 1 (Vestidor Mina)';
        ELSE
            v_bateria := 'Batería 2 (Vestidor Mina)';
        END IF;

        -- Insertar o actualizar módulo físico
        INSERT INTO lockers_modulos (codigo_modulo, area, bateria, tipo_modulo, ubicacion_detalle, orden)
        VALUES (v_mod_code, 'Mina', v_bateria, '3_niveles', 'Vestidores de Mina Nivel 0', v_mod_num)
        ON CONFLICT (codigo_modulo) DO UPDATE 
            SET area = 'Mina', bateria = v_bateria, tipo_modulo = '3_niveles'
        RETURNING id_modulo INTO v_mod_id;

        IF v_mod_id IS NULL THEN
            SELECT id_modulo INTO v_mod_id FROM lockers_modulos WHERE codigo_modulo = v_mod_code;
        END IF;

        -- Casillero Superior (A)
        INSERT INTO lockers_casilleros (id_modulo, codigo_casillero, posicion_nivel, numero_en_modulo, estatus)
        VALUES (v_mod_id, v_mod_code || '-A', 'Superior', 1, 'Disponible')
        ON CONFLICT (codigo_casillero) DO NOTHING;

        -- Casillero Medio (B)
        INSERT INTO lockers_casilleros (id_modulo, codigo_casillero, posicion_nivel, numero_en_modulo, estatus)
        VALUES (v_mod_id, v_mod_code || '-B', 'Medio', 2, 'Disponible')
        ON CONFLICT (codigo_casillero) DO NOTHING;

        -- Casillero Inferior (C)
        INSERT INTO lockers_casilleros (id_modulo, codigo_casillero, posicion_nivel, numero_en_modulo, estatus)
        VALUES (v_mod_id, v_mod_code || '-C', 'Inferior', 3, 'Disponible')
        ON CONFLICT (codigo_casillero) DO NOTHING;
    END LOOP;

    -- Módulos de 2 Casilleros Grandes (31 a 36)
    FOR v_mod_num IN 31..36 LOOP
        v_mod_code := 'MIN-M' || LPAD(v_mod_num::text, 2, '0');
        v_bateria := 'Batería 3 - Módulos Grandes 2 Niv.';

        INSERT INTO lockers_modulos (codigo_modulo, area, bateria, tipo_modulo, ubicacion_detalle, orden)
        VALUES (v_mod_code, 'Mina', v_bateria, '2_niveles', 'Vestidores de Mina Nivel 0 (Casilleros Grandes)', v_mod_num)
        ON CONFLICT (codigo_modulo) DO UPDATE 
            SET area = 'Mina', bateria = v_bateria, tipo_modulo = '2_niveles'
        RETURNING id_modulo INTO v_mod_id;

        IF v_mod_id IS NULL THEN
            SELECT id_modulo INTO v_mod_id FROM lockers_modulos WHERE codigo_modulo = v_mod_code;
        END IF;

        -- Casillero Superior Grande (A)
        INSERT INTO lockers_casilleros (id_modulo, codigo_casillero, posicion_nivel, numero_en_modulo, estatus)
        VALUES (v_mod_id, v_mod_code || '-A', 'Superior Grande', 1, 'Disponible')
        ON CONFLICT (codigo_casillero) DO NOTHING;

        -- Casillero Inferior Grande (B)
        INSERT INTO lockers_casilleros (id_modulo, codigo_casillero, posicion_nivel, numero_en_modulo, estatus)
        VALUES (v_mod_id, v_mod_code || '-B', 'Inferior Grande', 2, 'Disponible')
        ON CONFLICT (codigo_casillero) DO NOTHING;
    END LOOP;
END $$;


-- ====================================================================
-- PLANTILLA REUTILIZABLE: PARA CREAR CUALQUIER OTRA ÁREA NUEVA EN SQL
-- Ejemplo: Para crear módulos de 'Mantenimiento' con prefijo 'MNT-M':
-- ====================================================================
/*
DO $$
DECLARE
    v_mod_id UUID;
    v_mod_num INT;
    v_mod_code VARCHAR(50);
    v_nombre_area VARCHAR(100) := 'Mantenimiento';      -- Cambia por el nombre de tu nueva área
    v_prefijo VARCHAR(20) := 'MNT-M';                   -- Cambia por el prefijo deseado
    v_bateria VARCHAR(50) := 'Batería 1 Mantenimiento';
    v_ubicacion VARCHAR(150) := 'Taller Mecánico / Vestidor';
BEGIN
    FOR v_mod_num IN 1..10 LOOP -- Crea del módulo 1 al 10 (30 casilleros)
        v_mod_code := v_prefijo || LPAD(v_mod_num::text, 2, '0');
        
        INSERT INTO lockers_modulos (codigo_modulo, area, bateria, tipo_modulo, ubicacion_detalle, orden)
        VALUES (v_mod_code, v_nombre_area, v_bateria, '3_niveles', v_ubicacion, v_mod_num)
        ON CONFLICT (codigo_modulo) DO UPDATE 
            SET area = v_nombre_area, bateria = v_bateria
        RETURNING id_modulo INTO v_mod_id;

        IF v_mod_id IS NULL THEN
            SELECT id_modulo INTO v_mod_id FROM lockers_modulos WHERE codigo_modulo = v_mod_code;
        END IF;

        INSERT INTO lockers_casilleros (id_modulo, codigo_casillero, posicion_nivel, numero_en_modulo, estatus)
        VALUES (v_mod_id, v_mod_code || '-A', 'Superior', 1, 'Disponible')
        ON CONFLICT (codigo_casillero) DO NOTHING;

        INSERT INTO lockers_casilleros (id_modulo, codigo_casillero, posicion_nivel, numero_en_modulo, estatus)
        VALUES (v_mod_id, v_mod_code || '-B', 'Medio', 2, 'Disponible')
        ON CONFLICT (codigo_casillero) DO NOTHING;

        INSERT INTO lockers_casilleros (id_modulo, codigo_casillero, posicion_nivel, numero_en_modulo, estatus)
        VALUES (v_mod_id, v_mod_code || '-C', 'Inferior', 3, 'Disponible')
        ON CONFLICT (codigo_casillero) DO NOTHING;
    END LOOP;
END $$;
*/
