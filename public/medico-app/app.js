/* ============================================================================
   MÉDICO BACÍS — CONTROLADOR DE INTERFAZ CLÍNICA MÓVIL / TABLET / APK
   Menús desplegables bajo demanda, cero botones estorbosos, seguridad PIN,
   Dr. Jefe + Doctores, COFEPRIS, Pacientes/Alta, Recetas, Pases y Monitor BD
   ============================================================================ */
(function (global) {
  'use strict';

  const DB = global.MedicoDB;
  const Docs = global.MedicoDocs;

  let currentView = 'inicio';
  let currentPacTab = 'trabajadores';
  let currentFarmTab = 'meds';
  let authMode = 'email';
  let pinBuffer = '';
  let isLocked = false;
  let lastActivityTs = Date.now();
  let toastTimer = null;

  let doctorProfiles = [];
  let activeDoctorId = '';
  let cofeprisConfig = Docs.loadCofeprisConfig();

  // Estado del formulario de consulta y medicamentos
  let consultaMeds = [];
  let previewDownloadCallback = null;

  // Canvas de firma
  let sigDrawing = false;
  let sigInkColor = '#0f172a';
  let sigDraftDataUrl = '';

  // Escáner QR
  let qrStream = null;
  let qrRaf = null;
  let qrActive = false;

  const VIEW_TITLES = {
    inicio: 'Inicio Clínico',
    pacientes: 'Pacientes y Estatus Alta',
    consultas: 'Consultas y Recetas COFEPRIS',
    pases: 'Pases Médicos',
    hotel: 'Pases de Hotel',
    farmacia: 'Farmacia y Clínicas',
    perfil: 'Perfil Médico y Equipo',
    conexion: 'Conexión BD y Sincronización',
  };

  function $(id) {
    return document.getElementById(id);
  }

  function showToast(msg, durationMs) {
    const el = $('toastBanner');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), durationMs || 3400);
  }

  function getEmpFullName(emp) {
    if (!emp) return '';
    return `${emp.nombre || ''} ${emp.apellido_paterno || ''} ${emp.apellido_materno || ''}`.replace(/\s+/g, ' ').trim();
  }

  function isEmpBaja(emp) {
    if (!emp) return false;
    const st = String(emp.estado_empleado || emp.estatus || 'ACTIVO').toUpperCase();
    return st === 'BAJA' || st === 'INACTIVO';
  }

  function calcAgeYears(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    let yrs = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) yrs--;
    return yrs >= 0 ? `${yrs} años` : '';
  }

  function getActiveDoctor() {
    return (
      doctorProfiles.find((d) => d.id === activeDoctorId) ||
      doctorProfiles[0] || {
        id: 'default-doc',
        nombre_completo: (DB.state.session && DB.state.session.profile && DB.state.session.profile.nombre_completo) || 'Médico Prescriptor',
        categoria_emisor: 'I',
        cedula_profesional: '',
        institucion_titulo: '',
        especialidad: 'Medicina General',
        domicilio_consultorio: 'Consultorio Médico de Atención Primaria, Durango, Dgo.',
        telefono_consultorio: '',
        firma_base64: '',
        es_dr_principal: true,
      }
    );
  }

  function currentUserIsDrJefe() {
    const sess = DB.state.session;
    if (sess && sess.isDrJefe) return true;
    const act = getActiveDoctor();
    return Boolean(act && act.es_dr_principal);
  }

  /* ==========================================================================
     INICIALIZACIÓN, TEMA, SERVICE WORKER Y SEGURIDAD (INACTIVIDAD + PIN)
     ========================================================================== */
  function init() {
    // Aplicar tema guardado
    if (localStorage.getItem(DB.KEYS.THEME) === 'dark') {
      document.body.classList.add('clinical-dark');
      const lbl = $('themeToggleText');
      if (lbl) lbl.textContent = '☀️ Claro';
    }

    // Registrar Service Worker para operación PWA offline
    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
      navigator.serviceWorker.register('/medico-app/sw-medico.js').catch(() => {});
    }

    // Suscribirse a cambios del motor DB/Sync
    DB.subscribe(() => {
      updateHeaderAndConnectionUI();
      if (!isLocked && DB.state.session) {
        updateHomeKPIs();
        if (currentView === 'conexion') renderConexionView();
      }
    });

    // Rastrear actividad para auto-bloqueo clínico
    ['click', 'touchstart', 'keydown', 'scroll'].forEach((ev) => {
      window.addEventListener(ev, () => { lastActivityTs = Date.now(); }, { passive: true });
    });

    setInterval(() => {
      if (!DB.state.session || isLocked) return;
      const mins = Number(DB.state.security.autoLockMinutes || 0);
      if (mins > 0 && Date.now() - lastActivityTs >= mins * 60000) {
        if (DB.hasConfiguredPin()) {
          lockScreen();
          showToast('🔒 Pantalla bloqueada automáticamente por inactividad.');
        }
      }
    }, 15000);

    initSignaturePadEvents();
    const todayIso = new Date().toISOString().split('T')[0];
    if ($('hotelFechaSalida')) $('hotelFechaSalida').value = todayIso;
    if ($('paseFechaSalida')) $('paseFechaSalida').value = todayIso;

    // Verificar si ya hay sesión clínica previa
    if (DB.state.session) {
      if (DB.hasConfiguredPin()) {
        showAuthScreen('pin');
      } else {
        enterApp();
      }
    } else {
      showAuthScreen('email');
    }

    DB.testDatabaseConnection();
  }

  function showAuthScreen(mode) {
    isLocked = true;
    $('appShell').classList.add('hidden');
    $('authScreen').classList.remove('hidden');
    $('authAlert').classList.add('hidden');

    const hasSessionAndPin = Boolean(DB.state.session && DB.hasConfiguredPin());
    if (hasSessionAndPin) {
      $('authModeTabs').classList.remove('hidden');
      $('pinSavedDoctorName').textContent = (DB.state.session.profile && DB.state.session.profile.nombre_completo) || DB.state.session.email;
      setAuthMode(mode === 'email' ? 'email' : 'pin');
    } else {
      $('authModeTabs').classList.add('hidden');
      setAuthMode('email');
    }

    $('authNetBadge').textContent = navigator.onLine
      ? '🟢 Conexión disponible · Acceso Protegido'
      : '🟡 Modo Offline · Usa tu PIN Clínico guardado';
  }

  function setAuthMode(mode) {
    authMode = mode;
    pinBuffer = '';
    renderPinDots();
    $('authAlert').classList.add('hidden');
    if (mode === 'pin') {
      $('loginEmailForm').classList.add('hidden');
      $('loginPinBox').classList.remove('hidden');
      $('tabBtnPin').classList.add('active');
      $('tabBtnEmail').classList.remove('active');
    } else {
      $('loginEmailForm').classList.remove('hidden');
      $('loginPinBox').classList.add('hidden');
      $('tabBtnEmail').classList.add('active');
      $('tabBtnPin').classList.remove('active');
    }
  }

  function showAuthError(msg) {
    const box = $('authAlert');
    box.textContent = '⚠️ ' + msg;
    box.classList.remove('hidden');
  }

  async function handleEmailLogin(e) {
    e.preventDefault();
    $('authAlert').classList.add('hidden');
    const btn = $('btnEmailLogin');
    btn.disabled = true;
    btn.textContent = 'Verificando credenciales...';
    try {
      const email = $('loginEmail').value;
      const pass = $('loginPass').value;
      await DB.loginWithEmailPassword(email, pass);
      $('loginPass').value = '';
      enterApp();
      if (!DB.hasConfiguredPin()) {
        showToast('🛡️ Consejo: configura tu PIN Clínico en "Perfil Médico" para entrar sin internet.', 5200);
      }
    } catch (err) {
      showAuthError(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔓 Iniciar Sesión Médica';
    }
  }

  function renderPinDots() {
    const wrap = $('pinDotsDisplay');
    if (!wrap) return;
    let html = '';
    for (let i = 0; i < 6; i++) {
      html += `<span class="pin-dot ${i < pinBuffer.length ? 'filled' : ''}"></span>`;
    }
    wrap.innerHTML = html;
  }

  function pinPress(digit) {
    if (pinBuffer.length >= 6) return;
    pinBuffer += digit;
    renderPinDots();
    if (pinBuffer.length >= 4) {
      DB.verifyPin(pinBuffer).then((ok) => {
        if (ok) {
          pinBuffer = '';
          enterApp();
        }
      });
    }
  }

  function pinClear() {
    pinBuffer = '';
    renderPinDots();
  }

  async function pinSubmit() {
    if (pinBuffer.length < 4) return showAuthError('Ingresa tu PIN de 4 a 6 dígitos.');
    const ok = await DB.verifyPin(pinBuffer);
    if (ok) {
      pinBuffer = '';
      enterApp();
    } else {
      pinBuffer = '';
      renderPinDots();
      showAuthError('PIN Clínico incorrecto. Intenta de nuevo o entra con correo y contraseña.');
    }
  }

  function lockScreen() {
    if (!DB.hasConfiguredPin()) {
      const want = confirm('Aún no has configurado un PIN Clínico. ¿Deseas ir a Perfil Médico para crear uno ahora?');
      if (want) navigate('perfil');
      return;
    }
    showAuthScreen('pin');
  }

  function confirmLogout() {
    const qLen = DB.state.queue.length;
    const extra = qLen > 0 ? `\n\nTienes ${qLen} registro(s) pendiente(s) por subir; se conservarán seguros en la cola.` : '';
    if (!confirm('¿Cerrar tu sesión clínica en este dispositivo?' + extra)) return;
    toggleDrawer(false);
    DB.logout(false);
    showAuthScreen('email');
  }

  async function enterApp() {
    isLocked = false;
    lastActivityTs = Date.now();
    $('authScreen').classList.add('hidden');
    $('appShell').classList.remove('hidden');

    reloadDoctorProfiles();
    updateDrawerUserInfo();
    updateHeaderAndConnectionUI();
    navigate('inicio');

    // Sincronizar y actualizar padrón en segundo plano si hay internet
    const st = await DB.testDatabaseConnection();
    if (st.dbReachable) {
      if (DB.state.queue.length > 0) {
        await DB.syncAllPending();
      } else {
        await DB.downloadAllData(true);
      }
      reloadDoctorProfiles();
      refreshActiveView();
    }
  }

  function reloadDoctorProfiles() {
    const sessProfile = DB.state.session ? DB.state.session.profile : null;
    doctorProfiles = Docs.loadDoctorProfiles(sessProfile, DB.state.cache.medicos);
    const saved = Docs.getActiveDoctorId();
    const found =
      doctorProfiles.find((d) => d.id === saved) ||
      (sessProfile && doctorProfiles.find((d) => d.id === sessProfile.id)) ||
      doctorProfiles[0];
    activeDoctorId = found ? found.id : '';
    if (activeDoctorId) Docs.setActiveDoctorId(activeDoctorId);
  }

  function updateDrawerUserInfo() {
    const sess = DB.state.session;
    const activeDoc = getActiveDoctor();
    $('drawerUserName').textContent = (activeDoc && activeDoc.nombre_completo) || (sess && sess.profile && sess.profile.nombre_completo) || 'Médico';
    $('drawerUserRole').textContent = currentUserIsDrJefe() ? '⭐ Dr. Jefe / Principal' : ((sess && sess.profile && sess.profile.rol) || 'Médico Colaborador');
    $('topbarSub').textContent = activeDoc ? activeDoc.nombre_completo : 'Médico Bacís';
  }

  /* ==========================================================================
     NAVEGACIÓN Y MENÚ DESPLEGABLE BAJO DEMANDA
     ========================================================================== */
  function toggleDrawer(force) {
    const panel = $('drawerPanel');
    const back = $('drawerBackdrop');
    const shouldOpen = typeof force === 'boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open', shouldOpen);
    back.classList.toggle('open', shouldOpen);
  }

  function navigate(viewName, opts) {
    currentView = viewName;
    toggleDrawer(false);

    document.querySelectorAll('.view-section').forEach((sec) => sec.classList.remove('active'));
    const target = $('view-' + viewName);
    if (target) target.classList.add('active');

    document.querySelectorAll('.drawer-item').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-nav') === viewName);
    });

    $('topbarTitle').textContent = VIEW_TITLES[viewName] || 'Médico Bacís';
    window.scrollTo({ top: 0, behavior: 'instant' });

    refreshActiveView(opts);
  }

  function refreshActiveView(opts) {
    updateHomeKPIs();
    updateDrawerUserInfo();
    if (currentView === 'inicio') renderHome();
    if (currentView === 'pacientes') renderPacientes();
    if (currentView === 'consultas') {
      populateConsultaSelects();
      renderConsultas();
      if (opts && opts.openForm) toggleConsultaForm(true, opts.patientId);
    }
    if (currentView === 'pases') {
      populatePaseSelects();
      renderPases();
      if (opts && opts.openForm) togglePaseForm(true, opts.patientId);
    }
    if (currentView === 'hotel') {
      populateHotelPatients(opts && opts.patientId);
      renderHotelHistory();
    }
    if (currentView === 'farmacia') renderFarmacia();
    if (currentView === 'perfil') renderPerfilView();
    if (currentView === 'conexion') renderConexionView();
  }

  function toggleTheme() {
    const isDark = document.body.classList.toggle('clinical-dark');
    localStorage.setItem(DB.KEYS.THEME, isDark ? 'dark' : 'light');
    $('themeToggleText').textContent = isDark ? '☀️ Claro' : '🌙 Nocturno';
  }

  function closeModals() {
    ['modalWorker', 'modalPatient', 'modalWorkerDetail', 'modalDocPreview'].forEach((id) => {
      const el = $(id);
      if (el) el.classList.add('hidden');
    });
  }

  /* ==========================================================================
     HEADER LIVE DB STATUS & INICIO CLÍNICO
     ========================================================================== */
  function updateHeaderAndConnectionUI() {
    const st = DB.state.dbStatus;
    const qLen = DB.state.queue.length;
    const dot = $('headerDbDot');
    const lbl = $('headerDbLabel');
    const badge = $('drawerQueueBadge');

    if (dot && lbl) {
      dot.className = 'status-dot ' + (st.state === 'online' ? 'online' : st.state === 'syncing' ? 'syncing' : st.state === 'error' ? 'error' : 'offline');
      if (st.state === 'syncing') lbl.textContent = 'Sincronizando...';
      else if (st.state === 'online') lbl.textContent = qLen > 0 ? `BD (${qLen})` : 'BD En Línea';
      else if (st.state === 'error') lbl.textContent = 'Error BD';
      else lbl.textContent = qLen > 0 ? `Offline (${qLen})` : 'Offline';
    }

    if (badge) {
      badge.textContent = String(qLen);
      badge.classList.toggle('hidden', qLen === 0);
    }

    const banner = $('homeSyncBanner');
    if (banner) {
      banner.className = 'alert-banner ' + (st.dbReachable ? (qLen > 0 ? 'alert-warning' : 'alert-success') : 'alert-warning');
      $('homeDbHeadline').textContent = st.dbReachable
        ? (qLen > 0 ? `🟢 Base de datos conectada · ${qLen} registro(s) listos para subir` : `🟢 Conectado a Base de Datos Central (${st.latencyMs || 0} ms)`)
        : `🟡 Modo Offline Activo · ${qLen} cambio(s) guardados localmente`;
      $('homeDbSubline').textContent = st.dbReachable
        ? 'Todos los registros y cambios se reflejan en la computadora central en tiempo real.'
        : 'Puedes trabajar normalmente sin PC; todo se subirá automáticamente al reconectar.';
    }
  }

  function updateHomeKPIs() {
    const emps = DB.state.cache.empleados || [];
    const activos = emps.filter((e) => !isEmpBaja(e)).length;
    const bajas = emps.length - activos;
    $('kpiActivos').textContent = String(activos);
    $('kpiBajasMeta').textContent = `${bajas} baja(s) / inactivos`;
    $('kpiPacientes').textContent = String((DB.state.cache.pacientes || []).length);
    $('kpiConsultas').textContent = String((DB.state.cache.consultas || []).length);
    $('kpiPendientes').textContent = String(DB.state.queue.length);
  }

  function renderHome() {
    updateHomeKPIs();
    updateHeaderAndConnectionUI();
    const doc = getActiveDoctor();
    $('homeActiveDoctorCard').innerHTML = `
      <span><b>Nombre:</b> ${Docs.esc(doc.nombre_completo)}</span>
      <span><b>Cédula:</b> ${Docs.esc(doc.cedula_profesional || 'Sin capturar')}</span>
      <span><b>Especialidad:</b> ${Docs.esc(doc.especialidad || 'Medicina General')}</span>
      <span><b>Firma Digital:</b> ${doc.firma_base64 ? '✅ Capturada' : '⚠️ Falta capturar'}</span>
      <span><b>Rol:</b> ${doc.es_dr_principal ? '⭐ Dr. Jefe / Principal' : 'Médico Colaborador'}</span>
    `;
  }

  /* ==========================================================================
     VISTA 2: PACIENTES, ESTATUS DE ALTA (ACTIVO/BAJA), EDICIÓN Y BENEFICIARIOS
     ========================================================================== */
  function setPacTab(tab) {
    currentPacTab = tab;
    document.querySelectorAll('[data-pactab]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-pactab') === tab);
    });
    renderPacientes();
  }

  function renderPacientes() {
    const q = ($('pacSearchInput').value || '').trim().toLowerCase();
    const stFilter = $('pacStatusFilter').value;
    const emps = DB.state.cache.empleados || [];
    const pacs = DB.state.cache.pacientes || [];
    const container = $('pacientesListContainer');

    if (currentPacTab === 'trabajadores') {
      const filtered = emps.filter((e) => {
        const baja = isEmpBaja(e);
        if (stFilter === 'ACTIVO' && baja) return false;
        if (stFilter === 'BAJA' && !baja) return false;
        if (!q) return true;
        const hay = `${getEmpFullName(e)} ${e.numero_empleado || ''} ${e.curp || ''} ${e.nss || ''} ${e.departamento || ''} ${e.puesto || ''}`.toLowerCase();
        return q.split(/\s+/).every((tok) => hay.includes(tok));
      });

      $('pacientesCountBar').textContent = `Mostrando ${Math.min(filtered.length, 60)} de ${filtered.length} trabajadores`;
      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state span-full">No se encontraron trabajadores con ese criterio.</div>';
        return;
      }

      container.innerHTML = filtered.slice(0, 60).map((emp) => {
        const baja = isEmpBaja(emp);
        const benefs = pacs.filter((p) => String(p.id_empleado) === String(emp.id_empleado) && !DB.isTitularPatient(p));
        const titularPac = pacs.find((p) => String(p.id_empleado) === String(emp.id_empleado) && DB.isTitularPatient(p));
        const pacIdForAction = titularPac ? titularPac.id_paciente : '';
        return `
          <div class="record-card ${baja ? 'is-baja' : ''}">
            <div class="record-top">
              <div>
                <div class="record-name">${Docs.esc(getEmpFullName(emp))}</div>
                <div class="record-meta" style="margin-top:3px;">
                  <span><b>Ficha:</b> #${Docs.esc(emp.numero_empleado || 'S/N')}</span>
                  <span><b>Depto:</b> ${Docs.esc(emp.departamento || 'Sin asignar')}</span>
                  <span><b>Puesto:</b> ${Docs.esc(emp.puesto || 'General')}</span>
                </div>
              </div>
              <span class="badge ${baja ? 'badge-baja' : 'badge-active'}">${baja ? '🔴 BAJA' : '🟢 ALTA / ACTIVO'}</span>
            </div>
            <div class="record-meta">
              ${emp.curp ? `<span><b>CURP:</b> ${Docs.esc(emp.curp)}</span>` : ''}
              ${emp.nss ? `<span><b>NSS:</b> ${Docs.esc(emp.nss)}</span>` : ''}
              <span><b>Beneficiarios:</b> ${benefs.length}</span>
            </div>
            <div class="btn-row" style="margin-top:4px;">
              <button type="button" class="btn btn-soft btn-sm" onclick="MedicoApp.openWorkerDetail('${Docs.esc(emp.id_empleado)}')">👁️ Ver Expediente</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="MedicoApp.openModalWorker('${Docs.esc(emp.id_empleado)}')">✏️ Editar</button>
              <button type="button" class="btn btn-teal btn-sm" onclick="MedicoApp.openModalPatient('', '${Docs.esc(emp.id_empleado)}')">+ Beneficiario</button>
              ${pacIdForAction && !baja ? `<button type="button" class="btn btn-primary btn-sm" onclick="MedicoApp.navigate('consultas',{openForm:true,patientId:'${Docs.esc(pacIdForAction)}'})">📋 Receta</button>` : ''}
            </div>
          </div>`;
      }).join('');
      return;
    }

    // Beneficiarios o Población General
    const list = pacs.filter((p) => {
      if (currentPacTab === 'beneficiarios') {
        if (p.es_poblacion_general || DB.isTitularPatient(p)) return false;
      } else {
        if (!p.es_poblacion_general) return false;
      }
      const emp = p.id_empleado ? emps.find((e) => String(e.id_empleado) === String(p.id_empleado)) : null;
      const baja = emp ? isEmpBaja(emp) : (p.activo === false);
      if (stFilter === 'ACTIVO' && baja) return false;
      if (stFilter === 'BAJA' && !baja) return false;
      if (!q) return true;
      const hay = `${p.nombre_completo || ''} ${p.parentesco || ''} ${emp ? getEmpFullName(emp) : ''} ${emp ? emp.numero_empleado : ''}`.toLowerCase();
      return q.split(/\s+/).every((tok) => hay.includes(tok));
    });

    $('pacientesCountBar').textContent = `Mostrando ${Math.min(list.length, 60)} de ${list.length} registros`;
    if (list.length === 0) {
      container.innerHTML = '<div class="empty-state span-full">No se encontraron pacientes en esta categoría.</div>';
      return;
    }

    container.innerHTML = list.slice(0, 60).map((pac) => {
      const emp = pac.id_empleado ? emps.find((e) => String(e.id_empleado) === String(pac.id_empleado)) : null;
      const baja = emp ? isEmpBaja(emp) : (pac.activo === false);
      return `
        <div class="record-card ${baja ? 'is-baja' : ''}">
          <div class="record-top">
            <div>
              <div class="record-name">${Docs.esc(pac.nombre_completo)}</div>
              <div class="record-meta" style="margin-top:3px;">
                <span><b>Parentesco:</b> ${Docs.esc(pac.parentesco || 'Población General')}</span>
                ${emp ? `<span><b>Titular:</b> ${Docs.esc(getEmpFullName(emp))} (#${Docs.esc(emp.numero_empleado || 'S/N')})</span>` : ''}
                ${pac.acompanante ? `<span><b>Acompañante:</b> ${Docs.esc(pac.acompanante)}</span>` : ''}
              </div>
            </div>
            <span class="badge ${baja ? 'badge-baja' : 'badge-active'}">${baja ? '🔴 SUSPENDIDO' : '🟢 ACTIVO'}</span>
          </div>
          <div class="btn-row" style="margin-top:4px;">
            <button type="button" class="btn btn-outline btn-sm" onclick="MedicoApp.openModalPatient('${Docs.esc(pac.id_paciente)}')">✏️ Modificar</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="MedicoApp.navigate('consultas',{openForm:true,patientId:'${Docs.esc(pac.id_paciente)}'})">📋 Receta</button>
            <button type="button" class="btn btn-soft btn-sm" onclick="MedicoApp.navigate('pases',{openForm:true,patientId:'${Docs.esc(pac.id_paciente)}'})">🏥 Pase</button>
            <button type="button" class="btn btn-outline btn-sm" onclick="MedicoApp.navigate('hotel',{patientId:'${Docs.esc(pac.id_paciente)}'})">🏨 Hotel</button>
          </div>
        </div>`;
    }).join('');
  }

  function openWorkerDetail(empId) {
    const emp = (DB.state.cache.empleados || []).find((e) => String(e.id_empleado) === String(empId));
    if (!emp) return;
    const baja = isEmpBaja(emp);
    const pacs = DB.state.cache.pacientes || [];
    const titular = pacs.find((p) => String(p.id_empleado) === String(emp.id_empleado) && DB.isTitularPatient(p));
    const benefs = pacs.filter((p) => String(p.id_empleado) === String(emp.id_empleado) && !DB.isTitularPatient(p));
    const relatedPacIds = new Set(pacs.filter((p) => String(p.id_empleado) === String(emp.id_empleado)).map((p) => String(p.id_paciente)));
    const empConsultas = (DB.state.cache.consultas || []).filter((c) => relatedPacIds.has(String(c.id_paciente)));

    $('detailWorkerTitle').textContent = getEmpFullName(emp);
    $('detailWorkerBody').innerHTML = `
      <div class="alert-banner ${baja ? 'alert-danger' : 'alert-success'}">
        ${baja ? '🔴 TRABAJADOR DADO DE BAJA / INACTIVO — Atención médica y pases suspendidos.' : '🟢 TRABAJADOR DADO DE ALTA / ACTIVO — Autorizado para atención médica, recetas y pases.'}
      </div>
      <div class="form-grid cols-2">
        <div class="record-card"><b>Ficha:</b> #${Docs.esc(emp.numero_empleado || 'S/N')}<br><b>Depto:</b> ${Docs.esc(emp.departamento || '—')}<br><b>Puesto:</b> ${Docs.esc(emp.puesto || '—')}</div>
        <div class="record-card"><b>CURP:</b> ${Docs.esc(emp.curp || '—')}<br><b>NSS:</b> ${Docs.esc(emp.nss || '—')}<br><b>RFC:</b> ${Docs.esc(emp.rfc || '—')}</div>
      </div>
      <div>
        <div style="font-size:12px;font-weight:900;color:var(--primary);margin-bottom:6px;text-transform:uppercase;">Beneficiarios Registrados (${benefs.length})</div>
        ${benefs.length === 0 ? '<div class="empty-state">Sin beneficiarios vinculados.</div>' : benefs.map((b) => `
          <div class="record-card" style="margin-bottom:6px;">
            <div class="record-top">
              <div><b>${Docs.esc(b.nombre_completo)}</b><div class="record-meta">${Docs.esc(b.parentesco || 'Familiar')}</div></div>
              <button type="button" class="btn btn-outline btn-sm" onclick="MedicoApp.closeModals();MedicoApp.openModalPatient('${Docs.esc(b.id_paciente)}')">Editar</button>
            </div>
          </div>`).join('')}
      </div>
      <div style="font-size:12px;font-weight:800;color:var(--text-muted);">Consultas recientes en caché: ${empConsultas.length}</div>
    `;
    $('detailWorkerFoot').innerHTML = `
      <button type="button" class="btn ${baja ? 'btn-success' : 'btn-danger'} btn-sm" onclick="MedicoApp.toggleWorkerStatus('${Docs.esc(emp.id_empleado)}')">
        ${baja ? '✅ Reactivar (Dar de Alta)' : '⛔ Dar de Baja'}
      </button>
      <button type="button" class="btn btn-teal btn-sm" onclick="MedicoApp.closeModals();MedicoApp.openModalPatient('', '${Docs.esc(emp.id_empleado)}')">+ Beneficiario</button>
      ${titular ? `<button type="button" class="btn btn-primary btn-sm" onclick="MedicoApp.closeModals();MedicoApp.navigate('consultas',{openForm:true,patientId:'${Docs.esc(titular.id_paciente)}'})">📋 Nueva Receta</button>` : ''}
      <button type="button" class="btn btn-outline btn-sm" onclick="MedicoApp.closeModals()">Cerrar</button>
    `;
    $('modalWorkerDetail').classList.remove('hidden');
  }

  async function toggleWorkerStatus(empId) {
    const emp = (DB.state.cache.empleados || []).find((e) => String(e.id_empleado) === String(empId));
    if (!emp) return;
    const nextStatus = isEmpBaja(emp) ? 'ACTIVO' : 'BAJA';
    if (!confirm(`¿Cambiar estatus de ${getEmpFullName(emp)} a ${nextStatus}?`)) return;

    await DB.submitOrQueue(
      'UPDATE_WORKER_STATUS',
      `Estatus ${nextStatus}: ${getEmpFullName(emp)}`,
      { id_empleado: emp.id_empleado, estado_empleado: nextStatus },
      () => {
        emp.estado_empleado = nextStatus;
        (DB.state.cache.pacientes || []).forEach((p) => {
          if (String(p.id_empleado) === String(emp.id_empleado)) p.activo = nextStatus === 'ACTIVO';
        });
      }
    );
    closeModals();
    renderPacientes();
    showToast(`Estatus actualizado a ${nextStatus}.`);
  }

  function openModalWorker(empId) {
    const emp = empId ? (DB.state.cache.empleados || []).find((e) => String(e.id_empleado) === String(empId)) : null;
    $('modalWorkerTitle').textContent = emp ? '✏️ Modificar Trabajador' : '👤 Alta de Nuevo Trabajador';
    $('wrkId').value = emp ? emp.id_empleado : '';
    $('wrkNombre').value = emp ? (emp.nombre || '') : '';
    $('wrkPaterno').value = emp ? (emp.apellido_paterno || '') : '';
    $('wrkMaterno').value = emp ? (emp.apellido_materno || '') : '';
    $('wrkNum').value = emp ? (emp.numero_empleado || '') : '';
    $('wrkDepto').value = emp ? (emp.departamento || 'MINA GENERAL') : 'MINA GENERAL';
    $('wrkPuesto').value = emp ? (emp.puesto || 'GENERAL') : 'GENERAL';
    $('wrkCurp').value = emp ? (emp.curp || '') : '';
    $('wrkNss').value = emp ? (emp.nss || '') : '';
    $('wrkRfc').value = emp ? (emp.rfc || '') : '';
    $('wrkEstado').value = emp && isEmpBaja(emp) ? 'BAJA' : 'ACTIVO';
    $('modalWorker').classList.remove('hidden');
  }

  async function saveWorkerForm(e) {
    e.preventDefault();
    const editId = $('wrkId').value;
    const data = {
      nombre: $('wrkNombre').value.trim().toUpperCase(),
      apellido_paterno: $('wrkPaterno').value.trim().toUpperCase(),
      apellido_materno: $('wrkMaterno').value.trim().toUpperCase(),
      numero_empleado: $('wrkNum').value.trim() || null,
      departamento: $('wrkDepto').value.trim().toUpperCase() || 'MINA GENERAL',
      puesto: $('wrkPuesto').value.trim().toUpperCase() || 'GENERAL',
      curp: $('wrkCurp').value.trim().toUpperCase() || null,
      nss: $('wrkNss').value.trim() || null,
      rfc: $('wrkRfc').value.trim().toUpperCase() || null,
      estado_empleado: $('wrkEstado').value,
    };
    const fullName = `${data.nombre} ${data.apellido_paterno} ${data.apellido_materno}`.trim();

    if (editId) {
      await DB.submitOrQueue(
        'UPDATE_WORKER_DATA',
        `Editar trabajador: ${fullName}`,
        { id_empleado: editId, patch: data },
        () => {
          const found = (DB.state.cache.empleados || []).find((x) => String(x.id_empleado) === String(editId));
          if (found) Object.assign(found, data);
        }
      );
      showToast('Trabajador actualizado correctamente.');
    } else {
      const tempEmpId = 'local_emp_' + Date.now();
      const tempPacId = 'local_pac_' + Date.now();
      const titularPaciente = {
        nombre_completo: fullName,
        parentesco: 'TITULAR (TRABAJADOR)',
        es_poblacion_general: false,
        activo: data.estado_empleado === 'ACTIVO',
      };
      const res = await DB.submitOrQueue(
        'CREATE_WORKER',
        `Alta trabajador: ${fullName}`,
        { tempEmpId, tempPacId, empleado: data, titularPaciente },
        () => {
          DB.state.cache.empleados.unshift(Object.assign({ id_empleado: tempEmpId }, data));
          DB.state.cache.pacientes.unshift(Object.assign({ id_paciente: tempPacId, id_empleado: tempEmpId }, titularPaciente));
        }
      );
      if (res.synced) await DB.downloadAllData(true);
      showToast(res.synced ? 'Trabajador guardado en BD central.' : 'Trabajador guardado localmente (se subirá al conectar).');
    }
    closeModals();
    renderPacientes();
  }

  function openModalPatient(pacId, preselectEmpId) {
    const pac = pacId ? (DB.state.cache.pacientes || []).find((p) => String(p.id_paciente) === String(pacId)) : null;
    $('modalPatientTitle').textContent = pac ? '✏️ Modificar Paciente / Beneficiario' : '🩺 Alta de Beneficiario / Paciente';
    $('patId').value = pac ? pac.id_paciente : '';
    $('patNombre').value = pac ? (pac.nombre_completo || '') : '';
    $('patTipo').value = pac && pac.es_poblacion_general ? 'GENERAL' : 'BENEFICIARIO';
    $('patParentesco').value = pac && pac.parentesco ? pac.parentesco : 'Esposo(a)';
    $('patFechaNac').value = pac && pac.fecha_nacimiento ? String(pac.fecha_nacimiento).slice(0, 10) : '';
    $('patAcompanante').value = pac ? (pac.acompanante || '') : '';

    // Poblar selector de trabajadores titulares
    const sel = $('patTitularSelect');
    const emps = DB.state.cache.empleados || [];
    sel.innerHTML = '<option value="">— Seleccionar Trabajador Titular —</option>' + emps.map((e) =>
      `<option value="${Docs.esc(e.id_empleado)}">#${Docs.esc(e.numero_empleado || 'S/N')} — ${Docs.esc(getEmpFullName(e))}${isEmpBaja(e) ? ' [BAJA]' : ''}</option>`
    ).join('');
    sel.value = (pac && pac.id_empleado) || preselectEmpId || '';
    if (preselectEmpId && !$('patAcompanante').value) {
      const emp = emps.find((e) => String(e.id_empleado) === String(preselectEmpId));
      if (emp) $('patAcompanante').value = getEmpFullName(emp);
    }
    onPatTipoChange();
    $('modalPatient').classList.remove('hidden');
  }

  function onPatTipoChange() {
    const isGen = $('patTipo').value === 'GENERAL';
    $('patParentescoWrap').classList.toggle('hidden', isGen);
    $('patTitularWrap').classList.toggle('hidden', isGen);
  }

  async function savePatientForm(e) {
    e.preventDefault();
    const editId = $('patId').value;
    const isGen = $('patTipo').value === 'GENERAL';
    const row = {
      nombre_completo: $('patNombre').value.trim().toUpperCase(),
      es_poblacion_general: isGen,
      parentesco: isGen ? 'Población General' : $('patParentesco').value,
      id_empleado: isGen ? null : ($('patTitularSelect').value || null),
      fecha_nacimiento: $('patFechaNac').value || null,
      acompanante: $('patAcompanante').value.trim().toUpperCase() || null,
      activo: true,
    };

    if (editId) {
      await DB.submitOrQueue(
        'UPDATE_PATIENT',
        `Modificar paciente: ${row.nombre_completo}`,
        { id_paciente: editId, patch: row },
        () => {
          const found = (DB.state.cache.pacientes || []).find((x) => String(x.id_paciente) === String(editId));
          if (found) Object.assign(found, row);
        }
      );
      showToast('Paciente modificado correctamente.');
    } else {
      const tempPacId = 'local_pac_' + Date.now();
      const res = await DB.submitOrQueue(
        'CREATE_PATIENT',
        `Alta paciente: ${row.nombre_completo}`,
        { tempPacId, paciente: row },
        () => {
          DB.state.cache.pacientes.unshift(Object.assign({ id_paciente: tempPacId }, row));
        }
      );
      if (res.synced) await DB.downloadAllData(true);
      showToast(res.synced ? 'Paciente registrado en BD central.' : 'Paciente guardado en caché offline.');
    }
    closeModals();
    renderPacientes();
  }

  /* ==========================================================================
     VISTA 3: CONSULTAS Y RECETAS MÉDICAS COFEPRIS
     ========================================================================== */
  function createEmptyMed() {
    return {
      id_medicamento: '',
      nombre_generico: '',
      nombre_comercial: '',
      forma_farmaceutica: 'Tableta',
      dosis: '500 mg (1 unidad)',
      presentacion: '',
      frecuencia: 'Cada 8 horas',
      via_administracion: 'Oral (VO)',
      duracion_tratamiento: 'Por 5 días',
      indicaciones_uso: 'Tomar después de los alimentos con abundante agua.',
      cantidad: 1,
      costo_unitario: 0,
    };
  }

  function populateConsultaSelects() {
    const docSel = $('consDoctorSelect');
    docSel.innerHTML = doctorProfiles.map((d) =>
      `<option value="${Docs.esc(d.id)}">${Docs.esc(d.nombre_completo)} ${d.es_dr_principal ? '⭐ (Dr. Jefe)' : ''} ${d.cedula_profesional ? '· Céd. ' + Docs.esc(d.cedula_profesional) : ''}</option>`
    ).join('');
    docSel.value = activeDoctorId;
    populateConsultaPatients();
  }

  function populateConsultaPatients() {
    const q = ($('consPacFilter').value || '').trim().toLowerCase();
    const sel = $('consPacSelect');
    const prev = sel.value;
    const pacs = (DB.state.cache.pacientes || []).filter((p) =>
      !q || String(p.nombre_completo || '').toLowerCase().includes(q)
    );
    sel.innerHTML = '<option value="">— Formato Abierto / Seleccionar Paciente —</option>' + pacs.slice(0, 250).map((p) =>
      `<option value="${Docs.esc(p.id_paciente)}">${Docs.esc(p.nombre_completo)} (${Docs.esc(p.parentesco || 'General')})</option>`
    ).join('');
    if (prev) sel.value = prev;
  }

  function toggleConsultaForm(forceOpen, preselectPacId) {
    const box = $('consultaFormBox');
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : box.classList.contains('hidden');
    box.classList.toggle('hidden', !shouldOpen);
    $('btnToggleConsultaForm').textContent = shouldOpen ? '✕ Cerrar Formulario' : '+ Nueva Consulta / Receta';
    if (shouldOpen) {
      populateConsultaSelects();
      if (consultaMeds.length === 0) consultaMeds = [createEmptyMed()];
      renderConsultaMeds();
      if (preselectPacId) {
        $('consPacSelect').value = preselectPacId;
        onConsultaPatientChange();
      }
    }
  }

  function onConsultaPatientChange() {
    const pacId = $('consPacSelect').value;
    const pac = (DB.state.cache.pacientes || []).find((p) => String(p.id_paciente) === String(pacId));
    const alertBox = $('consultaBajaAlert');
    alertBox.classList.add('hidden');
    if (!pac) return;

    $('consCosto').value = pac.es_poblacion_general ? 200 : 0;
    if (pac.fecha_nacimiento) $('consEdad').value = calcAgeYears(pac.fecha_nacimiento);
    if (pac.acompanante) $('consAcompanante').value = pac.acompanante;

    if (pac.id_empleado) {
      const emp = (DB.state.cache.empleados || []).find((e) => String(e.id_empleado) === String(pac.id_empleado));
      if (emp && isEmpBaja(emp)) {
        alertBox.textContent = `⚠️ AVISO: El trabajador titular "${getEmpFullName(emp)}" está DADO DE BAJA. Puedes emitir receta abierta como atención externa si lo autorizas.`;
        alertBox.classList.remove('hidden');
      }
    }
  }

  function recalcImc() {
    const imc = Docs.calcularIMC($('consPeso').value, $('consTalla').value);
    $('consImc').value = imc;
  }

  function addConsultaMedRow() {
    consultaMeds.push(createEmptyMed());
    renderConsultaMeds();
  }

  function removeConsultaMedRow(idx) {
    consultaMeds.splice(idx, 1);
    if (consultaMeds.length === 0) consultaMeds.push(createEmptyMed());
    renderConsultaMeds();
  }

  function updateConsultaMedField(idx, field, val) {
    if (!consultaMeds[idx]) return;
    if (field === 'id_medicamento') {
      consultaMeds[idx].id_medicamento = val;
      const cat = (DB.state.cache.medicamentos || []).find((m) => String(m.id_medicamento) === String(val));
      if (cat) {
        consultaMeds[idx].nombre_generico = (cat.sustancia_activa || cat.nombre || '').toUpperCase();
        consultaMeds[idx].nombre_comercial = cat.nombre || '';
        consultaMeds[idx].presentacion = cat.presentacion || '';
        consultaMeds[idx].costo_unitario = Number(cat.precio_venta || 0);
        renderConsultaMeds();
      }
      return;
    }
    consultaMeds[idx][field] = field === 'cantidad' ? Math.max(1, parseInt(val, 10) || 1) : val;
  }

  function renderConsultaMeds() {
    const medsCat = DB.state.cache.medicamentos || [];
    const catOpts = '<option value="">— Captura libre o elegir de farmacia —</option>' + medsCat.slice(0, 300).map((m) =>
      `<option value="${Docs.esc(m.id_medicamento)}">${Docs.esc(m.nombre)} ${m.sustancia_activa ? '(' + Docs.esc(m.sustancia_activa) + ')' : ''}</option>`
    ).join('');

    $('consultaMedsList').innerHTML = consultaMeds.map((m, i) => `
      <div class="med-item-box">
        <div class="med-item-head">
          <strong style="font-size:13px;color:var(--primary);">Medicamento #${i + 1}</strong>
          <button type="button" class="btn btn-danger btn-sm" onclick="MedicoApp.removeConsultaMedRow(${i})">Quitar</button>
        </div>
        <div class="form-grid cols-2">
          <div class="field-group span-full">
            <label class="field-label">Catálogo Farmacia (Opcional)</label>
            <select class="field-select" onchange="MedicoApp.updateConsultaMedField(${i},'id_medicamento',this.value)">${catOpts.replace(`value="${Docs.esc(m.id_medicamento)}"`, `value="${Docs.esc(m.id_medicamento)}" selected`)}</select>
          </div>
          <div class="field-group"><label class="field-label">Nombre Genérico *</label><input class="field-input" value="${Docs.esc(m.nombre_generico)}" oninput="MedicoApp.updateConsultaMedField(${i},'nombre_generico',this.value)" placeholder="Ej. PARACETAMOL" /></div>
          <div class="field-group"><label class="field-label">Forma Farmacéutica</label>
            <select class="field-select" onchange="MedicoApp.updateConsultaMedField(${i},'forma_farmaceutica',this.value)">
              ${Docs.FORMAS_FARMACEUTICAS.map((f) => `<option ${f === m.forma_farmaceutica ? 'selected' : ''}>${Docs.esc(f)}</option>`).join('')}
            </select>
          </div>
          <div class="field-group"><label class="field-label">Dosis</label><input class="field-input" value="${Docs.esc(m.dosis)}" oninput="MedicoApp.updateConsultaMedField(${i},'dosis',this.value)" /></div>
          <div class="field-group"><label class="field-label">Presentación</label><input class="field-input" value="${Docs.esc(m.presentacion)}" oninput="MedicoApp.updateConsultaMedField(${i},'presentacion',this.value)" placeholder="Caja con 20 tabletas" /></div>
          <div class="field-group"><label class="field-label">Frecuencia</label><input class="field-input" value="${Docs.esc(m.frecuencia)}" oninput="MedicoApp.updateConsultaMedField(${i},'frecuencia',this.value)" /></div>
          <div class="field-group"><label class="field-label">Vía de Administración</label>
            <select class="field-select" onchange="MedicoApp.updateConsultaMedField(${i},'via_administracion',this.value)">
              ${Docs.VIAS_ADMINISTRACION.map((v) => `<option ${v === m.via_administracion ? 'selected' : ''}>${Docs.esc(v)}</option>`).join('')}
            </select>
          </div>
          <div class="field-group"><label class="field-label">Duración</label><input class="field-input" value="${Docs.esc(m.duracion_tratamiento)}" oninput="MedicoApp.updateConsultaMedField(${i},'duracion_tratamiento',this.value)" /></div>
          <div class="field-group"><label class="field-label">Cantidad</label><input type="number" min="1" class="field-input" value="${m.cantidad}" oninput="MedicoApp.updateConsultaMedField(${i},'cantidad',this.value)" /></div>
          <div class="field-group span-full"><label class="field-label">Indicaciones para el Uso</label><input class="field-input" value="${Docs.esc(m.indicaciones_uso)}" oninput="MedicoApp.updateConsultaMedField(${i},'indicaciones_uso',this.value)" /></div>
        </div>
      </div>`).join('');
  }

  function buildDraftRecetaInput() {
    const docId = $('consDoctorSelect').value;
    const doctor = doctorProfiles.find((d) => d.id === docId) || getActiveDoctor();
    const pacId = $('consPacSelect').value;
    const pacObj = (DB.state.cache.pacientes || []).find((p) => String(p.id_paciente) === String(pacId));
    const patName = ($('consPacLibre').value.trim() || (pacObj && pacObj.nombre_completo) || 'PACIENTE').toUpperCase();
    const validMeds = consultaMeds.filter((m) => (m.nombre_generico || '').trim() || m.id_medicamento);

    return {
      cfg: Docs.loadCofeprisConfig(),
      doctor,
      folio: 'REC-' + Date.now().toString(36).toUpperCase().slice(-6),
      fechaTexto: new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      paciente: {
        nombre_completo: patName,
        edad: $('consEdad').value.trim(),
        sexo: $('consSexo').value,
        alergias: $('consAlergias').value.trim(),
        talla: $('consTalla').value.trim(),
        peso: $('consPeso').value.trim(),
        imc: $('consImc').value.trim() || Docs.calcularIMC($('consPeso').value, $('consTalla').value),
        temperatura: $('consTemp').value.trim(),
        presion_arterial: $('consTA').value.trim(),
        diagnostico: $('consDiagnostico').value.trim() || 'Valoración clínica',
      },
      medicamentos: validMeds,
    };
  }

  function previewDraftReceta() {
    const input = buildDraftRecetaInput();
    openDocPreview('Receta Médica COFEPRIS (Vista Previa)', Docs.buildRecetaHtml(input), () => Docs.downloadRecetaPDF(input));
  }

  async function saveConsulta(e) {
    e.preventDefault();
    const input = buildDraftRecetaInput();
    const pacId = $('consPacSelect').value || null;
    const freeName = $('consPacLibre').value.trim().toUpperCase();
    if (!pacId && !freeName) {
      return alert('Selecciona un paciente del padrón o escribe el nombre libre del paciente.');
    }

    const cofeprisMeta = {
      paciente_nombre_libre: freeName || input.paciente.nombre_completo,
      edad: input.paciente.edad,
      sexo: input.paciente.sexo,
      alergias: input.paciente.alergias,
      talla: input.paciente.talla,
      peso: input.paciente.peso,
      imc: input.paciente.imc,
      temperatura: input.paciente.temperatura,
      presion_arterial: input.paciente.presion_arterial,
      diagnostico_limpio: input.paciente.diagnostico,
      doctor_snapshot: input.doctor,
      medicamentos: input.medicamentos,
    };

    const diagEncoded = Docs.encodeConsultaDiagnosticoWithCofepris(input.paciente.diagnostico, cofeprisMeta);
    const localId = 'local_cons_' + Date.now();
    Docs.saveConsultaMetaLocal(localId, cofeprisMeta);

    const consultaRow = {
      id_paciente: pacId,
      diagnostico: diagEncoded,
      costo_consulta: parseFloat($('consCosto').value || '0') || 0,
      medico_id: (DB.state.session && DB.state.session.user_id) || null,
    };

    const res = await DB.submitOrQueue(
      'CREATE_CONSULTA',
      `Consulta y Receta: ${input.paciente.nombre_completo}`,
      {
        consulta: consultaRow,
        freePatientName: !pacId ? freeName : null,
        cofeprisMeta,
        medicamentos: input.medicamentos,
        acompanante: $('consAcompanante').value.trim(),
      },
      () => {
        DB.state.cache.consultas.unshift({
          id_consulta: localId,
          id_paciente: pacId,
          diagnostico: diagEncoded,
          costo_consulta: consultaRow.costo_consulta,
          fecha: new Date().toISOString(),
          pacientes: { nombre_completo: input.paciente.nombre_completo },
        });
      }
    );

    if (res.synced) await DB.downloadAllData(true);
    toggleConsultaForm(false);
    $('consDiagnostico').value = '';
    $('consPacLibre').value = '';
    consultaMeds = [createEmptyMed()];
    renderConsultas();
    showToast(res.synced ? '✅ Consulta guardada en BD central.' : '🟡 Consulta guardada offline (en cola para BD).');
    openDocPreview('Receta Médica COFEPRIS Generada', Docs.buildRecetaHtml(input), () => Docs.downloadRecetaPDF(input));
  }

  function renderConsultas() {
    const q = ($('consHistSearch').value || '').trim().toLowerCase();
    const list = (DB.state.cache.consultas || []).filter((c) => {
      const { cleanDiagnostico, meta } = Docs.decodeConsultaCofeprisMeta(c.id_consulta, c.diagnostico);
      const name = (meta && meta.paciente_nombre_libre) || (c.pacientes && c.pacientes.nombre_completo) || 'Paciente';
      if (!q) return true;
      return `${name} ${cleanDiagnostico}`.toLowerCase().includes(q);
    });

    const box = $('consultasListContainer');
    if (list.length === 0) {
      box.innerHTML = '<div class="empty-state">No hay consultas registradas aún.</div>';
      return;
    }

    box.innerHTML = list.slice(0, 50).map((c) => {
      const { cleanDiagnostico, meta } = Docs.decodeConsultaCofeprisMeta(c.id_consulta, c.diagnostico);
      const name = (meta && meta.paciente_nombre_libre) || (c.pacientes && c.pacientes.nombre_completo) || 'PACIENTE';
      const fecha = c.fecha ? new Date(c.fecha).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'Reciente';
      const medsCount = (meta && meta.medicamentos && meta.medicamentos.length) || 0;
      return `
        <div class="record-card">
          <div class="record-top">
            <div>
              <div class="record-name">${Docs.esc(name)}</div>
              <div class="record-meta" style="margin-top:2px;">
                <span>📅 ${Docs.esc(fecha)}</span>
                <span>💊 ${medsCount} med(s)</span>
                ${meta && meta.doctor_snapshot ? `<span>👨‍⚕️ ${Docs.esc(meta.doctor_snapshot.nombre_completo)}</span>` : ''}
              </div>
            </div>
            <button type="button" class="btn btn-primary btn-sm" onclick="MedicoApp.openRecetaFromHistory('${Docs.esc(c.id_consulta)}')">📄 Ver / PDF</button>
          </div>
          <div style="font-size:13px;color:var(--text-secondary);"><b>Dx:</b> ${Docs.esc(cleanDiagnostico || 'Valoración general')}</div>
        </div>`;
    }).join('');
  }

  function openRecetaFromHistory(idConsulta) {
    const c = (DB.state.cache.consultas || []).find((x) => String(x.id_consulta) === String(idConsulta));
    if (!c) return;
    const { cleanDiagnostico, meta } = Docs.decodeConsultaCofeprisMeta(c.id_consulta, c.diagnostico);
    let doc = getActiveDoctor();
    if (meta && meta.doctor_snapshot) {
      const match = doctorProfiles.find((d) => d.id === meta.doctor_snapshot.id);
      doc = match || Object.assign({}, doc, meta.doctor_snapshot, {
        firma_base64: meta.doctor_snapshot.firma_base64 === '__HAS_SIG__' ? doc.firma_base64 : (meta.doctor_snapshot.firma_base64 || doc.firma_base64),
      });
    }
    const input = {
      cfg: Docs.loadCofeprisConfig(),
      doctor: doc,
      folio: 'REC-' + String(c.id_consulta).slice(0, 8).toUpperCase(),
      fechaTexto: new Date(c.fecha || Date.now()).toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      paciente: {
        nombre_completo: ((meta && meta.paciente_nombre_libre) || (c.pacientes && c.pacientes.nombre_completo) || 'PACIENTE').toUpperCase(),
        edad: (meta && meta.edad) || '',
        sexo: (meta && meta.sexo) || '',
        alergias: (meta && meta.alergias) || '',
        talla: (meta && meta.talla) || '',
        peso: (meta && meta.peso) || '',
        imc: (meta && meta.imc) || '',
        temperatura: (meta && meta.temperatura) || '',
        presion_arterial: (meta && meta.presion_arterial) || '',
        diagnostico: cleanDiagnostico || 'Valoración general',
      },
      medicamentos: (meta && meta.medicamentos) || [],
    };
    openDocPreview(`Receta ${input.folio}`, Docs.buildRecetaHtml(input), () => Docs.downloadRecetaPDF(input));
  }

  /* ==========================================================================
     VISTA 4: PASES MÉDICOS
     ========================================================================== */
  function nextPaseFolio() {
    const yr = new Date().getFullYear();
    let maxN = 0;
    (DB.state.cache.pases || []).forEach((p) => {
      const m = String(p.folio || '').match(/(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxN) maxN = n;
      }
    });
    return `PM-${yr}-${String(maxN + 1).padStart(4, '0')}`;
  }

  function populatePaseSelects() {
    populatePasePatients();
    const clinicas = (DB.state.cache.clinicas || []).filter((c) => c.activo !== false);
    const origSel = $('paseClinicaOrigen');
    const destSel = $('paseClinicaDestino');
    const opts = '<option value="">— Seleccionar Clínica —</option>' + clinicas.map((c) =>
      `<option value="${Docs.esc(c.id_clinica)}">${Docs.esc(c.nombre)} (${Docs.esc(c.tipo || 'Clínica')} · ${Docs.esc(c.ubicacion || '')})</option>`
    ).join('');
    origSel.innerHTML = opts;
    destSel.innerHTML = opts;
    const doc = getActiveDoctor();
    if (doc.id_clinica) origSel.value = doc.id_clinica;
  }

  function populatePasePatients() {
    const q = ($('pasePacFilter').value || '').trim().toLowerCase();
    const sel = $('pasePacSelect');
    const prev = sel.value;
    const pacs = (DB.state.cache.pacientes || []).filter((p) =>
      !q || String(p.nombre_completo || '').toLowerCase().includes(q)
    );
    sel.innerHTML = '<option value="">— Seleccionar Paciente —</option>' + pacs.slice(0, 250).map((p) =>
      `<option value="${Docs.esc(p.id_paciente)}">${Docs.esc(p.nombre_completo)} (${Docs.esc(p.parentesco || 'General')})</option>`
    ).join('');
    if (prev) sel.value = prev;
  }

  function togglePaseForm(forceOpen, preselectPacId) {
    const box = $('paseFormBox');
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : box.classList.contains('hidden');
    box.classList.toggle('hidden', !shouldOpen);
    $('btnTogglePaseForm').textContent = shouldOpen ? '✕ Cerrar Formulario' : '+ Nuevo Pase Médico';
    if (shouldOpen) {
      populatePaseSelects();
      $('paseFolio').value = nextPaseFolio();
      if (preselectPacId) {
        $('pasePacSelect').value = preselectPacId;
        onPasePatientChange();
      }
    }
  }

  function onPasePatientChange() {
    const pacId = $('pasePacSelect').value;
    const pac = (DB.state.cache.pacientes || []).find((p) => String(p.id_paciente) === String(pacId));
    const alertBox = $('paseBajaAlert');
    alertBox.classList.add('hidden');
    if (!pac) return;

    $('paseParentesco').value = pac.parentesco || 'TITULAR';
    $('paseEdad').value = calcAgeYears(pac.fecha_nacimiento);
    $('paseAcompanante').value = pac.acompanante || 'NO REQUIERE';

    const emp = pac.id_empleado ? (DB.state.cache.empleados || []).find((e) => String(e.id_empleado) === String(pac.id_empleado)) : null;
    if (emp) {
      $('paseTrabajador').value = getEmpFullName(emp).toUpperCase();
      if ($('paseDepartamento')) {
        $('paseDepartamento').value = (emp.departamento || (emp.departamento_id && emp.departamento_id.departamento) || emp.puesto || 'General').toUpperCase();
      }
      if ($('paseAntiguedad') && emp.fecha_ingreso) {
        $('paseAntiguedad').value = calcAgeYears(emp.fecha_ingreso) + ' de servicio';
      }
      if (isEmpBaja(emp)) {
        alertBox.textContent = `⚠️ TRABAJADOR EN BAJA: "${getEmpFullName(emp)}" tiene estatus BAJA. Atención médica y pases suspendidos.`;
        alertBox.classList.remove('hidden');
      }
    } else {
      $('paseTrabajador').value = pac.nombre_completo || '';
      if ($('paseDepartamento')) $('paseDepartamento').value = 'PÚBLICO GENERAL';
    }
  }

  function onPaseClinicaDestinoChange() {
    const id = $('paseClinicaDestino').value;
    const cli = (DB.state.cache.clinicas || []).find((c) => String(c.id_clinica) === String(id));
    if (cli) $('paseUnidadRefiere').value = cli.nombre;
  }

  function onPaseHotelToggle() {
    $('paseHotelNombreGroup').classList.toggle('hidden', $('paseRequiereHotel').value !== 'SI');
  }

  async function savePaseMedico(e) {
    e.preventDefault();
    const pacId = $('pasePacSelect').value;
    const pac = (DB.state.cache.pacientes || []).find((p) => String(p.id_paciente) === String(pacId));
    if (!pac) return alert('Selecciona un paciente.');

    const doc = getActiveDoctor();
    const drJefe = doctorProfiles.find((d) => d.es_dr_principal) || doc;
    const reqHotel = $('paseRequiereHotel').value === 'SI';
    const hotelNombre = reqHotel ? ($('paseHotelNombre').value.trim().toUpperCase() || 'HOTEL DEL CENTRO') : null;

    const paseRow = {
      id_paciente: pac.id_paciente,
      id_empleado: pac.id_empleado || null,
      id_clinica_origen: $('paseClinicaOrigen').value || null,
      id_clinica_destino: $('paseClinicaDestino').value || null,
      folio: $('paseFolio').value.trim().toUpperCase(),
      urgencia: $('paseUrgencia').value,
      parentesco: $('paseParentesco').value.trim().toUpperCase(),
      nombre_trabajador: $('paseTrabajador').value.trim().toUpperCase(),
      edad: $('paseEdad').value.trim().toUpperCase(),
      departamento_pasajero: ($('paseDepartamento') ? $('paseDepartamento').value.trim() : '').toUpperCase(),
      antiguedad: ($('paseAntiguedad') ? $('paseAntiguedad').value.trim() : '').toUpperCase(),
      unidad_refiere: 'UNIDAD MEDICA BACIS',
      unidad_se_refiere: $('paseUnidadRefiere').value.trim().toUpperCase(),
      servicio_se_envia: $('paseServicio').value.trim().toUpperCase(),
      acompanante: $('paseAcompanante').value.trim().toUpperCase() || 'NO REQUIERE',
      medio_transporte: $('paseTransporte').value,
      fecha_salida: $('paseFechaSalida').value || null,
      fecha_retorno: ($('paseFechaRetorno') ? $('paseFechaRetorno').value : null) || null,
      fecha_cita: $('paseFechaCita').value || null,
      requiere_hotel: reqHotel,
      hotel_nombre: hotelNombre,
      sv_ta: $('paseTa').value.trim(),
      sv_temp: $('paseTemp').value.trim(),
      sv_fc: $('paseFc').value.trim(),
      sv_fr: $('paseFr').value.trim(),
      sv_peso: $('pasePeso') ? $('pasePeso').value.trim() : '',
      sv_talla: $('paseTalla') ? $('paseTalla').value.trim() : '',
      padecimiento_actual: $('pasePadecimiento').value.trim().toUpperCase(),
      motivo: $('pasePadecimiento').value.trim().toUpperCase(),
      impresion_diagnostica: $('paseDiagnostico').value.trim().toUpperCase(),
      estudios_paraclinicos: $('paseEstudios').value.trim().toUpperCase(),
      comentarios: $('paseComentarios').value.trim().toUpperCase(),
      medico_refiere: doc.nombre_completo,
      cedula_refiere: doc.cedula_profesional || '',
      medico_responsable_unidad: drJefe.nombre_completo,
      cedula_responsable_unidad: drJefe.cedula_profesional || '',
      compartido_departamentos: $('paseCompartidoDeptos') ? $('paseCompartidoDeptos').checked : true,
    };

    if (reqHotel) {
      DB.addHotelHistoryEntry({
        pase_medico: `${pac.nombre_completo} (Folio ${paseRow.folio})`.toUpperCase(),
        acompanante: paseRow.acompanante,
        hotel_nombre: hotelNombre,
        fecha_salida: paseRow.fecha_salida || new Date().toISOString().split('T')[0],
        empresa: 'GRUPO MINERO BACIS S.A. DE C.V.',
        unidad: 'UNIDAD "EL HERRERO"',
        emitido_el: new Date().toISOString(),
        medico: doc.nombre_completo,
      });
    }

    const previewObj = Object.assign({}, paseRow, { paciente_nombre: pac.nombre_completo });
    const res = await DB.submitOrQueue(
      'CREATE_PASE_MEDICO',
      `Pase Médico ${paseRow.folio}: ${pac.nombre_completo}`,
      { pase: paseRow },
      () => {
        DB.state.cache.pases.unshift(Object.assign({ id_pase: 'local_pase_' + Date.now(), creado_el: new Date().toISOString(), pacientes: { nombre_completo: pac.nombre_completo } }, paseRow));
      }
    );

    if (res.synced) await DB.downloadAllData(true);
    togglePaseForm(false);
    $('pasePadecimiento').value = '';
    $('paseDiagnostico').value = '';
    renderPases();
    showToast(res.synced ? '✅ Pase médico registrado en BD central.' : '🟡 Pase médico guardado en cola offline.');
    openDocPreview(`Pase Médico ${paseRow.folio}`, Docs.buildPaseMedicoHtml(previewObj, doc), () => Docs.downloadPaseMedicoPDF(previewObj, doc));
  }

  function renderPases() {
    const q = ($('pasesSearchInput').value || '').trim().toLowerCase();
    const list = (DB.state.cache.pases || []).filter((p) => {
      if (!q) return true;
      const hay = `${p.folio || ''} ${p.nombre_trabajador || ''} ${p.pacientes ? p.pacientes.nombre_completo : ''} ${p.unidad_se_refiere || ''} ${p.impresion_diagnostica || ''}`.toLowerCase();
      return hay.includes(q);
    });

    const box = $('pasesListContainer');
    if (list.length === 0) {
      box.innerHTML = '<div class="empty-state">No hay pases médicos registrados.</div>';
      return;
    }

    box.innerHTML = list.slice(0, 50).map((p) => `
      <div class="record-card">
        <div class="record-top">
          <div>
            <div class="record-name">${Docs.esc(p.folio || 'S/F')} — ${Docs.esc((p.pacientes && p.pacientes.nombre_completo) || p.nombre_trabajador || 'Paciente')}</div>
            <div class="record-meta" style="margin-top:3px;">
              <span>🏥 ${Docs.esc(p.unidad_se_refiere || 'Clínica Externa')}</span>
              <span>📅 Salida: ${Docs.esc(p.fecha_salida || (p.creado_el ? p.creado_el.slice(0, 10) : ''))}${p.fecha_retorno ? ` · Retorno: ${Docs.esc(p.fecha_retorno)}` : ''}</span>
              ${p.departamento_pasajero ? `<span>🏢 ${Docs.esc(p.departamento_pasajero)}</span>` : ''}
              ${p.requiere_hotel ? `<span class="badge badge-purple">🏨 ${Docs.esc(p.hotel_nombre || 'Hotel')}</span>` : ''}
            </div>
          </div>
          <div class="btn-row">
            ${p.urgencia === 'SI' ? '<span class="badge badge-baja">URGENCIA</span>' : ''}
            ${p.requiere_hotel ? `<button type="button" class="btn btn-purple btn-sm" onclick="MedicoApp.openHotelFromPase('${Docs.esc(p.id_pase)}')">🏨 Hotel</button>` : ''}
            <button type="button" class="btn btn-primary btn-sm" onclick="MedicoApp.openPaseFromHistory('${Docs.esc(p.id_pase)}')">📄 PDF</button>
          </div>
        </div>
        ${p.impresion_diagnostica ? `<div style="font-size:12.5px;color:var(--text-secondary);"><b>Dx:</b> ${Docs.esc(p.impresion_diagnostica)}</div>` : ''}
      </div>`).join('');
  }

  function openHotelFromPase(idPase) {
    const p = (DB.state.cache.pases || []).find((x) => String(x.id_pase) === String(idPase));
    if (!p) return;
    const doc = getActiveDoctor();
    const hotelData = {
      pase_medico: ((p.pacientes && p.pacientes.nombre_completo) || p.nombre_trabajador || 'Paciente').toUpperCase(),
      acompanante: (p.acompanante || 'NO REQUIERE').toUpperCase(),
      hotel_nombre: (p.hotel_nombre || 'HOTEL DEL CENTRO').toUpperCase(),
      fecha_salida: p.fecha_salida || (p.creado_el ? p.creado_el.slice(0, 10) : new Date().toISOString().split('T')[0]),
      empresa: 'GRUPO MINERO BACIS S.A. DE C.V.',
      unidad: 'UNIDAD "EL HERRERO"',
      emitido_el: p.creado_el || new Date().toISOString(),
      medico: doc.nombre_completo,
    };
    openDocPreview(`Pase de Hotel — ${hotelData.pase_medico}`, Docs.buildPaseHotelHtml(hotelData), () => Docs.downloadPaseHotelPDF(hotelData));
  }

  function openPaseFromHistory(idPase) {
    const p = (DB.state.cache.pases || []).find((x) => String(x.id_pase) === String(idPase));
    if (!p) return;
    const doc = getActiveDoctor();
    openDocPreview(`Pase Médico ${p.folio || ''}`, Docs.buildPaseMedicoHtml(p, doc), () => Docs.downloadPaseMedicoPDF(p, doc));
  }

  /* ==========================================================================
     VISTA 5: PASES DE HOTEL (HOJA DIVIDIDA ORIGINAL + COPIA)
     ========================================================================== */
  function populateHotelPatients(preselectId) {
    const q = ($('hotelPacFilter').value || '').trim().toLowerCase();
    const sel = $('hotelPacSelect');
    const pacs = (DB.state.cache.pacientes || []).filter((p) =>
      !q || String(p.nombre_completo || '').toLowerCase().includes(q)
    );
    sel.innerHTML = '<option value="">— Seleccionar del Padrón —</option>' + pacs.slice(0, 250).map((p) =>
      `<option value="${Docs.esc(p.id_paciente)}">${Docs.esc(p.nombre_completo)} (${Docs.esc(p.parentesco || 'General')})</option>`
    ).join('');
    if (preselectId) {
      sel.value = preselectId;
      onHotelPatientChange();
    }
  }

  function onHotelPatientChange() {
    const pacId = $('hotelPacSelect').value;
    const pac = (DB.state.cache.pacientes || []).find((p) => String(p.id_paciente) === String(pacId));
    const bajaBanner = $('hotelBajaAlert');
    let baja = false;
    if (pac) {
      let fullName = pac.nombre_completo || '';
      let acomp = pac.acompanante || 'NO REQUIERE';
      const emp = pac.id_empleado ? (DB.state.cache.empleados || []).find((e) => String(e.id_empleado) === String(pac.id_empleado)) : null;
      if (emp) {
        if (DB.isTitularPatient(pac)) fullName = getEmpFullName(emp);
        if (isEmpBaja(emp)) baja = true;
        if (!pac.acompanante && !DB.isTitularPatient(pac)) acomp = getEmpFullName(emp);
      }
      $('hotelPacienteNombre').value = fullName.toUpperCase();
      $('hotelAcompanante').value = acomp.toUpperCase();
    }
    bajaBanner.classList.toggle('hidden', !baja);
    $('btnHotelEmit').disabled = baja;
  }

  function getHotelFormData() {
    return {
      pase_medico: $('hotelPacienteNombre').value.trim().toUpperCase(),
      acompanante: $('hotelAcompanante').value.trim().toUpperCase() || 'NO REQUIERE',
      hotel_nombre: $('hotelNombre').value.trim().toUpperCase() || 'HOTEL DEL CENTRO',
      fecha_salida: $('hotelFechaSalida').value || new Date().toISOString().split('T')[0],
      empresa: $('hotelEmpresa').value.trim().toUpperCase(),
      unidad: $('hotelUnidad').value.trim().toUpperCase(),
      emitido_el: new Date().toISOString(),
      medico: getActiveDoctor().nombre_completo,
    };
  }

  function previewHotelPass() {
    const data = getHotelFormData();
    if (!data.pase_medico) return alert('Captura el nombre del paciente.');
    openDocPreview('Pase de Hotel (Hoja Dividida)', Docs.buildPaseHotelHtml(data), () => Docs.downloadPaseHotelPDF(data));
  }

  function emitPaseHotel(e) {
    e.preventDefault();
    const data = getHotelFormData();
    DB.addHotelHistoryEntry(data);
    renderHotelHistory();
    Docs.downloadPaseHotelPDF(data);
    showToast('🏨 Pase de hotel generado en PDF (Original y Copia).');
  }

  function renderHotelHistory() {
    const list = DB.state.hotelHistory || [];
    const box = $('hotelHistoryList');
    if (list.length === 0) {
      box.innerHTML = '<div class="empty-state">Aún no se han emitido pases de hotel en este equipo.</div>';
      return;
    }
    box.innerHTML = list.slice(0, 30).map((h, idx) => `
      <div class="record-card">
        <div class="record-top">
          <div>
            <div class="record-name">${Docs.esc(h.pase_medico)}</div>
            <div class="record-meta">
              <span>🏨 ${Docs.esc(h.hotel_nombre)}</span>
              <span>📅 Salida: ${Docs.esc(h.fecha_salida)}</span>
              <span>Acompañante: ${Docs.esc(h.acompanante)}</span>
            </div>
          </div>
          <button type="button" class="btn btn-purple btn-sm" onclick="MedicoApp.reprintHotel(${idx})">📄 PDF</button>
        </div>
      </div>`).join('');
  }

  function reprintHotel(idx) {
    const h = DB.state.hotelHistory[idx];
    if (h) openDocPreview('Pase de Hotel', Docs.buildPaseHotelHtml(h), () => Docs.downloadPaseHotelPDF(h));
  }

  /* ==========================================================================
     VISTA 6: FARMACIA Y CLÍNICAS
     ========================================================================== */
  function setFarmTab(tab) {
    currentFarmTab = tab;
    document.querySelectorAll('[data-farmtab]').forEach((b) => b.classList.toggle('active', b.getAttribute('data-farmtab') === tab));
    $('farmPanelMeds').classList.toggle('hidden', tab !== 'meds');
    $('farmPanelClinicas').classList.toggle('hidden', tab !== 'clinicas');
    renderFarmacia();
  }

  function renderFarmacia() {
    const q = ($('medSearchInput').value || '').trim().toLowerCase();
    const meds = (DB.state.cache.medicamentos || []).filter((m) =>
      !q || `${m.nombre || ''} ${m.sustancia_activa || ''} ${m.presentacion || ''}`.toLowerCase().includes(q)
    );
    $('medsListContainer').innerHTML = meds.length === 0
      ? '<div class="empty-state span-full">Sin medicamentos encontrados.</div>'
      : meds.slice(0, 80).map((m) => `
        <div class="record-card">
          <div class="record-top">
            <div>
              <div class="record-name">${Docs.esc(m.nombre)}</div>
              <div class="record-meta"><span>${Docs.esc(m.sustancia_activa || '—')}</span><span>${Docs.esc(m.presentacion || '')}</span></div>
            </div>
            <span class="badge badge-teal">$${Number(m.precio_venta || 0).toFixed(2)}</span>
          </div>
        </div>`).join('');

    const clinicas = DB.state.cache.clinicas || [];
    $('clinicasListContainer').innerHTML = clinicas.length === 0
      ? '<div class="empty-state span-full">Sin clínicas registradas.</div>'
      : clinicas.map((c) => `
        <div class="record-card">
          <div class="record-top">
            <div>
              <div class="record-name">${Docs.esc(c.nombre)}</div>
              <div class="record-meta"><span>📍 ${Docs.esc(c.ubicacion || 'Sin ubicación')}</span></div>
            </div>
            <span class="badge ${c.tipo === 'Interna' ? 'badge-info' : 'badge-purple'}">${Docs.esc(c.tipo || 'Clínica')}</span>
          </div>
        </div>`).join('');
  }

  async function saveMedicamento(e) {
    e.preventDefault();
    const med = {
      nombre: $('medNombre').value.trim(),
      sustancia_activa: $('medSustancia').value.trim(),
      presentacion: $('medPres').value.trim(),
      precio_venta: parseFloat($('medPrecio').value || '0') || 0,
      descripcion: '',
    };
    const res = await DB.submitOrQueue('CREATE_MEDICAMENTO', `Nuevo medicamento: ${med.nombre}`, { medicamento: med }, () => {
      DB.state.cache.medicamentos.unshift(Object.assign({ id_medicamento: 'local_med_' + Date.now() }, med));
    });
    if (res.synced) await DB.downloadAllData(true);
    $('medNombre').value = '';
    $('medSustancia').value = '';
    $('medPres').value = '';
    renderFarmacia();
    showToast('Medicamento guardado.');
  }

  async function saveClinica(e) {
    e.preventDefault();
    const cli = {
      nombre: $('cliNombre').value.trim().toUpperCase(),
      tipo: $('cliTipo').value,
      ubicacion: $('cliUbicacion').value.trim().toUpperCase(),
      activo: true,
    };
    const res = await DB.submitOrQueue('CREATE_CLINICA', `Nueva clínica: ${cli.nombre}`, { clinica: cli }, () => {
      DB.state.cache.clinicas.unshift(Object.assign({ id_clinica: 'local_cli_' + Date.now() }, cli));
    });
    if (res.synced) await DB.downloadAllData(true);
    $('cliNombre').value = '';
    $('cliUbicacion').value = '';
    renderFarmacia();
    showToast('Clínica registrada.');
  }

  /* ==========================================================================
     VISTA 7: PERFIL MÉDICO, EQUIPO (DR. JEFE + DOCTORES), FIRMA Y COFEPRIS
     ========================================================================== */
  function renderPerfilView() {
    reloadDoctorProfiles();
    const isJefe = currentUserIsDrJefe();
    $('drJefeTeamControls').classList.toggle('hidden', !isJefe);
    $('cofeprisConfigCard').classList.toggle('hidden', !isJefe);
    $('docIsPrincipalToggleWrap').classList.toggle('hidden', !isJefe);

    $('profileDocSelect').innerHTML = doctorProfiles.map((d) =>
      `<option value="${Docs.esc(d.id)}">${Docs.esc(d.nombre_completo)} ${d.es_dr_principal ? '⭐ (Dr. Jefe)' : '(Doctor)'}</option>`
    ).join('');
    $('profileDocSelect').value = activeDoctorId;

    $('docCategoria').innerHTML = Docs.COFEPRIS_EMISORES_AUTORIZADOS.map((c) =>
      `<option value="${c.id}">${Docs.esc(c.label)}</option>`
    ).join('');

    const clinicas = DB.state.cache.clinicas || [];
    $('docClinicaAsignada').innerHTML = '<option value="">— Sin clínica específica —</option>' + clinicas.map((c) =>
      `<option value="${Docs.esc(c.id_clinica)}">${Docs.esc(c.nombre)}</option>`
    ).join('');

    loadSelectedDoctorIntoForm();
    renderCofeprisConfigPanel();
    $('secAutoLock').value = String(DB.state.security.autoLockMinutes ?? 10);
  }

  function loadSelectedDoctorIntoForm() {
    const doc = getActiveDoctor();
    $('docNombre').value = doc.nombre_completo || '';
    $('docCategoria').value = doc.categoria_emisor || 'I';
    $('docCedula').value = doc.cedula_profesional || '';
    $('docInstitucion').value = doc.institucion_titulo || '';
    $('docEspecialidad').value = doc.especialidad || '';
    $('docTelefono').value = doc.telefono_consultorio || '';
    $('docDomicilio').value = doc.domicilio_consultorio || '';
    $('docTituloConsultorio').value = doc.titulo_consultorio || '';
    $('docClinicaAsignada').value = doc.id_clinica || '';
    $('docEsPrincipal').checked = Boolean(doc.es_dr_principal);

    $('profileRoleBadgeBox').textContent = doc.es_dr_principal
      ? '⭐ DR. JEFE / MÉDICO PRINCIPAL (Administra equipo y formato COFEPRIS)'
      : '🩺 DOCTOR COLABORADOR (Captura su perfil COFEPRIS y firma individual)';

    sigDraftDataUrl = doc.firma_base64 || '';
    updateSavedSigPreview(sigDraftDataUrl);
    clearSigPad(true);

    const canDelete = currentUserIsDrJefe() && doctorProfiles.length > 1 && (!DB.state.session || doc.id !== DB.state.session.user_id);
    $('btnDeleteDoctor').classList.toggle('hidden', !canDelete);
  }

  function selectDoctorProfile(docId) {
    activeDoctorId = docId;
    Docs.setActiveDoctorId(docId);
    loadSelectedDoctorIntoForm();
    updateDrawerUserInfo();
  }

  function createNewDoctor() {
    const nuevo = {
      id: 'doc-' + Date.now(),
      nombre_completo: 'Dr(a). Nuevo Médico del Equipo',
      categoria_emisor: 'I',
      cedula_profesional: '',
      institucion_titulo: '',
      especialidad: 'Medicina General',
      domicilio_consultorio: getActiveDoctor().domicilio_consultorio || 'Consultorio Médico de Atención Primaria',
      telefono_consultorio: getActiveDoctor().telefono_consultorio || '',
      titulo_consultorio: '',
      firma_base64: '',
      es_dr_principal: false,
      id_clinica: '',
    };
    doctorProfiles = Docs.saveDoctorProfile(nuevo);
    activeDoctorId = nuevo.id;
    Docs.setActiveDoctorId(nuevo.id);
    renderPerfilView();
    showToast('Nuevo perfil de doctor creado. Captura sus datos y su firma.');
  }

  function deleteSelectedDoctor() {
    const doc = getActiveDoctor();
    if (!confirm(`¿Eliminar el perfil local de "${doc.nombre_completo}"?`)) return;
    doctorProfiles = Docs.deleteDoctorProfile(doc.id);
    activeDoctorId = doctorProfiles[0] ? doctorProfiles[0].id : '';
    Docs.setActiveDoctorId(activeDoctorId);
    renderPerfilView();
    showToast('Perfil de doctor eliminado.');
  }

  async function saveDoctorProfileForm(e) {
    e.preventDefault();
    const current = getActiveDoctor();
    const updated = {
      id: current.id,
      nombre_completo: $('docNombre').value.trim(),
      categoria_emisor: $('docCategoria').value,
      cedula_profesional: $('docCedula').value.trim(),
      institucion_titulo: $('docInstitucion').value.trim(),
      especialidad: $('docEspecialidad').value.trim(),
      domicilio_consultorio: $('docDomicilio').value.trim(),
      telefono_consultorio: $('docTelefono').value.trim(),
      titulo_consultorio: $('docTituloConsultorio').value.trim(),
      id_clinica: $('docClinicaAsignada').value || '',
      firma_base64: sigDraftDataUrl || current.firma_base64 || '',
      es_dr_principal: currentUserIsDrJefe() ? $('docEsPrincipal').checked : Boolean(current.es_dr_principal),
    };

    doctorProfiles = Docs.saveDoctorProfile(updated);
    Docs.setActiveDoctorId(updated.id);
    updateDrawerUserInfo();

    // Si corresponde al usuario autenticado en Supabase, sincronizar con tabla `perfiles`
    const sess = DB.state.session;
    if (sess && sess.user_id && updated.id === sess.user_id) {
      await DB.submitOrQueue(
        'UPDATE_DOCTOR_PROFILE',
        `Actualizar perfil médico: ${updated.nombre_completo}`,
        {
          userId: sess.user_id,
          patch: {
            cedula_profesional: updated.cedula_profesional || null,
            institucion_titulo: updated.institucion_titulo || null,
            especialidad: updated.especialidad || null,
            firma: updated.firma_base64 || null,
            id_clinica: updated.id_clinica || null,
          },
        }
      );
    }

    renderPerfilView();
    showToast('✅ Perfil médico y firma digital guardados.');
  }

  // Pad de Firma Táctil (Mouse + Touch + Stylus)
  function initSignaturePadEvents() {
    const canvas = $('signatureCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const pt = e.touches && e.touches[0] ? e.touches[0] : e;
      return {
        x: (pt.clientX - rect.left) * (canvas.width / (rect.width || 1)),
        y: (pt.clientY - rect.top) * (canvas.height / (rect.height || 1)),
      };
    };

    const start = (e) => {
      e.preventDefault();
      sigDrawing = true;
      const p = getPos(e);
      ctx.strokeStyle = sigInkColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
    };

    const move = (e) => {
      if (!sigDrawing) return;
      e.preventDefault();
      const p = getPos(e);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    };

    const end = () => {
      if (!sigDrawing) return;
      sigDrawing = false;
      sigDraftDataUrl = canvas.toDataURL('image/png');
      updateSavedSigPreview(sigDraftDataUrl);
    };

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
  }

  function setSigInk(color) {
    sigInkColor = color;
    showToast(color === '#1d4ed8' ? 'Tinta azul seleccionada.' : 'Tinta negra seleccionada.');
  }

  function clearSigPad(keepSaved) {
    const canvas = $('signatureCanvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    if (!keepSaved) {
      sigDraftDataUrl = '';
      updateSavedSigPreview('');
    }
  }

  function uploadSigImage(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        sigDraftDataUrl = reader.result;
        updateSavedSigPreview(sigDraftDataUrl);
        showToast('Imagen de firma cargada. Presiona "Guardar Perfil Médico y Firma".');
      }
    };
    reader.readAsDataURL(file);
  }

  function updateSavedSigPreview(url) {
    const box = $('savedSigPreviewBox');
    const img = $('savedSigPreviewImg');
    if (url) {
      img.src = url;
      box.classList.remove('hidden');
    } else {
      box.classList.add('hidden');
    }
  }

  // Configurador de Receta COFEPRIS del Dr. Jefe
  function renderCofeprisConfigPanel() {
    cofeprisConfig = Docs.loadCofeprisConfig();
    $('cfgTituloAbierto').value = cofeprisConfig.titulo_consultorio_abierto || '';
    $('cfgSubtitulo').value = cofeprisConfig.subtitulo_receta || '';

    $('cofeprisTogglesContainer').innerHTML = Docs.COFEPRIS_FIELD_CATALOG.map((item) => `
      <label class="toggle-item">
        <span>${Docs.esc(item.label)}</span>
        <input type="checkbox" ${cofeprisConfig[item.key] ? 'checked' : ''} onchange="MedicoApp.toggleCofeprisField('${item.key}', this.checked)" />
      </label>`).join('');
  }

  function toggleCofeprisField(key, checked) {
    cofeprisConfig[key] = checked;
    cofeprisConfig = Docs.saveCofeprisConfig(cofeprisConfig);
  }

  function saveCofeprisTexts() {
    cofeprisConfig.titulo_consultorio_abierto = $('cfgTituloAbierto').value.trim();
    cofeprisConfig.subtitulo_receta = $('cfgSubtitulo').value.trim();
    cofeprisConfig = Docs.saveCofeprisConfig(cofeprisConfig);
    showToast('Encabezado de receta COFEPRIS actualizado.');
  }

  function applyCofeprisPreset(preset) {
    cofeprisConfig = Docs.saveCofeprisConfig(Docs.applyPreset(cofeprisConfig, preset));
    renderCofeprisConfigPanel();
    showToast(`Plantilla aplicada: ${preset}`);
  }

  function previewSampleReceta() {
    const sample = {
      cfg: Docs.loadCofeprisConfig(),
      doctor: getActiveDoctor(),
      folio: 'REC-MUESTRA',
      fechaTexto: new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      paciente: {
        nombre_completo: 'PACIENTE DE PRUEBA CLÍNICA',
        edad: '35 años',
        sexo: 'Masculino',
        alergias: 'Negadas',
        talla: '1.74 m',
        peso: '76',
        imc: '25.1',
        temperatura: '36.5',
        presion_arterial: '120/80',
        diagnostico: 'Faringoamigdalitis aguda no complicada',
      },
      medicamentos: [
        {
          nombre_generico: 'PARACETAMOL',
          forma_farmaceutica: 'Tableta',
          dosis: '500 mg (1 tableta)',
          presentacion: 'Caja con 20 tabletas',
          frecuencia: 'Cada 8 horas',
          via_administracion: 'Oral (VO)',
          duracion_tratamiento: 'Por 5 días',
          indicaciones_uso: 'Tomar después de los alimentos.',
          cantidad: 1,
        },
      ],
    };
    openDocPreview('Vista Previa Plantilla COFEPRIS', Docs.buildRecetaHtml(sample), () => Docs.downloadRecetaPDF(sample));
  }

  async function saveNewPin() {
    try {
      await DB.setUserPin($('secNewPin').value);
      $('secNewPin').value = '';
      showToast('🔐 PIN Clínico guardado. Ya puedes desbloquear sin internet.');
    } catch (err) {
      alert(err.message);
    }
  }

  function updateAutoLock(mins) {
    DB.updateSecuritySettings({ autoLockMinutes: parseInt(mins, 10) || 0 });
    showToast('Tiempo de bloqueo automático actualizado.');
  }

  /* ==========================================================================
     VISTA 8: PANTALLA DE CONEXIÓN A BASE DE DATOS Y SINCRONIZACIÓN
     ========================================================================== */
  function renderConexionView() {
    const st = DB.state.dbStatus;
    const cache = DB.state.cache;
    const queue = DB.state.queue;

    const hero = $('dbHeroCard');
    hero.className = 'db-hero ' + (st.state === 'online' ? 'online' : st.state === 'syncing' ? 'syncing' : st.state === 'error' ? 'error' : 'offline');

    if (st.state === 'syncing') {
      $('dbHeroTitle').textContent = '🔄 Sincronizando con la Computadora / BD...';
      $('dbHeroDetail').textContent = 'Subiendo registros clínicos guardados offline a Supabase.';
    } else if (st.dbReachable) {
      $('dbHeroTitle').textContent = '🟢 CONECTADO A LA BASE DE DATOS';
      $('dbHeroDetail').textContent = `Enlace activo con ${DB.SUPABASE_URL} · Respuesta en ${st.latencyMs || 0} ms.`;
    } else if (st.state === 'error') {
      $('dbHeroTitle').textContent = '🔴 ERROR DE RESPUESTA EN BASE DE DATOS';
      $('dbHeroDetail').textContent = st.lastError || 'Verifica sesión o permisos de red.';
    } else {
      $('dbHeroTitle').textContent = '🟡 SIN CONEXIÓN A BASE DE DATOS (MODO OFFLINE)';
      $('dbHeroDetail').textContent = st.lastError || 'Trabajando con base de datos local. Todo se sincronizará automáticamente al conectar.';
    }

    $('connDeviceNet').textContent = st.onlineDevice ? '🟢 Con Internet' : '🟡 Sin Red';
    $('connLastCheck').textContent = st.lastCheckAt ? 'Verificado: ' + new Date(st.lastCheckAt).toLocaleTimeString('es-MX') : 'Sin verificar';
    $('connLatency').textContent = st.latencyMs != null ? `${st.latencyMs} ms` : '—';
    $('connHttpCode').textContent = st.httpStatus ? `HTTP ${st.httpStatus}` : 'Sin enlace';
    $('connCachedCount').textContent = String((cache.empleados || []).length + (cache.pacientes || []).length);
    $('connLastDownload').textContent = cache.lastDownloadAt ? 'Descarga: ' + new Date(cache.lastDownloadAt).toLocaleTimeString('es-MX') : 'Sin descarga aún';
    $('connQueueCount').textContent = String(queue.length);
    $('connLastSync').textContent = st.lastSyncAt ? 'Último sync: ' + new Date(st.lastSyncAt).toLocaleTimeString('es-MX') : 'Sin envíos recientes';

    $('btnSyncAllNow').disabled = queue.length === 0 || DB.state.isSyncing;

    // Lista de cola pendiente
    const qBox = $('syncQueueContainer');
    if (queue.length === 0) {
      qBox.innerHTML = '<div class="empty-state">✅ Todo sincronizado. No hay cambios pendientes por subir a la computadora central.</div>';
    } else {
      qBox.innerHTML = queue.map((item) => `
        <div class="record-card">
          <div class="record-top">
            <div>
              <div class="record-name">${Docs.esc(item.summary)}</div>
              <div class="record-meta">
                <span>Tipo: ${Docs.esc(item.type)}</span>
                <span>Capturado: ${new Date(item.createdAt).toLocaleString('es-MX')}</span>
              </div>
              ${item.error ? `<div style="font-size:12px;color:var(--danger);font-weight:700;margin-top:4px;">Error: ${Docs.esc(item.error)}</div>` : ''}
            </div>
            <div class="btn-row">
              <span class="badge ${item.status === 'ERROR' ? 'badge-baja' : 'badge-warn'}">${Docs.esc(item.status)}</span>
              <button type="button" class="btn btn-outline btn-sm" onclick="MedicoApp.discardQueueItem('${Docs.esc(item.id)}')">Descartar</button>
            </div>
          </div>
        </div>`).join('');
    }

    $('offlineCacheSummary').innerHTML = `
      <span><b>👷 Trabajadores:</b> ${(cache.empleados || []).length}</span>
      <span><b>👥 Pacientes y Beneficiarios:</b> ${(cache.pacientes || []).length}</span>
      <span><b>📋 Consultas:</b> ${(cache.consultas || []).length}</span>
      <span><b>🏥 Pases Médicos:</b> ${(cache.pases || []).length}</span>
      <span><b>💊 Medicamentos:</b> ${(cache.medicamentos || []).length}</span>
      <span><b>🏢 Clínicas:</b> ${(cache.clinicas || []).length}</span>
      <span><b>👨‍⚕️ Perfiles Médicos:</b> ${doctorProfiles.length}</span>
    `;

    const logs = DB.state.logs || [];
    $('syncConsoleBox').innerHTML = logs.length === 0
      ? '> Listo para registrar eventos de conexión y sincronización.'
      : logs.map((l) => {
          const color = l.level === 'ERR' ? '#f87171' : l.level === 'WARN' ? '#fbbf24' : l.level === 'OK' ? '#34d399' : '#93c5fd';
          return `<div style="color:${color}">[${Docs.esc(l.time)}] [${l.level}] ${Docs.esc(l.message)}</div>`;
        }).join('');
  }

  async function runManualDbCheck() {
    showToast('Probando enlace con base de datos...');
    const st = await DB.testDatabaseConnection();
    renderConexionView();
    showToast(st.dbReachable ? `🟢 Conectado a la BD (${st.latencyMs} ms)` : '🟡 Sin respuesta de la base de datos.');
  }

  async function runDownloadPadron() {
    showToast('Descargando padrón actualizado...');
    const ok = await DB.downloadAllData(false);
    reloadDoctorProfiles();
    renderConexionView();
    showToast(ok ? '✅ Padrón actualizado en este dispositivo.' : '⚠️ No se pudo descargar (sin conexión).');
  }

  async function runSyncNow() {
    showToast('Sincronizando cambios pendientes...');
    const res = await DB.syncAllPending();
    renderConexionView();
    if (res.synced > 0 && res.failed === 0) {
      showToast(`✅ ${res.synced} registro(s) sincronizados con la BD central.`);
    } else if (res.failed > 0) {
      showToast(`⚠️ ${res.synced} subidos, ${res.failed} pendientes/con error.`);
    } else {
      showToast('Sin cambios pendientes por sincronizar.');
    }
  }

  function discardQueueItem(id) {
    if (!confirm('¿Descartar este registro de la cola offline? No se subirá a la BD.')) return;
    DB.removeQueueItem(id);
    renderConexionView();
  }

  /* ==========================================================================
     VISTA PREVIA DE DOCUMENTOS & ESCÁNER QR DE CREDENCIALES
     ========================================================================== */
  function openDocPreview(title, html, downloadFn) {
    $('docPreviewTitle').textContent = title;
    previewDownloadCallback = downloadFn;
    const iframe = $('docPreviewIframe');
    iframe.srcdoc = html;
    $('btnDocDownloadPdf').onclick = () => {
      if (typeof previewDownloadCallback === 'function') previewDownloadCallback();
    };
    $('modalDocPreview').classList.remove('hidden');
  }

  function printPreviewDoc() {
    const iframe = $('docPreviewIframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }
  }

  async function openQrScanner() {
    $('qrScannerModal').classList.remove('hidden');
    try {
      qrStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const v = $('qrVideo');
      v.srcObject = qrStream;
      await v.play();
      qrActive = true;
      const scanCanvas = document.createElement('canvas');
      const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
      const tick = () => {
        if (!qrActive) return;
        if (v.readyState >= 2 && global.jsQR && v.videoWidth > 0) {
          scanCanvas.width = 480;
          scanCanvas.height = 480;
          scanCtx.drawImage(v, 0, 0, 480, 480);
          const img = scanCtx.getImageData(0, 0, 480, 480);
          const code = global.jsQR(img.data, 480, 480, { inversionAttempts: 'attemptBoth' });
          if (code && code.data) {
            closeQrScanner();
            handleScannedQr(code.data);
            return;
          }
        }
        qrRaf = requestAnimationFrame(tick);
      };
      qrRaf = requestAnimationFrame(tick);
    } catch (_) {
      closeQrScanner();
      alert('No se pudo abrir la cámara. Verifica permisos de cámara del navegador o APK.');
    }
  }

  function closeQrScanner() {
    qrActive = false;
    if (qrRaf) cancelAnimationFrame(qrRaf);
    if (qrStream) qrStream.getTracks().forEach((t) => t.stop());
    qrStream = null;
    $('qrScannerModal').classList.add('hidden');
  }

  function handleScannedQr(rawText) {
    const clean = String(rawText || '').trim();
    const emps = DB.state.cache.empleados || [];
    const match = emps.find((e) => {
      const num = String(e.numero_empleado || '').trim();
      const curp = String(e.curp || '').trim();
      return (num && clean.includes(num)) || (curp && clean.toUpperCase().includes(curp.toUpperCase())) || clean === String(e.id_empleado);
    });
    if (match) {
      navigate('pacientes');
      openWorkerDetail(match.id_empleado);
      showToast(`🪪 Credencial identificada: ${getEmpFullName(match)}`);
    } else {
      navigate('pacientes');
      $('pacSearchInput').value = clean;
      renderPacientes();
      showToast(`QR leído: ${clean}`);
    }
  }

  global.MedicoApp = {
    setAuthMode,
    handleEmailLogin,
    pinPress,
    pinClear,
    pinSubmit,
    lockScreen,
    confirmLogout,
    toggleDrawer,
    navigate,
    toggleTheme,
    closeModals,
    setPacTab,
    renderPacientes,
    openWorkerDetail,
    toggleWorkerStatus,
    openModalWorker,
    saveWorkerForm,
    openModalPatient,
    onPatTipoChange,
    savePatientForm,
    populateConsultaPatients,
    toggleConsultaForm,
    onConsultaPatientChange,
    recalcImc,
    addConsultaMedRow,
    removeConsultaMedRow,
    updateConsultaMedField,
    previewDraftReceta,
    saveConsulta,
    renderConsultas,
    openRecetaFromHistory,
    populatePasePatients,
    togglePaseForm,
    onPasePatientChange,
    onPaseClinicaDestinoChange,
    onPaseHotelToggle,
    savePaseMedico,
    renderPases,
    openPaseFromHistory,
    openHotelFromPase,
    populateHotelPatients,
    onHotelPatientChange,
    previewHotelPass,
    emitPaseHotel,
    reprintHotel,
    setFarmTab,
    renderFarmacia,
    saveMedicamento,
    saveClinica,
    selectDoctorProfile,
    createNewDoctor,
    deleteSelectedDoctor,
    saveDoctorProfileForm,
    setSigInk,
    clearSigPad,
    uploadSigImage,
    toggleCofeprisField,
    saveCofeprisTexts,
    applyCofeprisPreset,
    previewSampleReceta,
    saveNewPin,
    updateAutoLock,
    runManualDbCheck,
    runDownloadPadron,
    runSyncNow,
    discardQueueItem,
    printPreviewDoc,
    openQrScanner,
    closeQrScanner,
  };

  document.addEventListener('DOMContentLoaded', init);
})(window);
