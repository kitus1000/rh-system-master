/* ============================================================================
   MÉDICO BACÍS — MOTOR COFEPRIS, PERFILES DE DOCTORES Y GENERADOR DE PDF OFFLINE
   Recetas Médicas COFEPRIS (Abiertas), Pases Médicos y Pases de Hotel
   ============================================================================ */
(function (global) {
  'use strict';

  const COFEPRIS_EMISORES_AUTORIZADOS = [
    { id: 'I', codigo: 'I. Médicos', label: 'I. Médicos (Médico Cirujano / General / Especialista)' },
    { id: 'II', codigo: 'II. Homeópatas', label: 'II. Homeópatas' },
    { id: 'III', codigo: 'III. Cirujanos dentistas', label: 'III. Cirujanos dentistas (Odontólogos)' },
    { id: 'IV', codigo: 'IV. Médicos veterinarios', label: 'IV. Médicos veterinarios, en el área de su competencia' },
    { id: 'V', codigo: 'V. Pasantes en servicio social', label: 'V. Pasantes en servicio social' },
    { id: 'VI', codigo: 'VI. Enfermeras y parteras', label: 'VI. Enfermeras y parteras' },
  ];

  const FORMAS_FARMACEUTICAS = [
    'Tableta', 'Cápsula', 'Gragea', 'Comprimido', 'Jarabe', 'Suspensión Oral',
    'Solución Oral', 'Solución Inyectable', 'Gotas Oftálmicas', 'Gotas Óticas',
    'Spray Nasal', 'Crema / Pomada', 'Gel Tópico', 'Ungüento', 'Supositorio',
    'Parche Transdérmico', 'Aerosol / Inhalador', 'Polvo / Sobre',
  ];

  const VIAS_ADMINISTRACION = [
    'Oral (VO)', 'Sublingual', 'Intramuscular (IM)', 'Intravenosa (IV)',
    'Subcutánea (SC)', 'Tópica / Cutánea', 'Oftálmica', 'Ótica',
    'Nasal', 'Inhalatoria', 'Rectal', 'Vaginal',
  ];

  const DEFAULT_COFEPRIS_CONFIG = {
    modo_abierto_sin_membrete_empresa: true,
    titulo_consultorio_abierto: 'CONSULTORIO MÉDICO PARTICULAR / ATENCIÓN CLÍNICA',
    subtitulo_receta: 'RECETA MÉDICA — FORMATO ABIERTO NORMATIVA COFEPRIS',
    nota_abierta_pie: 'Documento de prescripción clínica emitido bajo criterios de la Ley General de Salud y COFEPRIS. Surtido libre en farmacia.',
    // 16 Obligatorios
    ob_nombre_medico: true,
    ob_categoria_emisor: true,
    ob_cedula_profesional: true,
    ob_institucion_titulo: true,
    ob_fecha: true,
    ob_domicilio_consultorio: true,
    ob_telefono: true,
    ob_firma_medico: true,
    ob_nombre_generico: true,
    ob_forma_farmaceutica: true,
    ob_dosis: true,
    ob_presentacion: true,
    ob_frecuencia: true,
    ob_via_administracion: true,
    ob_duracion_tratamiento: true,
    ob_indicaciones_uso: true,
    // 10 Recomendados
    rec_nombre_paciente: true,
    rec_edad: true,
    rec_sexo: true,
    rec_alergias: true,
    rec_talla: true,
    rec_peso: true,
    rec_imc: true,
    rec_temperatura: true,
    rec_presion_arterial: true,
    rec_diagnostico: true,
    // Visuales
    mostrar_sello_medico: true,
    mostrar_folio: true,
    mostrar_especialidad: true,
  };

  const COFEPRIS_FIELD_CATALOG = [
    { key: 'ob_nombre_medico', label: 'Nombre completo del médico', grupo: 'OBLIGATORIOS_MEDICO' },
    { key: 'ob_categoria_emisor', label: 'Categoría emisor autorizado (I–VI)', grupo: 'OBLIGATORIOS_MEDICO' },
    { key: 'ob_cedula_profesional', label: 'Número de cédula profesional', grupo: 'OBLIGATORIOS_MEDICO' },
    { key: 'ob_institucion_titulo', label: 'Institución que emite el título', grupo: 'OBLIGATORIOS_MEDICO' },
    { key: 'ob_fecha', label: 'Fecha de prescripción', grupo: 'OBLIGATORIOS_MEDICO' },
    { key: 'ob_domicilio_consultorio', label: 'Domicilio completo del consultorio', grupo: 'OBLIGATORIOS_MEDICO' },
    { key: 'ob_telefono', label: 'Teléfono del consultorio', grupo: 'OBLIGATORIOS_MEDICO' },
    { key: 'ob_firma_medico', label: 'Firma autógrafa digital del médico', grupo: 'OBLIGATORIOS_MEDICO' },
    { key: 'ob_nombre_generico', label: 'Nombre genérico del tratamiento', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
    { key: 'ob_forma_farmaceutica', label: 'Forma farmacéutica', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
    { key: 'ob_dosis', label: 'Dosis', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
    { key: 'ob_presentacion', label: 'Presentación', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
    { key: 'ob_frecuencia', label: 'Frecuencia', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
    { key: 'ob_via_administracion', label: 'Vía de administración', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
    { key: 'ob_duracion_tratamiento', label: 'Duración del tratamiento', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
    { key: 'ob_indicaciones_uso', label: 'Indicaciones para el uso', grupo: 'OBLIGATORIOS_TRATAMIENTO' },
    { key: 'rec_nombre_paciente', label: 'Nombre completo del paciente', grupo: 'RECOMENDADOS_PACIENTE' },
    { key: 'rec_edad', label: 'Edad', grupo: 'RECOMENDADOS_PACIENTE' },
    { key: 'rec_sexo', label: 'Sexo', grupo: 'RECOMENDADOS_PACIENTE' },
    { key: 'rec_alergias', label: 'Alergias', grupo: 'RECOMENDADOS_PACIENTE' },
    { key: 'rec_talla', label: 'Talla', grupo: 'RECOMENDADOS_PACIENTE' },
    { key: 'rec_peso', label: 'Peso', grupo: 'RECOMENDADOS_PACIENTE' },
    { key: 'rec_imc', label: 'IMC', grupo: 'RECOMENDADOS_PACIENTE' },
    { key: 'rec_temperatura', label: 'Temperatura', grupo: 'RECOMENDADOS_PACIENTE' },
    { key: 'rec_presion_arterial', label: 'Presión Arterial', grupo: 'RECOMENDADOS_PACIENTE' },
    { key: 'rec_diagnostico', label: 'Diagnóstico médico', grupo: 'RECOMENDADOS_PACIENTE' },
    { key: 'mostrar_especialidad', label: 'Especialidad clínica', grupo: 'VISUALES' },
    { key: 'mostrar_folio', label: 'Folio de receta', grupo: 'VISUALES' },
    { key: 'mostrar_sello_medico', label: 'Recuadro de sello médico', grupo: 'VISUALES' },
  ];

  const META_START = '[[COFEPRIS_META_V1:';
  const META_END = ':COFEPRIS_META_END]]';

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function calcularIMC(pesoStr, tallaStr) {
    const peso = parseFloat(String(pesoStr || '').replace(',', '.'));
    let talla = parseFloat(String(tallaStr || '').replace(',', '.'));
    if (!peso || !talla || peso <= 0 || talla <= 0) return '';
    if (talla > 3) talla = talla / 100;
    const imc = peso / (talla * talla);
    if (!isFinite(imc) || imc <= 0 || imc > 100) return '';
    return imc.toFixed(1);
  }

  function loadCofeprisConfig() {
    try {
      const raw = localStorage.getItem(global.MedicoDB.KEYS.COFEPRIS_CFG);
      if (!raw) return Object.assign({}, DEFAULT_COFEPRIS_CONFIG);
      return Object.assign({}, DEFAULT_COFEPRIS_CONFIG, JSON.parse(raw));
    } catch (_) {
      return Object.assign({}, DEFAULT_COFEPRIS_CONFIG);
    }
  }

  function saveCofeprisConfig(cfg) {
    const next = Object.assign({}, DEFAULT_COFEPRIS_CONFIG, cfg, { actualizado_el: new Date().toISOString() });
    localStorage.setItem(global.MedicoDB.KEYS.COFEPRIS_CFG, JSON.stringify(next));
    return next;
  }

  function applyPreset(current, preset) {
    const next = Object.assign({}, current);
    if (preset === 'COFEPRIS_COMPLETA') {
      COFEPRIS_FIELD_CATALOG.forEach((f) => { next[f.key] = true; });
    } else if (preset === 'SOLO_OBLIGATORIOS') {
      COFEPRIS_FIELD_CATALOG.forEach((f) => {
        next[f.key] = f.grupo !== 'RECOMENDADOS_PACIENTE' || f.key === 'rec_nombre_paciente';
      });
    } else if (preset === 'COMPACTA') {
      COFEPRIS_FIELD_CATALOG.forEach((f) => { next[f.key] = true; });
      ['ob_presentacion', 'rec_sexo', 'rec_talla', 'rec_peso', 'rec_imc', 'rec_temperatura', 'rec_presion_arterial'].forEach((k) => {
        next[k] = false;
      });
    }
    return next;
  }

  function loadDoctorProfiles(sessionProfile, dbMedicos) {
    let list = [];
    try {
      const raw = localStorage.getItem(global.MedicoDB.KEYS.DOCTOR_PROFILES);
      if (raw) list = JSON.parse(raw);
    } catch (_) {
      list = [];
    }

    // Fusionar doctores de la tabla `perfiles` de Supabase si no están aún en la lista local
    if (Array.isArray(dbMedicos)) {
      dbMedicos.forEach((m) => {
        if (!m || !m.id) return;
        const lowerRol = String(m.rol || '').toLowerCase();
        if (!lowerRol.includes('médic') && !lowerRol.includes('medic') && !lowerRol.includes('doctor') && !lowerRol.includes('enferm')) return;
        const idx = list.findIndex((d) => d.id === m.id);
        const isJefe = lowerRol.includes('jefe');
        if (idx === -1) {
          list.push({
            id: m.id,
            nombre_completo: m.nombre_completo || 'Médico de Turno',
            categoria_emisor: lowerRol.includes('enferm') ? 'VI' : 'I',
            cedula_profesional: m.cedula_profesional || '',
            institucion_titulo: m.institucion_titulo || m.universidad || '',
            especialidad: m.especialidad || 'Medicina General',
            domicilio_consultorio: m.domicilio_consultorio || 'Consultorio Médico de Atención Primaria, Durango, Dgo.',
            telefono_consultorio: m.telefono_consultorio || '',
            titulo_consultorio: '',
            firma_base64: m.firma || '',
            es_dr_principal: isJefe,
            id_clinica: m.id_clinica || '',
          });
        } else {
          if (!list[idx].firma_base64 && m.firma) list[idx].firma_base64 = m.firma;
          if (!list[idx].cedula_profesional && m.cedula_profesional) list[idx].cedula_profesional = m.cedula_profesional;
          if (!list[idx].institucion_titulo && (m.institucion_titulo || m.universidad)) {
            list[idx].institucion_titulo = m.institucion_titulo || m.universidad;
          }
          if (isJefe) list[idx].es_dr_principal = true;
        }
      });
    }

    if (sessionProfile && sessionProfile.id) {
      const idx = list.findIndex((d) => d.id === sessionProfile.id);
      const isJefe = global.MedicoDB.isDrJefeRole(sessionProfile.rol);
      if (idx === -1) {
        list.unshift({
          id: sessionProfile.id,
          nombre_completo: sessionProfile.nombre_completo || 'Médico Prescriptor',
          categoria_emisor: 'I',
          cedula_profesional: sessionProfile.cedula_profesional || '',
          institucion_titulo: sessionProfile.institucion_titulo || sessionProfile.universidad || '',
          especialidad: sessionProfile.especialidad || 'Medicina General',
          domicilio_consultorio: sessionProfile.domicilio_consultorio || 'Consultorio Médico de Atención Primaria, Durango, Dgo.',
          telefono_consultorio: sessionProfile.telefono_consultorio || '',
          titulo_consultorio: '',
          firma_base64: sessionProfile.firma || '',
          es_dr_principal: isJefe,
          id_clinica: sessionProfile.id_clinica || '',
        });
      }
    }

    if (list.length === 0) {
      list.push({
        id: 'dr-principal-default',
        nombre_completo: 'Dr. Médico Principal de Unidad',
        categoria_emisor: 'I',
        cedula_profesional: '',
        institucion_titulo: 'Universidad Juárez del Estado de Durango',
        especialidad: 'Medicina General y Ocupacional',
        domicilio_consultorio: 'Consultorio Médico de Atención Primaria, Durango, Dgo.',
        telefono_consultorio: '',
        titulo_consultorio: '',
        firma_base64: '',
        es_dr_principal: true,
        id_clinica: '',
      });
    }

    localStorage.setItem(global.MedicoDB.KEYS.DOCTOR_PROFILES, JSON.stringify(list));
    return list;
  }

  function saveDoctorProfile(doc) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(global.MedicoDB.KEYS.DOCTOR_PROFILES) || '[]'); } catch (_) {}
    const idx = list.findIndex((d) => d.id === doc.id);
    if (idx >= 0) list[idx] = doc;
    else list.push(doc);
    localStorage.setItem(global.MedicoDB.KEYS.DOCTOR_PROFILES, JSON.stringify(list));
    return list;
  }

  function deleteDoctorProfile(docId) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(global.MedicoDB.KEYS.DOCTOR_PROFILES) || '[]'); } catch (_) {}
    const next = list.filter((d) => d.id !== docId);
    localStorage.setItem(global.MedicoDB.KEYS.DOCTOR_PROFILES, JSON.stringify(next));
    return next;
  }

  function getActiveDoctorId() {
    return localStorage.getItem(global.MedicoDB.KEYS.ACTIVE_DOCTOR) || '';
  }

  function setActiveDoctorId(id) {
    localStorage.setItem(global.MedicoDB.KEYS.ACTIVE_DOCTOR, id);
  }

  function encodeConsultaDiagnosticoWithCofepris(diagnosticoVisible, meta) {
    try {
      const lightDoctor = meta.doctor_snapshot
        ? Object.assign({}, meta.doctor_snapshot, {
            firma_base64: meta.doctor_snapshot.firma_base64 ? '__HAS_SIG__' : '',
          })
        : null;
      const compactMeta = Object.assign({}, meta, { doctor_snapshot: lightDoctor });
      const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(compactMeta))));
      return `${diagnosticoVisible}\n\n${META_START}${b64}${META_END}`;
    } catch (_) {
      return diagnosticoVisible;
    }
  }

  function decodeConsultaCofeprisMeta(idConsulta, diagnosticoRaw) {
    const raw = diagnosticoRaw || '';
    let cleanDiag = raw.split('[INDICACIONES RECETA]')[0].split(META_START)[0].trim();
    let parsedMeta = null;

    if (idConsulta) {
      try {
        const store = JSON.parse(localStorage.getItem(global.MedicoDB.KEYS.CONSULTA_META) || '{}');
        if (store[idConsulta]) parsedMeta = store[idConsulta];
      } catch (_) {}
    }

    if (!parsedMeta && raw.includes(META_START) && raw.includes(META_END)) {
      try {
        const start = raw.indexOf(META_START) + META_START.length;
        const end = raw.indexOf(META_END, start);
        const b64 = raw.slice(start, end);
        parsedMeta = JSON.parse(decodeURIComponent(escape(atob(b64))));
      } catch (_) {}
    }

    if (parsedMeta && parsedMeta.diagnostico_limpio) {
      cleanDiag = parsedMeta.diagnostico_limpio;
    }
    return { cleanDiagnostico: cleanDiag, meta: parsedMeta };
  }

  function saveConsultaMetaLocal(idConsulta, meta) {
    if (!idConsulta) return;
    try {
      const store = JSON.parse(localStorage.getItem(global.MedicoDB.KEYS.CONSULTA_META) || '{}');
      store[idConsulta] = meta;
      const keys = Object.keys(store);
      if (keys.length > 150) delete store[keys[0]];
      localStorage.setItem(global.MedicoDB.KEYS.CONSULTA_META, JSON.stringify(store));
    } catch (_) {}
  }

  /* ==========================================================================
     1. RECETA MÉDICA COFEPRIS (HTML ADAPTATIVO + PDF OFFLINE jsPDF)
     ========================================================================== */
  function buildRecetaHtml(input) {
    const { cfg, doctor, folio, fechaTexto, paciente, medicamentos } = input;
    const emisor = COFEPRIS_EMISORES_AUTORIZADOS.find((e) => e.id === doctor.categoria_emisor) || COFEPRIS_EMISORES_AUTORIZADOS[0];

    const docPills = [];
    if (cfg.ob_categoria_emisor) docPills.push(`<div class="pill"><span>Personal Autorizado</span><strong>${esc(emisor.codigo)}</strong></div>`);
    if (cfg.ob_cedula_profesional) docPills.push(`<div class="pill"><span>Cédula Profesional</span><strong>${esc(doctor.cedula_profesional || 'POR CAPTURAR')}</strong></div>`);
    if (cfg.ob_institucion_titulo) docPills.push(`<div class="pill"><span>Institución del Título</span><strong>${esc(doctor.institucion_titulo || 'POR CAPTURAR')}</strong></div>`);
    if (cfg.ob_telefono) docPills.push(`<div class="pill"><span>Teléfono</span><strong>${esc(doctor.telefono_consultorio || 'S/N')}</strong></div>`);
    if (cfg.ob_domicilio_consultorio) docPills.push(`<div class="pill wide"><span>Domicilio del Consultorio</span><strong>${esc(doctor.domicilio_consultorio || 'POR CAPTURAR')}</strong></div>`);

    const vitals = [];
    if (cfg.rec_edad) vitals.push({ l: 'Edad', v: paciente.edad || '—' });
    if (cfg.rec_sexo) vitals.push({ l: 'Sexo', v: paciente.sexo || '—' });
    if (cfg.rec_peso) vitals.push({ l: 'Peso', v: paciente.peso ? `${paciente.peso} kg` : '—' });
    if (cfg.rec_talla) vitals.push({ l: 'Talla', v: paciente.talla || '—' });
    if (cfg.rec_imc) {
      const imcVal = paciente.imc || calcularIMC(paciente.peso, paciente.talla);
      vitals.push({ l: 'IMC', v: imcVal ? `${imcVal} kg/m²` : '—' });
    }
    if (cfg.rec_temperatura) vitals.push({ l: 'Temperatura', v: paciente.temperatura ? `${paciente.temperatura} °C` : '—' });
    if (cfg.rec_presion_arterial) vitals.push({ l: 'Presión Arterial', v: paciente.presion_arterial ? `${paciente.presion_arterial} mmHg` : '—' });
    if (cfg.rec_alergias) vitals.push({ l: 'Alergias', v: paciente.alergias || 'Negadas' });

    const medsHtml = (medicamentos && medicamentos.length > 0)
      ? medicamentos.map((m, i) => {
          const tags = [];
          if (cfg.ob_forma_farmaceutica && m.forma_farmaceutica) tags.push(`<span><b>Forma:</b> ${esc(m.forma_farmaceutica)}</span>`);
          if (cfg.ob_presentacion && m.presentacion) tags.push(`<span><b>Presentación:</b> ${esc(m.presentacion)}</span>`);
          if (cfg.ob_dosis && m.dosis) tags.push(`<span class="hl"><b>Dosis:</b> ${esc(m.dosis)}</span>`);
          if (cfg.ob_frecuencia && m.frecuencia) tags.push(`<span class="hl"><b>Frecuencia:</b> ${esc(m.frecuencia)}</span>`);
          if (cfg.ob_via_administracion && m.via_administracion) tags.push(`<span><b>Vía:</b> ${esc(m.via_administracion)}</span>`);
          if (cfg.ob_duracion_tratamiento && m.duracion_tratamiento) tags.push(`<span class="hl"><b>Duración:</b> ${esc(m.duracion_tratamiento)}</span>`);
          return `
            <div class="med">
              <div class="med-n">${i + 1}</div>
              <div class="med-b">
                ${cfg.ob_nombre_generico ? `<div class="med-t">${esc(m.nombre_generico || 'TRATAMIENTO')} ${m.cantidad ? `<span class="qty">Cant.: ${m.cantidad}</span>` : ''}</div>` : ''}
                ${m.nombre_comercial ? `<div class="med-sub">Denominación distintiva: ${esc(m.nombre_comercial)}</div>` : ''}
                ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
                ${cfg.ob_indicaciones_uso && m.indicaciones_uso ? `<div class="ind"><b>Indicaciones:</b> ${esc(m.indicaciones_uso)}</div>` : ''}
              </div>
            </div>`;
        }).join('')
      : '<div class="empty">Valoración clínica y seguimiento sin prescripción farmacológica adicional.</div>';

    const title = (doctor.titulo_consultorio || cfg.titulo_consultorio_abierto || 'CONSULTORIO MÉDICO').trim();

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Receta COFEPRIS</title><style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:Segoe UI,Arial,sans-serif}
      body{background:#f1f5f9;color:#0f172a;padding:14px;font-size:12px}
      .sheet{max-width:800px;margin:0 auto;background:#fff;border:1.5px solid #cbd5e1;border-radius:14px;overflow:hidden}
      .bar{height:6px;background:linear-gradient(90deg,#0b2559,#1d4ed8,#0d9488)}
      .head{padding:16px 20px;border-bottom:1.5px solid #e2e8f0;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .title{font-size:15px;font-weight:900;color:#0b2559}
      .sub{font-size:10px;font-weight:800;color:#0d9488;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
      .doc-name{font-size:14px;font-weight:900;margin-top:6px}
      .esp{font-size:11px;font-weight:700;color:#475569}
      .right{text-align:right;font-size:11px}
      .folio{display:inline-block;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:6px;padding:3px 8px;font-weight:900;margin-bottom:4px}
      .pills{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;padding:12px 20px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
      .pill{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px}
      .pill.wide{grid-column:1/-1}
      .pill span{display:block;font-size:9px;text-transform:uppercase;color:#64748b;font-weight:800}
      .pill strong{font-size:11px;color:#0f172a}
      .sec{padding:14px 20px;border-bottom:1px solid #e2e8f0}
      .sec-h{font-size:10px;font-weight:900;text-transform:uppercase;color:#1d4ed8;letter-spacing:.5px;margin-bottom:8px}
      .pat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-bottom:8px}
      .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px}
      .box span{display:block;font-size:9px;font-weight:800;text-transform:uppercase;color:#64748b}
      .box strong{font-size:12px}
      .vitals{display:grid;grid-template-columns:repeat(auto-fit,minmax(95px,1fr));gap:6px}
      .v{background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:6px 8px}
      .v span{display:block;font-size:8.5px;font-weight:800;text-transform:uppercase;color:#0f766e}
      .v strong{font-size:11px}
      .med{display:flex;gap:10px;border:1px solid #cbd5e1;border-radius:10px;padding:10px;margin-bottom:8px;background:#fff}
      .med-n{width:24px;height:24px;border-radius:999px;background:#0b2559;color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0}
      .med-b{flex:1}
      .med-t{font-size:13px;font-weight:900;color:#0f172a;display:flex;justify-content:space-between;gap:8px}
      .qty{font-size:10px;background:#eff6ff;color:#1d4ed8;padding:2px 7px;border-radius:6px}
      .med-sub{font-size:10.5px;color:#475569;margin-top:2px}
      .tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;font-size:10.5px}
      .tags span{background:#f1f5f9;border:1px solid #e2e8f0;padding:2px 7px;border-radius:6px}
      .tags span.hl{background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a}
      .ind{margin-top:6px;padding-top:5px;border-top:1px dashed #cbd5e1;font-size:11px;color:#1e293b}
      .foot{padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
      .sig{text-align:center;min-width:220px}
      .sig img{max-height:66px;max-width:210px;object-fit:contain;display:block;margin:0 auto 4px}
      .sig-line{border-top:1.5px solid #0f172a;padding-top:4px;font-weight:900;font-size:11px}
      .sello{border:1.5px dashed #94a3b8;border-radius:10px;padding:12px 18px;font-size:10px;color:#64748b;text-align:center}
      .note{background:#f8fafc;padding:9px 20px;font-size:9.5px;color:#64748b;text-align:center;border-top:1px solid #e2e8f0}
      @media print{body{background:#fff;padding:0}.sheet{border:none;border-radius:0}}
    </style></head><body><div class="sheet"><div class="bar"></div>
      <div class="head">
        <div>
          <div class="title">${esc(title)}</div>
          <div class="sub">${esc(cfg.subtitulo_receta)}</div>
          ${cfg.ob_nombre_medico ? `<div class="doc-name">${esc(doctor.nombre_completo)}</div>` : ''}
          ${cfg.mostrar_especialidad && doctor.especialidad ? `<div class="esp">${esc(doctor.especialidad)}</div>` : ''}
        </div>
        <div class="right">
          ${cfg.mostrar_folio && folio ? `<div class="folio">${esc(folio)}</div><br>` : ''}
          ${cfg.ob_fecha ? `<div><b>Fecha:</b> ${esc(fechaTexto)}</div>` : ''}
        </div>
      </div>
      ${docPills.length ? `<div class="pills">${docPills.join('')}</div>` : ''}
      ${(cfg.rec_nombre_paciente || cfg.rec_diagnostico || vitals.length) ? `
      <div class="sec">
        <div class="sec-h">Datos del Paciente y Valoración Clínica</div>
        ${(cfg.rec_nombre_paciente || cfg.rec_diagnostico) ? `
        <div class="pat-grid">
          ${cfg.rec_nombre_paciente ? `<div class="box"><span>Nombre del Paciente</span><strong>${esc(paciente.nombre_completo)}</strong></div>` : ''}
          ${cfg.rec_diagnostico ? `<div class="box"><span>Diagnóstico Médico</span><strong>${esc(paciente.diagnostico || 'Valoración general')}</strong></div>` : ''}
        </div>` : ''}
        ${vitals.length ? `<div class="vitals">${vitals.map((x) => `<div class="v"><span>${esc(x.l)}</span><strong>${esc(x.v)}</strong></div>`).join('')}</div>` : ''}
      </div>` : ''}
      <div class="sec">
        <div class="sec-h">Rx — Prescripción e Indicaciones Terapéuticas</div>
        ${medsHtml}
      </div>
      <div class="foot">
        ${cfg.mostrar_sello_medico ? '<div class="sello">SELLO DEL MÉDICO / FARMACIA</div>' : '<div></div>'}
        ${cfg.ob_firma_medico ? `
        <div class="sig">
          ${doctor.firma_base64 ? `<img src="${doctor.firma_base64}" alt="Firma" />` : '<div style="height:48px"></div>'}
          <div class="sig-line">${esc(doctor.nombre_completo)}</div>
          ${cfg.ob_cedula_profesional && doctor.cedula_profesional ? `<div style="font-size:10px;color:#475569">Céd. Prof. ${esc(doctor.cedula_profesional)}</div>` : ''}
        </div>` : ''}
      </div>
      <div class="note">${esc(cfg.nota_abierta_pie)}</div>
    </div></body></html>`;
  }

  function downloadRecetaPDF(input) {
    const { jsPDF } = global.jspdf || {};
    if (!jsPDF) return alert('Librería jsPDF no disponible.');
    const { cfg, doctor, folio, fechaTexto, paciente, medicamentos } = input;
    const emisor = COFEPRIS_EMISORES_AUTORIZADOS.find((e) => e.id === doctor.categoria_emisor) || COFEPRIS_EMISORES_AUTORIZADOS[0];
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    let y = 14;

    // Franja superior clínica
    doc.setFillColor(11, 37, 89);
    doc.rect(0, 0, 216, 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(11, 37, 89);
    const title = (doctor.titulo_consultorio || cfg.titulo_consultorio_abierto || 'CONSULTORIO MÉDICO').trim();
    doc.text(title.slice(0, 68), 14, y);
    y += 5;

    doc.setFontSize(8.5);
    doc.setTextColor(13, 148, 136);
    doc.text(cfg.subtitulo_receta || 'RECETA MÉDICA COFEPRIS', 14, y);
    if (cfg.mostrar_folio && folio) {
      doc.setTextColor(29, 78, 216);
      doc.text(`FOLIO: ${folio}`, 202, y, { align: 'right' });
    }
    y += 6;

    doc.setTextColor(15, 23, 42);
    if (cfg.ob_nombre_medico) {
      doc.setFontSize(11.5);
      doc.text(doctor.nombre_completo || 'Médico Prescriptor', 14, y);
      y += 4.5;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const metaLines = [];
    if (cfg.mostrar_especialidad && doctor.especialidad) metaLines.push(`Especialidad: ${doctor.especialidad}`);
    if (cfg.ob_categoria_emisor) metaLines.push(`Emisor: ${emisor.codigo}`);
    if (cfg.ob_cedula_profesional) metaLines.push(`Céd. Prof.: ${doctor.cedula_profesional || 'POR CAPTURAR'}`);
    if (cfg.ob_institucion_titulo) metaLines.push(`Título: ${doctor.institucion_titulo || 'POR CAPTURAR'}`);
    if (cfg.ob_telefono && doctor.telefono_consultorio) metaLines.push(`Tel.: ${doctor.telefono_consultorio}`);
    if (metaLines.length) {
      const wrapped = doc.splitTextToSize(metaLines.join('  |  '), 188);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 4 + 1;
    }
    if (cfg.ob_domicilio_consultorio && doctor.domicilio_consultorio) {
      const dom = doc.splitTextToSize(`Domicilio: ${doctor.domicilio_consultorio}`, 188);
      doc.text(dom, 14, y);
      y += dom.length * 4 + 1;
    }
    if (cfg.ob_fecha) {
      doc.setFont('helvetica', 'bold');
      doc.text(`Fecha: ${fechaTexto}`, 14, y);
      y += 5;
    }

    doc.setDrawColor(203, 213, 225);
    doc.line(14, y, 202, y);
    y += 6;

    // Datos del paciente y signos
    if (cfg.rec_nombre_paciente || cfg.rec_diagnostico) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      if (cfg.rec_nombre_paciente) {
        doc.text(`PACIENTE: ${(paciente.nombre_completo || '').toUpperCase()}`, 14, y);
        y += 5;
      }
      if (cfg.rec_diagnostico) {
        doc.setFont('helvetica', 'normal');
        const diagLines = doc.splitTextToSize(`DIAGNÓSTICO: ${paciente.diagnostico || 'Valoración general'}`, 188);
        doc.text(diagLines, 14, y);
        y += diagLines.length * 4.5 + 1;
      }
    }

    const vParts = [];
    if (cfg.rec_edad && paciente.edad) vParts.push(`Edad: ${paciente.edad}`);
    if (cfg.rec_sexo && paciente.sexo) vParts.push(`Sexo: ${paciente.sexo}`);
    if (cfg.rec_peso && paciente.peso) vParts.push(`Peso: ${paciente.peso} kg`);
    if (cfg.rec_talla && paciente.talla) vParts.push(`Talla: ${paciente.talla}`);
    const imcVal = paciente.imc || calcularIMC(paciente.peso, paciente.talla);
    if (cfg.rec_imc && imcVal) vParts.push(`IMC: ${imcVal}`);
    if (cfg.rec_temperatura && paciente.temperatura) vParts.push(`Temp: ${paciente.temperatura}°C`);
    if (cfg.rec_presion_arterial && paciente.presion_arterial) vParts.push(`TA: ${paciente.presion_arterial}`);
    if (cfg.rec_alergias && paciente.alergias) vParts.push(`Alergias: ${paciente.alergias}`);
    if (vParts.length) {
      doc.setFillColor(240, 253, 250);
      const vLines = doc.splitTextToSize(vParts.join('  •  '), 182);
      doc.roundedRect(14, y - 3.5, 188, vLines.length * 4.5 + 4, 2, 2, 'F');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 118, 110);
      doc.text(vLines, 17, y + 0.5);
      y += vLines.length * 4.5 + 6;
    }

    // Prescripción Rx
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(29, 78, 216);
    doc.text('Rx — TRATAMIENTO E INDICACIONES', 14, y);
    y += 6;
    doc.setTextColor(15, 23, 42);

    const meds = Array.isArray(medicamentos) ? medicamentos : [];
    if (meds.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text('Valoración clínica y seguimiento sin prescripción farmacológica adicional.', 14, y);
      y += 8;
    } else {
      meds.forEach((m, idx) => {
        if (y > 225) { doc.addPage(); y = 18; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        const head = cfg.ob_nombre_generico
          ? `${idx + 1}. ${m.nombre_generico || 'TRATAMIENTO'}${m.cantidad ? ` (Cant: ${m.cantidad})` : ''}`
          : `${idx + 1}. Prescripción`;
        doc.text(head, 14, y);
        y += 4.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.8);
        const specs = [];
        if (cfg.ob_forma_farmaceutica && m.forma_farmaceutica) specs.push(`Forma: ${m.forma_farmaceutica}`);
        if (cfg.ob_presentacion && m.presentacion) specs.push(`Pres.: ${m.presentacion}`);
        if (cfg.ob_dosis && m.dosis) specs.push(`Dosis: ${m.dosis}`);
        if (cfg.ob_frecuencia && m.frecuencia) specs.push(`Frec.: ${m.frecuencia}`);
        if (cfg.ob_via_administracion && m.via_administracion) specs.push(`Vía: ${m.via_administracion}`);
        if (cfg.ob_duracion_tratamiento && m.duracion_tratamiento) specs.push(`Duración: ${m.duracion_tratamiento}`);
        if (specs.length) {
          const sl = doc.splitTextToSize(specs.join('  |  '), 182);
          doc.text(sl, 18, y);
          y += sl.length * 4.2;
        }
        if (cfg.ob_indicaciones_uso && m.indicaciones_uso) {
          const il = doc.splitTextToSize(`Indicaciones: ${m.indicaciones_uso}`, 182);
          doc.text(il, 18, y);
          y += il.length * 4.2;
        }
        y += 3.5;
      });
    }

    // Firma del médico
    const sigY = Math.max(y + 12, 232);
    if (cfg.ob_firma_medico) {
      if (doctor.firma_base64 && doctor.firma_base64.startsWith('data:image')) {
        try {
          const fmt = doctor.firma_base64.includes('image/jpeg') ? 'JPEG' : 'PNG';
          doc.addImage(doctor.firma_base64, fmt, 130, sigY - 18, 52, 16);
        } catch (_) {}
      }
      doc.setDrawColor(15, 23, 42);
      doc.line(122, sigY, 198, sigY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(doctor.nombre_completo || 'Firma del Médico', 160, sigY + 4.5, { align: 'center' });
      if (cfg.ob_cedula_profesional && doctor.cedula_profesional) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Céd. Prof. ${doctor.cedula_profesional}`, 160, sigY + 8.5, { align: 'center' });
      }
    }

    if (cfg.mostrar_sello_medico) {
      doc.setDrawColor(148, 163, 184);
      doc.roundedRect(14, sigY - 12, 66, 20, 2, 2, 'S');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('SELLO MÉDICO / FARMACIA', 47, sigY - 1, { align: 'center' });
    }

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(cfg.nota_abierta_pie || '', 108, 270, { align: 'center', maxWidth: 186 });

    const safeName = (paciente.nombre_completo || 'Paciente').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 28);
    doc.save(`Receta_COFEPRIS_${safeName}.pdf`);
  }

  /* ==========================================================================
     2. PASE MÉDICO OFICIAL (PDF OFFLINE + HTML PREVIEW)
     ========================================================================== */
  function buildPaseMedicoHtml(pase, doctor) {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Pase Médico ${esc(pase.folio)}</title><style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:Segoe UI,Arial,sans-serif}
      body{background:#f1f5f9;padding:14px;color:#0f172a;font-size:12px}
      .sheet{max-width:800px;margin:0 auto;background:#fff;border:1.5px solid #cbd5e1;border-radius:12px;overflow:hidden}
      .top{background:#0b2559;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;align-items:center}
      .top h1{font-size:15px;font-weight:900}
      .badge{background:${pase.urgencia === 'SI' ? '#dc2626' : '#0d9488'};color:#fff;padding:4px 10px;border-radius:8px;font-weight:900;font-size:11px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:14px 20px}
      .cell{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:7px 10px}
      .cell.full{grid-column:1/-1}
      .cell span{display:block;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase}
      .cell strong{font-size:11.5px}
      .sigs{padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:24px;text-align:center}
      .sigs img{max-height:58px;margin:0 auto 4px;display:block}
      .line{border-top:1.5px solid #0f172a;padding-top:4px;font-weight:800;font-size:10.5px}
      @media print{body{background:#fff;padding:0}.sheet{border:none}}
    </style></head><body><div class="sheet">
      <div class="top">
        <div>
          <h1>GRUPO MINERO BACÍS — PASE MÉDICO OFICIAL</h1>
          <div style="font-size:11px;color:#bae6fd">Folio: ${esc(pase.folio || 'S/F')} · Unidad: ${esc(pase.unidad_refiere || 'UNIDAD MEDICA BACIS')}</div>
        </div>
        <span class="badge">${pase.urgencia === 'SI' ? 'URGENCIA' : 'ORDINARIO'}</span>
      </div>
      <div class="grid">
        <div class="cell"><span>Paciente</span><strong>${esc(pase.paciente_nombre || pase.pacientes?.nombre_completo || '—')}</strong></div>
        <div class="cell"><span>Parentesco / Trabajador</span><strong>${esc(pase.parentesco || 'TITULAR')} — ${esc(pase.nombre_trabajador || '')}</strong></div>
        <div class="cell"><span>Departamento / Puesto</span><strong>${esc(pase.departamento_pasajero || '—')}</strong></div>
        <div class="cell"><span>Se Refiere A (Clínica Destino)</span><strong>${esc(pase.unidad_se_refiere || '—')}</strong></div>
        <div class="cell"><span>Servicio / Especialidad</span><strong>${esc(pase.servicio_se_envia || 'VALORACIÓN MÉDICA')}</strong></div>
        <div class="cell"><span>Fecha Salida / Retorno</span><strong>${esc(pase.fecha_salida || '—')} ${pase.fecha_retorno ? `| Retorno: ${esc(pase.fecha_retorno)}` : ''} ${pase.fecha_cita ? `| Cita: ${esc(pase.fecha_cita)}` : ''}</strong></div>
        <div class="cell"><span>Transporte / Hotel</span><strong>${esc(pase.medio_transporte || 'VIA TERRESTRE')} ${pase.requiere_hotel ? `· HOTEL: ${esc(pase.hotel_nombre || 'AUTORIZADO')}` : ''}</strong></div>
        <div class="cell full"><span>Signos Vitales</span><strong>TA: ${esc(pase.sv_ta || '—')} · Temp: ${esc(pase.sv_temp || '—')} · FC: ${esc(pase.sv_fc || '—')} · FR: ${esc(pase.sv_fr || '—')} · Peso: ${esc(pase.sv_peso || '—')} · Talla: ${esc(pase.sv_talla || '—')}</strong></div>
        <div class="cell full"><span>Padecimiento Actual</span><strong>${esc(pase.padecimiento_actual || pase.motivo || '—')}</strong></div>
        <div class="cell full"><span>Impresión Diagnóstica</span><strong>${esc(pase.impresion_diagnostica || '—')}</strong></div>
        <div class="cell full"><span>Estudios Paraclínicos / Comentarios</span><strong>${esc(pase.estudios_paraclinicos || '')} — ${esc(pase.comentarios || '')}</strong></div>
        <div class="cell"><span>Acompañante</span><strong>${esc(pase.acompanante || 'NO REQUIERE')}</strong></div>
        <div class="cell"><span>Edad</span><strong>${esc(pase.edad || '—')}</strong></div>
      </div>
      <div class="sigs">
        <div>
          ${doctor && doctor.firma_base64 ? `<img src="${doctor.firma_base64}" />` : '<div style="height:46px"></div>'}
          <div class="line">${esc(pase.medico_refiere || (doctor && doctor.nombre_completo) || 'Médico que Refiere')}</div>
          <div style="font-size:10px;color:#475569">Céd. ${esc(pase.cedula_refiere || (doctor && doctor.cedula_profesional) || '')}</div>
        </div>
        <div>
          <div style="height:46px"></div>
          <div class="line">${esc(pase.medico_responsable_unidad || 'Médico Responsable de Unidad')}</div>
          <div style="font-size:10px;color:#475569">Céd. ${esc(pase.cedula_responsable_unidad || '')}</div>
        </div>
      </div>
    </div></body></html>`;
  }

  function downloadPaseMedicoPDF(pase, doctor) {
    const { jsPDF } = global.jspdf || {};
    if (!jsPDF) return alert('Librería jsPDF no disponible.');
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    doc.setFillColor(11, 37, 89);
    doc.rect(0, 0, 216, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('GRUPO MINERO BACIS S.A. DE C.V. — PASE MÉDICO OFICIAL', 14, 10);
    doc.setFontSize(9.5);
    doc.text(`FOLIO: ${pase.folio || 'S/F'}   |   URGENCIA: ${pase.urgencia || 'NO'}   |   UNIDAD: ${pase.unidad_refiere || 'UNIDAD MEDICA BACIS'}`, 14, 17);

    let y = 32;
    doc.setTextColor(15, 23, 42);
    const rows = [
      ['Paciente', pase.paciente_nombre || (pase.pacientes && pase.pacientes.nombre_completo) || '—'],
      ['Trabajador / Parentesco', `${pase.nombre_trabajador || '—'} (${pase.parentesco || 'TITULAR'})`],
      ['Departamento / Puesto', pase.departamento_pasajero || '—'],
      ['Edad / Acompañante', `${pase.edad || '—'}  |  Acompañante: ${pase.acompanante || 'NO REQUIERE'}`],
      ['Clínica Destino', pase.unidad_se_refiere || '—'],
      ['Servicio / Especialidad', pase.servicio_se_envia || 'VALORACIÓN MÉDICA'],
      ['Fecha Salida / Retorno', `${pase.fecha_salida || '—'}  /  Retorno: ${pase.fecha_retorno || '—'}`],
      ['Transporte / Hotel', `${pase.medio_transporte || 'VIA TERRESTRE'}${pase.requiere_hotel ? `  |  HOTEL: ${pase.hotel_nombre || 'AUTORIZADO'}` : ''}`],
      ['Signos Vitales', `TA: ${pase.sv_ta || '-'} | Temp: ${pase.sv_temp || '-'} | FC: ${pase.sv_fc || '-'} | FR: ${pase.sv_fr || '-'} | Peso: ${pase.sv_peso || '-'} | Talla: ${pase.sv_talla || '-'}`],
      ['Padecimiento Actual', pase.padecimiento_actual || pase.motivo || '—'],
      ['Impresión Diagnóstica', pase.impresion_diagnostica || '—'],
      ['Estudios Paraclínicos', pase.estudios_paraclinicos || '—'],
      ['Comentarios', pase.comentarios || '—'],
    ];
    rows.forEach(([label, val]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(29, 78, 216);
      doc.text(label.toUpperCase() + ':', 14, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      const lines = doc.splitTextToSize(String(val || '—'), 136);
      doc.text(lines, 64, y);
      y += Math.max(6, lines.length * 4.6 + 2);
    });

    const sigY = Math.max(y + 18, 235);
    if (doctor && doctor.firma_base64 && doctor.firma_base64.startsWith('data:image')) {
      try {
        const fmt = doctor.firma_base64.includes('image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(doctor.firma_base64, fmt, 26, sigY - 18, 48, 15);
      } catch (_) {}
    }
    doc.line(18, sigY, 92, sigY);
    doc.line(120, sigY, 194, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(pase.medico_refiere || 'Médico que Refiere', 55, sigY + 5, { align: 'center' });
    doc.text(pase.medico_responsable_unidad || 'Médico Responsable Unidad', 157, sigY + 5, { align: 'center' });
    doc.save(`Pase_Medico_${(pase.folio || 'SN').replace(/[^a-zA-Z0-9-]/g, '_')}.pdf`);
  }

  /* ==========================================================================
     3. PASE DE HOTEL (HOJA DIVIDIDA ORIGINAL + COPIA — HTML & PDF OFFLINE)
     ========================================================================== */
  function buildPaseHotelHtml(data) {
    const fechaLarga = data.fecha_salida
      ? new Date(data.fecha_salida + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const half = (tag) => `
      <div class="half">
        <div>
          <div class="hdr">${esc(data.empresa)}<br>${esc(data.unidad)}</div>
          <div class="sub">HOSPEDAJE EN ${esc(data.hotel_nombre)} (${tag})</div>
          <table>
            <tr><th colspan="2">A FAVOR DE</th></tr>
            <tr><th>PASE MÉDICO / PACIENTE</th><td>${esc(data.pase_medico)}</td></tr>
            <tr><th>ACOMPAÑANTE</th><td>${esc(data.acompanante || 'NO REQUIERE')}</td></tr>
          </table>
          <div class="row"><span>SALIDA DE LA UNIDAD</span><span>${esc(fechaLarga)}</span></div>
        </div>
        <div class="sigs">
          <div><div class="ln"></div>FIRMA TRABAJADOR</div>
          <div><div class="ln"></div>FIRMA SERVICIOS MÉDICOS / RH</div>
        </div>
      </div>`;
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Pase de Hotel</title><style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:Arial,sans-serif}
      body{background:#f1f5f9;padding:12px;color:#0f172a}
      .page{max-width:780px;margin:0 auto;background:#fff;padding:18px;border-radius:12px}
      .half{border:1.5px solid #334155;border-radius:10px;padding:16px;min-height:290px;display:flex;flex-direction:column;justify-content:space-between}
      .hdr{text-align:center;font-weight:900;font-size:14px;color:#0b2559}
      .sub{text-align:center;font-weight:900;font-size:13px;color:#6d28d9;text-decoration:underline;margin:8px 0 12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #0f172a;padding:7px 9px;text-align:left}
      th{background:#f1f5f9}
      .row{display:flex;justify-content:space-between;font-weight:800;font-size:12px;border-bottom:1px solid #0f172a;padding:12px 0 5px;text-transform:capitalize}
      .sigs{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:34px;text-align:center;font-size:10.5px;font-weight:800}
      .ln{border-top:1.5px solid #0f172a;margin-bottom:4px}
      .cut{border-top:2px dashed #94a3b8;text-align:center;margin:18px 0;position:relative}
      .cut span{position:relative;top:-9px;background:#fff;padding:0 10px;font-size:10.5px;color:#64748b;font-weight:800}
    </style></head><body><div class="page">${half('ORIGINAL')}<div class="cut"><span>✂ CORTAR POR AQUÍ (ORIGINAL Y COPIA) ✂</span></div>${half('COPIA')}</div></body></html>`;
  }

  function downloadPaseHotelPDF(data) {
    const { jsPDF } = global.jspdf || {};
    if (!jsPDF) return alert('Librería jsPDF no disponible.');
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const fechaLarga = data.fecha_salida
      ? new Date(data.fecha_salida + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('es-MX');

    [14, 152].forEach((topY, idx) => {
      doc.setDrawColor(51, 65, 85);
      doc.roundedRect(14, topY, 188, 114, 3, 3, 'S');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(11, 37, 89);
      doc.text(data.empresa || 'GRUPO MINERO BACIS S.A. DE C.V.', 108, topY + 10, { align: 'center' });
      doc.setFontSize(10);
      doc.text(data.unidad || 'UNIDAD "EL HERRERO"', 108, topY + 16, { align: 'center' });
      doc.setTextColor(109, 40, 217);
      doc.setFontSize(11);
      doc.text(`HOSPEDAJE EN ${(data.hotel_nombre || 'HOTEL').toUpperCase()} (${idx === 0 ? 'ORIGINAL' : 'COPIA'})`, 108, topY + 25, { align: 'center' });

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.text(`PASE MÉDICO / PACIENTE: ${(data.pase_medico || '').toUpperCase()}`, 22, topY + 42);
      doc.text(`ACOMPAÑANTE: ${(data.acompanante || 'NO REQUIERE').toUpperCase()}`, 22, topY + 52);
      doc.text(`SALIDA DE LA UNIDAD: ${fechaLarga.toUpperCase()}`, 22, topY + 64);

      doc.line(24, topY + 96, 90, topY + 96);
      doc.line(124, topY + 96, 190, topY + 96);
      doc.setFontSize(8.5);
      doc.text('FIRMA TRABAJADOR', 57, topY + 101, { align: 'center' });
      doc.text('FIRMA SERVICIOS MÉDICOS / RH', 157, topY + 101, { align: 'center' });
    });

    doc.setLineDashPattern([2, 2], 0);
    doc.line(14, 139, 202, 139);
    doc.setLineDashPattern([], 0);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('CORTAR POR AQUI (ORIGINAL Y COPIA)', 108, 137.5, { align: 'center' });

    const safe = (data.pase_medico || 'Paciente').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 26);
    doc.save(`Pase_Hotel_${safe}.pdf`);
  }

  global.MedicoDocs = {
    COFEPRIS_EMISORES_AUTORIZADOS,
    FORMAS_FARMACEUTICAS,
    VIAS_ADMINISTRACION,
    DEFAULT_COFEPRIS_CONFIG,
    COFEPRIS_FIELD_CATALOG,
    esc,
    calcularIMC,
    loadCofeprisConfig,
    saveCofeprisConfig,
    applyPreset,
    loadDoctorProfiles,
    saveDoctorProfile,
    deleteDoctorProfile,
    getActiveDoctorId,
    setActiveDoctorId,
    encodeConsultaDiagnosticoWithCofepris,
    decodeConsultaCofeprisMeta,
    saveConsultaMetaLocal,
    buildRecetaHtml,
    downloadRecetaPDF,
    buildPaseMedicoHtml,
    downloadPaseMedicoPDF,
    buildPaseHotelHtml,
    downloadPaseHotelPDF,
  };
})(window);
