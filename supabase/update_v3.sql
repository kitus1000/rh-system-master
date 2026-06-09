-- Actualización de tabla perfiles
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS apodo TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS ultima_conexion TIMESTAMPTZ;

-- Actualización de configuracion_empresa para la Clave Maestra
ALTER TABLE configuracion_empresa ADD COLUMN IF NOT EXISTS clave_maestra TEXT;

-- Actualización de autorizaciones para rastrear quién firmó
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS id_autorizador UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 1. Tabla de Muro de Actividades (Blog)
CREATE TABLE IF NOT EXISTS muro_alertas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_autor UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    id_departamento UUID REFERENCES cat_departamentos(id_departamento) ON DELETE SET NULL, -- Si es null, es un aviso global
    contenido TEXT NOT NULL,
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Mensajes Privados (Chat)
CREATE TABLE IF NOT EXISTS mensajes_privados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_remitente UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    id_destinatario UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mensaje TEXT NOT NULL,
    leido BOOLEAN DEFAULT FALSE,
    creado_el TIMESTAMPTZ DEFAULT now()
);

-- Políticas RLS básicas para el chat (para seguridad)
-- Esto asume que RLS está habilitado, si no lo está, lo habilitamos:
ALTER TABLE mensajes_privados ENABLE ROW LEVEL SECURITY;
ALTER TABLE muro_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver sus propios mensajes" 
ON mensajes_privados FOR SELECT 
USING (auth.uid() = id_remitente OR auth.uid() = id_destinatario);

CREATE POLICY "Los usuarios pueden enviar mensajes" 
ON mensajes_privados FOR INSERT 
WITH CHECK (auth.uid() = id_remitente);

CREATE POLICY "Todos pueden leer el muro" 
ON muro_alertas FOR SELECT 
USING (true);

CREATE POLICY "Los usuarios pueden publicar en el muro" 
ON muro_alertas FOR INSERT 
WITH CHECK (auth.uid() = id_autor);
