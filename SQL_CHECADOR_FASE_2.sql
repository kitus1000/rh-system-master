-- =========================================================================
-- SCRIPT DE BASE DE DATOS - MÓDULO CHECADOR (Fase 2)
-- Ejecutar en el Editor SQL de Supabase
-- Proyecto: El Expediente (rh-system)
-- =========================================================================

-- 1. EXTENDER TABLA EXISTENTE 'empleados'
-- (Agregamos el token QR y un id_turno para su turno por defecto)
ALTER TABLE empleados 
ADD COLUMN IF NOT EXISTS qr_token TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
ADD COLUMN IF NOT EXISTS id_turno UUID; -- Relación foránea después de crear 'turnos'


-- 2. TABLA: turnos
CREATE TABLE IF NOT EXISTS turnos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,              -- Ej: "Turno Matutino"
  hora_inicio     TIME NOT NULL,              -- Ej: 08:00:00
  hora_fin        TIME,                       -- Ej: 17:00:00
  tolerancia_min  INT DEFAULT 10,             -- Minutos de gracia (10 min)
  ventana_desde   TIME,                       -- Hora mínima para checar ENTRADA
  ventana_hasta   TIME,                       -- Hora máxima para checar ENTRADA        
  bloquear_fuera_ventana BOOLEAN DEFAULT FALSE,
  aplica_dias     TEXT[] DEFAULT '{"Lunes","Martes","Miércoles","Jueves","Viernes"}',
  activo          BOOLEAN DEFAULT TRUE,
  company_id      UUID,                       -- Preparando Multi-Tenant
  creado_el       TIMESTAMPTZ DEFAULT now()
);

-- Ahora sí agregamos la llave foránea a empleados
ALTER TABLE empleados 
  DROP CONSTRAINT IF EXISTS fk_empleado_turno,
  ADD CONSTRAINT fk_empleado_turno FOREIGN KEY (id_turno) REFERENCES turnos(id) ON DELETE SET NULL;


-- 3. TABLA: empleado_turnos (Histórico / Excepciones si las hay)
CREATE TABLE IF NOT EXISTS empleado_turnos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empleado     UUID REFERENCES empleados(id_empleado) ON DELETE CASCADE,
  id_turno        UUID REFERENCES turnos(id) ON DELETE CASCADE,
  fecha_inicio    DATE NOT NULL,
  fecha_fin       DATE,              -- NULL = vigente actual
  creado_por      UUID REFERENCES perfiles(id),
  creado_el       TIMESTAMPTZ DEFAULT now()
);


-- 4. TABLA: cat_tipos_checada (Los 6 tipos definidos)
CREATE TABLE IF NOT EXISTS cat_tipos_checada (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                  TEXT NOT NULL UNIQUE,   -- Llave interna (ENTRADA, SALIDA...)
  label                 TEXT NOT NULL,           -- Frontend label
  requiere_codigo       BOOLEAN DEFAULT FALSE,
  color                 TEXT,                    
  icono                 TEXT,                   
  ordinal               INT DEFAULT 0,           -- Orden visual
  activo                BOOLEAN DEFAULT TRUE
);

-- INSERTAR TIPOS DEFAULT SI NO EXISTEN
INSERT INTO cat_tipos_checada (tipo, label, requiere_codigo, color, ordinal) 
VALUES
  ('ENTRADA', 'ENTRADA', false, 'bg-green-600', 1),
  ('SALIDA', 'SALIDA', false, 'bg-red-600', 2),
  ('COMIDA_SALIDA', 'COMIDA – SALIDA', false, 'bg-amber-500', 3),
  ('COMIDA_REGRESO', 'COMIDA – REGRESO', false, 'bg-amber-600', 4),
  ('PERMISO_PERSONAL', 'PERMISO PERSONAL', true, 'bg-blue-600', 5),
  ('SALIDA_OPERACIONES', 'SALIDA OPERACIONES', true, 'bg-indigo-600', 6)
ON CONFLICT (tipo) DO UPDATE 
SET requiere_codigo = EXCLUDED.requiere_codigo, label = EXCLUDED.label;


-- 5. TABLA: dispositivos_checadores
CREATE TABLE IF NOT EXISTS dispositivos_checadores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,         -- Ej: "Tablet Recepción"
  device_key      TEXT UNIQUE NOT NULL,  -- Token para validar desde el kiosko
  tipo            TEXT DEFAULT 'tablet', -- tablet | web | android
  ubicacion       TEXT,                  
  activo          BOOLEAN DEFAULT TRUE,
  company_id      UUID,
  ultimo_ping     TIMESTAMPTZ,
  creado_el       TIMESTAMPTZ DEFAULT now()
);

-- Insertar un dispositivo genérico para la web local (Temporal MVP)
INSERT INTO dispositivos_checadores (nombre, device_key, tipo, ubicacion)
VALUES ('Checador Web MVP', 'MVP_LOCAL_DEV_KEY_2026', 'web', 'En desarrollo')
ON CONFLICT (device_key) DO NOTHING;


