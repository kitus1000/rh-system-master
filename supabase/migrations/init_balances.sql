
-- 1. Create a function to auto-initialize balances for an employee
-- This function will calculate tenure and insert a row into vacaciones_saldos
-- It assumes a '2024-2025' period exists (or generic)

CREATE OR REPLACE FUNCTION initialize_vacation_balance(target_employee_id UUID) 
RETURNS VOID AS $$
DECLARE
    v_fecha_ingreso DATE;
    v_years_service INT;
    v_dias_corresponden INT;
    v_periodo_id UUID;
BEGIN
    -- 1. Get Hiring Date
    SELECT fecha_ingreso INTO v_fecha_ingreso 
    FROM empleado_ingreso 
    WHERE id_empleado = target_employee_id;

    IF v_fecha_ingreso IS NULL THEN
        RAISE EXCEPTION 'Employee % has no hiring date', target_employee_id;
    END IF;

    -- 2. Calculate Service Years (Simple diff)
    v_years_service := EXTRACT(YEAR FROM age(current_date, v_fecha_ingreso))::INT;
    
    -- If less than 1 year, use 1 to give them the first year's right immediately (or 0 if you prefer strict)
    IF v_years_service < 1 THEN 
        v_years_service := 1; 
    END IF;

    -- 3. Calculate Days (Using LFT 2023 Rules stored in logic)
    -- This is a simplified SQL version of the logic
    IF v_years_service = 1 THEN v_dias_corresponden := 12;
    ELSIF v_years_service = 2 THEN v_dias_corresponden := 14;
    ELSIF v_years_service = 3 THEN v_dias_corresponden := 16;
    ELSIF v_years_service = 4 THEN v_dias_corresponden := 18;
    ELSIF v_years_service = 5 THEN v_dias_corresponden := 20;
    ELSE 
        -- Formula: 20 + 2 * floor((years - 1) / 5) for years > 5
        v_dias_corresponden := 20 + (2 * floor((v_years_service - 1) / 5));
    END IF;

    -- 4. Get active period (ensure one exists in cat_periodos_vacacionales)
    -- For now, we pick the first available or a specific one '2025'
    SELECT id_periodo INTO v_periodo_id FROM cat_periodos_vacacionales LIMIT 1;

    IF v_periodo_id IS NULL THEN
        -- Create a default period if none exists
        INSERT INTO cat_periodos_vacacionales (periodo, fecha_inicio, fecha_fin)
        VALUES ('2024-2025', '2024-01-01', '2025-12-31')
        RETURNING id_periodo INTO v_periodo_id;
    END IF;

    -- 5. Insert/Update Balance
    INSERT INTO vacaciones_saldos (id_empleado, id_periodo, dias_asignados, dias_tomados)
    VALUES (target_employee_id, v_periodo_id, v_dias_corresponden, 0)
    ON CONFLICT (id_empleado, id_periodo) 
    DO UPDATE SET dias_asignados = EXCLUDED.dias_asignados;

END;
$$ LANGUAGE plpgsql;

-- 6. Trigger to auto-create balance when an employee is created
CREATE OR REPLACE FUNCTION trigger_init_balance()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM initialize_vacation_balance(NEW.id_empleado);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to empleado_ingreso (since we need the date)
DROP TRIGGER IF EXISTS trg_init_balance ON empleado_ingreso;
CREATE TRIGGER trg_init_balance
AFTER INSERT ON empleado_ingreso
FOR EACH ROW
EXECUTE FUNCTION trigger_init_balance();

-- 7. COMMAND TO RUN FOR EXISTING EMPLOYEES
-- Run this block manually to seed existing ones
DO $$
DECLARE
    emp RECORD;
BEGIN
    FOR emp IN SELECT id_empleado FROM empleado_ingreso LOOP
        PERFORM initialize_vacation_balance(emp.id_empleado);
    END LOOP;
END $$;
