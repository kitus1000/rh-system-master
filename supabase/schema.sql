-- 1.1 Catálogos
CREATE TABLE IF NOT EXISTS cat_unidades_trabajo (
    id_unidad UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unidad_trabajo TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cat_departamentos (
    id_departamento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    departamento TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cat_puestos (
    id_puesto UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    puesto TEXT NOT NULL,
    id_departamento UUID REFERENCES cat_departamentos(id_departamento),
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cat_cecos (
    id_ceco UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave_ceco TEXT NOT NULL,
    descripcion_ceco TEXT,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cat_tipos_rol (
    id_tipo_rol UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_rol TEXT NOT NULL, -- "20x10", "14x7"
    dias_trabajo INT NOT NULL,
    dias_descanso INT NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cat_tipos_incidencia (
    id_tipo_incidencia UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_incidencia TEXT NOT NULL, -- "Vacaciones", "Incapacidad", etc.
    bloquea_asistencia BOOLEAN DEFAULT FALSE,
    requiere_evidencia BOOLEAN DEFAULT FALSE,
    cuenta_como_descanso BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cat_tipos_solicitud (
    id_tipo_solicitud UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_solicitud TEXT NOT NULL, -- "Vacaciones", "Baja", etc.
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cat_periodos_vacacionales (
    id_periodo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo TEXT NOT NULL, -- "2025-2026"
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    activo BOOLEAN DEFAULT TRUE
);

-- 1.2 Empleado (Núcleo)
CREATE TABLE IF NOT EXISTS empleados (
    id_empleado UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_empleado INT UNIQUE NOT NULL,
    estado_empleado TEXT DEFAULT 'Activo', -- "Activo", "Baja"
    nombre TEXT NOT NULL,
    apellido_paterno TEXT NOT NULL,
    apellido_materno TEXT,
    sexo TEXT,
    fecha_nacimiento DATE,
    curp TEXT UNIQUE,
    rfc TEXT UNIQUE,
    nss TEXT UNIQUE,
    telefono TEXT,
    correo_electronico TEXT,
    estado_civil TEXT,
    tipo_residencia TEXT, -- "Local/Foráneo"
    hijos_numero INT DEFAULT 0,
    foto_url TEXT,
    fecha_creacion TIMESTAMPTZ DEFAULT now(),
    fecha_actualizacion TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS empleado_ingreso (
    id_empleado UUID REFERENCES empleados(id_empleado) PRIMARY KEY,
    fecha_ingreso DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS empleado_domicilio (
    id_empleado UUID REFERENCES empleados(id_empleado) PRIMARY KEY,
    calle TEXT,
    numero_exterior TEXT,
    colonia TEXT,
    codigo_postal TEXT,
    municipio TEXT,
    estado TEXT,
    ciudad TEXT
);

CREATE TABLE IF NOT EXISTS empleado_banco (
    id_empleado UUID REFERENCES empleados(id_empleado) PRIMARY KEY,
    numero_cuenta TEXT,
    clabe TEXT,
    banco TEXT
);

-- 1.3 Historial Laboral
CREATE TABLE IF NOT EXISTS empleado_adscripciones (
    id_empleado UUID REFERENCES empleados(id_empleado),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    categoria TEXT, -- "Administrativo/Operativo"
    id_departamento UUID REFERENCES cat_departamentos(id_departamento),
    id_puesto UUID REFERENCES cat_puestos(id_puesto),
    id_unidad UUID REFERENCES cat_unidades_trabajo(id_unidad),
    id_ceco UUID REFERENCES cat_cecos(id_ceco),
    razon_social TEXT,
    jefe_directo_nombre TEXT,
    es_jefe BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (id_empleado, fecha_inicio)
);

CREATE TABLE IF NOT EXISTS empleado_salarios (
    id_empleado UUID REFERENCES empleados(id_empleado),
    fecha_inicio_vigencia DATE NOT NULL,
    fecha_fin_vigencia DATE,
    salario_diario NUMERIC(10,2) NOT NULL,
    motivo TEXT,
    PRIMARY KEY (id_empleado, fecha_inicio_vigencia)
);

CREATE TABLE IF NOT EXISTS empleado_roles (
    id_empleado UUID REFERENCES empleados(id_empleado),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    id_tipo_rol UUID REFERENCES cat_tipos_rol(id_tipo_rol),
    PRIMARY KEY (id_empleado, fecha_inicio)
);

-- 1.4 Incidencias
CREATE TABLE IF NOT EXISTS empleado_incidencias (
    id_incidencia UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empleado UUID REFERENCES empleados(id_empleado) NOT NULL,
    id_tipo_incidencia UUID REFERENCES cat_tipos_incidencia(id_tipo_incidencia) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    comentarios TEXT,
    evidencia_url TEXT,
    estado TEXT DEFAULT 'Capturada', -- "Capturada", "En revisión", "Aprobada", etc.
    creado_por UUID, -- Link to auth.users if possible, otherwise UUID
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- 1.5 Vacaciones
CREATE TABLE IF NOT EXISTS vacaciones_saldos (
    id_empleado UUID REFERENCES empleados(id_empleado),
    id_periodo UUID REFERENCES cat_periodos_vacacionales(id_periodo),
    dias_asignados INT DEFAULT 0,
    dias_tomados INT DEFAULT 0,
    PRIMARY KEY (id_empleado, id_periodo)
);

-- 1.6 Solicitudes y Aprobaciones
CREATE TABLE IF NOT EXISTS solicitudes (
    id_solicitud UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_tipo_solicitud UUID REFERENCES cat_tipos_solicitud(id_tipo_solicitud),
    id_empleado_objetivo UUID REFERENCES empleados(id_empleado),
    folio TEXT UNIQUE,
    estatus TEXT DEFAULT 'Borrador', -- "Borrador", "Enviada", "Aprobada", etc.
    payload JSONB, -- Stores specific data (fechas, motivo)
    creado_por UUID, -- Link to auth.users
    creado_el TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS solicitud_aprobaciones (
    id_solicitud UUID REFERENCES solicitudes(id_solicitud),
    orden INT NOT NULL,
    aprobador_user_id UUID NOT NULL, -- Link to auth.users
    estatus TEXT DEFAULT 'Pendiente', -- "Pendiente", "Aprobado", "Rechazado"
    comentario TEXT,
    decidido_el TIMESTAMPTZ,
    PRIMARY KEY (id_solicitud, orden)
);

CREATE TABLE IF NOT EXISTS reglas_aprobacion (
    id_regla UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_tipo_solicitud UUID REFERENCES cat_tipos_solicitud(id_tipo_solicitud),
    orden INT NOT NULL,
    aprobador_user_id UUID,
    filtro JSONB, -- e.g. { "id_unidad": "..." }
    activo BOOLEAN DEFAULT TRUE
);

-- 1.7 Bajas
CREATE TABLE IF NOT EXISTS bajas (
    id_empleado UUID REFERENCES empleados(id_empleado),
    fecha_baja DATE NOT NULL,
    tipo_baja TEXT, -- "Renuncia", "Despido"
    motivo_baja TEXT,
    id_solicitud UUID REFERENCES solicitudes(id_solicitud),
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- 1.8 Auditoría
CREATE TABLE IF NOT EXISTS auditoria (
    id_evento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Link to auth.users
    accion TEXT NOT NULL,
    entidad TEXT NOT NULL,
    id_entidad UUID,
    antes JSONB,
    despues JSONB,
    fecha TIMESTAMPTZ DEFAULT now()
);

-- 1.9 Catálogos de Bajas
CREATE TABLE IF NOT EXISTS cat_causas_baja (
    id_causa_baja UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    causa TEXT NOT NULL,
    requiere_evidencia BOOLEAN DEFAULT FALSE,
    rol_iniciador TEXT DEFAULT 'Jefe',
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cat_causas_baja_imss (
    id_causa_imss UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clave TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE
);

-- Schema Updates for Bajas
ALTER TABLE bajas ADD COLUMN IF NOT EXISTS id_causa_baja UUID REFERENCES cat_causas_baja(id_causa_baja);
ALTER TABLE bajas ADD COLUMN IF NOT EXISTS id_causa_imss UUID REFERENCES cat_causas_baja_imss(id_causa_imss);

-- Insert Values for Causas Baja
INSERT INTO cat_causas_baja (causa, requiere_evidencia, rol_iniciador) VALUES 
('Término de contrato', FALSE, 'Sistema'),
('Separación voluntaria (renuncia)', FALSE, 'Empleado'),
('Abandono de empleo', TRUE, 'Jefe'),
('Defunción', FALSE, 'RH'),
('Clausura', FALSE, 'Directiva'),
('Otra', TRUE, 'Jefe'),
('Ausentismo', TRUE, 'Jefe'),
('Rescisión de contrato', TRUE, 'Jefe')
ON CONFLICT DO NOTHING;

-- 1.10 Perfiles (Gestión de Accesos)
CREATE TABLE IF NOT EXISTS perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_completo TEXT,
    rol TEXT DEFAULT 'Jefe', -- 'Administrativo', 'Jefe'
    id_departamento UUID REFERENCES cat_departamentos(id_departamento),
    creado_el TIMESTAMPTZ DEFAULT now(),
    actualizado_el TIMESTAMPTZ DEFAULT now()
);

