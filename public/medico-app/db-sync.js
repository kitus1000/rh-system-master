/* ============================================================================
   MÉDICO BACÍS — MOTOR DE SEGURIDAD, CACHÉ OFFLINE Y SINCRONIZACIÓN SUPABASE
   Compatible 100% con el esquema oficial del sistema RH & Clínica Bacís
   ============================================================================ */
(function (global) {
  'use strict';

  const SUPABASE_URL = 'https://levyoflvpcbuueefqhtk.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_FQWWX93mMjFFQdqy6N_GWQ_pb5vkCzG';

  const KEYS = {
    SESSION: 'medico_bacis_session_v1',
    PIN_HASH: 'medico_bacis_pin_hash_v1',
    SECURITY: 'medico_bacis_security_v1',
    CACHE: 'medico_bacis_cache_v1',
    QUEUE: 'medico_bacis_sync_queue_v1',
    LOG: 'medico_bacis_sync_log_v1',
    HOTEL_HISTORY: 'medico_bacis_hotel_history_v1',
    THEME: 'medico_bacis_theme_v1',
    // Claves compartidas con el portal web Next.js
    COFEPRIS_CFG: 'bacis_cofepris_receta_template_v1',
    DOCTOR_PROFILES: 'bacis_doctores_perfiles_v1',
    ACTIVE_DOCTOR: 'bacis_active_doctor_id_v1',
    CONSULTA_META: 'bacis_cofepris_recetas_meta_v1',
  };

  const ALLOWED_MEDICAL_ROLES = [
    'jefe médico',
    'jefe medico',
    'médico',
    'medico',
    'doctor',
    'enfermería',
    'enfermeria',
    'enfermero',
    'enfermera',
    'administrativo',
    'administrador',
    'admin',
    'sistemas',
    'recursos humanos',
    'rh',
  ];

  function safeReadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function safeWriteJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.warn('Storage quota warning for', key, e);
      return false;
    }
  }

  // Hash determinista SHA-256 con fallback puro JS para WebViews sin crypto.subtle
  async function hashPin(pin) {
    const text = 'BACIS_MED_PIN_SALT_2026::' + String(pin || '').trim();
    if (global.crypto && global.crypto.subtle) {
      try {
        const data = new TextEncoder().encode(text);
        const digest = await global.crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
      } catch (_) {}
    }
    let h1 = 0xdeadbeef ^ text.length;
    let h2 = 0x41c6ce57 ^ text.length;
    for (let i = 0; i < text.length; i++) {
      const ch = text.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }

  function isMergedGhostEmployee(emp) {
    if (!emp) return false;
    const n = String(emp.nombre || '').toUpperCase();
    const ap = String(emp.apellido_paterno || '').toUpperCase();
    const est = String(emp.estado_empleado || emp.estatus || '').toUpperCase();
    return n.includes('[FUSIONADO') || ap.includes('[FUSIONADO') || est === 'FUSIONADO';
  }

  function isTitularPatient(pac) {
    if (!pac) return false;
    const par = String(pac.parentesco || '').toUpperCase().trim();
    if (!par) return Boolean(pac.id_empleado && !pac.es_poblacion_general);
    return (
      par.includes('TITULAR') ||
      par === 'EL MISMO' ||
      par === 'ELLA MISMA' ||
      par === 'TRABAJADOR'
    );
  }

  function isRoleAuthorized(roleStr) {
    const lower = String(roleStr || '').toLowerCase();
    return ALLOWED_MEDICAL_ROLES.some((r) => lower.includes(r));
  }

  function isDrJefeRole(roleStr) {
    const lower = String(roleStr || '').toLowerCase();
    return (
      lower.includes('jefe médico') ||
      lower.includes('jefe medico') ||
      lower.includes('admin') ||
      lower.includes('sistemas')
    );
  }

  // Estado interno del motor
  const state = {
    session: safeReadJSON(KEYS.SESSION, null),
    security: safeReadJSON(KEYS.SECURITY, { autoLockMinutes: 10, requirePinOffline: true }),
    cache: safeReadJSON(KEYS.CACHE, {
      empleados: [],
      pacientes: [],
      consultas: [],
      pases: [],
      clinicas: [],
      medicamentos: [],
      inventario: [],
      medicos: [],
      logoBase64: null,
      lastDownloadAt: null,
    }),
    queue: safeReadJSON(KEYS.QUEUE, []),
    logs: safeReadJSON(KEYS.LOG, []),
    hotelHistory: safeReadJSON(KEYS.HOTEL_HISTORY, []),
    dbStatus: {
      state: navigator.onLine ? 'checking' : 'offline', // online | offline | syncing | error | checking
      onlineDevice: navigator.onLine,
      dbReachable: false,
      latencyMs: null,
      httpStatus: null,
      lastCheckAt: null,
      lastSyncAt: null,
      lastError: null,
    },
    isSyncing: false,
    listeners: [],
  };

  // Depuración y limpieza automática de la cola offline para descartar errores de esquema en perfil de doctor
  // y sanear campos puramente visuales en pases médicos sin borrar nunca registros clínicos pendientes
  if (Array.isArray(state.queue)) {
    let modified = false;
    state.queue.forEach((item) => {
      if (!item) return;
      if (item.type === 'CREATE_PASE_MEDICO' && item.payload && item.payload.pase) {
        if ('departamento_pasajero' in item.payload.pase) {
          delete item.payload.pase.departamento_pasajero;
          modified = true;
        }
        if (item.error && item.error.includes('departamento_pasajero')) {
          item.status = 'PENDIENTE';
          delete item.error;
          item.retries = 0;
          modified = true;
        }
      }
    });
    const rawLen = state.queue.length;
    state.queue = state.queue.filter((item) => {
      if (!item) return false;
      if (item.type === 'UPDATE_DOCTOR_PROFILE') {
        if (item.error && (item.error.includes('schema cache') || item.error.includes("column of 'perfiles'"))) {
          return false;
        }
        if (item.retries > 0) {
          return false;
        }
      }
      return true;
    });
    if (state.queue.length !== rawLen || modified) {
      safeWriteJSON(KEYS.QUEUE, state.queue);
    }
  }

  function emitChange() {
    state.listeners.forEach((fn) => {
      try { fn(state); } catch (_) {}
    });
  }

  function subscribe(fn) {
    state.listeners.push(fn);
    return () => {
      state.listeners = state.listeners.filter((f) => f !== fn);
    };
  }

  function addLog(level, message) {
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      time: new Date().toLocaleTimeString('es-MX', { hour12: false }),
      iso: new Date().toISOString(),
      level, // INFO | OK | WARN | ERR
      message,
    };
    state.logs.unshift(entry);
    if (state.logs.length > 80) state.logs.length = 80;
    safeWriteJSON(KEYS.LOG, state.logs);
    emitChange();
  }

  let refreshInFlight = null;
  let checkInFlight = null;

  function getJwtExpSeconds(jwt) {
    try {
      const parts = String(jwt || '').split('.');
      if (parts.length !== 3) return 0;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const pad = b64.length % 4 ? b64 + '='.repeat(4 - (b64.length % 4)) : b64;
      const payload = JSON.parse(atob(pad));
      return Number(payload.exp || 0);
    } catch (_) {
      return 0;
    }
  }

  function getAnonAuthHeaders(extra) {
    return Object.assign(
      {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      extra || {}
    );
  }

  function getApikeyOnlyHeaders(extra) {
    return Object.assign(
      {
        apikey: SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      extra || {}
    );
  }

  function hasUsableUserJwt() {
    if (!state.session || !state.session.access_token) return false;
    const expAt = state.session.expires_at || getJwtExpSeconds(state.session.access_token);
    if (!expAt) return true;
    const nowSec = Math.floor(Date.now() / 1000);
    return expAt > nowSec + 10;
  }

  function getAuthHeaders(extra) {
    const token = hasUsableUserJwt() ? state.session.access_token : SUPABASE_KEY;
    return Object.assign(
      {
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
      extra || {}
    );
  }

  async function refreshSessionIfNeeded(force) {
    if (!state.session || !state.session.refresh_token) return false;
    const expAt = state.session.expires_at || getJwtExpSeconds(state.session.access_token);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!force && expAt && expAt - nowSec > 180) return true;

    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: state.session.refresh_token }),
        });
        if (!res.ok) {
          // Si el refresh_token fue revocado o expiró, limpiar tokens caducados sin borrar el perfil local ni el PIN
          if (res.status === 400 || res.status === 401 || res.status === 403) {
            if (state.session) {
              delete state.session.access_token;
              delete state.session.refresh_token;
              state.session.tokenMode = 'anon';
              safeWriteJSON(KEYS.SESSION, state.session);
            }
          }
          return false;
        }
        const data = await res.json();
        if (data && data.access_token) {
          state.session.access_token = data.access_token;
          state.session.refresh_token = data.refresh_token || state.session.refresh_token;
          state.session.expires_at = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);
          delete state.session.tokenMode;
          safeWriteJSON(KEYS.SESSION, state.session);
          return true;
        }
      } catch (_) {}
      return false;
    })();

    try {
      return await refreshInFlight;
    } finally {
      refreshInFlight = null;
    }
  }

  async function doFetchRest(path, method, headers, body, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 12000);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      return { res, text };
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }

  async function restRequest(path, options) {
    await refreshSessionIfNeeded(false);
    const opts = Object.assign({ method: 'GET' }, options || {});
    const hadUserJwt = hasUsableUserJwt();
    let { res, text } = await doFetchRest(
      path,
      opts.method,
      getAuthHeaders(opts.headers),
      opts.body,
      opts.timeoutMs
    );

    if (res.status === 401 || res.status === 403) {
      const refreshed = await refreshSessionIfNeeded(true);
      if (refreshed) {
        ({ res, text } = await doFetchRest(
          path,
          opts.method,
          getAuthHeaders(opts.headers),
          opts.body,
          opts.timeoutMs
        ));
      }
      if ((res.status === 401 || res.status === 403) && (hadUserJwt || (state.session && state.session.access_token))) {
        ({ res, text } = await doFetchRest(
          path,
          opts.method,
          getAnonAuthHeaders(opts.headers),
          opts.body,
          opts.timeoutMs
        ));
        if (res.status === 401 || res.status === 403) {
          ({ res, text } = await doFetchRest(
            path,
            opts.method,
            getApikeyOnlyHeaders(opts.headers),
            opts.body,
            opts.timeoutMs
          ));
        }
        if (res.ok && state.session && state.session.access_token) {
          delete state.session.access_token;
          safeWriteJSON(KEYS.SESSION, state.session);
        }
      }
    }

    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    if (!res.ok) {
      const msg = (json && (json.message || json.error_description || json.error)) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  /* ==========================================================================
     AUTENTICACIÓN PROTEGIDA (SUPABASE + VALIDACIÓN DE ROL MÉDICO + PIN OFFLINE)
     ========================================================================== */
  async function loginWithEmailPassword(email, password) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new Error('Ingresa correo electrónico y contraseña.');
    }
    if (!navigator.onLine) {
      throw new Error('Sin conexión a internet. Si ya iniciaste sesión antes en este equipo, usa el acceso por PIN Clínico.');
    }

    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token || !data.user) {
      throw new Error(data.error_description || data.msg || 'Credenciales incorrectas. Verifica tu correo y contraseña.');
    }

    const userId = data.user.id;
    // Verificar perfil y rol médico en tabla `perfiles`
    const perfRes = await fetch(
      `${SUPABASE_URL}/rest/v1/perfiles?id=eq.${encodeURIComponent(userId)}&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + data.access_token,
        },
      }
    );
    const perfList = await perfRes.json().catch(() => []);
    const perfil = Array.isArray(perfList) && perfList[0] ? perfList[0] : null;
    if (!perfil) {
      throw new Error('No se encontró un perfil registrado en el sistema para esta cuenta.');
    }
    if (!isRoleAuthorized(perfil.rol)) {
      throw new Error(`Acceso denegado: tu rol ("${perfil.rol || 'Sin rol'}") no tiene autorización para la App Clínica Médica.`);
    }

    state.session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      email: cleanEmail,
      user_id: userId,
      profile: perfil,
      isDrJefe: isDrJefeRole(perfil.rol),
      loggedInAt: new Date().toISOString(),
    };
    safeWriteJSON(KEYS.SESSION, state.session);
    addLog('OK', `Sesión clínica iniciada: ${perfil.nombre_completo} (${perfil.rol})`);
    emitChange();
    return state.session;
  }

  async function setUserPin(pin) {
    const clean = String(pin || '').trim();
    if (!/^\d{4,6}$/.test(clean)) {
      throw new Error('El PIN debe tener entre 4 y 6 dígitos numéricos.');
    }
    const hashed = await hashPin(clean);
    localStorage.setItem(KEYS.PIN_HASH, hashed);
    addLog('OK', 'PIN Clínico de seguridad actualizado en este dispositivo.');
    emitChange();
    return true;
  }

  function hasConfiguredPin() {
    return Boolean(localStorage.getItem(KEYS.PIN_HASH));
  }

  async function verifyPin(pin) {
    const saved = localStorage.getItem(KEYS.PIN_HASH);
    if (!saved) return false;
    const hashed = await hashPin(pin);
    return hashed === saved;
  }

  function updateSecuritySettings(patch) {
    state.security = Object.assign({}, state.security, patch || {});
    safeWriteJSON(KEYS.SECURITY, state.security);
    emitChange();
  }

  function logout(clearLocalCache) {
    state.session = null;
    localStorage.removeItem(KEYS.SESSION);
    if (clearLocalCache) {
      localStorage.removeItem(KEYS.PIN_HASH);
      localStorage.removeItem(KEYS.CACHE);
    }
    addLog('INFO', 'Sesión clínica cerrada de forma segura.');
    emitChange();
  }

  /* ==========================================================================
     MONITOR EN VIVO DE CONEXIÓN A BASE DE DATOS SUPABASE
     ========================================================================== */
  async function pingSupabaseClinicas(headers) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cat_clinicas?select=id_clinica&limit=1`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }

  async function testDatabaseConnection(opts) {
    if (checkInFlight) return checkInFlight;

    checkInFlight = (async () => {
      const prevState = state.dbStatus.state;
      const deviceOnline = navigator.onLine;
      state.dbStatus.onlineDevice = deviceOnline;
      state.dbStatus.lastCheckAt = new Date().toISOString();

      if (!deviceOnline) {
        state.dbStatus.state = 'offline';
        state.dbStatus.dbReachable = false;
        state.dbStatus.latencyMs = null;
        state.dbStatus.httpStatus = 0;
        state.dbStatus.lastError = 'Dispositivo sin conexión Wi-Fi o datos móviles.';
        emitChange();
        return state.dbStatus;
      }

      const t0 = performance.now();
      try {
        // Renovar token JWT si está por vencer o ya expiró antes de probar BD
        await refreshSessionIfNeeded(false);

        let res = await pingSupabaseClinicas(getAuthHeaders());

        // Si el JWT guardado fue rechazado (401/403), intentar renovación forzada o respaldo publishable
        if (res.status === 401 || res.status === 403) {
          const refreshed = await refreshSessionIfNeeded(true);
          if (refreshed) {
            res = await pingSupabaseClinicas(getAuthHeaders());
          }
          if (res.status === 401 || res.status === 403) {
            res = await pingSupabaseClinicas(getAnonAuthHeaders());
            if (res.status === 401 || res.status === 403) {
              res = await pingSupabaseClinicas(getApikeyOnlyHeaders());
            }
            if (res.ok && state.session && state.session.access_token) {
              delete state.session.access_token;
              safeWriteJSON(KEYS.SESSION, state.session);
            }
          }
        }

        const latency = Math.round(performance.now() - t0);
        state.dbStatus.latencyMs = latency;
        state.dbStatus.httpStatus = res.status;

        if (res.ok) {
          state.dbStatus.state = state.isSyncing ? 'syncing' : 'online';
          state.dbStatus.dbReachable = true;
          state.dbStatus.lastError = null;
          if ((opts && opts.verbose) || prevState === 'error') {
            addLog('OK', `Enlace activo con BD Central (HTTP ${res.status}, ${latency} ms).`);
          }
        } else {
          let detail = '';
          try {
            const txt = await res.text();
            const parsed = txt ? JSON.parse(txt) : null;
            detail = (parsed && (parsed.message || parsed.error_description || parsed.error)) || txt || '';
          } catch (_) {}
          state.dbStatus.state = 'error';
          state.dbStatus.dbReachable = false;
          state.dbStatus.lastError = `Respuesta BD HTTP ${res.status}${detail ? ': ' + detail : ''}`;
          if ((opts && opts.verbose) || prevState !== 'error') {
            addLog('ERR', `Error de respuesta BD: ${state.dbStatus.lastError}`);
          }
        }
      } catch (err) {
        state.dbStatus.state = 'offline';
        state.dbStatus.dbReachable = false;
        state.dbStatus.latencyMs = null;
        state.dbStatus.httpStatus = 0;
        state.dbStatus.lastError = err.name === 'AbortError' ? 'Tiempo de espera agotado (sin respuesta BD)' : err.message;
        if (opts && opts.verbose) {
          addLog('WARN', `No se pudo alcanzar el servidor BD: ${state.dbStatus.lastError}`);
        }
      }

      emitChange();
      return state.dbStatus;
    })();

    try {
      return await checkInFlight;
    } finally {
      checkInFlight = null;
    }
  }

  /* ==========================================================================
     DESCARGA DE PADRÓN COMPLETO A CACHÉ OFFLINE
     ========================================================================== */
  async function downloadAllData(silent, skipQueueSync) {
    const status = await testDatabaseConnection({ verbose: !silent });
    if (!status.dbReachable) {
      if (!silent) {
        const reason = status.lastError ? ` (${status.lastError})` : '';
        addLog('WARN', `No hay conexión con la BD${reason}. Trabajando con el padrón guardado en caché local.`);
      }
      return false;
    }

    // Subir cambios pendientes antes de descargar para no pisar trabajo local sin sincronizar
    if (!skipQueueSync && state.queue.length > 0 && !state.isSyncing) {
      await syncAllPending({ skipDownload: true });
    }

    if (!silent) addLog('INFO', 'Descargando padrón actualizado desde la base de datos central...');
    try {
      const [emps, pacs, cons, pases, clinicas, meds, inventario, perfiles, configEmp] = await Promise.all([
        restRequest('empleados?select=*&order=apellido_paterno.asc&limit=4000').catch(() => null),
        restRequest('pacientes?select=*&order=nombre_completo.asc&limit=5000').catch(() => null),
        restRequest('consultas_medicas?select=*,pacientes(nombre_completo,parentesco,es_poblacion_general,acompanante,fecha_nacimiento)&order=fecha.desc&limit=250').catch(() =>
          restRequest('consultas_medicas?select=*&order=fecha.desc&limit=250').catch(() => null)
        ),
        restRequest('pases_medicos?select=*,pacientes(nombre_completo,parentesco,es_poblacion_general,id_empleado)&order=creado_el.desc&limit=250').catch(() =>
          restRequest('pases_medicos?select=*&order=creado_el.desc&limit=250').catch(() => null)
        ),
        restRequest('cat_clinicas?select=*&order=nombre.asc').catch(() => null),
        restRequest('cat_medicamentos?select=*&order=nombre.asc&limit=2000').catch(() => null),
        restRequest('inventario_clinicas?select=*&limit=4000').catch(() => null),
        restRequest('perfiles?select=*&order=nombre_completo.asc').catch(() => null),
        restRequest('configuracion_empresa?select=logo_base64&limit=1').catch(() => null),
      ]);

      if (Array.isArray(emps)) {
        state.cache.empleados = emps.filter((e) => !isMergedGhostEmployee(e));
      }
      if (Array.isArray(pacs)) {
        state.cache.pacientes = pacs;
      }
      if (Array.isArray(cons)) {
        state.cache.consultas = cons;
      }
      if (Array.isArray(pases)) {
        state.cache.pases = pases;
      }
      if (Array.isArray(clinicas)) {
        state.cache.clinicas = clinicas;
      }
      if (Array.isArray(meds)) {
        state.cache.medicamentos = meds;
      }
      if (Array.isArray(inventario)) {
        state.cache.inventario = inventario;
      }
      if (Array.isArray(perfiles)) {
        state.cache.medicos = perfiles.filter((u) => isRoleAuthorized(u.rol));
        // Actualizar perfil de sesión si está presente
        if (state.session && state.session.user_id) {
          const freshMe = perfiles.find((p) => p.id === state.session.user_id);
          if (freshMe) {
            state.session.profile = freshMe;
            state.session.isDrJefe = isDrJefeRole(freshMe.rol);
            safeWriteJSON(KEYS.SESSION, state.session);
          }
        }
      }
      if (Array.isArray(configEmp) && configEmp[0] && configEmp[0].logo_base64) {
        state.cache.logoBase64 = configEmp[0].logo_base64;
      }

      state.cache.lastDownloadAt = new Date().toISOString();
      safeWriteJSON(KEYS.CACHE, state.cache);
      addLog(
        'OK',
        `Padrón actualizado: ${state.cache.empleados.length} empleados, ${state.cache.pacientes.length} pacientes, ${state.cache.consultas.length} consultas, ${state.cache.pases.length} pases.`
      );
      emitChange();
      return true;
    } catch (err) {
      addLog('ERR', 'Error descargando padrón: ' + err.message);
      return false;
    }
  }

  /* ==========================================================================
     COLA OFFLINE Y EJECUCIÓN DUAL (ONLINE INMEDIATO / OFFLINE EN COLA)
     ========================================================================== */
  function saveQueue() {
    safeWriteJSON(KEYS.QUEUE, state.queue);
    emitChange();
  }

  function saveCache() {
    safeWriteJSON(KEYS.CACHE, state.cache);
    emitChange();
  }

  function enqueueMutation(type, summary, payload) {
    const item = {
      id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      type,
      summary,
      payload,
      status: 'PENDIENTE', // PENDIENTE | ERROR
      error: null,
      createdAt: new Date().toISOString(),
      retries: 0,
    };
    state.queue.push(item);
    saveQueue();
    addLog('WARN', `[OFFLINE] En cola para sincronizar: ${summary}`);
    return item;
  }

  function extractMissingColumnFromError(msg) {
    if (!msg) return null;
    const m1 = String(msg).match(/Could not find the '([^']+)' column/i);
    if (m1 && m1[1]) return m1[1];
    const m2 = String(msg).match(/column ["']?([a-zA-Z0-9_]+)["']? of/i);
    return m2 && m2[1] ? m2[1] : null;
  }

  function computeNextNumericEmpNumber() {
    let maxNum = 90000;
    (state.cache.empleados || []).forEach((e) => {
      const n = parseInt(String(e && e.numero_empleado ? e.numero_empleado : '').trim(), 10);
      if (!isNaN(n) && n > maxNum && n < 99999999) {
        maxNum = n;
      }
    });
    return maxNum + 1;
  }

  async function insertWithSchemaFallback(table, rowObj, preferHeader) {
    const payloadRow = Object.assign({}, rowObj);
    let attempts = 0;
    while (attempts < 10) {
      try {
        return await restRequest(table, {
          method: 'POST',
          headers: { Prefer: preferHeader || 'return=minimal' },
          body: JSON.stringify([payloadRow]),
        });
      } catch (err) {
        const msg = err && err.message ? err.message : '';
        const missingCol = extractMissingColumnFromError(msg);
        if (missingCol && Object.prototype.hasOwnProperty.call(payloadRow, missingCol)) {
          addLog('WARN', `Campo '${missingCol}' no existe aún en tabla ${table}; omitiendo para guardar registro...`);
          delete payloadRow[missingCol];
          attempts++;
          continue;
        }
        throw err;
      }
    }
    throw new Error(`No se pudo insertar en ${table} tras depurar columnas opcionales.`);
  }

  async function patchWithSchemaFallback(tableQuery, patchObj, preferHeader) {
    const payloadPatch = Object.assign({}, patchObj);
    let attempts = 0;
    while (attempts < 10) {
      if (Object.keys(payloadPatch).length === 0) {
        addLog('WARN', `Sin campos compatibles para actualizar en ${tableQuery}; conservado en caché local.`);
        return true;
      }
      try {
        return await restRequest(tableQuery, {
          method: 'PATCH',
          headers: { Prefer: preferHeader || 'return=minimal' },
          body: JSON.stringify(payloadPatch),
        });
      } catch (err) {
        const msg = err && err.message ? err.message : '';
        const missingCol = extractMissingColumnFromError(msg);
        if (missingCol && Object.prototype.hasOwnProperty.call(payloadPatch, missingCol)) {
          addLog('WARN', `Columna '${missingCol}' no existe aún en ${tableQuery.split('?')[0]}; omitiendo para guardar...`);
          delete payloadPatch[missingCol];
          attempts++;
          continue;
        }
        throw err;
      }
    }
    throw new Error(`No se pudo actualizar ${tableQuery} tras depurar columnas opcionales.`);
  }

  async function deductInventoryRemote(idMedicamento, qty, preferredClinicaId) {
    if (!idMedicamento || !qty || qty <= 0) return;
    const rows = await restRequest(
      `inventario_clinicas?id_medicamento=eq.${encodeURIComponent(idMedicamento)}&select=*`
    ).catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) return;

    let target = null;
    if (preferredClinicaId) {
      target =
        rows.find((r) => String(r.id_clinica) === String(preferredClinicaId) && Number(r.cantidad || 0) > 0) || null;
    }
    if (!target) {
      const candidates = rows
        .filter((r) => Number(r.cantidad || 0) > 0)
        .sort((a, b) => Number(b.cantidad || 0) - Number(a.cantidad || 0));
      target = candidates[0] || null;
    }
    if (!target || !target.id_inventario) return;

    const nextQty = Math.max(0, Number(target.cantidad || 0) - qty);
    await patchWithSchemaFallback(`inventario_clinicas?id_inventario=eq.${encodeURIComponent(target.id_inventario)}`, {
      cantidad: nextQty,
    });
  }

  async function executeSingleMutation(item, idMap) {
    const resolveId = (val) => (val && idMap[val] ? idMap[val] : val);
    const p = item.payload || {};

    if (item.type === 'CREATE_WORKER') {
      const empRow = Object.assign({}, p.empleado);
      const rawNum = empRow.numero_empleado != null ? String(empRow.numero_empleado).trim() : '';
      empRow.numero_empleado = /^\d+$/.test(rawNum) ? parseInt(rawNum, 10) : computeNextNumericEmpNumber();

      let inserted;
      try {
        inserted = await insertWithSchemaFallback('empleados', empRow, 'return=representation');
      } catch (err) {
        const msg = String(err && err.message ? err.message : '').toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique')) {
          empRow.numero_empleado = Math.floor(100000 + (Date.now() % 899999));
          inserted = await insertWithSchemaFallback('empleados', empRow, 'return=representation');
        } else {
          throw err;
        }
      }

      const realEmp = Array.isArray(inserted) ? inserted[0] : inserted;
      if (!realEmp || !realEmp.id_empleado) throw new Error('No se recibió ID de empleado creado.');
      if (p.tempEmpId) idMap[p.tempEmpId] = realEmp.id_empleado;

      const titularRow = Object.assign({}, p.titularPaciente, { id_empleado: realEmp.id_empleado });
      const insPac = await insertWithSchemaFallback('pacientes', titularRow, 'return=representation');
      const realPac = Array.isArray(insPac) ? insPac[0] : insPac;
      if (p.tempPacId && realPac && realPac.id_paciente) {
        idMap[p.tempPacId] = realPac.id_paciente;
      }
      return { realEmp, realPac };
    }

    if (item.type === 'UPDATE_WORKER_STATUS') {
      const empId = resolveId(p.id_empleado);
      await patchWithSchemaFallback(`empleados?id_empleado=eq.${encodeURIComponent(empId)}`, {
        estado_empleado: p.estado_empleado,
      });
      await patchWithSchemaFallback(`pacientes?id_empleado=eq.${encodeURIComponent(empId)}`, {
        activo: String(p.estado_empleado || '').toUpperCase() === 'ACTIVO',
      }).catch(() => {});
      return true;
    }

    if (item.type === 'UPDATE_WORKER_DATA') {
      const empId = resolveId(p.id_empleado);
      const patch = Object.assign({}, p.patch);
      const rawNum = patch.numero_empleado != null ? String(patch.numero_empleado).trim() : '';
      if (/^\d+$/.test(rawNum)) {
        patch.numero_empleado = parseInt(rawNum, 10);
      } else {
        delete patch.numero_empleado;
      }
      await patchWithSchemaFallback(`empleados?id_empleado=eq.${encodeURIComponent(empId)}`, patch);
      return true;
    }

    if (item.type === 'CREATE_PATIENT') {
      const row = Object.assign({}, p.paciente, {
        id_empleado: p.paciente.id_empleado ? resolveId(p.paciente.id_empleado) : null,
      });
      const inserted = await insertWithSchemaFallback('pacientes', row, 'return=representation');
      const realPac = Array.isArray(inserted) ? inserted[0] : inserted;
      if (p.tempPacId && realPac && realPac.id_paciente) {
        idMap[p.tempPacId] = realPac.id_paciente;
      }
      return realPac;
    }

    if (item.type === 'UPDATE_PATIENT') {
      const pacId = resolveId(p.id_paciente);
      await patchWithSchemaFallback(`pacientes?id_paciente=eq.${encodeURIComponent(pacId)}`, p.patch);
      return true;
    }

    if (item.type === 'CREATE_CONSULTA') {
      let pacId = p.consulta.id_paciente ? resolveId(p.consulta.id_paciente) : null;
      if (!pacId && p.freePatientName) {
        const created = await insertWithSchemaFallback(
          'pacientes',
          {
            nombre_completo: p.freePatientName.toUpperCase(),
            es_poblacion_general: true,
            activo: true,
          },
          'return=representation'
        );
        if (Array.isArray(created) && created[0]) pacId = created[0].id_paciente;
      }

      const consultaRow = Object.assign({}, p.consulta, {
        id_paciente: pacId,
        id_empleado: p.consulta.id_empleado ? resolveId(p.consulta.id_empleado) : null,
      });
      const ins = await insertWithSchemaFallback('consultas_medicas', consultaRow, 'return=representation');
      const realConsulta = Array.isArray(ins) ? ins[0] : ins;
      if (realConsulta && realConsulta.id_consulta) {
        if (p.cofeprisMeta && global.MedicoDocs) {
          global.MedicoDocs.saveConsultaMetaLocal(realConsulta.id_consulta, p.cofeprisMeta);
        }
        const catalogMeds = (p.medicamentos || []).filter((m) => Boolean(m.id_medicamento));
        if (catalogMeds.length > 0) {
          const withDosis = catalogMeds.map((med) => ({
            id_consulta: realConsulta.id_consulta,
            id_medicamento: med.id_medicamento,
            cantidad: med.cantidad || 1,
            costo_unitario: med.costo_unitario || 0,
            costo_total: (med.cantidad || 1) * (med.costo_unitario || 0),
            dosis: `${med.dosis || ''} · ${med.frecuencia || ''} · ${med.via_administracion || ''} · ${med.duracion_tratamiento || ''}`.toUpperCase(),
          }));
          try {
            await restRequest('dispensacion_medicamentos', {
              method: 'POST',
              headers: { Prefer: 'return=minimal' },
              body: JSON.stringify(withDosis),
            });
          } catch (_) {
            const basic = catalogMeds.map((med) => ({
              id_consulta: realConsulta.id_consulta,
              id_medicamento: med.id_medicamento,
              cantidad: med.cantidad || 1,
              costo_unitario: med.costo_unitario || 0,
              costo_total: (med.cantidad || 1) * (med.costo_unitario || 0),
            }));
            await restRequest('dispensacion_medicamentos', {
              method: 'POST',
              headers: { Prefer: 'return=minimal' },
              body: JSON.stringify(basic),
            }).catch(() => {});
          }

          // Descontar automáticamente del inventario de clínica por cada medicamento dispensado
          for (const med of catalogMeds) {
            await deductInventoryRemote(
              resolveId(med.id_medicamento),
              Math.max(1, Number(med.cantidad) || 1),
              p.consulta && p.consulta.id_clinica ? resolveId(p.consulta.id_clinica) : null
            ).catch(() => {});
          }
        }
        if (pacId && p.acompanante) {
          await patchWithSchemaFallback(`pacientes?id_paciente=eq.${encodeURIComponent(pacId)}`, {
            acompanante: p.acompanante.toUpperCase(),
          }).catch(() => {});
        }
      }
      return realConsulta;
    }

    if (item.type === 'CREATE_PASE_MEDICO') {
      const paseRow = Object.assign({}, p.pase, {
        id_paciente: p.pase.id_paciente ? resolveId(p.pase.id_paciente) : null,
        id_empleado: p.pase.id_empleado ? resolveId(p.pase.id_empleado) : null,
      });
      delete paseRow.departamento_pasajero;
      await insertWithSchemaFallback('pases_medicos', paseRow, 'return=minimal');
      return true;
    }

    if (item.type === 'CREATE_MEDICAMENTO') {
      const inserted = await insertWithSchemaFallback('cat_medicamentos', p.medicamento, 'return=representation');
      const realMed = Array.isArray(inserted) ? inserted[0] : inserted;
      const medId = realMed && realMed.id_medicamento ? realMed.id_medicamento : null;
      if (medId && p.local_id) idMap[p.local_id] = medId;
      if (medId && Number(p.stock_inicial || 0) > 0 && p.id_clinica) {
        await insertWithSchemaFallback(
          'inventario_clinicas',
          {
            id_clinica: resolveId(p.id_clinica),
            id_medicamento: medId,
            cantidad: Math.max(0, Number(p.stock_inicial) || 0),
          },
          'return=minimal'
        ).catch(() => {});
      }
      return realMed || true;
    }

    if (item.type === 'ADJUST_STOCK') {
      const clinId = p.id_clinica ? resolveId(p.id_clinica) : null;
      const medId = p.id_medicamento ? resolveId(p.id_medicamento) : null;
      if (clinId && medId) {
        const existing = await restRequest(
          `inventario_clinicas?id_clinica=eq.${encodeURIComponent(clinId)}&id_medicamento=eq.${encodeURIComponent(medId)}&select=*`
        ).catch(() => []);
        const row = Array.isArray(existing) && existing[0] ? existing[0] : null;
        if (row && row.id_inventario) {
          const nextQty =
            typeof p.newCantidad === 'number'
              ? Math.max(0, p.newCantidad)
              : Math.max(0, Number(row.cantidad || 0) + Number(p.delta || 0));
          await patchWithSchemaFallback(`inventario_clinicas?id_inventario=eq.${encodeURIComponent(row.id_inventario)}`, {
            cantidad: nextQty,
          });
        } else {
          const initQty =
            typeof p.newCantidad === 'number' ? Math.max(0, p.newCantidad) : Math.max(0, Number(p.delta || 0));
          await insertWithSchemaFallback(
            'inventario_clinicas',
            { id_clinica: clinId, id_medicamento: medId, cantidad: initQty },
            'return=minimal'
          );
        }
      }
      return true;
    }

    if (item.type === 'CREATE_CLINICA') {
      await insertWithSchemaFallback('cat_clinicas', p.clinica, 'return=minimal');
      return true;
    }

    if (item.type === 'UPDATE_DOCTOR_PROFILE') {
      if (p.userId && p.patch) {
        await patchWithSchemaFallback(`perfiles?id=eq.${encodeURIComponent(p.userId)}`, p.patch);
      }
      return true;
    }

    throw new Error('Operación desconocida: ' + item.type);
  }

  async function submitOrQueue(type, summary, payload, optimisticFn) {
    // 1. Aplicar actualización optimista al caché local inmediatamente
    if (typeof optimisticFn === 'function') {
      try { optimisticFn(); saveCache(); } catch (_) {}
    }

    // 2. Si hay conexión y no hay cola previa dependiente, intentar envío directo a Supabase
    const hadPriorQueue = state.queue.length > 0;
    if (navigator.onLine && !hadPriorQueue) {
      try {
        const result = await executeSingleMutation({ type, payload }, {});
        state.dbStatus.state = 'online';
        state.dbStatus.dbReachable = true;
        state.dbStatus.lastError = null;
        state.dbStatus.lastSyncAt = new Date().toISOString();
        addLog('OK', `[EN LÍNEA] Guardado en base de datos central: ${summary}`);
        emitChange();
        return { synced: true, result };
      } catch (err) {
        // Si es un error de esquema en UPDATE_DOCTOR_PROFILE, no lo encolemos infinitamente
        if (type === 'UPDATE_DOCTOR_PROFILE' && err.message && (err.message.includes('schema cache') || err.message.includes('column of'))) {
          addLog('WARN', `Perfil médico guardado localmente (la tabla 'perfiles' en Supabase requiere migración SQL para columnas COFEPRIS).`);
          return { synced: false, result: null };
        }
        addLog('WARN', `Envío directo falló (${err.message}); guardado en cola offline para sincronización automática.`);
      }
    }

    // 3. Guardar en cola persistente y, si existía cola previa y hay red, sincronizar en orden de inmediato
    const queued = enqueueMutation(type, summary, payload);
    if (hadPriorQueue && navigator.onLine && !state.isSyncing) {
      await syncAllPending();
      const stillQueued = state.queue.some((q) => q.id === queued.id);
      return { synced: !stillQueued, queued: stillQueued ? queued : null };
    }
    return { synced: false, queued };
  }

  async function syncAllPending(opts) {
    if (state.isSyncing) return { synced: 0, failed: 0 };
    if (state.queue.length === 0) {
      await testDatabaseConnection();
      return { synced: 0, failed: 0 };
    }

    const conn = await testDatabaseConnection();
    if (!conn.dbReachable) {
      addLog('WARN', `Sincronización pospuesta: sin conexión con Supabase (${state.queue.length} pendiente(s)).`);
      return { synced: 0, failed: state.queue.length };
    }

    state.isSyncing = true;
    state.dbStatus.state = 'syncing';
    emitChange();
    addLog('INFO', `Iniciando sincronización de ${state.queue.length} registro(s) hacia la base de datos central...`);

    const idMap = {};
    const remaining = [];
    let syncedCount = 0;

    for (const item of state.queue) {
      try {
        await executeSingleMutation(item, idMap);
        syncedCount++;
        addLog('OK', `Sincronizado con BD: ${item.summary}`);
      } catch (err) {
        // Solo omitir errores de esquema no críticos en actualización de perfil; nunca descartar registros clínicos
        if (
          item.type === 'UPDATE_DOCTOR_PROFILE' &&
          err.message &&
          (err.message.includes('schema cache') || err.message.includes("column of 'perfiles'"))
        ) {
          addLog('WARN', `Operación de perfil omitida por incompatibilidad de esquema remoto: ${err.message}.`);
          syncedCount++;
          continue;
        }
        item.status = 'ERROR';
        item.error = err.message;
        item.retries = (item.retries || 0) + 1;
        remaining.push(item);
        addLog('ERR', `Error al sincronizar "${item.summary}": ${err.message}`);
      }
    }

    state.queue = remaining;
    saveQueue();
    state.isSyncing = false;
    state.dbStatus.lastSyncAt = new Date().toISOString();
    state.dbStatus.state = conn.dbReachable ? 'online' : 'offline';
    emitChange();

    if (!(opts && opts.skipDownload) && syncedCount > 0) {
      await downloadAllData(true, true);
    }
    return { synced: syncedCount, failed: remaining.length };
  }

  function removeQueueItem(id) {
    state.queue = state.queue.filter((q) => q.id !== id);
    saveQueue();
    addLog('INFO', 'Elemento descartado manualmente de la cola offline.');
  }

  function addHotelHistoryEntry(entry) {
    state.hotelHistory.unshift(entry);
    if (state.hotelHistory.length > 100) state.hotelHistory.length = 100;
    safeWriteJSON(KEYS.HOTEL_HISTORY, state.hotelHistory);
    emitChange();
  }

  // Listeners automáticos de conectividad del dispositivo
  window.addEventListener('online', async () => {
    addLog('INFO', 'Red detectada. Verificando enlace con base de datos...');
    const st = await testDatabaseConnection();
    if (st.dbReachable && state.queue.length > 0) {
      await syncAllPending();
    }
  });

  window.addEventListener('offline', () => {
    state.dbStatus.onlineDevice = false;
    state.dbStatus.dbReachable = false;
    state.dbStatus.state = 'offline';
    state.dbStatus.lastError = 'Dispositivo en modo sin conexión.';
    addLog('WARN', 'Dispositivo sin internet. Modo Offline activado — todos los cambios se guardarán localmente.');
    emitChange();
  });

  // Verificación periódica automática cada 35 segundos cuando hay sesión activa
  setInterval(async () => {
    if (!state.session) return;
    if (navigator.onLine) {
      const st = await testDatabaseConnection();
      if (st.dbReachable && state.queue.length > 0 && !state.isSyncing) {
        await syncAllPending();
      }
    }
  }, 35000);

  global.MedicoDB = {
    KEYS,
    SUPABASE_URL,
    state,
    subscribe,
    addLog,
    isMergedGhostEmployee,
    isTitularPatient,
    isDrJefeRole,
    loginWithEmailPassword,
    setUserPin,
    hasConfiguredPin,
    verifyPin,
    updateSecuritySettings,
    logout,
    testDatabaseConnection,
    downloadAllData,
    submitOrQueue,
    syncAllPending,
    removeQueueItem,
    addHotelHistoryEntry,
    safeReadJSON,
    safeWriteJSON,
  };
})(window);