-- 6. TABLA: permisos_autorizados
CREATE TABLE IF NOT EXISTS permisos_autorizados (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            TEXT NOT NULL UNIQUE,        -- 6 dígitos string ('123456')
  id_empleado       UUID NOT NULL REFERENCES empleados(id_empleado) ON DELETE CASCADE,
  tipo_checada      TEXT NOT NULL,               -- EJ: PERMISO_PERSONAL
  vigencia_desde    TIMESTAMPTZ NOT NULL,
  vigencia_hasta    TIMESTAMPTZ NOT NULL,
  usos_maximos      INT DEFAULT 1,
  usos_realizados   INT DEFAULT 0,
  estatus           TEXT DEFAULT 'Activo',       -- Activo | Usado | Vencido | Cancelado
  motivo            TEXT,
  company_id        UUID,
  creado_por        UUID REFERENCES perfiles(id),
  usado_en          TIMESTAMPTZ,
  usado_en_device   UUID REFERENCES dispositivos_checadores(id),
  cancelado_por     UUID REFERENCES perfiles(id),
  cancelado_el      TIMESTAMPTZ,
  creado_el         TIMESTAMPTZ DEFAULT now()
);

-- Índices Permisos
CREATE INDEX IF NOT EXISTS idx_permisos_codigo ON permisos_autorizados(codigo);
CREATE INDEX IF NOT EXISTS idx_permisos_emp ON permisos_autorizados(id_empleado);


-- 7. TABLA: checadas
CREATE TABLE IF NOT EXISTS checadas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_empleado           UUID NOT NULL REFERENCES empleados(id_empleado) ON DELETE CASCADE,
  tipo_checada          TEXT NOT NULL REFERENCES cat_tipos_checada(tipo),
  timestamp_checada     TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_local           DATE NOT NULL,          -- Permite queries ráidos_por_día
  estatus_puntualidad   TEXT,                   -- PUNTUAL | RETARDO | FUERA_VENTANA | SIN_TURNO
  retardo_minutos       INT DEFAULT 0,
  id_permiso            UUID REFERENCES permisos_autorizados(id),
  id_dispositivo        UUID REFERENCES dispositivos_checadores(id),
  id_turno              UUID REFERENCES turnos(id),
  metodo_identificacion TEXT DEFAULT 'QR',      -- QR | NUMERO_EMPLEADO
  company_id            UUID,
  sincronizado          BOOLEAN DEFAULT TRUE,   -- Uso offline android
  origen                TEXT DEFAULT 'web',     -- web | android
  notas                 TEXT,
  creado_el             TIMESTAMPTZ DEFAULT now()
);

-- Índices Checadas
CREATE INDEX IF NOT EXISTS idx_checadas_emp_fecha ON checadas(id_empleado, fecha_local);
CREATE INDEX IF NOT EXISTS idx_checadas_fecha ON checadas(fecha_local);


-- 8. TABLA: auditoria_logs
CREATE TABLE IF NOT EXISTS auditoria_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID REFERENCES perfiles(id),
  accion          TEXT NOT NULL,      
  entidad         TEXT NOT NULL,      
  entidad_id      TEXT,               
  datos_antes     JSONB,
  datos_despues   JSONB,
  company_id      UUID,
  ip_address      TEXT,
  creado_el       TIMESTAMPTZ DEFAULT now()
);


-- =========================================================================
-- CONFIGURACIÓN DE POLÍTICAS DE SEGURIDAD RLS BÁSICAS
-- (Para habilitar lectura de empleados desde el Checador)
-- =========================================================================

-- Aseguramos que las tablas tengan RLS habilitado (Si tienes RLS cerrado)
ALTER TABLE checadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cat_tipos_checada ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispositivos_checadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE permisos_autorizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE empleado_turnos ENABLE ROW LEVEL SECURITY;

-- Excepción RLS explícitas temporal para el MVP (Permite Insert/Select a todos)
-- IMPORTANTE: Para producción la política debe usar JWT o validación por token
CREATE POLICY "Permitir select a todos checadas" ON checadas FOR SELECT USING (true);
CREATE POLICY "Permitir insert a todos checadas" ON checadas FOR INSERT WITH CHECK (true);

CREATE POLICY "Permitir select turnos" ON turnos FOR SELECT USING (true);
CREATE POLICY "Permitir select cat_tipos_checada" ON cat_tipos_checada FOR SELECT USING (true);
CREATE POLICY "Permitir select dispositivos" ON dispositivos_checadores FOR SELECT USING (true);

CREATE POLICY "Permitir select permisos" ON permisos_autorizados FOR SELECT USING (true);
CREATE POLICY "Permitir update permisos" ON permisos_autorizados FOR UPDATE USING (true);

-- =========================================================================
-- LISTO. TODO CREADO SIN AFECTAR TUS TABLAS EXISTENTES.
-- =========================================================================
