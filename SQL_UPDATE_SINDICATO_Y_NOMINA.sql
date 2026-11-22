-- ========================================================================
-- GRUPO MINERO BACÍS S.A. DE C.V. - UNIDAD EL HERRERO
-- ACTUALIZACIÓN DE ESQUEMA: NÓMINA (SEMANAL / QUINCENAL) Y SINDICATO SECCIÓN 45
-- ========================================================================

-- 1. Campos oficiales en empleados para distinguir:
--    - Semanal Sindicalizado (S.N.T.M.M.S.S.R.M. Sección 45) -> Operativos Mina / Planta / Mtto
--    - Semanal de Confianza -> Supervisores / Cuadrillas / Personal administrativo semanal
--    - Quincenal de Confianza -> Directivos / Superintendentes / Jefaturas / Contabilidad / Médicos
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS tipo_nomina VARCHAR(50) DEFAULT 'SEMANAL';
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS es_sindicalizado BOOLEAN DEFAULT TRUE;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS sindicato VARCHAR(100) DEFAULT 'S.N.T.M.M.S.S.R.M. Secc. 45';

-- 2. Clasificación automática inicial para registros existentes basada en puestos ejecutivos / jefaturas
UPDATE empleados
SET 
    tipo_nomina = CASE 
        WHEN UPPER(COALESCE(puesto, '')) LIKE '%SUPERINTENDENTE%' 
          OR UPPER(COALESCE(puesto, '')) LIKE '%GERENTE%' 
          OR UPPER(COALESCE(puesto, '')) LIKE '%SUBDIRECTOR%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%DIRECTOR%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%CONTADOR%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%MEDICO%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%MÉDICO%'
        THEN 'QUINCENAL'
        ELSE 'SEMANAL'
    END,
    es_sindicalizado = CASE
        WHEN UPPER(COALESCE(puesto, '')) LIKE '%SUPERINTENDENTE%' 
          OR UPPER(COALESCE(puesto, '')) LIKE '%GERENTE%' 
          OR UPPER(COALESCE(puesto, '')) LIKE '%JEFE%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%SUPERVISOR%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%COORDINADOR%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%ADMINISTRATIV%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%SISTEMAS%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%CONTADOR%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%MEDICO%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%MÉDICO%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%CONFIANZA%'
        THEN FALSE
        ELSE TRUE
    END,
    sindicato = CASE
        WHEN UPPER(COALESCE(puesto, '')) LIKE '%SUPERINTENDENTE%' 
          OR UPPER(COALESCE(puesto, '')) LIKE '%GERENTE%' 
          OR UPPER(COALESCE(puesto, '')) LIKE '%JEFE%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%SUPERVISOR%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%COORDINADOR%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%ADMINISTRATIV%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%SISTEMAS%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%CONTADOR%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%MEDICO%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%MÉDICO%'
          OR UPPER(COALESCE(puesto, '')) LIKE '%CONFIANZA%'
        THEN 'Confianza'
        ELSE 'S.N.T.M.M.S.S.R.M. Secc. 45'
    END
WHERE tipo_nomina IS NULL OR es_sindicalizado IS NULL;

-- 3. Índices de optimización para filtros y reportes de nómina y sindicato
CREATE INDEX IF NOT EXISTS idx_empleados_tipo_nomina ON empleados(tipo_nomina);
CREATE INDEX IF NOT EXISTS idx_empleados_es_sindicalizado ON empleados(es_sindicalizado);
