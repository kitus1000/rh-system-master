-- =====================================================================================
-- SISTEMA UNIFICADO DE MOVIMIENTOS, ESCALAFÓN SINDICAL, VACANTES (10 DÍAS) Y TABLERO DE AJEDREZ
-- Grupo Minero Bacís S.A. de C.V. - Unidad "El Herrero"
-- Conecta: Sindicato ↔ RH Local ↔ RH Corporativo ↔ Depto Vacante (Mina) ↔ Deptos/Sub-deptos Origen
-- =====================================================================================

-- 1. ENCARGADOS MULTI-SUBDEPARTAMENTO (Una sola persona encargada de varios departamentos/sub-departamentos)
CREATE TABLE IF NOT EXISTS movimientos_encargados_subdeptos (
    id_encargado UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_encargado TEXT NOT NULL,
    correo_encargado TEXT NOT NULL,
    telefono_encargado TEXT,
    cargo TEXT DEFAULT 'Jefe / Superintendente de Área',
    departamento_principal TEXT NOT NULL,
    sub_departamentos TEXT[] DEFAULT '{}'::TEXT[], -- Ej: ARRAY['Mina', 'Perforación', 'Acarreo', 'Rezaga']
    activo BOOLEAN DEFAULT TRUE,
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- Sembrar encargados multi-subdepartamento base si la tabla está vacía
INSERT INTO movimientos_encargados_subdeptos (nombre_encargado, correo_encargado, cargo, departamento_principal, sub_departamentos)
SELECT 'Superintendente / Jefe de Mina', 'jefe.mina@bacis.com', 'Encargado General Mina y Sub-áreas', 'Mina',
       ARRAY['Mina', 'Perforación y Voladura', 'Acarreo Interior Mina', 'Rezaga y Ademe', 'Ventilación y Servicios Mina']
WHERE NOT EXISTS (SELECT 1 FROM movimientos_encargados_subdeptos WHERE departamento_principal = 'Mina');

INSERT INTO movimientos_encargados_subdeptos (nombre_encargado, correo_encargado, cargo, departamento_principal, sub_departamentos)
SELECT 'Encargado Planta de Beneficio y Procesos', 'jefe.planta.de@bacis.com', 'Jefe de Planta y Sub-departamentos', 'Planta de Beneficio',
       ARRAY['Planta de Beneficio', 'Trituración', 'Molienda', 'Flotación', 'Filtros y Espesadores', 'Presa de Jales']
WHERE NOT EXISTS (SELECT 1 FROM movimientos_encargados_subdeptos WHERE departamento_principal = 'Planta de Beneficio');

INSERT INTO movimientos_encargados_subdeptos (nombre_encargado, correo_encargado, cargo, departamento_principal, sub_departamentos)
SELECT 'Jefe de Mantenimiento y Talleres', 'jefe.mantenimiento@bacis.com', 'Encargado Mantenimiento Mecánico y Eléctrico', 'Mantenimiento',
       ARRAY['Mantenimiento', 'Mantenimiento Mecánico Mina', 'Mantenimiento Planta', 'Taller Equipo Pesado / Scooptram', 'Eléctrico e Instrumentación']
WHERE NOT EXISTS (SELECT 1 FROM movimientos_encargados_subdeptos WHERE departamento_principal = 'Mantenimiento');

INSERT INTO movimientos_encargados_subdeptos (nombre_encargado, correo_encargado, cargo, departamento_principal, sub_departamentos)
SELECT 'Encargado Geología, Laboratorio y Servicios', 'jefe.geologia.y@bacis.com', 'Jefe de Áreas Técnicas', 'Geología y Exploración',
       ARRAY['Geología y Exploración', 'Muestreo y Topografía', 'Laboratorio Químico', 'Logística y Almacén', 'Superficie y Patio']
WHERE NOT EXISTS (SELECT 1 FROM movimientos_encargados_subdeptos WHERE departamento_principal = 'Geología y Exploración');


-- 2. VACANTES Y CONVOCATORIAS SINDICALES (10 DÍAS DE INSCRIPCIÓN)
CREATE TABLE IF NOT EXISTS movimientos_vacantes (
    id_vacante UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio_convocatoria TEXT NOT NULL UNIQUE,
    puesto_vacante TEXT NOT NULL,                 -- Ej: 'Ayudante de Perforista'
    departamento_destino TEXT NOT NULL,           -- Ej: 'Mina'
    sub_departamento_destino TEXT,                -- Ej: 'Perforación y Voladura'
    plazas_totales INTEGER DEFAULT 1,
    plazas_ocupadas INTEGER DEFAULT 0,
    origen_vacante TEXT DEFAULT 'Vacante Libre',  -- 'Vacante Libre', 'Liberada por Movimiento (Efecto Dominó)', 'Nueva Plaza'
    liberada_por_nombre TEXT,                     -- Nombre del trabajador que dejó libre este puesto al ascender
    categoria_tabulador TEXT DEFAULT 'Sindicalizado / Escalafón',
    requisitos TEXT DEFAULT 'Disponibilidad de turno, examen médico apto, compromiso con seguridad industrial.',
    fecha_apertura DATE DEFAULT CURRENT_DATE,
    fecha_cierre_inscripcion DATE DEFAULT (CURRENT_DATE + INTERVAL '10 days')::DATE,
    dias_convocatoria INTEGER DEFAULT 10,
    -- Autorizaciones de la Vacante / Movimiento
    estatus_sindicato TEXT DEFAULT 'Convocatoria Publicada',
    estatus_rh_local TEXT DEFAULT 'Pendiente',        -- 'Pendiente', 'Autorizado', 'Rechazado'
    autorizado_rh_local_por TEXT,
    estatus_rh_corporativo TEXT DEFAULT 'Pendiente',  -- 'Pendiente', 'Autorizado', 'Rechazado'
    autorizado_rh_corporativo_por TEXT,
    plan_avance_departamento TEXT,                    -- Plan de capacitación/evaluación que define Mina
    fecha_cita_propuesta DATE,
    estatus_vacante TEXT DEFAULT 'Convocatoria Abierta (10 Días)',
    -- 'Convocatoria Abierta (10 Días)', 'En Autorización RH / Corporativo', 'En Selección y Plan de Avance', 'Esperando Liberación de Departamentos', 'Cubierta / Cerrada'
    creado_el TIMESTAMPTZ DEFAULT now(),
    actualizado_el TIMESTAMPTZ DEFAULT now()
);


-- 3. POSTULANTES INSCRITOS A LAS CONVOCATORIAS Y FLUJO DE AJEDREZ
CREATE TABLE IF NOT EXISTS movimientos_postulantes (
    id_postulacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_vacante UUID REFERENCES movimientos_vacantes(id_vacante) ON DELETE CASCADE,
    id_empleado UUID REFERENCES empleados(id_empleado) ON DELETE SET NULL,
    nombre_completo TEXT NOT NULL,
    numero_empleado TEXT,
    fecha_inscripcion DATE DEFAULT CURRENT_DATE,
    departamento_actual TEXT NOT NULL,
    sub_departamento_actual TEXT,
    puesto_actual TEXT NOT NULL,
    puesto_postulado TEXT NOT NULL,
    celular TEXT,
    anos_antiguedad NUMERIC(5,2) DEFAULT 0,
    -- Checkboxes solicitados en inscripción
    tiene_anos_experiencia BOOLEAN DEFAULT FALSE,
    anos_experiencia_detalle TEXT,
    tiene_experiencia_puesto BOOLEAN DEFAULT FALSE,
    requiere_capacitacion_previa BOOLEAN DEFAULT TRUE,
    es_sindicalizado BOOLEAN DEFAULT TRUE,
    -- Autorizaciones Previas RH y RH Corporativo
    autorizado_rh_local BOOLEAN DEFAULT FALSE,
    autorizado_rh_corporativo BOOLEAN DEFAULT FALSE,
    -- Selección y Plan del Departamento de la Vacante (ej. Mina)
    seleccionado_por_destino BOOLEAN DEFAULT FALSE,
    plan_avance_asignado TEXT,
    fecha_presentacion DATE,
    -- Comunicación y Autorización del Encargado del Departamento / Sub-departamento de Origen
    encargado_origen_nombre TEXT,
    encargado_origen_correo TEXT,
    correo_enviado_origen BOOLEAN DEFAULT FALSE,
    fecha_correo_origen TIMESTAMPTZ,
    token_respuesta TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
    respuesta_depto_origen TEXT DEFAULT 'Pendiente', -- 'Pendiente', 'Autorizado (Sí)', 'No / Reprogramar Fecha'
    comentario_depto_origen TEXT,
    fecha_respuesta_origen TIMESTAMPTZ,
    nueva_fecha_reprogramada DATE,
    aviso_retorno_destino BOOLEAN DEFAULT FALSE,
    -- Estado en el Tablero de Ajedrez
    estatus_movimiento TEXT DEFAULT 'Inscrito en Convocatoria',
    -- 'Inscrito en Convocatoria', 'Autorizado por RH y Corporativo', 'Seleccionado con Plan y Fecha', 'Esperando Respuesta Depto Origen', 'Confirmado para Mover (SÍ)', 'Reprogramar Fecha (NO)', 'Movimiento Ejecutado (En Puesto)', 'No Seleccionado'
    fecha_ejecucion_movimiento TIMESTAMPTZ,
    creado_el TIMESTAMPTZ DEFAULT now()
);


-- 4. HISTORIAL DE ESTANCIA (DÓNDE ESTUVO, CUÁNTOS DÍAS ESTUVO Y CALIFICACIÓN DEL DEPARTAMENTO ASIGNADO)
CREATE TABLE IF NOT EXISTS movimientos_historial_estancia (
    id_historial UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_postulacion UUID REFERENCES movimientos_postulantes(id_postulacion) ON DELETE SET NULL,
    id_vacante UUID REFERENCES movimientos_vacantes(id_vacante) ON DELETE SET NULL,
    id_empleado UUID REFERENCES empleados(id_empleado) ON DELETE SET NULL,
    nombre_completo TEXT NOT NULL,
    numero_empleado TEXT,
    departamento_origen TEXT,
    sub_departamento_origen TEXT,
    puesto_origen TEXT,
    departamento_asignado TEXT NOT NULL,
    sub_departamento_asignado TEXT,
    puesto_asignado TEXT NOT NULL,
    fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_fin DATE,
    dias_acumulados INTEGER DEFAULT 1,
    calificacion NUMERIC(4,1), -- Escala 1.0 a 10.0 otorgada por el Departamento Asignado
    dictamen TEXT DEFAULT 'En Periodo de Prueba / Capacitación',
    -- 'En Periodo de Prueba / Capacitación', 'Aprobado Definitivo en el Puesto', 'Regresado a Puesto Anterior', 'Promovido a Siguiente Categoría'
    comentarios_desempeno TEXT,
    evaluado_por TEXT,
    fecha_evaluacion TIMESTAMPTZ,
    activo_en_puesto BOOLEAN DEFAULT TRUE,
    creado_el TIMESTAMPTZ DEFAULT now()
);


-- 5. BITÁCORA DE AVISOS Y CORREOS AUTOMÁTICOS (SINDICATO, RH, CORPORATIVO Y DEPARTAMENTOS)
CREATE TABLE IF NOT EXISTS movimientos_notificaciones_log (
    id_notificacion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_vacante UUID REFERENCES movimientos_vacantes(id_vacante) ON DELETE CASCADE,
    id_postulacion UUID REFERENCES movimientos_postulantes(id_postulacion) ON DELETE SET NULL,
    tipo_aviso TEXT NOT NULL, -- 'CONVOCATORIA_10_DIAS', 'AUTORIZACION_RH', 'SELECCION_MINA_A_ORIGEN', 'RESPUESTA_SI_ORIGEN', 'RESPUESTA_NO_REPROGRAMAR', 'MOVIMIENTO_AJEDREZ', 'CALIFICACION_DEPTO'
    remitente TEXT NOT NULL,
    destinatarios TEXT NOT NULL,
    asunto TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    correo_enviado BOOLEAN DEFAULT FALSE,
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- Políticas RLS abiertas para operación interna fluida
ALTER TABLE movimientos_encargados_subdeptos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access movimientos_encargados_subdeptos" ON movimientos_encargados_subdeptos;
CREATE POLICY "Public access movimientos_encargados_subdeptos" ON movimientos_encargados_subdeptos FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE movimientos_vacantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access movimientos_vacantes" ON movimientos_vacantes;
CREATE POLICY "Public access movimientos_vacantes" ON movimientos_vacantes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE movimientos_postulantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access movimientos_postulantes" ON movimientos_postulantes;
CREATE POLICY "Public access movimientos_postulantes" ON movimientos_postulantes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE movimientos_historial_estancia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access movimientos_historial_estancia" ON movimientos_historial_estancia;
CREATE POLICY "Public access movimientos_historial_estancia" ON movimientos_historial_estancia FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE movimientos_notificaciones_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public access movimientos_notificaciones_log" ON movimientos_notificaciones_log;
CREATE POLICY "Public access movimientos_notificaciones_log" ON movimientos_notificaciones_log FOR ALL USING (true) WITH CHECK (true);
