-- ============================================================================
-- MIGRACIÓN INTEGRAL: CONEXIÓN INTERNA RH + COMEDOR + PORTAL DE CONTRATISTAS
-- Ejecutar en Supabase SQL Editor (Idempotente / Seguro para re-ejecutar)
-- ============================================================================

-- 1. ACTUALIZAR ROLES EN PERFILES Y VINCULACIÓN CON EMPRESA CONTRATISTA
ALTER TABLE perfiles DROP CONSTRAINT IF EXISTS perfiles_rol_check;
ALTER TABLE perfiles ADD CONSTRAINT perfiles_rol_check CHECK (
    rol IN (
        'Administrativo',
        'Administrador',
        'Recursos Humanos',
        'Superintendente',
        'Jefe',
        'Jefe de Departamento',
        'Supervisor',
        'Médico',
        'Jefe Médico',
        'Chofer',
        'Encargado de Campamento y Comedor',
        'Contratista',
        'Seguridad',
        'Seguridad Industrial',
        'Caseta',
        'Seguridad Patrimonial',
        'Sistemas'
    )
);

ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS id_empresa_contratista UUID;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. MÓDULO DE COMEDOR EN SUPABASE (CONECTADO A RH Y CONTRATISTAS)
CREATE TABLE IF NOT EXISTS comedor_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    precio_desayuno NUMERIC(10,2) DEFAULT 45,
    precio_comida NUMERIC(10,2) DEFAULT 65,
    precio_cena NUMERIC(10,2) DEFAULT 55,
    precio_colacion NUMERIC(10,2) DEFAULT 30,
    jefe_cocinero TEXT DEFAULT 'Chef Encargado de Comedor',
    actualizado_el TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comedor_registros (
    id_registro UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empleado UUID REFERENCES empleados(id_empleado) ON DELETE SET NULL,
    id_contratista_personal UUID,
    numero_ficha TEXT,
    nombre_comensal TEXT NOT NULL,
    tipo_comensal TEXT DEFAULT 'Empleado' CHECK (tipo_comensal IN ('Empleado', 'Contratista', 'Visita')),
    puesto TEXT,
    departamento TEXT,
    servicio TEXT NOT NULL CHECK (servicio IN ('Desayuno', 'Comida', 'Cena', 'Colación')),
    costo NUMERIC(10,2) NOT NULL DEFAULT 0,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    hora TEXT NOT NULL,
    registrado_por UUID,
    creado_el TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE comedor_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo comedor_config" ON comedor_config;
CREATE POLICY "Permitir todo comedor_config" ON comedor_config FOR ALL USING (true);

ALTER TABLE comedor_registros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir todo comedor_registros" ON comedor_registros;
CREATE POLICY "Permitir todo comedor_registros" ON comedor_registros FOR ALL USING (true);

-- Insertar configuración inicial de comedor si está vacía
INSERT INTO comedor_config (precio_desayuno, precio_comida, precio_cena, precio_colacion, jefe_cocinero)
SELECT 45, 65, 55, 30, 'Chef Don Carlos Méndez'
WHERE NOT EXISTS (SELECT 1 FROM comedor_config);

-- 3. CAMPAMENTOS & EMPLEADOS: COLUMNAS DE SINCRONIZACIÓN
ALTER TABLE campamentos ADD COLUMN IF NOT EXISTS zona TEXT DEFAULT 'Parajes';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS rol_tipo TEXT DEFAULT '20x10';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_inicio_rol DATE;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS es_contratista BOOLEAN DEFAULT FALSE;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS dias_estadia INTEGER DEFAULT 0;
ALTER TABLE campamento_camas ADD COLUMN IF NOT EXISTS id_contratista_personal UUID;
ALTER TABLE campamento_camas ADD COLUMN IF NOT EXISTS ocupado_por_nombre TEXT;
ALTER TABLE campamento_camas ADD COLUMN IF NOT EXISTS ocupado_tipo TEXT DEFAULT 'Empleado';

-- 4. SINCRONIZACIÓN MÉDICO -> RH (PASES MÉDICOS E INCIDENCIAS)
ALTER TABLE pases_medicos ADD COLUMN IF NOT EXISTS sincronizado_rh BOOLEAN DEFAULT FALSE;
ALTER TABLE pases_medicos ADD COLUMN IF NOT EXISTS id_incidencia_rh UUID;
ALTER TABLE consultas_medicas ADD COLUMN IF NOT EXISTS dias_reposo INTEGER DEFAULT 0;
ALTER TABLE consultas_medicas ADD COLUMN IF NOT EXISTS genera_incapacidad BOOLEAN DEFAULT FALSE;

-- 5. MÓDULO INTEGRAL DE CONTRATISTAS, DOCUMENTACIÓN, FLUJO MULTI-FACTOR Y CASETA
CREATE TABLE IF NOT EXISTS contratistas_empresas (
    id_empresa UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razon_social TEXT NOT NULL,
    nombre_comercial TEXT,
    rfc TEXT NOT NULL,
    representante_legal TEXT,
    telefono TEXT,
    correo TEXT,
    especialidad TEXT,
    estatus TEXT DEFAULT 'Activa' CHECK (estatus IN ('Activa', 'Suspendida', 'Pendiente')),
    notas TEXT,
    creado_el TIMESTAMPTZ DEFAULT now(),
    actualizado_el TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contratistas_personal (
    id_personal UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empresa UUID REFERENCES contratistas_empresas(id_empresa) ON DELETE CASCADE NOT NULL,
    nombre TEXT NOT NULL,
    apellido_paterno TEXT NOT NULL,
    apellido_materno TEXT,
    curp TEXT,
    nss TEXT,
    rfc TEXT,
    puesto_servicio TEXT DEFAULT 'Técnico Contratista',
    telefono TEXT,
    tipo_sangre TEXT,
    contacto_emergencia TEXT,
    foto_url TEXT,
    induccion_aprobada BOOLEAN DEFAULT FALSE,
    fecha_induccion DATE,
    vigencia_induccion DATE,
    notas_seguridad TEXT,
    estatus TEXT DEFAULT 'Activo' CHECK (estatus IN ('Activo', 'Baja', 'En Mina', 'Bloqueado')),
    creado_el TIMESTAMPTZ DEFAULT now(),
    actualizado_el TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contratistas_documentos (
    id_documento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_empresa UUID REFERENCES contratistas_empresas(id_empresa) ON DELETE CASCADE NOT NULL,
    id_personal UUID REFERENCES contratistas_personal(id_personal) ON DELETE CASCADE,
    ambito TEXT NOT NULL CHECK (ambito IN ('Empresa', 'Personal')),
    tipo_documento TEXT NOT NULL,
    nombre_archivo TEXT NOT NULL,
    archivo_url TEXT NOT NULL,
    mime_type TEXT,
    fecha_emision DATE,
    fecha_vencimiento DATE,
    estatus TEXT DEFAULT 'Pendiente' CHECK (estatus IN ('Pendiente', 'Aprobado', 'Rechazado')),
    comentarios_revision TEXT,
    revisado_por UUID,
    creado_el TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contratistas_solicitudes (
    id_solicitud UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folio TEXT UNIQUE NOT NULL,
    id_empresa UUID REFERENCES contratistas_empresas(id_empresa) ON DELETE CASCADE NOT NULL,
    id_departamento_objetivo UUID REFERENCES cat_departamentos(id_departamento),
    departamento_nombre TEXT NOT NULL,
    contacto_departamento TEXT,
    descripcion_servicio TEXT NOT NULL,
    area_trabajo TEXT,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    requiere_campamento BOOLEAN DEFAULT FALSE,
    requiere_comedor BOOLEAN DEFAULT FALSE,
    estatus_general TEXT DEFAULT 'En Revisión' CHECK (
        estatus_general IN ('Borrador', 'En Revisión', 'Aprobada', 'En Mina', 'Prórroga Solicitada', 'Finalizada', 'Rechazada')
    ),
    -- Factor 1: Documentación
    estatus_documentos TEXT DEFAULT 'Pendiente',
    -- Factor 2: Departamento interesado en servicios
    estatus_departamento TEXT DEFAULT 'Pendiente' CHECK (estatus_departamento IN ('Pendiente', 'En Diálogo', 'Aprobado', 'Rechazado')),
    aprobado_depto_por TEXT,
    fecha_aprobacion_depto TIMESTAMPTZ,
    notas_departamento TEXT,
    -- Factor 3: Seguridad / Inducción
    estatus_seguridad TEXT DEFAULT 'Pendiente' CHECK (estatus_seguridad IN ('Pendiente', 'En Diálogo', 'Inducción Programada', 'Aprobado', 'Rechazado')),
    aprobado_seguridad_por TEXT,
    fecha_aprobacion_seguridad TIMESTAMPTZ,
    fecha_induccion_programada DATE,
    hora_induccion TEXT,
    lugar_induccion TEXT,
    notas_seguridad TEXT,
    -- Factor 4: Campamentos disponibilidad
    estatus_campamento TEXT DEFAULT 'Pendiente' CHECK (estatus_campamento IN ('No Requiere', 'Pendiente', 'Disponible / Asignado', 'Sin Cupo')),
    aprobado_campamento_por TEXT,
    fecha_aprobacion_campamento TIMESTAMPTZ,
    notas_campamento TEXT,
    -- Factor 5: Autorización Final RH
    estatus_rh TEXT DEFAULT 'Pendiente' CHECK (estatus_rh IN ('Pendiente', 'Aprobado', 'Rechazado')),
    aprobado_rh_por TEXT,
    fecha_aprobacion_rh TIMESTAMPTZ,
    creado_el TIMESTAMPTZ DEFAULT now(),
    actualizado_el TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contratistas_solicitud_personal (
    id_item UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_solicitud UUID REFERENCES contratistas_solicitudes(id_solicitud) ON DELETE CASCADE NOT NULL,
    id_personal UUID REFERENCES contratistas_personal(id_personal) ON DELETE CASCADE NOT NULL,
    id_cama_asignada UUID REFERENCES campamento_camas(id_cama) ON DELETE SET NULL,
    cama_descripcion TEXT,
    induccion_verificada BOOLEAN DEFAULT FALSE,
    creado_el TIMESTAMPTZ DEFAULT now(),
    UNIQUE(id_solicitud, id_personal)
);

CREATE TABLE IF NOT EXISTS contratistas_credenciales (
    id_credencial UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_qr TEXT UNIQUE NOT NULL,
    id_solicitud UUID REFERENCES contratistas_solicitudes(id_solicitud) ON DELETE CASCADE NOT NULL,
    id_empresa UUID REFERENCES contratistas_empresas(id_empresa) ON DELETE CASCADE NOT NULL,
    id_personal UUID REFERENCES contratistas_personal(id_personal) ON DELETE CASCADE NOT NULL,
    fecha_emision TIMESTAMPTZ DEFAULT now(),
    vigencia_desde DATE NOT NULL,
    vigencia_hasta DATE NOT NULL,
    estatus TEXT DEFAULT 'Emitida' CHECK (estatus IN ('Emitida', 'En Mina', 'Devuelta', 'Vencida', 'Revocada')),
    fecha_entrada_mina TIMESTAMPTZ,
    fecha_salida_mina TIMESTAMPTZ,
    credencial_entregada BOOLEAN DEFAULT FALSE,
    recibido_por TEXT,
    notas_caseta TEXT,
    creado_el TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contratistas_prorrogas (
    id_prorroga UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_solicitud UUID REFERENCES contratistas_solicitudes(id_solicitud) ON DELETE CASCADE NOT NULL,
    id_credencial UUID REFERENCES contratistas_credenciales(id_credencial) ON DELETE SET NULL,
    id_empresa UUID REFERENCES contratistas_empresas(id_empresa) ON DELETE CASCADE NOT NULL,
    fecha_fin_anterior DATE NOT NULL,
    fecha_fin_solicitada DATE NOT NULL,
    motivo TEXT NOT NULL,
    estatus_departamento TEXT DEFAULT 'Pendiente',
    estatus_seguridad TEXT DEFAULT 'Pendiente',
    estatus_campamento TEXT DEFAULT 'Pendiente',
    estatus_rh TEXT DEFAULT 'Pendiente',
    estatus_general TEXT DEFAULT 'Pendiente' CHECK (estatus_general IN ('Pendiente', 'Aprobada', 'Rechazada')),
    solicitado_por TEXT,
    resuelto_el TIMESTAMPTZ,
    creado_el TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contratistas_mensajes (
    id_mensaje UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_solicitud UUID REFERENCES contratistas_solicitudes(id_solicitud) ON DELETE CASCADE NOT NULL,
    id_empresa UUID REFERENCES contratistas_empresas(id_empresa) ON DELETE CASCADE NOT NULL,
    remitente_id UUID,
    remitente_nombre TEXT NOT NULL,
    remitente_rol TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    creado_el TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contratistas_movimientos_bitacora (
    id_movimiento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_credencial UUID REFERENCES contratistas_credenciales(id_credencial) ON DELETE CASCADE NOT NULL,
    id_personal UUID REFERENCES contratistas_personal(id_personal) ON DELETE CASCADE NOT NULL,
    id_empresa UUID REFERENCES contratistas_empresas(id_empresa) ON DELETE CASCADE NOT NULL,
    tipo_movimiento TEXT NOT NULL CHECK (tipo_movimiento IN ('Entrada', 'Salida', 'Entrega Credencial', 'Prórroga')),
    caseta_lugar TEXT DEFAULT 'Caseta Principal Mina',
    registrado_por TEXT,
    observaciones TEXT,
    fecha_hora TIMESTAMPTZ DEFAULT now()
);

-- RLS PARA TABLAS DE CONTRATISTAS
ALTER TABLE contratistas_empresas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All contratistas_empresas" ON contratistas_empresas;
CREATE POLICY "All contratistas_empresas" ON contratistas_empresas FOR ALL USING (true);

ALTER TABLE contratistas_personal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All contratistas_personal" ON contratistas_personal;
CREATE POLICY "All contratistas_personal" ON contratistas_personal FOR ALL USING (true);

ALTER TABLE contratistas_documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All contratistas_documentos" ON contratistas_documentos;
CREATE POLICY "All contratistas_documentos" ON contratistas_documentos FOR ALL USING (true);

ALTER TABLE contratistas_solicitudes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All contratistas_solicitudes" ON contratistas_solicitudes;
CREATE POLICY "All contratistas_solicitudes" ON contratistas_solicitudes FOR ALL USING (true);

ALTER TABLE contratistas_solicitud_personal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All contratistas_solicitud_personal" ON contratistas_solicitud_personal;
CREATE POLICY "All contratistas_solicitud_personal" ON contratistas_solicitud_personal FOR ALL USING (true);

ALTER TABLE contratistas_credenciales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All contratistas_credenciales" ON contratistas_credenciales;
CREATE POLICY "All contratistas_credenciales" ON contratistas_credenciales FOR ALL USING (true);

ALTER TABLE contratistas_prorrogas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All contratistas_prorrogas" ON contratistas_prorrogas;
CREATE POLICY "All contratistas_prorrogas" ON contratistas_prorrogas FOR ALL USING (true);

ALTER TABLE contratistas_mensajes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All contratistas_mensajes" ON contratistas_mensajes;
CREATE POLICY "All contratistas_mensajes" ON contratistas_mensajes FOR ALL USING (true);

ALTER TABLE contratistas_movimientos_bitacora ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "All contratistas_movimientos_bitacora" ON contratistas_movimientos_bitacora;
CREATE POLICY "All contratistas_movimientos_bitacora" ON contratistas_movimientos_bitacora FOR ALL USING (true);

ALTER TABLE contratistas_solicitudes ADD COLUMN IF NOT EXISTS fecha_induccion_programada DATE;
ALTER TABLE contratistas_solicitudes ADD COLUMN IF NOT EXISTS hora_induccion TEXT;
ALTER TABLE contratistas_solicitudes ADD COLUMN IF NOT EXISTS lugar_induccion TEXT;
ALTER TABLE contratistas_solicitudes DROP CONSTRAINT IF EXISTS contratistas_solicitudes_estatus_seguridad_check;
ALTER TABLE contratistas_solicitudes ADD CONSTRAINT contratistas_solicitudes_estatus_seguridad_check CHECK (estatus_seguridad IN ('Pendiente', 'En Diálogo', 'Inducción Programada', 'Aprobado', 'Rechazado'));

-- BUCKET DE STORAGE PARA DOCUMENTOS DE CONTRATISTAS (PDFs / IMÁGENES / FOTOS)
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratistas_docs', 'contratistas_docs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Access contratistas_docs" ON storage.objects;
CREATE POLICY "Public Access contratistas_docs"
ON storage.objects FOR ALL
USING (bucket_id = 'contratistas_docs')
WITH CHECK (bucket_id = 'contratistas_docs');
