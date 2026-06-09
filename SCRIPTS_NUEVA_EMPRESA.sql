-- ==========================================
-- EL EXPEDIENTE - SCRIPTS DE INSTALACIÓN (NUEVO CLIENTE)
-- ==========================================

-- 1. CATÁLOGOS BASE
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

CREATE TABLE IF NOT EXISTS cat_tipos_rol (
    id_tipo_rol UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_rol TEXT NOT NULL,
    dias_trabajo INT NOT NULL,
    dias_descanso INT NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cat_tipos_incidencia (
    id_tipo_incidencia UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_incidencia TEXT NOT NULL,
    bloquea_asistencia BOOLEAN DEFAULT FALSE,
    requiere_evidencia BOOLEAN DEFAULT FALSE,
    cuenta_como_descanso BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cat_tipos_solicitud (
    id_tipo_solicitud UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_solicitud TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cat_causas_baja (
    id_causa_baja UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    causa TEXT NOT NULL,
    activo BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cat_periodos_vacacionales (
    id_periodo UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    activo BOOLEAN DEFAULT TRUE
);

-- 2. EMPLEADOS Y EXPEDIENTE
CREATE TABLE IF NOT EXISTS empleados (
    id_empleado UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_empleado INT UNIQUE NOT NULL,
    estado_empleado TEXT DEFAULT 'Activo',
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
    foto_url TEXT,
    fecha_creacion TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS empleado_ingreso (
    id_empleado UUID REFERENCES empleados(id_empleado) PRIMARY KEY,
    fecha_ingreso DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS empleado_adscripciones (
    id_empleado UUID REFERENCES empleados(id_empleado),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    id_departamento UUID REFERENCES cat_departamentos(id_departamento),
    id_puesto UUID REFERENCES cat_puestos(id_puesto),
    id_unidad UUID REFERENCES cat_unidades_trabajo(id_unidad),
    PRIMARY KEY (id_empleado, fecha_inicio)
);

-- 3. MOVIMIENTOS E INCIDENCIAS
CREATE TABLE IF NOT EXISTS empleado_incidencias (
    id_incidencia UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empleado UUID REFERENCES empleados(id_empleado) NOT NULL,
    id_tipo_incidencia UUID REFERENCES cat_tipos_incidencia(id_tipo_incidencia) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    comentarios TEXT,
    estado TEXT DEFAULT 'Aprobada',
    creado_el TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vacaciones_saldos (
    id_empleado UUID REFERENCES empleados(id_empleado),
    id_periodo UUID REFERENCES cat_periodos_vacacionales(id_periodo),
    dias_asignados INT DEFAULT 0,
    dias_tomados INT DEFAULT 0,
    PRIMARY KEY (id_empleado, id_periodo)
);

CREATE TABLE IF NOT EXISTS solicitudes (
    id_solicitud UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_tipo_solicitud UUID REFERENCES cat_tipos_solicitud(id_tipo_solicitud),
    id_empleado_objetivo UUID REFERENCES empleados(id_empleado),
    folio TEXT UNIQUE,
    estatus TEXT DEFAULT 'Pendiente',
    payload JSONB,
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- 4. CONFIGURACIÓN Y DOCUMENTOS
CREATE TABLE IF NOT EXISTS configuracion_empresa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_empresa TEXT,
    rfc TEXT,
    direccion TEXT,
    registro_patronal TEXT,
    logo_base64 TEXT,
    actualizado_el TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    content JSONB,
    blocks JSONB,
    header_content JSONB,
    footer_content JSONB,
    margins JSONB DEFAULT '{"top": 2.5, "right": 2.5, "bottom": 2.5, "left": 2.5}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS perfiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    nombre_completo TEXT,
    rol TEXT DEFAULT 'Jefe' CHECK (rol IN ('Administrativo', 'Jefe')),
    id_departamento UUID REFERENCES cat_departamentos(id_departamento),
    actualizado_el TIMESTAMPTZ DEFAULT now()
);

-- 5. SEGURIDAD (RLS)
ALTER TABLE configuracion_empresa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read" ON configuracion_empresa FOR SELECT USING (true);
CREATE POLICY "Authenticated All" ON configuracion_empresa FOR ALL USING (true);

ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated All" ON solicitudes FOR ALL USING (true);

ALTER TABLE empleados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated All" ON empleados FOR ALL USING (true);

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON perfiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can all" ON perfiles FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'Administrativo')
);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre_completo, rol)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', 'Jefe');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. SEMILLAS (DATA INICIAL)
INSERT INTO cat_tipos_incidencia (tipo_incidencia, bloquea_asistencia, cuenta_como_descanso) VALUES
('Falta Injustificada', TRUE, FALSE),
('Incapacidad', TRUE, FALSE),
('Vacaciones', TRUE, TRUE),
('Permiso con Goce', TRUE, FALSE),
('Retardo', FALSE, FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO cat_tipos_solicitud (tipo_solicitud) VALUES
('Vacaciones'),
('Baja de Personal'),
('Permiso Especial'),
('Reingreso de Personal')
ON CONFLICT DO NOTHING;

INSERT INTO cat_causas_baja (causa) VALUES
('Renuncia Voluntaria'),
('Terminación de Contrato'),
('Abandono de Empleo'),
('Despido')
ON CONFLICT DO NOTHING;
