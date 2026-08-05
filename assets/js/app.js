import { APP_CONFIG } from './config.js';
import { DEMO_LOAD_SCHOOL } from './demo-load.js';
import { ApiClient, ApiError, getDeviceId } from './api.js';
import { LocalDatabase } from './db.js';
import { blobToBase64, captureLocation, prepareImage } from './image.js';
import { SchoolMap } from './map.js';
import {
  balancePendingAssignments,
  buildWorkloads,
  changedAssignmentItems,
  filterLogisticsSchools,
  googleRouteUrl,
  logisticsCsv,
  logisticsMetrics,
  primaryAssignmentMap,
  schoolStatus
} from './operations.js';
import { contingencyForecast, minutesLabel } from './performance.js';
import { enhanceContextHelp, initializeContextHelp } from './help.js';
import {
  buildRueCompatibilityRows,
  canonicalAppSchoolCode,
  findSchoolByCode,
  normalizeRueSchoolCode,
  rueCompatibilityCsv,
  rueCompatibilitySummary,
  rueSectionForSpace,
  rueSpaceKey
} from './rue.js';

const app = document.querySelector('#app');
const toastRegion = document.querySelector('#toast-region');
const api = new ApiClient();
const database = new LocalDatabase();
const operationsViews = new Set(['admin', 'surveyors', 'logistics', 'requests']);
const savedPlanningSettings = loadJson('cialpa-fotos-planning-settings-v1') || {};
const INCIDENT_REPORT_TEMPLATE = [
  'Codigo operativo / cedula (sin PIN):',
  'Codigo RUE (7 digitos):',
  'Sitio fisico CIALPA:',
  'Registro B/P/E/H:',
  'Fecha y hora:',
  'Accion realizada:',
  'Mensaje exacto:',
  'Conexion y cola pendiente:'
].join('\n');

const state = {
  catalog: [],
  catalogMeta: null,
  health: null,
  session: loadJson(APP_CONFIG.sessionStorageKey),
  bootstrap: null,
  view: 'schools',
  map: null,
  selectedSchoolCode: '',
  filters: { search: '', department: '', status: '' },
  location: null,
  activeDraft: null,
  drafts: [],
  queue: [],
  remote: { records: [], photos: [], schools: [] },
  remoteStatus: { source: 'initial', stale: false, error: null, updatedAt: '' },
  gallery: { schoolCode: '', recordKey: '', content: {} },
  admin: null,
  adminLoading: false,
  adminFilters: {
    surveyorSearch: '', surveyorRole: '', surveyorStatus: '',
    logisticsSearch: '', logisticsDepartment: '', logisticsDistrict: '',
    logisticsStatus: '', logisticsSurveyor: '', requestStatus: 'PENDIENTE'
  },
  editingUserCode: '',
  logisticsOriginal: {},
  logisticsDraft: {},
  logisticsInitialized: false,
  logisticsSaving: false,
  rueExporting: false,
  planningSettings: {
    baseMinutes: Number(savedPlanningSettings.baseMinutes || 45),
    hoursPerDay: Number(savedPlanningSettings.hoursPerDay || 6),
    targetDays: Number(savedPlanningSettings.targetDays || 10)
  },
  syncing: false,
  installPrompt: null,
  updateChecking: false,
  serviceWorkerRegistration: null,
  online: navigator.onLine
};

api.setSession(state.session);
initializeContextHelp();

function loadJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

function saveJson(key, value) {
  if (value == null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function icon(name, size = 18) {
  return `<i data-lucide="${name}" width="${size}" height="${size}" aria-hidden="true"></i>`;
}

function refreshIcons() {
  window.lucide?.createIcons({ attrs: { 'stroke-width': 1.9 } });
}

function toast(message, tone = 'info', timeout = 4500) {
  const element = document.createElement('div');
  element.className = `toast toast-${tone}`;
  element.innerHTML = `${icon(tone === 'error' ? 'circle-alert' : tone === 'success' ? 'circle-check' : tone === 'warning' ? 'triangle-alert' : 'info')}<span>${escapeHtml(message)}</span>`;
  toastRegion.append(element);
  refreshIcons();
  setTimeout(() => element.remove(), timeout);
}

function versionControl(compact = false) {
  return `<div class="version-control ${compact ? 'is-compact' : ''}" aria-label="Version de la aplicacion">
    <span class="version-badge">${compact ? 'v' : 'Version '}${APP_CONFIG.version}</span>
    <button type="button" class="btn btn-secondary update-app-button" data-action="check-app-update" aria-label="Actualizar aplicacion" ${state.updateChecking ? 'disabled' : ''}>${icon('refresh-cw')} <span>${state.updateChecking ? 'Buscando...' : 'Actualizar'}</span></button>
  </div>`;
}

function setUpdateChecking(checking) {
  state.updateChecking = checking;
  document.querySelectorAll('[data-action="check-app-update"]').forEach((button) => {
    button.disabled = checking;
    button.innerHTML = `${icon('refresh-cw')} <span>${checking ? 'Buscando...' : 'Actualizar'}</span>`;
  });
  refreshIcons();
}

async function fetchPublishedVersion() {
  const separator = APP_CONFIG.versionManifestUrl.includes('?') ? '&' : '?';
  const response = await fetch(`${APP_CONFIG.versionManifestUrl}${separator}t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo consultar la version publicada.');
  return response.json();
}

async function checkAppUpdate({ manual = false } = {}) {
  if (state.updateChecking) return;
  if (!navigator.onLine) {
    if (manual) toast('No hay conexion para buscar actualizaciones.', 'warning');
    return;
  }
  setUpdateChecking(true);
  try {
    const published = await fetchPublishedVersion();
    if (state.serviceWorkerRegistration) await state.serviceWorkerRegistration.update();
    if (String(published.version || '') === APP_CONFIG.version) {
      if (manual) toast(`Ya esta usando la version ${APP_CONFIG.version}.`, 'success');
      return;
    }
    toast(`Se encontro la version ${published.version}. La actualizacion se instalara automaticamente.`, 'info', 7000);
  } catch (error) {
    if (manual) toast(error.message || 'No se pudo buscar una actualizacion.', 'error');
  } finally {
    setUpdateChecking(false);
  }
}

function showAppliedUpdateNotice() {
  const url = new URL(location.href);
  const updatedVersion = url.searchParams.get('app_updated');
  if (!updatedVersion) return;
  url.searchParams.delete('app_updated');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  toast(`Aplicacion actualizada correctamente a la version ${updatedVersion}.`, 'success', 30000);
}

async function initializeAppUpdates() {
  if (!('serviceWorker' in navigator) || APP_CONFIG.demo) return;
  state.serviceWorkerRegistration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
  await checkAppUpdate();
}

function setSession(session) {
  state.session = session;
  api.setSession(session);
  saveJson(APP_CONFIG.sessionStorageKey, session);
}

async function boot() {
  try {
    await database.open();
    const healthRequest = navigator.onLine
      ? api.health().catch((error) => ({ ok: false, error }))
      : Promise.resolve({ ok: false, offline: true });
    const [catalogResponse, health] = await Promise.all([
      fetch(APP_CONFIG.schoolCatalogUrl, { cache: 'no-cache' }).then((response) => {
        if (!response.ok) throw new Error('No se pudo cargar el catalogo de escuelas.');
        return response.json();
      }),
      healthRequest
    ]);
    state.catalogMeta = catalogResponse;
    state.catalog = [...(catalogResponse.schools || []), ...(APP_CONFIG.loadTest ? [DEMO_LOAD_SCHOOL] : [])];
    state.health = health;
    await refreshLocalState();
    if (state.session && new Date(state.session.expiresAt || 0) > new Date()) {
      await loadBootstrap(true);
      await loadRemoteRecords(true);
    } else if (state.session) {
      setSession(null);
    }
    render();
    showAppliedUpdateNotice();
    if (state.session && navigator.onLine) syncQueue({ quiet: true });
  } catch (error) {
    app.innerHTML = renderFatal(error);
    refreshIcons();
  }
}

async function refreshLocalState() {
  [state.drafts, state.queue] = await Promise.all([
    database.listDrafts(),
    database.listQueue()
  ]);
}

async function loadBootstrap(allowCache = false) {
  const cached = loadJson('cialpa-fotos-bootstrap-cache-v1');
  if (allowCache && !navigator.onLine && cached) {
    state.bootstrap = normalizeBootstrapSchoolCodes(cached);
    toast('Sin conexion: se muestran las asignaciones guardadas en este celular.', 'info');
    return;
  }
  try {
    state.bootstrap = normalizeBootstrapSchoolCodes(await api.bootstrap());
    saveJson('cialpa-fotos-bootstrap-cache-v1', state.bootstrap);
  } catch (error) {
    if (['AUTH_REQUIRED', 'SESSION_EXPIRED', 'AUTH_INVALID'].includes(error.code)) {
      setSession(null);
      state.bootstrap = null;
      toast('La sesion vencio. Ingrese nuevamente.', 'error');
      return;
    }
    if (allowCache && cached) {
      state.bootstrap = normalizeBootstrapSchoolCodes(cached);
      toast('No se pudieron actualizar las asignaciones. Se muestra la copia guardada en este celular.', 'warning', 7000);
      return;
    }
    throw error;
  }
}

async function loadRemoteRecords(allowCache = false) {
  const user = state.bootstrap?.user || state.session?.user;
  if (!user) return { source: 'none', stale: false, error: null, updatedAt: '' };
  const cached = loadJson(APP_CONFIG.recordsCacheKey);
  const cachedForUser = cached?.codigoCensista === user.codigoCensista ? cached : null;
  if (allowCache && !navigator.onLine) {
    state.remote = cachedForUser?.data || { records: [], photos: [], schools: [] };
    state.remote = normalizeRemoteSchoolCodes(state.remote);
    state.remoteStatus = {
      source: cachedForUser ? 'cache' : 'empty',
      stale: true,
      error: { code: 'OFFLINE', message: cachedForUser
        ? 'Sin conexion: se muestran los datos guardados en este dispositivo.'
        : 'Sin conexion y sin una copia local: no se pudieron verificar los registros del servidor.' },
      updatedAt: String(cachedForUser?.updatedAt || '')
    };
    return state.remoteStatus;
  }
  try {
    state.remote = normalizeRemoteSchoolCodes(await api.listRecords());
    state.remoteStatus = { source: 'remote', stale: false, error: null, updatedAt: new Date().toISOString() };
    saveJson(APP_CONFIG.recordsCacheKey, {
      codigoCensista: user.codigoCensista,
      data: state.remote,
      updatedAt: state.remoteStatus.updatedAt
    });
    return state.remoteStatus;
  } catch (error) {
    if (['AUTH_REQUIRED', 'SESSION_EXPIRED', 'AUTH_INVALID'].includes(error.code)) {
      setSession(null);
      state.bootstrap = null;
      state.remote = { records: [], photos: [], schools: [] };
      state.remoteStatus = {
        source: 'error',
        stale: true,
        error: { code: String(error.code || 'AUTH_REQUIRED'), message: error.message || 'La sesion ya no es valida.' },
        updatedAt: ''
      };
      throw error;
    }
    if (allowCache) {
      state.remote = normalizeRemoteSchoolCodes(cachedForUser?.data || { records: [], photos: [], schools: [] });
      state.remoteStatus = {
        source: cachedForUser ? 'cache' : 'empty',
        stale: true,
        error: {
          code: String(error.code || 'SERVER_ERROR'),
          message: cachedForUser
            ? `No se pudo actualizar desde el servidor: ${error.message || 'error desconocido'}. Se muestra la copia local.`
            : `No se pudieron verificar los registros del servidor: ${error.message || 'error desconocido'}.`
        },
        updatedAt: String(cachedForUser?.updatedAt || '')
      };
      return state.remoteStatus;
    }
    state.remoteStatus = {
      source: 'error',
      stale: true,
      error: { code: String(error.code || 'SERVER_ERROR'), message: error.message || 'No se pudo consultar el servidor.' },
      updatedAt: String(cachedForUser?.updatedAt || '')
    };
    throw error;
  }
}

function renderRemoteStatusNotice() {
  const status = state.remoteStatus || {};
  if (!status.error) return '';
  const lastUpdate = status.updatedAt ? ` Ultima lectura correcta: ${formatDateTime(status.updatedAt)}.` : '';
  return `<div class="alert ${status.source === 'cache' ? 'alert-warning' : 'alert-error'} remote-status-alert" role="alert">
    ${icon(status.source === 'cache' ? 'database-backup' : 'cloud-alert')}
    <span><strong>Datos remotos no verificados.</strong> ${escapeHtml(status.error.message)}${escapeHtml(lastUpdate)} Codigo: ${escapeHtml(status.error.code || 'ERROR')}.</span>
  </div>`;
}

function render() {
  if (!state.session) {
    state.map?.destroy();
    state.map = null;
    app.className = '';
    app.innerHTML = renderAccess();
  } else {
    app.className = 'app-shell';
    app.innerHTML = renderShell();
    mountView();
  }
  enhanceContextHelp(app);
  refreshIcons();
}

function renderFatal(error) {
  return `<main class="fatal-screen">
    <img src="./assets/img/logo.png" alt="CIALPA" width="124">
    <div class="empty-state">
      ${icon('triangle-alert', 32)}
      <h1>No se pudo iniciar la aplicacion</h1>
      <p>${escapeHtml(error.message || 'Error desconocido.')}</p>
      <button class="btn btn-primary" data-action="reload">${icon('refresh-cw')} Reintentar</button>
    </div>
  </main>`;
}

function renderAccess() {
  const backendProblem = state.health?.ok === false;
  return `<main class="access-layout">
    <section class="access-brand" aria-label="CIALPA Registro de fotos">
      <img src="./assets/img/logo.png" alt="CIALPA" class="access-logo">
      <div>
        <p class="eyebrow">Relevamiento de infraestructura escolar</p>
        <h1>Registro de fotos</h1>
        <p>Fotos vinculadas a cada escuela, bloque, piso, espacio y hoja de relevamiento.</p>
      </div>
      <div class="access-status">
        ${icon('school')} ${state.catalog.length || 0} escuelas piloto
        <span>${icon('shield-check')} Datos protegidos</span>
      </div>
    </section>
    <section class="access-panel">
      <div class="access-card">
        <div class="section-heading compact">
          <div>
            <p class="eyebrow">Acceso de campo</p>
            <h2>Ingresar</h2>
          </div>
          <span class="status-dot ${state.online ? 'online' : 'offline'}">${state.online ? 'En linea' : 'Sin conexion'}</span>
        </div>
        ${backendProblem ? `<div class="alert alert-warning">${icon('cloud-alert')}<span>No se pudo verificar el servicio de sincronizacion. Revise la conexion antes de trabajar.</span><button type="button" class="btn btn-secondary" data-action="reload">${icon('refresh-cw')} Reintentar</button></div>` : ''}
        ${APP_CONFIG.demo ? `<div class="alert alert-info">${icon('flask-conical')} Prueba local: codigo <strong>1234567</strong>, PIN <strong>1234</strong>.</div>` : ''}
        <form data-form="login" class="form-stack">
          <label>Usuario, codigo operativo o cedula
            <input name="codigoCensista" autocomplete="username" required minlength="5" maxlength="12" pattern="admin|[Aa][Dd][Mm][Ii][Nn]|[0-9]{5,12}" placeholder="admin, codigo operativo o cedula">
          </label>
          <label>Contrasena / PIN
            <div class="input-with-action">
              <input name="pin" type="password" inputmode="numeric" autocomplete="current-password" required minlength="4" maxlength="12">
              <button type="button" class="icon-btn" data-action="toggle-pin" title="Mostrar u ocultar PIN">${icon('eye')}</button>
            </div>
          </label>
          <button class="btn btn-primary btn-block" type="submit">${icon('log-in')} Ingresar</button>
        </form>
        <details class="access-details">
          <summary>Solicitar acceso</summary>
          <form data-form="request-access" class="form-grid two-cols">
            <label>Codigo operativo / cedula<input name="codigoCensista" inputmode="numeric" required maxlength="12"></label>
          <label>Telefono<input name="telefono" inputmode="tel" maxlength="30"></label>
          <label>Nombres<input name="nombres" required maxlength="80"></label>
          <label>Apellidos<input name="apellidos" required maxlength="80"></label>
          <label class="full-row">PIN que usara para ingresar<input name="pin" type="password" inputmode="numeric" minlength="4" maxlength="12" required></label>
            <button class="btn btn-secondary full-row" type="submit">${icon('send')} Enviar solicitud</button>
          </form>
        </details>
        ${state.health?.bootstrapRequired ? `<details class="access-details">
          <summary>Crear primer administrador</summary>
          <form data-form="bootstrap-admin" class="form-grid two-cols">
            <label>Clave inicial<input name="bootstrapKey" type="password" required></label>
            <label>Codigo operativo / cedula<input name="codigoCensista" inputmode="numeric" required></label>
            <label>Nombres<input name="nombres" required></label>
            <label>Apellidos<input name="apellidos" required></label>
            <label>PIN nuevo<input name="pin" type="password" inputmode="numeric" minlength="4" maxlength="12" required></label>
            <button class="btn btn-secondary full-row" type="submit">${icon('shield-plus')} Crear administrador</button>
          </form>
        </details>` : ''}
        ${versionControl()}
        <p class="version-line">Publicada el ${APP_CONFIG.buildDate}</p>
      </div>
    </section>
  </main>`;
}

function renderShell() {
  const user = state.bootstrap?.user || state.session?.user || {};
  const canAdmin = ['ADMIN', 'SUPERVISOR'].includes(user.rol);
  const navItems = [
    ['schools', 'map', 'Escuelas'],
    ['register', 'camera', 'Registrar'],
    ['pending', 'clipboard-list', 'Mi jornada'],
    ['photos', 'images', 'Fotos'],
    ...(canAdmin ? [
      ['admin', 'layout-dashboard', 'Control'],
      ['surveyors', 'users', 'Encuestadores'],
      ['logistics', 'route', 'Logistica'],
      ['requests', 'inbox', 'Solicitudes']
    ] : []),
    ['guide', 'book-open-check', 'Guia de campo'],
    ['account', 'circle-user-round', 'Cuenta']
  ];
  const mobileNavItems = [
    ['schools', 'map', 'Escuelas'],
    ['register', 'camera', 'Registrar'],
    ['pending', 'clipboard-list', 'Jornada'],
    ...(canAdmin ? [['admin', 'layout-dashboard', 'Control']] : []),
    ['account', 'circle-user-round', 'Cuenta']
  ];
  return `<header class="topbar">
      <button class="brand-button" data-view="schools" aria-label="Ir a escuelas">
        <img src="./assets/img/logo.png" alt="" width="72">
        <span><strong>CIALPA Fotos</strong><small>Registro de campo</small></span>
      </button>
      <div class="topbar-actions">
        ${versionControl(true)}
        <span class="network-chip ${state.online ? 'is-online' : 'is-offline'}">${icon(state.online ? 'wifi' : 'wifi-off', 15)} ${state.online ? 'En linea' : 'Sin conexion'}</span>
        <button class="icon-btn sync-button ${state.queue.length ? 'has-badge' : ''}" data-action="sync" title="Sincronizar pendientes" aria-label="Sincronizar pendientes">
          ${icon('refresh-cw')}<span class="button-badge">${state.queue.length}</span>
        </button>
        <button class="icon-btn" data-view="photos" title="Ver fotografias" aria-label="Ver fotografias">${icon('images')}</button>
        <button class="icon-btn" data-view="guide" title="Guia de campo" aria-label="Abrir guia de campo">${icon('circle-help')}</button>
        ${state.installPrompt ? `<button class="btn btn-quiet desktop-only" data-action="install">${icon('download')} Instalar</button>` : ''}
      </div>
    </header>
    <aside class="side-nav">
      <div class="side-user">
        <span class="avatar">${escapeHtml(initials(user))}</span>
        <div><strong>${escapeHtml(displayName(user))}</strong><small>${escapeHtml(roleLabel(user.rol))}</small></div>
      </div>
      <nav aria-label="Navegacion principal">
        ${navItems.map(([view, iconName, label]) => navButton(view, iconName, label)).join('')}
      </nav>
      <div class="side-footer">Version ${APP_CONFIG.version}</div>
    </aside>
    <main class="main-content" id="main-content">
      ${APP_CONFIG.loadTest ? `<div class="load-test-banner">${icon('flask-conical')} <strong>Simulacion de carga:</strong> escuela ficticia 9999001, 75 registros y 300 fotos. No utiliza el libro productivo.</div>` : ''}
      ${renderSyncQueueNotice()}
      ${renderCurrentView()}
    </main>
    <nav class="bottom-nav" aria-label="Navegacion movil">
      ${mobileNavItems.map(([view, iconName, label]) => navButton(
        view, iconName, label, true, view === 'admin' && operationsViews.has(state.view)
      )).join('')}
    </nav>`;
}

function renderSyncQueueNotice() {
  if (!state.queue.length) return '';
  const failed = state.queue.filter((item) => item.lastError).length;
  const detail = failed
    ? `${failed} operacion${failed === 1 ? '' : 'es'} ${failed === 1 ? 'tuvo' : 'tuvieron'} un error. Abra Mi jornada para revisar el mensaje.`
    : state.online
      ? 'Pulse Sincronizar ahora y espere a que la cola llegue a cero antes de cerrar o borrar datos del navegador.'
      : 'Se enviaran al recuperar la conexion. No cierre sesion ni borre los datos del navegador.';
  return `<div class="alert ${failed ? 'alert-error' : 'alert-warning'} sync-queue-notice" role="status">
    ${icon(failed ? 'cloud-alert' : 'cloud-upload')}
    <span><strong>Este dispositivo conserva ${state.queue.length} operacion${state.queue.length === 1 ? '' : 'es'} que aun no llegaron al servidor.</strong> ${detail}</span>
    <button class="btn btn-secondary" data-action="sync" ${!state.online || state.syncing ? 'disabled' : ''}>${icon('refresh-cw')} ${state.syncing ? 'Sincronizando...' : 'Sincronizar ahora'}</button>
  </div>`;
}

function navButton(view, iconName, label, mobile = false, activeOverride = false) {
  const active = state.view === view || activeOverride;
  const badge = view === 'pending' ? state.queue.length
    : view === 'requests' ? Number(state.admin?.counts?.solicitudesPendientes || 0) : 0;
  return `<button data-view="${view}" class="nav-button ${active ? 'is-active' : ''}" ${active ? 'aria-current="page"' : ''}>
    ${icon(iconName, mobile ? 20 : 18)}<span>${label}</span>
    ${badge ? `<b>${badge}</b>` : ''}
  </button>`;
}

function renderCurrentView() {
  if (state.view === 'register') return renderRegister();
  if (state.view === 'pending') return renderPending();
  if (state.view === 'photos') return renderGallery();
  if (state.view === 'admin') return renderAdmin();
  if (state.view === 'surveyors') return renderSurveyors();
  if (state.view === 'logistics') return renderLogistics();
  if (state.view === 'requests') return renderRequests();
  if (state.view === 'guide') return renderGuide();
  if (state.view === 'account') return renderAccount();
  return renderSchools();
}

function availableSchools() {
  if (!state.bootstrap) return [];
  if (state.bootstrap.showAllSchools) return state.catalog;
  const assigned = new Set((state.bootstrap.assignedCodes || []).map(canonicalSchoolCode));
  return state.catalog.filter((school) => assigned.has(school.codigo));
}

function remoteSchoolByCode(code) {
  return findSchoolByCode(state.remote?.schools || [], code) || schoolByCode(code);
}

function gallerySchools(records = state.remote?.records || []) {
  const recordCodes = new Set(records.map((record) => canonicalSchoolCode(record.codigoEscuela)).filter(Boolean));
  const schools = new Map();
  availableSchools().forEach((school) => schools.set(canonicalSchoolCode(school.codigo), school));
  (state.remote?.schools || []).forEach((school) => {
    const code = canonicalSchoolCode(school.codigo || school.codigoRue);
    if (code) schools.set(code, { ...(schools.get(code) || {}), ...school, codigo: code });
  });
  records.forEach((record) => {
    const code = canonicalSchoolCode(record.codigoEscuela);
    if (!code || schools.has(code)) return;
    schools.set(code, {
      codigo: code,
      codigoRue: record.codigoRue || normalizeRueSchoolCode(code),
      sitioId: record.sitioId || '',
      nombre: `Escuela no catalogada ${code}`,
      departamento: '', distrito: '', zona: '', localidad: ''
    });
  });
  return [...schools.values()].filter((school) => recordCodes.has(canonicalSchoolCode(school.codigo)))
    .sort((left, right) => String(left.nombre || '').localeCompare(String(right.nombre || ''), 'es'));
}

function filteredSchools() {
  const search = state.filters.search.trim().toLocaleLowerCase('es');
  const progress = state.bootstrap?.progress || {};
  let schools = availableSchools().filter((school) => {
    const haystack = `${school.codigo} ${school.codigoRue || ''} ${school.sitioId || ''} ${(school.codigosRueSitio || []).join(' ')} ${school.nombre} ${school.distrito} ${school.localidad}`.toLocaleLowerCase('es');
    const status = progress[school.codigo]?.estado || 'PENDIENTE';
    return (!search || haystack.includes(search))
      && (!state.filters.department || school.departamento === state.filters.department)
      && (!state.filters.status || status === state.filters.status);
  });
  if (state.location) {
    schools = schools
      .map((school) => ({ ...school, distanceKm: distanceKm(state.location, school) }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }
  return schools;
}

function renderSchools() {
  const schools = filteredSchools();
  const selected = schoolByCode(state.selectedSchoolCode);
  const departments = [...new Set(availableSchools().map((school) => school.departamento))].sort();
  return `<section class="view view-schools">
    <div class="view-heading">
      <div><p class="eyebrow">Trabajo de campo</p><h1>Escuelas asignadas</h1><p>${schools.length} visibles de ${availableSchools().length}</p></div>
      <button class="btn btn-secondary" data-action="locate">${icon('locate-fixed')} Mi ubicacion</button>
    </div>
    <div class="filter-bar">
      <label class="search-field">${icon('search')}<input data-filter="search" value="${escapeHtml(state.filters.search)}" placeholder="Codigo RUE o interno, escuela, distrito..."></label>
      <select data-filter="department" aria-label="Departamento">
        <option value="">Todos los departamentos</option>
        ${departments.map((department) => `<option ${state.filters.department === department ? 'selected' : ''}>${escapeHtml(department)}</option>`).join('')}
      </select>
      <select data-filter="status" aria-label="Estado">
        <option value="">Todos los estados</option>
        ${['PENDIENTE', 'EN_PROCESO', 'FINALIZADO', 'CON_PENDIENTES'].map((status) => `<option value="${status}" ${state.filters.status === status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}
      </select>
    </div>
    <div class="schools-workspace">
      <div id="school-map" class="school-map" aria-label="Mapa de escuelas asignadas"></div>
      <aside class="school-list" aria-label="Lista de escuelas">
        ${selected ? renderSelectedSchool(selected) : ''}
        <div class="school-list-scroll">
          ${schools.length ? schools.map(renderSchoolRow).join('') : renderEmpty('school', 'No hay escuelas con estos filtros.', 'Cambie los filtros o solicite una asignacion al administrador.')}
        </div>
      </aside>
    </div>
  </section>`;
}

function renderSelectedSchool(school) {
  const progress = state.bootstrap?.progress?.[school.codigo] || {};
  const rueCode = school.codigoRue || normalizeRueSchoolCode(school.codigo);
  return `<article class="selected-school">
    <button class="icon-btn close-selected" data-action="clear-school" title="Cerrar detalle">${icon('x')}</button>
    <span class="status-pill status-${(progress.estado || 'PENDIENTE').toLowerCase()}">${statusLabel(progress.estado || 'PENDIENTE')}</span>
    <h2>${escapeHtml(school.nombre)}</h2>
    <p><strong>RUE ${escapeHtml(rueCode)}</strong> · Interno ${escapeHtml(school.codigo)} · ${escapeHtml(school.sitioId || 'Sitio sin conciliar')} · ${escapeHtml(school.distrito)} · ${escapeHtml(school.localidad)}</p>
    ${school.sedeCompartida ? `<p class="shared-site-note">${icon('building-2', 15)} Sede compartida por ${escapeHtml((school.codigosRueSitio || []).join(' y '))}</p>` : ''}
    <div class="selected-school-stats"><span>${progress.registros || 0} registros</span><span>${progress.fotos || 0} fotos</span></div>
    <div class="button-row">
      <button class="btn btn-primary" data-action="start-record" data-school="${school.codigo}">${icon('camera')} Registrar</button>
      <button class="btn btn-secondary" data-action="show-school-photos" data-school="${school.codigo}">${icon('images')} Ver fotos</button>
      <a class="btn btn-secondary" href="https://www.google.com/maps/dir/?api=1&destination=${school.latitud},${school.longitud}" target="_blank" rel="noopener">${icon('navigation')} Ir</a>
    </div>
  </article>`;
}

function renderSchoolRow(school) {
  const progress = state.bootstrap?.progress?.[school.codigo] || {};
  const active = state.selectedSchoolCode === school.codigo;
  return `<button class="school-row ${active ? 'is-active' : ''}" data-action="select-school" data-school="${school.codigo}">
    <span class="school-status-dot status-${(progress.estado || 'PENDIENTE').toLowerCase()}"></span>
    <span class="school-row-main"><strong>${escapeHtml(school.nombre)}</strong><small>RUE ${escapeHtml(school.codigoRue || normalizeRueSchoolCode(school.codigo))} · Interno ${escapeHtml(school.codigo)} · ${escapeHtml(school.sitioId || '')} · ${escapeHtml(school.distrito)}</small></span>
    ${Number.isFinite(school.distanceKm) ? `<span class="distance">${school.distanceKm < 1 ? `${Math.round(school.distanceKm * 1000)} m` : `${school.distanceKm.toFixed(1)} km`}</span>` : ''}
    ${icon('chevron-right', 16)}
  </button>`;
}

function renderRegister() {
  const schools = availableSchools();
  const draft = state.activeDraft || newDraft(state.selectedSchoolCode || schools[0]?.codigo || '');
  state.activeDraft = draft;
  const school = schoolByCode(draft.codigoEscuela);
  const recordId = calculateRecordId(draft);
  const recordHeading = draft.sourceRecordKey
    ? 'Editar registro'
    : (draft.draftId && state.drafts.some((item) => item.draftId === draft.draftId) ? 'Editar borrador' : 'Nuevo registro');
  return `<section class="view view-register">
    <div class="view-heading">
      <div><p class="eyebrow">Registro progresivo</p><h1>${recordHeading}</h1><p>Identificador: <strong class="record-code">${escapeHtml(recordId || 'Complete los numeros requeridos')}</strong> · Tiempo transcurrido: <strong>${elapsedMinutesLabel(draft.startedAt)}</strong></p></div>
      <button class="btn btn-secondary" data-action="save-draft">${icon('save')} Guardar borrador</button>
    </div>
    <form id="record-form" data-form="record" class="record-layout" novalidate>
      <section class="form-panel">
        <div class="panel-heading"><span class="step-number">1</span><div><h2>Relacion con la ficha</h2><p>Use exactamente los numeros escritos en el papel.</p></div></div>
        <div class="form-grid two-cols">
          <label class="full-row">Escuela
            <select name="codigoEscuela" required>
              ${schools.map((item) => `<option value="${item.codigo}" ${item.codigo === draft.codigoEscuela ? 'selected' : ''}>RUE ${escapeHtml(item.codigoRue || normalizeRueSchoolCode(item.codigo))} · Interno ${escapeHtml(item.codigo)} · ${escapeHtml(item.nombre)}</option>`).join('')}
            </select>
          </label>
          <label>Formulario<input name="numeroFormulario" value="${escapeHtml(draft.numeroFormulario)}" inputmode="numeric" pattern="[0-9]+" required maxlength="4"></label>
          <label>Hoja<input name="numeroHoja" value="${escapeHtml(draft.numeroHoja)}" inputmode="numeric" pattern="[0-9]+" required maxlength="3"></label>
          <label>Bloque<input name="bloque" value="${escapeHtml(draft.bloque)}" inputmode="numeric" pattern="[0-9]+" required maxlength="3"></label>
          <label>Piso<input name="piso" value="${escapeHtml(draft.piso)}" inputmode="numeric" pattern="[0-9]+" required maxlength="2"></label>
          <label>Espacio<input name="espacio" value="${escapeHtml(draft.espacio)}" inputmode="numeric" pattern="[0-9]+" required maxlength="4"></label>
          <label>Tipo de espacio
            <select name="tipoEspacio" required>${spaceOptions(draft.tipoEspacio)}</select>
          </label>
        </div>
        ${school ? `<div class="school-context">${icon('school')}<span><strong>${escapeHtml(school.nombre)}</strong><small>RUE ${escapeHtml(school.codigoRue || normalizeRueSchoolCode(school.codigo))} · Interno ${escapeHtml(school.codigo)} · ${escapeHtml(school.sitioId || '')} · ${escapeHtml(school.distrito)} · ${escapeHtml(school.localidad)}</small></span></div>` : ''}
      </section>
      <section class="form-panel photo-panel">
        <div class="panel-heading"><span class="step-number">2</span><div><h2>Fotografias</h2><p>Cada imagen conservara el identificador del registro.</p></div><span class="count-badge">${draft.photos.length}</span></div>
        <div class="photo-sequence" aria-label="Secuencia fotografica recomendada">
          <span><b>1</b> Contexto</span><i aria-hidden="true">→</i>
          <span><b>2</b> Posicion</span><i aria-hidden="true">→</i>
          <span><b>3</b> Detalle</span><i aria-hidden="true">→</i>
          <span><b>4</b> Hoja</span>
        </div>
        <div class="element-fields">
          <label>Elemento fotografiado
            <select name="tipoElemento" required>${elementOptions(draft.tipoElemento)}</select>
          </label>
          <label>Nro. de elemento<input name="numeroElemento" value="${escapeHtml(draft.numeroElemento)}" inputmode="numeric" pattern="[0-9]+" required maxlength="3"></label>
        </div>
        <div class="photo-id-preview">${icon('tag')}<span>La proxima foto llevara: <strong>${escapeHtml(calculateNextPhotoCode(draft))}</strong></span></div>
        <div class="capture-grid">
          <button type="button" class="capture-button" data-action="capture-photo" data-photo-type="EVIDENCIA">
            ${icon('camera', 26)}<strong>Foto del espacio</strong><small>Ambiente, elemento o dano</small>
          </button>
          <button type="button" class="capture-button paper" data-action="capture-photo" data-photo-type="HOJA_PAPEL">
            ${icon('scan-line', 26)}<strong>Foto de la hoja</strong><small>Completa, plana y legible</small>
          </button>
          <input id="photo-input-evidence" class="visually-hidden" type="file" accept="image/*" capture="environment" data-photo-input="EVIDENCIA">
          <input id="photo-input-paper" class="visually-hidden" type="file" accept="image/*" capture="environment" data-photo-input="HOJA_PAPEL">
        </div>
        <div class="photo-list" id="photo-list">
          ${draft.photos.length ? draft.photos.map(renderPhotoItem).join('') : `<div class="photo-empty">${icon('images')} Aun no hay fotos en este registro.</div>`}
        </div>
      </section>
      <section class="form-panel full-width-panel">
        <div class="panel-heading"><span class="step-number">3</span><div><h2>Revision</h2><p>Registre observaciones y confirme el estado.</p></div></div>
        <div class="form-grid two-cols">
          <label>Estado
            <select name="estado">${['EN_PROCESO', 'FINALIZADO', 'CON_PENDIENTES'].map((status) => `<option value="${status}" ${draft.estado === status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}</select>
          </label>
          <label>Ubicacion de captura
            <button class="btn btn-secondary btn-field" type="button" data-action="capture-location">${icon('crosshair')} ${draft.location ? `GPS ±${draft.location.precisionM} m` : 'Obtener GPS'}</button>
          </label>
          <label>Observaciones<textarea name="observaciones" rows="3" maxlength="1000">${escapeHtml(draft.observaciones)}</textarea></label>
          <label>Danos y fallas<textarea name="danosFallas" rows="3" maxlength="1000">${escapeHtml(draft.danosFallas)}</textarea></label>
        </div>
        ${renderCompletionChecklist(draft)}
      </section>
      <div class="record-actions">
        <div><strong>${draft.photos.length} foto${draft.photos.length === 1 ? '' : 's'}</strong><small>${state.online ? 'Se sincronizara al finalizar' : 'Quedara en cola hasta recuperar conexion'}</small></div>
        <button class="btn btn-primary btn-large" type="submit">${icon(state.online ? 'cloud-upload' : 'archive')} Finalizar y ${state.online ? 'sincronizar' : 'guardar en cola'}</button>
      </div>
    </form>
  </section>`;
}

function newDraft(code = '') {
  const schoolCode = canonicalSchoolCode(code);
  return {
    draftId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    codigoEscuela: schoolCode,
    numeroFormulario: '1',
    numeroHoja: '1',
    bloque: '1',
    piso: '0',
    espacio: '1',
    tipoEspacio: 'AULA',
    tipoElemento: 'AMBIENTE',
    numeroElemento: '1',
    estado: 'EN_PROCESO',
    observaciones: '',
    danosFallas: '',
    location: null,
    photos: [],
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: '',
    durationSeconds: 0
  };
}

function updateDraftFromForm() {
  const form = document.querySelector('#record-form');
  if (!form || !state.activeDraft) return state.activeDraft;
  const data = new FormData(form);
  for (const key of ['codigoEscuela', 'numeroFormulario', 'numeroHoja', 'bloque', 'piso', 'espacio', 'tipoEspacio', 'tipoElemento', 'numeroElemento', 'estado', 'observaciones', 'danosFallas']) {
    state.activeDraft[key] = String(data.get(key) || '').trim();
  }
  return state.activeDraft;
}

function renderPhotoItem(photo, index) {
  if (photo.synced) {
    return `<article class="photo-item is-synced" data-photo-id="${photo.fotoId}">
      <div class="photo-thumb synced-thumb"><span>${icon(photo.tipoFoto === 'HOJA_PAPEL' ? 'scan-line' : 'image-check')}</span></div>
      <div class="photo-copy"><strong>${escapeHtml(photo.codigoFoto)}</strong><small>${escapeHtml(elementLabel(photo.tipoElemento))} ${escapeHtml(photo.numeroElemento || '')} · ${formatBytes(photo.bytes)}</small><span class="synced-label">${icon('cloud-upload', 14)} Sincronizada</span></div>
    </article>`;
  }
  return `<article class="photo-item" data-photo-id="${photo.fotoId}">
    <div class="photo-thumb"><img data-blob-preview="${photo.blobId}" alt="Vista previa de foto ${index + 1}"><span>${photo.tipoFoto === 'HOJA_PAPEL' ? icon('scan-line') : icon('camera')}</span></div>
    <div class="photo-copy"><strong>${escapeHtml(photo.codigoFoto || (photo.tipoFoto === 'HOJA_PAPEL' ? 'Hoja en papel' : 'Evidencia de campo'))}</strong><small>${escapeHtml(elementLabel(photo.tipoElemento))} ${escapeHtml(photo.numeroElemento || '')} · ${formatBytes(photo.bytes)} · ${photo.width}×${photo.height}</small><input data-photo-note="${photo.fotoId}" value="${escapeHtml(photo.notas || '')}" placeholder="Descripcion breve (opcional)" maxlength="180"></div>
    <button type="button" class="icon-btn danger" data-action="remove-photo" data-photo="${photo.fotoId}" title="Quitar foto">${icon('trash-2')}</button>
  </article>`;
}

function renderPending() {
  const remoteRecords = state.remote?.records || [];
  const schools = availableSchools();
  const progress = state.bootstrap?.progress || {};
  const finalizadas = schools.filter((school) => schoolStatus(progress, school.codigo) === 'FINALIZADO').length;
  const enProceso = schools.filter((school) => ['EN_PROCESO', 'CON_PENDIENTES'].includes(schoolStatus(progress, school.codigo))).length;
  const pendientes = schools.length - finalizadas - enProceso;
  const candidates = schools
    .filter((school) => schoolStatus(progress, school.codigo) !== 'FINALIZADO')
    .map((school) => state.location ? { ...school, distanceKm: distanceKm(state.location, school) } : school)
    .sort((left, right) => state.location
      ? left.distanceKm - right.distanceKm
      : Number(left.ordenMuestra || 0) - Number(right.ordenMuestra || 0));
  const nextSchool = candidates[0] || null;
  return `<section class="view">
    <div class="view-heading"><div><p class="eyebrow">Trabajo de campo</p><h1>Mi jornada</h1><p>${schools.length} escuelas asignadas · ${remoteRecords.length} registros sincronizados · ${state.queue.length} operaciones en cola</p></div><div class="button-row"><button class="btn btn-secondary" data-action="locate-journal">${icon('locate-fixed')} Ordenar por cercania</button><button class="btn btn-secondary" data-action="reload-records">${icon('rotate-cw')} Actualizar</button><button class="btn btn-primary" data-action="sync" ${!state.queue.length || state.syncing ? 'disabled' : ''}>${icon('refresh-cw')} ${state.syncing ? 'Sincronizando...' : 'Sincronizar ahora'}</button></div></div>
    ${renderRemoteStatusNotice()}
    <div class="summary-strip">
      <div><span>Asignadas</span><strong>${schools.length}</strong></div>
      <div><span>Finalizadas</span><strong>${finalizadas}</strong></div>
      <div><span>En proceso</span><strong>${enProceso}</strong></div>
      <div><span>Pendientes</span><strong>${pendientes}</strong></div>
    </div>
    ${renderMyPerformance(state.bootstrap?.performance)}
    <section class="content-section next-school-section">
      <div class="section-heading"><div><h2>Proxima escuela</h2><p>${state.location ? 'Sugerida por cercania a su ubicacion actual.' : 'Sugerida segun el orden de la muestra.'}</p></div></div>
      ${nextSchool ? `<article class="next-school-card"><div class="list-card-icon">${icon('school')}</div><div><span class="status-pill status-${schoolStatus(progress, nextSchool.codigo).toLowerCase()}">${statusLabel(schoolStatus(progress, nextSchool.codigo))}</span><h3>${escapeHtml(nextSchool.nombre)}</h3><p><strong>RUE ${escapeHtml(nextSchool.codigoRue || normalizeRueSchoolCode(nextSchool.codigo))}</strong> · Interno ${escapeHtml(nextSchool.codigo)} · ${escapeHtml(nextSchool.distrito)} · ${escapeHtml(nextSchool.localidad)}${Number.isFinite(nextSchool.distanceKm) ? ` · ${nextSchool.distanceKm < 1 ? `${Math.round(nextSchool.distanceKm * 1000)} m` : `${nextSchool.distanceKm.toFixed(1)} km`}` : ''}</p></div><div class="button-row"><button class="btn btn-primary" data-action="start-record" data-school="${nextSchool.codigo}">${icon('camera')} Registrar</button><button class="btn btn-secondary" data-action="show-school" data-school="${nextSchool.codigo}">${icon('map')} Ver en mapa</button><a class="icon-btn" href="https://www.google.com/maps/dir/?api=1&destination=${nextSchool.latitud},${nextSchool.longitud}" target="_blank" rel="noopener" title="Abrir ruta en Google Maps" aria-label="Abrir ruta en Google Maps">${icon('navigation')}</a></div></article>` : renderEmpty('badge-check', 'Jornada completada.', 'No quedan escuelas pendientes en sus asignaciones.')}
    </section>
    <section class="content-section">
      <div class="section-heading"><div><h2>Borradores locales</h2><p>Registros que todavia pueden modificarse.</p></div></div>
      <div class="draft-list">${state.drafts.length ? state.drafts.map(renderDraftRow).join('') : renderEmpty('file-check-2', 'No hay borradores.', 'Los registros incompletos apareceran aqui.')}</div>
    </section>
    <section class="content-section">
      <div class="section-heading"><div><h2>Cola de sincronizacion</h2><p>Se procesa en orden: primero el registro y luego sus fotos.</p></div></div>
      <div class="queue-list">${state.queue.length ? state.queue.map(renderQueueRow).join('') : renderEmpty('cloud-upload', 'Todo esta sincronizado.', 'No quedan datos pendientes en este celular.')}</div>
    </section>
    <section class="content-section">
      <div class="section-heading"><div><h2>Registros sincronizados</h2><p>Puede reabrir un registro propio para agregar evidencia sin perder su numeracion.</p></div></div>
      <div class="draft-list">${remoteRecords.length ? remoteRecords.map(renderSyncedRecordRow).join('') : state.remoteStatus?.error
        ? renderEmpty('cloud-alert', 'No se pudieron verificar los registros sincronizados.', 'Revise el aviso anterior y pulse Actualizar para volver a consultar el servidor.')
        : renderEmpty('notebook-tabs', 'Aun no hay registros sincronizados.', 'Los registros recibidos por el servidor apareceran aqui.')}</div>
    </section>
  </section>`;
}

function renderDraftRow(draft) {
  const school = schoolByCode(draft.codigoEscuela);
  return `<article class="list-card"><div class="list-card-icon">${icon('file-pen-line')}</div><div><strong>${escapeHtml(calculateRecordId(draft) || 'Registro incompleto')}</strong><span>${escapeHtml(school?.nombre || draft.codigoEscuela)} · ${draft.photos?.length || 0} fotos</span><small>Actualizado ${formatDateTime(draft.updatedAt)}</small></div><div class="list-card-actions"><button class="btn btn-secondary" data-action="open-draft" data-draft="${draft.draftId}">${icon('pencil')} Editar</button><button class="icon-btn danger" data-action="delete-draft" data-draft="${draft.draftId}" title="Eliminar borrador">${icon('trash-2')}</button></div></article>`;
}

function renderQueueRow(item) {
  const label = item.action === 'uploadPhoto' ? 'Fotografia' : 'Registro';
  const id = item.payload?.photo?.recordId || item.payload?.record?.recordId || '';
  return `<article class="list-card ${item.lastError ? 'has-error' : ''}"><div class="list-card-icon">${icon(item.action === 'uploadPhoto' ? 'image-up' : 'file-up')}</div><div><strong>${label} · ${escapeHtml(id)}</strong><span>${item.lastError ? escapeHtml(item.lastError) : 'Esperando sincronizacion'}</span><small>${item.attempts || 0} intentos · ${formatDateTime(item.createdAt)}</small></div></article>`;
}

function renderSyncedRecordRow(record) {
  const school = remoteSchoolByCode(record.codigoEscuela);
  const own = isOwnRecord(record);
  const recordKey = recordKeyOf(record);
  const actions = `<div class="list-card-actions">
    <button class="btn btn-secondary" data-action="show-record-photos" data-record="${escapeHtml(recordKey)}">${icon('images')} Fotos</button>
    ${own && recordKey
      ? `<button class="btn btn-secondary" data-action="edit-record" data-record="${escapeHtml(recordKey)}">${icon('pencil')} Editar</button>`
      : `<span class="protected-label" title="Registro creado por otro integrante del equipo">${icon('eye', 14)} Solo lectura</span>`}
  </div>`;
  return `<article class="list-card"><div class="list-card-icon">${icon('cloud-upload')}</div><div><strong>${escapeHtml(record.recordId)}</strong><span>${escapeHtml(school?.nombre || record.codigoEscuela)} · ${record.cantidadFotos || 0} fotos</span><small>${statusLabel(record.estado)} · ${record.durationSeconds ? minutesLabel(record.durationSeconds / 60) : 'Tiempo no disponible'} · ${formatDateTime(record.updatedAt || record.syncedAt)}</small></div>${actions}</article>`;
}

function renderGallery() {
  const records = state.remote?.records || [];
  const schools = gallerySchools(records);
  const fallbackSchool = state.selectedSchoolCode && schools.some((school) => school.codigo === state.selectedSchoolCode)
    ? state.selectedSchoolCode : schools[0]?.codigo || '';
  if (!schools.some((school) => school.codigo === state.gallery.schoolCode)) state.gallery.schoolCode = fallbackSchool;
  const schoolRecords = records.filter((record) => record.codigoEscuela === state.gallery.schoolCode)
    .sort((left, right) => String(right.updatedAt || right.syncedAt || '').localeCompare(String(left.updatedAt || left.syncedAt || '')));
  if (!schoolRecords.some((record) => recordKeyOf(record) === state.gallery.recordKey)) {
    state.gallery.recordKey = recordKeyOf(schoolRecords[0]) || '';
  }
  const selectedRecord = schoolRecords.find((record) => recordKeyOf(record) === state.gallery.recordKey);
  const photos = (state.remote?.photos || []).filter((photo) => recordKeyOf(photo) === state.gallery.recordKey)
    .sort((left, right) => Number(left.secuencia || 0) - Number(right.secuencia || 0));
  const selectedSchool = schools.find((school) => school.codigo === state.gallery.schoolCode)
    || remoteSchoolByCode(state.gallery.schoolCode);
  return `<section class="view view-gallery">
    <div class="view-heading"><div><p class="eyebrow">Evidencia sincronizada</p><h1>Fotografias por escuela</h1><p>Disponible para administradores, supervisores y encuestadores dentro de su ambito autorizado.</p></div><button class="btn btn-secondary" data-action="reload-gallery">${icon('rotate-cw')} Actualizar</button></div>
    ${renderRemoteStatusNotice()}
    <div class="gallery-filters">
      <label>Escuela<select data-gallery-school>${schools.map((school) => `<option value="${school.codigo}" ${school.codigo === state.gallery.schoolCode ? 'selected' : ''}>RUE ${escapeHtml(school.codigoRue || normalizeRueSchoolCode(school.codigo))} Â· ${escapeHtml(school.nombre)}</option>`).join('')}</select></label>
      <label>Registro<select data-gallery-record ${schoolRecords.length ? '' : 'disabled'}>${schoolRecords.map((record) => `<option value="${escapeHtml(recordKeyOf(record))}" ${recordKeyOf(record) === state.gallery.recordKey ? 'selected' : ''}>${escapeHtml(record.recordId)} Â· ${record.cantidadFotos || 0} fotos</option>`).join('')}</select></label>
    </div>
    ${!schools.length ? state.remoteStatus?.error
      ? renderEmpty('cloud-alert', 'No se pudieron verificar las fotografias sincronizadas.', 'Revise el aviso anterior y pulse Actualizar para volver a consultar el servidor.')
      : renderEmpty('images', 'Aun no hay fotografias sincronizadas.', 'Cuando se sincronicen registros con fotos apareceran aqui.') : `
      <section class="gallery-summary"><div><h2>${escapeHtml(selectedSchool?.nombre || state.gallery.schoolCode)}</h2><p>${selectedRecord ? `${escapeHtml(selectedRecord.recordId)} Â· ${statusLabel(selectedRecord.estado)} Â· censista ${escapeHtml(String(selectedRecord.codigoCensista || ''))}` : 'Seleccione un registro.'}</p></div><strong>${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}</strong></section>
      <div class="gallery-grid">${photos.length ? photos.map(renderGalleryPhoto).join('') : renderEmpty('image-off', 'Este registro no tiene fotos activas.', 'Actualice la vista si la carga acaba de sincronizarse.')}</div>
    `}
  </section>`;
}

function renderGalleryPhoto(photo) {
  const cached = state.gallery.content[photo.fotoId];
  const image = cached?.dataUrl
    ? `<img src="${cached.dataUrl}" alt="${escapeHtml(photo.codigoFoto || 'Fotografia del registro')}" loading="lazy">`
    : `<div class="gallery-placeholder">${icon(cached?.error ? 'image-off' : 'loader-circle', 30)}<span>${cached?.error ? 'No se pudo cargar' : 'Cargando imagen...'}</span></div>`;
  return `<article class="gallery-card" data-gallery-photo="${escapeHtml(photo.fotoId)}">
    <button class="gallery-image" data-action="open-gallery-photo" data-photo="${escapeHtml(photo.fotoId)}" aria-label="Ampliar ${escapeHtml(photo.codigoFoto || 'fotografia')}">${image}</button>
    <div class="gallery-card-copy"><strong>${escapeHtml(photo.codigoFoto || photo.nombreArchivo || 'Fotografia')}</strong><span>${escapeHtml(elementLabel(photo.tipoElemento))}${photo.numeroElemento ? ` ${escapeHtml(photo.numeroElemento)}` : ''} Â· ${photo.tipoFoto === 'HOJA_PAPEL' ? 'Hoja en papel' : 'Evidencia'}</span><small>${formatBytes(photo.bytes)} Â· ${formatDateTime(photo.capturedAt || photo.uploadedAt)}</small>${photo.notas ? `<p>${escapeHtml(photo.notas)}</p>` : ''}${cached?.error ? `<button class="btn btn-quiet" data-action="retry-gallery-photo" data-photo="${escapeHtml(photo.fotoId)}">${icon('rotate-cw')} Reintentar</button>` : ''}</div>
  </article>`;
}

function renderMyPerformance(performance = {}) {
  const individual = performance?.individual;
  const team = performance?.team;
  if (!individual || !team) {
    return `<section class="content-section"><div class="section-heading"><div><h2>Mi desempeño</h2><p>Los tiempos apareceran al sincronizar las primeras fichas instrumentadas.</p></div></div></section>`;
  }
  const forecast = contingencyForecast({
    pendingSchools: team.pendingSchools,
    baseMinutes: state.planningSettings.baseMinutes,
    hoursPerDay: state.planningSettings.hoursPerDay,
    totalMembers: team.totalMembers,
    availableMembers: team.availableMembers
  });
  return `<section class="content-section performance-section">
    <div class="section-heading"><div><h2>Mi desempeño</h2><p>Seguimiento individual y de ${escapeHtml(team.equipo)}. El tiempo mide desde que se abre la ficha hasta su cierre.</p></div><span class="status-pill ${individual.disponibleCampo ? 'status-finalizado' : 'status-con_pendientes'}">${individual.disponibleCampo ? 'Disponible' : 'Ausente'}</span></div>
    <div class="summary-strip">
      <div><span>Mis fichas</span><strong>${individual.records}</strong><small>${individual.completedRecords} finalizadas</small></div>
      <div><span>Promedio por ficha</span><strong>${minutesLabel(individual.averageMinutes)}</strong><small>${individual.timedRecords} con tiempo</small></div>
      <div><span>Mediana</span><strong>${minutesLabel(individual.medianMinutes)}</strong><small>Reduce el efecto de casos extremos</small></div>
      <div><span>Mis fotos</span><strong>${individual.photos}</strong><small>${individual.completionRate}% finalizadas</small></div>
      <div><span>Demora de sincronizacion</span><strong>${minutesLabel(individual.averageSyncDelayMinutes)}</strong><small>Incluye trabajo offline</small></div>
    </div>
    <div class="summary-strip">
      <div><span>${escapeHtml(team.equipo)}</span><strong>${team.availableMembers}/${team.totalMembers}</strong><small>integrantes disponibles</small></div>
      <div><span>Escuelas atendidas</span><strong>${team.touchedSchools}/${team.assignedSchools}</strong><small>${team.pendingSchools} sin iniciar</small></div>
      <div><span>Promedio del equipo</span><strong>${minutesLabel(team.averageMinutes)}</strong><small>${team.records} fichas</small></div>
      <div><span>Capacidad actual</span><strong>${Math.round(forecast.capacityFactor * 100)}%</strong><small>${forecast.capacityLossPercent}% de reduccion</small></div>
      <div><span>Plazo restante</span><strong>${forecast.blocked ? 'Bloqueado' : `${formatNumber(forecast.estimatedDays, 1)} dias`}</strong><small>${forecast.delayDays ? `+${formatNumber(forecast.delayDays, 1)} dias por ausencias` : 'Sin demora por ausencias'}</small></div>
    </div>
    ${team.availableMembers < team.totalMembers ? `<div class="alert alert-warning">${icon('triangle-alert')}<span><strong>Contingencia activa:</strong> con ${team.availableMembers} de ${team.totalMembers} integrantes, el plazo se recalcula segun la capacidad disponible.</span></div>` : ''}
  </section>`;
}

function operationsAllowed() {
  return ['ADMIN', 'SUPERVISOR'].includes((state.bootstrap?.user || {}).rol);
}

function supervisorMode() {
  return (state.bootstrap?.user || state.session?.user || {}).rol === 'SUPERVISOR';
}

function operationalCatalog() {
  return supervisorMode() ? availableSchools() : state.catalog;
}

function renderOperationsGuard() {
  return `<section class="view">${renderEmpty('shield-alert', 'Acceso restringido.', 'Esta vista requiere rol de supervision o administracion.')}</section>`;
}

function renderOperationsLoading(title) {
  return `<section class="view"><div class="view-heading"><div><p class="eyebrow">Control operativo</p><h1>${escapeHtml(title)}</h1></div></div>${renderAdminTabs(state.view)}<div class="loading-panel"><div class="spinner"></div><p>Cargando datos operativos...</p></div></section>`;
}

function renderAdminTabs(activeView) {
  const tabs = [
    ['admin', 'layout-dashboard', 'Resumen'],
    ['surveyors', 'users', 'Encuestadores'],
    ['logistics', 'route', 'Logistica'],
    ['requests', 'inbox', 'Solicitudes']
  ];
  const pending = Number(state.admin?.counts?.solicitudesPendientes || 0);
  return `<nav class="operations-tabs" aria-label="Modulos de control">${tabs.map(([view, iconName, label]) => `<button class="operations-tab ${activeView === view ? 'is-active' : ''}" data-view="${view}" ${activeView === view ? 'aria-current="page"' : ''}>${icon(iconName, 17)}<span>${label}</span>${view === 'requests' && pending ? `<b>${pending}</b>` : ''}</button>`).join('')}</nav>`;
}

function renderDataQuality(dataQuality = {}) {
  const status = dataQuality.status === 'OK' ? 'OK' : 'REVISAR';
  const samples = dataQuality.samples || {};
  const orphanSamples = (samples.orphanPhotos || []).map((item) => escapeHtml(item.fotoId || item.recordKey || 'Foto sin identificador')).join(', ');
  const mismatchSamples = (samples.countMismatches || []).map((item) => `${escapeHtml(item.recordId || item.recordKey || 'Registro')}: ${Number(item.declaredPhotos || 0)} declaradas / ${Number(item.linkedPhotos || 0)} vinculadas`).join('; ');
  return `<section class="content-section data-quality-panel">
    <div class="section-heading"><div><h2>Integridad registro–foto</h2><p>Conciliacion automatica por clave de registro. Solo las fotos vinculadas se contabilizan como evidencia operativa.</p></div><span class="status-pill ${status === 'OK' ? 'status-finalizado' : 'status-con_pendientes'}">${status}</span></div>
    <div class="summary-strip compatibility-summary">
      <div><span>Registros</span><strong>${Number(dataQuality.recordsTotal || 0)}</strong></div>
      <div><span>Fotos vinculadas</span><strong>${Number(dataQuality.photosLinked || 0)}</strong><small>Con registro existente</small></div>
      <div><span>Fotos sin registro</span><strong>${Number(dataQuality.photosOrphaned || 0)}</strong><small>Requieren conciliacion</small></div>
      <div><span>Conteos diferentes</span><strong>${Number(dataQuality.countMismatches || 0)}</strong><small>Declaradas vs. vinculadas</small></div>
    </div>
    <div class="alert ${status === 'OK' ? 'alert-info' : 'alert-warning'}">${icon(status === 'OK' ? 'badge-check' : 'triangle-alert')}<span>${status === 'OK'
      ? 'No se detectaron fotos huerfanas ni diferencias entre los conteos declarados y las evidencias vinculadas.'
      : `Se detectaron incidencias: ${Number(dataQuality.recordsWithoutKey || 0)} registros sin clave, ${Number(dataQuality.recordsOutsideCatalog || 0)} registros fuera del catalogo, ${Number(dataQuality.photosOutsideCatalog || 0)} fotos fuera del catalogo y ${Number(dataQuality.photosOrphaned || 0)} fotos sin registro.${orphanSamples ? ` Muestra de fotos: ${orphanSamples}.` : ''}${mismatchSamples ? ` Diferencias: ${mismatchSamples}.` : ''}`}</span></div>
    <div class="alert alert-info">${icon('folder-key')}<span>El acceso a la carpeta de Google Drive depende de sus permisos de Drive y es independiente del acceso a esta aplicacion.</span></div>
  </section>`;
}

function renderAdmin() {
  if (!operationsAllowed()) return renderOperationsGuard();
  if (!state.admin) return renderOperationsLoading('Control');
  const counts = state.admin.counts || {};
  const progress = state.bootstrap?.progress || {};
  const catalog = operationalCatalog();
  const physicalSites = new Set(catalog.map((school) => school.sitioId || school.codigo)).size;
  const sharedSites = [...new Set(catalog.map((school) => school.sitioId || school.codigo))]
    .filter((site) => catalog.filter((school) => (school.sitioId || school.codigo) === site).length > 1).length;
  const completedSchools = catalog.filter((school) => schoolStatus(progress, school.codigo) === 'FINALIZADO').length;
  const teamName = String((state.bootstrap?.user || {}).equipo || '');
  return `<section class="view operations-view">
    <div class="view-heading"><div><p class="eyebrow">Control operativo</p><h1>${supervisorMode() ? `Resumen de ${escapeHtml(teamName || 'mi equipo')}` : 'Resumen general'}</h1><p>${supervisorMode() ? 'Escuelas, encuestadores y avance asignados exclusivamente a su equipo.' : 'Avance consolidado del relevamiento fotografico.'}</p></div><div class="button-row"><button class="btn btn-primary" data-action="export-rue" ${state.rueExporting ? 'disabled' : ''}>${icon('file-down')} ${state.rueExporting ? 'Preparando...' : 'Conciliar con RUE'}</button>${state.admin.photoRootUrl ? `<a class="btn btn-secondary" href="${escapeHtml(state.admin.photoRootUrl)}" target="_blank" rel="noopener">${icon('folder-open')} Abrir carpeta en Drive</a>` : ''}<button class="btn btn-secondary" data-action="reload-admin">${icon('refresh-cw')} Actualizar</button></div></div>
    ${renderAdminTabs('admin')}
    <div class="summary-strip admin-summary">
      <div><span>Escuelas finalizadas</span><strong>${completedSchools}/${catalog.length}</strong></div>
      <div><span>Encuestadores activos</span><strong>${(state.admin.users || []).filter((item) => item.activo && item.rol === 'ENCUESTADOR').length}</strong></div>
      <div><span>Registros</span><strong>${counts.registros || 0}</strong></div>
      <div><span>Fotos vinculadas</span><strong>${counts.fotos || 0}</strong><small>${Number(counts.fotosHuerfanas || 0)} sin registro</small></div>
      <div><span>Solicitudes pendientes</span><strong>${counts.solicitudesPendientes || 0}</strong></div>
    </div>
    ${renderDataQuality(state.admin.dataQuality)}
    <section class="content-section rue-compatibility-panel">
      <div class="section-heading"><div><h2>Compatibilidad RUE</h2><p>Contrato RUE–CIALPA 1.0: conserva la clave interna y agrega el codigo RUE de siete digitos, la sede fisica y la equivalencia de bloque, planta y espacio.</p></div><a class="btn btn-secondary" href="https://demo.mec.gov.py/demo_rue/infraestructuras_fiscalizaciones_v2/index" target="_blank" rel="noopener">${icon('external-link')} Abrir RUE demo</a></div>
      <div class="summary-strip compatibility-summary">
        <div><span>Codigos RUE</span><strong>${catalog.length}</strong><small>Establecimientos visibles</small></div>
        <div><span>Sedes fisicas</span><strong>${physicalSites}</strong><small>Unidad operativa de visita</small></div>
        <div><span>Sedes compartidas</span><strong>${sharedSites}</strong><small>Dos codigos, una construccion</small></div>
        <div><span>Formato de intercambio</span><strong>CSV</strong><small>UTF-8 y trazable por foto</small></div>
      </div>
      <div class="alert alert-info">${icon('info')}<span>El archivo de conciliacion no escribe dentro de RUE: prepara datos y evidencias con claves comunes para revision o importacion por un mecanismo autorizado del MEC.</span></div>
    </section>
    ${renderTeamPerformanceAdmin(state.admin.performance)}
    <section class="content-section"><div class="section-heading"><div><h2>Avance por censista</h2><p>Carga recibida, equipo y escuelas asignadas.</p></div><button class="btn btn-secondary" data-view="surveyors">${icon('users')} ${supervisorMode() ? 'Ver integrantes' : 'Administrar'}</button></div>
      <div class="data-table-wrap"><table><thead><tr><th>Censista</th><th>Equipo</th><th>Disponibilidad</th><th>Fichas</th><th>Finalizadas</th><th>Promedio</th><th>Mediana</th><th>Fotos</th><th>Ultima carga</th></tr></thead><tbody>${(state.admin.performance?.individuals || []).map((item) => `<tr><td><strong>${escapeHtml(displayName(item))}</strong><br><small>${escapeHtml(item.codigoCensista)}</small></td><td>${escapeHtml(item.equipo || 'Sin equipo')}</td><td><span class="status-pill ${item.disponibleCampo ? 'status-finalizado' : 'status-con_pendientes'}">${item.disponibleCampo ? 'Disponible' : 'Ausente'}</span></td><td>${item.records || 0}</td><td>${item.completedRecords || 0}</td><td>${minutesLabel(item.averageMinutes)}</td><td>${minutesLabel(item.medianMinutes)}</td><td>${item.photos || 0}</td><td>${formatDateTime(item.lastActivity)}</td></tr>`).join('') || '<tr><td colspan="9">Aun no hay censistas registrados.</td></tr>'}</tbody></table></div>
    </section>
    <section class="content-section"><div class="section-heading"><div><h2>Registros recientes</h2><p>${supervisorMode() ? 'Ultimas cargas de los integrantes de su equipo.' : 'Ultimas cargas de todos los usuarios.'}</p></div></div>
      <div class="data-table-wrap"><table><thead><tr><th>Registro</th><th>Escuela</th><th>Censista</th><th>Estado</th><th>Fotos</th><th>Actualizacion</th></tr></thead><tbody>${(state.admin.records || []).slice(0, 50).map((record) => `<tr><td><strong>${escapeHtml(record.recordId)}</strong></td><td>${escapeHtml(record.codigoEscuela)}</td><td>${escapeHtml(record.codigoCensista)}</td><td><span class="status-pill status-${String(record.estado || 'PENDIENTE').toLowerCase()}">${statusLabel(record.estado)}</span></td><td>${record.cantidadFotos || 0}</td><td>${formatDateTime(record.updatedAt || record.syncedAt)}</td></tr>`).join('') || '<tr><td colspan="6">Aun no hay registros.</td></tr>'}</tbody></table></div>
    </section>
  </section>`;
}

function renderSurveyors() {
  if (!operationsAllowed()) return renderOperationsGuard();
  if (!state.admin) return renderOperationsLoading('Encuestadores');
  const currentUser = state.bootstrap?.user || {};
  const users = state.admin.users || [];
  const summaries = new Map((state.admin.surveyorSummary || []).map((item) => [String(item.codigoCensista), item]));
  const search = state.adminFilters.surveyorSearch.trim().toLocaleLowerCase('es');
  const filtered = users.filter((item) => {
    const haystack = `${item.codigoCensista} ${item.nombres} ${item.apellidos} ${item.telefono} ${item.equipo}`.toLocaleLowerCase('es');
    return (!search || haystack.includes(search))
      && (!state.adminFilters.surveyorRole || item.rol === state.adminFilters.surveyorRole)
      && (!state.adminFilters.surveyorStatus || (state.adminFilters.surveyorStatus === 'ACTIVO') === Boolean(item.activo));
  });
  const editing = users.find((item) => String(item.codigoCensista) === state.editingUserCode) || null;
  const activeSurveyors = users.filter((item) => item.activo && item.rol === 'ENCUESTADOR').length;
  const teamName = String(currentUser.equipo || '');
  return `<section class="view operations-view">
    <div class="view-heading"><div><p class="eyebrow">Equipo de campo</p><h1>${supervisorMode() ? `Encuestadores de ${escapeHtml(teamName || 'mi equipo')}` : 'Administrar encuestadores'}</h1><p>${supervisorMode() ? 'Lista de integrantes asignados a su equipo.' : `${filtered.length} usuarios visibles de ${users.length}.`}</p></div><div class="button-row">${currentUser.rol === 'ADMIN' ? `<button class="btn btn-primary" data-action="new-user">${icon('user-plus')} Nuevo encuestador</button>` : ''}<button class="btn btn-secondary" data-action="reload-admin">${icon('refresh-cw')} Actualizar</button></div></div>
    ${renderAdminTabs('surveyors')}
    <div class="summary-strip">
      <div><span>Total de usuarios</span><strong>${users.length}</strong></div>
      <div><span>Encuestadores activos</span><strong>${activeSurveyors}</strong></div>
      <div><span>Supervisores activos</span><strong>${users.filter((item) => item.activo && item.rol === 'SUPERVISOR').length}</strong></div>
      <div><span>Inactivos</span><strong>${users.filter((item) => !item.activo).length}</strong></div>
    </div>
    ${currentUser.rol === 'ADMIN' ? renderUserEditor(editing) : ''}
    <section class="content-section"><div class="operations-filters">
      <label class="search-field">${icon('search')}<input data-admin-filter="surveyorSearch" value="${escapeHtml(state.adminFilters.surveyorSearch)}" placeholder="Codigo, nombre, equipo o telefono..."></label>
      <select data-admin-filter="surveyorRole" aria-label="Filtrar por rol"><option value="">Todos los roles</option>${['ENCUESTADOR', 'SUPERVISOR', 'ADMIN'].map((role) => `<option value="${role}" ${state.adminFilters.surveyorRole === role ? 'selected' : ''}>${roleLabel(role)}</option>`).join('')}</select>
      <select data-admin-filter="surveyorStatus" aria-label="Filtrar por estado"><option value="">Todos los estados</option><option value="ACTIVO" ${state.adminFilters.surveyorStatus === 'ACTIVO' ? 'selected' : ''}>Activos</option><option value="INACTIVO" ${state.adminFilters.surveyorStatus === 'INACTIVO' ? 'selected' : ''}>Inactivos</option></select>
    </div>
    <div class="data-table-wrap"><table><thead><tr><th>Usuario</th><th>Equipo</th><th>Disponibilidad</th><th>Rol</th><th>Estado</th><th>Escuelas</th><th>Registros</th><th>Fotos</th><th>Ultimo acceso</th><th>Acciones</th></tr></thead><tbody>${filtered.map((item) => {
      const summary = summaries.get(String(item.codigoCensista)) || {};
      const protectedAdmin = item.codigoCensista === 'admin'
        || (item.rol === 'ADMIN' && item.codigoCensista === currentUser.codigoCensista);
      return `<tr><td><span class="table-user"><span class="avatar small">${escapeHtml(initials(item))}</span><span><strong>${escapeHtml(displayName(item))}</strong><small>${escapeHtml(item.codigoCensista)}${item.telefono ? ` · ${escapeHtml(item.telefono)}` : ''}</small></span></span></td><td>${escapeHtml(item.equipo || 'Sin equipo')}</td><td><span class="status-pill ${item.disponibleCampo !== false ? 'status-finalizado' : 'status-con_pendientes'}">${item.disponibleCampo !== false ? 'Disponible' : 'Ausente'}</span>${item.motivoIndisponibilidad ? `<br><small>${escapeHtml(item.motivoIndisponibilidad)}</small>` : ''}</td><td>${roleLabel(item.rol)}</td><td><span class="status-pill ${item.activo ? 'status-finalizado' : 'status-pendiente'}">${item.activo ? 'Activo' : 'Inactivo'}</span></td><td>${summary.escuelasAsignadas || 0}</td><td>${summary.registros || 0}</td><td>${summary.fotos || 0}</td><td>${formatDateTime(item.ultimoAcceso)}</td><td><div class="table-actions">${item.rol === 'ENCUESTADOR' && item.activo ? `<button class="icon-btn" data-action="toggle-availability" data-user="${escapeHtml(item.codigoCensista)}" data-available="${item.disponibleCampo === false ? 'true' : 'false'}" title="${item.disponibleCampo === false ? 'Marcar disponible' : 'Registrar ausencia'}" aria-label="${item.disponibleCampo === false ? 'Marcar disponible' : 'Registrar ausencia'} de ${escapeHtml(displayName(item))}">${icon(item.disponibleCampo === false ? 'user-check' : 'calendar-off')}</button>` : ''}${currentUser.rol === 'ADMIN' && !protectedAdmin ? `<button class="icon-btn" data-action="edit-user" data-user="${escapeHtml(item.codigoCensista)}" title="Editar usuario" aria-label="Editar ${escapeHtml(displayName(item))}">${icon('pencil')}</button><button class="icon-btn ${item.activo ? 'danger' : ''}" data-action="toggle-user" data-user="${escapeHtml(item.codigoCensista)}" data-active="${item.activo ? 'false' : 'true'}" title="${item.activo ? 'Desactivar' : 'Activar'} usuario" aria-label="${item.activo ? 'Desactivar' : 'Activar'} ${escapeHtml(displayName(item))}">${icon(item.activo ? 'user-x' : 'user-check')}</button>` : protectedAdmin ? `<span class="protected-label">${icon('lock-keyhole', 14)} Protegido</span>` : ''}</div></td></tr>`;
    }).join('') || '<tr><td colspan="10">No hay usuarios con estos filtros.</td></tr>'}</tbody></table></div>
    </section>
  </section>`;
}

function renderUserEditor(editing) {
  const user = editing || { codigoCensista: '', nombres: '', apellidos: '', telefono: '', rol: 'ENCUESTADOR', equipo: '', activo: true };
  return `<section class="content-section user-editor" id="user-editor"><div class="section-heading"><div><h2>${editing ? 'Editar usuario' : 'Nuevo encuestador'}</h2><p>Use el codigo operativo entregado al censista o su cedula, segun la definicion administrativa.</p></div>${editing ? `<button class="icon-btn" data-action="cancel-user-edit" title="Cancelar edicion" aria-label="Cancelar edicion">${icon('x')}</button>` : ''}</div>
    <form data-form="save-user" class="form-grid user-form">
      <label>Codigo operativo / cedula<input name="codigoCensista" value="${escapeHtml(user.codigoCensista)}" inputmode="numeric" required minlength="5" maxlength="12" ${editing ? 'readonly' : ''}></label>
      <label>Nombres<input name="nombres" value="${escapeHtml(user.nombres)}" required maxlength="80"></label>
      <label>Apellidos<input name="apellidos" value="${escapeHtml(user.apellidos)}" required maxlength="80"></label>
      <label>Telefono<input name="telefono" value="${escapeHtml(user.telefono || '')}" inputmode="tel" maxlength="30"></label>
      <label>${editing ? 'Nuevo PIN (opcional)' : 'PIN inicial'}<input name="pin" type="password" inputmode="numeric" minlength="4" maxlength="12" ${editing ? '' : 'required'}></label>
      <label>Rol<select name="rol">${['ENCUESTADOR', 'SUPERVISOR', 'ADMIN'].map((role) => `<option value="${role}" ${user.rol === role ? 'selected' : ''}>${roleLabel(role)}</option>`).join('')}</select></label>
      <label>Equipo<select name="equipo"><option value="">Sin equipo</option>${Array.from({ length: 8 }, (_, index) => `Equipo ${index + 1}`).map((team) => `<option value="${team}" ${user.equipo === team ? 'selected' : ''}>${team}</option>`).join('')}</select></label>
      <label class="checkbox-label"><input name="disponibleCampo" type="checkbox" ${user.disponibleCampo !== false ? 'checked' : ''}> Disponible para campo</label>
      <label>Motivo de ausencia<input name="motivoIndisponibilidad" value="${escapeHtml(user.motivoIndisponibilidad || '')}" maxlength="250" placeholder="Solo si no esta disponible"></label>
      <label class="checkbox-label"><input name="activo" type="checkbox" ${user.activo !== false ? 'checked' : ''}> Usuario activo</label>
      <button class="btn btn-primary" type="submit">${icon(editing ? 'save' : 'user-plus')} ${editing ? 'Guardar cambios' : 'Crear usuario'}</button>
    </form>
  </section>`;
}

function renderLogistics() {
  if (!operationsAllowed()) return renderOperationsGuard();
  if (!state.admin) return renderOperationsLoading('Logistica');
  const users = state.admin.users || [];
  const progress = state.bootstrap?.progress || {};
  const assignments = state.logisticsDraft || {};
  const fieldUsers = teamAssignmentOptions(users);
  const catalog = operationalCatalog();
  const changed = changedAssignmentItems(state.logisticsOriginal, assignments, catalog);
  const metrics = logisticsMetrics(catalog, fieldUsers, assignments, progress, state.planningSettings);
  const workloads = buildWorkloads(fieldUsers, catalog, assignments, progress, state.admin.surveyorSummary || []);
  const departments = [...new Set(catalog.map((school) => school.departamento))].sort();
  const districts = [...new Set(catalog
    .filter((school) => !state.adminFilters.logisticsDepartment || school.departamento === state.adminFilters.logisticsDepartment)
    .map((school) => school.distrito))].sort();
  const filtered = filterLogisticsSchools(catalog, progress, assignments, {
    search: state.adminFilters.logisticsSearch,
    department: state.adminFilters.logisticsDepartment,
    district: state.adminFilters.logisticsDistrict,
    status: state.adminFilters.logisticsStatus,
    surveyor: state.adminFilters.logisticsSurveyor
  });
  const maxLoad = Math.max(1, ...workloads.map((item) => item.asignadas));
  return `<section class="view operations-view logistics-view">
    <div class="view-heading"><div><p class="eyebrow">Planificacion territorial</p><h1>Logistica de campo</h1><p>${filtered.length} escuelas visibles de ${catalog.length}${supervisorMode() ? ' en su equipo' : ''}.</p></div><div class="button-row"><button class="btn btn-secondary" data-action="export-logistics">${icon('download')} CSV</button><button class="btn btn-secondary" data-action="undo-logistics" ${changed.length ? '' : 'disabled'}>${icon('undo-2')} Deshacer</button><button class="btn btn-primary" data-action="save-logistics" ${changed.length && !state.logisticsSaving ? '' : 'disabled'}>${icon('save')} ${state.logisticsSaving ? 'Guardando...' : `Guardar ${changed.length || ''} cambio${changed.length === 1 ? '' : 's'}`}</button></div></div>
    ${renderAdminTabs('logistics')}
    <div class="planning-band">
      <label>Minutos por escuela<input type="number" min="5" max="1440" step="5" data-planning-setting="baseMinutes" value="${state.planningSettings.baseMinutes}"></label>
      <label>Horas de campo por dia<input type="number" min="1" max="24" step="0.5" data-planning-setting="hoursPerDay" value="${state.planningSettings.hoursPerDay}"></label>
      <label>Plazo objetivo en dias<input type="number" min="1" max="365" step="1" data-planning-setting="targetDays" value="${state.planningSettings.targetDays}"></label>
      <button class="btn btn-secondary" data-action="balance-logistics" ${fieldUsers.some((item) => item.rol === 'ENCUESTADOR') ? '' : 'disabled'}>${icon('scale')} Balancear pendientes</button>
    </div>
    <div class="summary-strip admin-summary logistics-summary">
      <div><span>Escuelas</span><strong>${metrics.total}</strong></div><div><span>Pendientes</span><strong>${metrics.pendientes}</strong></div><div><span>Sin asignar</span><strong>${metrics.sinAsignar}</strong></div><div><span>Horas restantes</span><strong>${formatNumber(metrics.horasPendientes, 1)}</strong></div><div><span>Dias estimados</span><strong>${metrics.diasCalendario ?? '—'}</strong></div>
    </div>
    ${changed.length ? `<div class="dirty-banner">${icon('circle-dot')}<span><strong>${changed.length} cambio${changed.length === 1 ? '' : 's'} sin guardar.</strong> La hoja en linea aun no fue modificada.</span></div>` : ''}
    <section class="content-section"><div class="section-heading"><div><h2>Carga por equipo</h2><p>${metrics.encuestadoresActivos} equipos activos · ${metrics.encuestadoresNecesarios} necesarios para el plazo indicado · ${formatNumber(metrics.jornadasPersona, 1)} jornadas-equipo.</p></div></div>
      <div class="workload-grid">${workloads.map((item) => {
        const assignedSchools = catalog.filter((school) => assignments[school.codigo] === item.codigoCensista && schoolStatus(progress, school.codigo) !== 'FINALIZADO');
        const routeUrl = googleRouteUrl(assignedSchools);
        return `<article class="workload-row"><span class="avatar small">${escapeHtml(initials(item))}</span><div><strong>${escapeHtml(displayName(item))}</strong><small>${item.finalizadas} finalizadas · ${item.pendientes} pendientes · ${item.fotos} fotos</small><span class="workload-track"><i style="width:${Math.round(item.asignadas / maxLoad * 100)}%"></i></span></div><b>${item.asignadas}</b>${routeUrl ? `<a class="icon-btn" href="${escapeHtml(routeUrl)}" target="_blank" rel="noopener" title="Abrir primeras escuelas pendientes en Google Maps" aria-label="Abrir ruta de ${escapeHtml(displayName(item))}">${icon('navigation')}</a>` : '<span class="route-placeholder"></span>'}</article>`;
      }).join('') || renderEmpty('users', 'No hay encuestadores activos.', '')}</div>
    </section>
    <section class="content-section"><div class="operations-filters logistics-filters">
      <label class="search-field">${icon('search')}<input data-admin-filter="logisticsSearch" value="${escapeHtml(state.adminFilters.logisticsSearch)}" placeholder="Codigo, escuela o localidad..."></label>
      <select data-admin-filter="logisticsDepartment" aria-label="Departamento"><option value="">Todos los departamentos</option>${departments.map((item) => `<option value="${escapeHtml(item)}" ${state.adminFilters.logisticsDepartment === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select>
      <select data-admin-filter="logisticsDistrict" aria-label="Distrito"><option value="">Todos los distritos</option>${districts.map((item) => `<option value="${escapeHtml(item)}" ${state.adminFilters.logisticsDistrict === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select>
      <select data-admin-filter="logisticsStatus" aria-label="Estado"><option value="">Todos los estados</option>${['PENDIENTE', 'EN_PROCESO', 'FINALIZADO', 'CON_PENDIENTES'].map((item) => `<option value="${item}" ${state.adminFilters.logisticsStatus === item ? 'selected' : ''}>${statusLabel(item)}</option>`).join('')}</select>
      <select data-admin-filter="logisticsSurveyor" aria-label="Equipo"><option value="">Todos los equipos</option><option value="__UNASSIGNED__" ${state.adminFilters.logisticsSurveyor === '__UNASSIGNED__' ? 'selected' : ''}>Sin asignar</option>${fieldUsers.map((item) => `<option value="${item.codigoCensista}" ${state.adminFilters.logisticsSurveyor === item.codigoCensista ? 'selected' : ''}>${escapeHtml(displayName(item))}</option>`).join('')}</select>
    </div>
    <div class="data-table-wrap logistics-table"><table><thead><tr><th>Orden</th><th>Escuela</th><th>Departamento / distrito</th><th>Estado</th><th>Equipo asignado</th><th>Mapa</th></tr></thead><tbody>${filtered.map((school) => {
      const assignedCode = String(assignments[school.codigo] || '');
      const originalCode = String(state.logisticsOriginal[school.codigo] || '');
      const assignedUser = users.find((item) => item.codigoCensista === assignedCode);
      return `<tr class="${assignedCode !== originalCode ? 'is-dirty' : ''}"><td>${school.ordenMuestra || ''}</td><td><strong>${escapeHtml(school.nombre)}</strong><br><small>RUE ${escapeHtml(school.codigoRue || normalizeRueSchoolCode(school.codigo))} · Interno ${escapeHtml(school.codigo)} · ${escapeHtml(school.sitioId || '')} · ${escapeHtml(school.localidad)}</small></td><td>${escapeHtml(school.departamento)}<br><small>${escapeHtml(school.distrito)}</small></td><td><span class="status-pill status-${schoolStatus(progress, school.codigo).toLowerCase()}">${statusLabel(schoolStatus(progress, school.codigo))}</span></td><td><select data-logistics-assignment="${school.codigo}" aria-label="Equipo para ${escapeHtml(school.nombre)}"><option value="">Sin asignar</option>${assignedUser && !fieldUsers.some((item) => item.codigoCensista === assignedCode) ? `<option value="${escapeHtml(assignedCode)}" selected>${escapeHtml(displayName(assignedUser))} (inactivo)</option>` : ''}${fieldUsers.map((item) => `<option value="${item.codigoCensista}" ${assignedCode === item.codigoCensista ? 'selected' : ''}>${escapeHtml(displayName(item))}</option>`).join('')}</select></td><td><a class="icon-btn" href="https://www.google.com/maps/search/?api=1&query=${school.latitud},${school.longitud}" target="_blank" rel="noopener" title="Ver escuela en Google Maps" aria-label="Ver ${escapeHtml(school.nombre)} en Google Maps">${icon('map-pin')}</a></td></tr>`;
    }).join('') || '<tr><td colspan="6">No hay escuelas con estos filtros.</td></tr>'}</tbody></table></div>
    </section>
  </section>`;
}

function renderRequests() {
  if (!operationsAllowed()) return renderOperationsGuard();
  if (!state.admin) return renderOperationsLoading('Solicitudes');
  const currentUser = state.bootstrap?.user || {};
  const requests = state.admin.requests || [];
  const filtered = requests
    .filter((item) => !state.adminFilters.requestStatus || item.estado === state.adminFilters.requestStatus)
    .sort((left, right) => String(right.requestedAt || '').localeCompare(String(left.requestedAt || '')));
  return `<section class="view operations-view">
    <div class="view-heading"><div><p class="eyebrow">Accesos al sistema</p><h1>Solicitudes</h1><p>${filtered.length} solicitudes visibles de ${requests.length}.</p></div><button class="btn btn-secondary" data-action="reload-admin">${icon('refresh-cw')} Actualizar</button></div>
    ${renderAdminTabs('requests')}
    <div class="summary-strip request-summary">
      <div><span>Pendientes</span><strong>${requests.filter((item) => item.estado === 'PENDIENTE').length}</strong></div><div><span>Aprobadas</span><strong>${requests.filter((item) => item.estado === 'APROBADA').length}</strong></div><div><span>Rechazadas</span><strong>${requests.filter((item) => item.estado === 'RECHAZADA').length}</strong></div><div><span>Total</span><strong>${requests.length}</strong></div>
    </div>
    <section class="content-section"><div class="section-heading"><div><h2>Bandeja de solicitudes</h2><p>Identidad, fecha y resolucion administrativa.</p></div><select class="compact-select" data-admin-filter="requestStatus" aria-label="Estado de solicitud"><option value="">Todos los estados</option>${['PENDIENTE', 'APROBADA', 'RECHAZADA'].map((item) => `<option value="${item}" ${state.adminFilters.requestStatus === item ? 'selected' : ''}>${requestStatusLabel(item)}</option>`).join('')}</select></div>
      <div class="request-list">${filtered.map((item) => `<article class="list-card request-card"><div class="list-card-icon">${icon(item.estado === 'PENDIENTE' ? 'user-round-search' : item.estado === 'APROBADA' ? 'user-check' : 'user-x')}</div><div><strong>${escapeHtml(item.nombres)} ${escapeHtml(item.apellidos)}</strong><span>${escapeHtml(item.codigoCensista)} · ${escapeHtml(item.telefono || 'Sin telefono')}</span><small>Solicitada ${formatDateTime(item.requestedAt)}${item.revisadoAt ? ` · Revisada ${formatDateTime(item.revisadoAt)} por ${escapeHtml(item.revisadoPor)}` : ''}</small></div><span class="status-pill request-${String(item.estado || '').toLowerCase()}">${requestStatusLabel(item.estado)}</span>${item.estado === 'PENDIENTE' && currentUser.rol === 'ADMIN' ? `<div class="list-card-actions"><button class="btn btn-secondary" data-action="review-access" data-request="${item.solicitudId}" data-status="RECHAZADA">${icon('x')} Rechazar</button><button class="btn btn-primary" data-action="review-access" data-request="${item.solicitudId}" data-status="APROBADA">${icon('check')} Aprobar</button></div>` : ''}</article>`).join('') || renderEmpty('inbox', 'No hay solicitudes con este estado.', '')}</div>
    </section>
  </section>`;
}

function renderAccount() {
  const user = state.bootstrap?.user || state.session?.user || {};
  return `<section class="view account-view"><div class="view-heading"><div><p class="eyebrow">Sesion actual</p><h1>Mi cuenta</h1></div></div>
    <section class="profile-panel"><span class="avatar large">${escapeHtml(initials(user))}</span><div><h2>${escapeHtml(displayName(user))}</h2><p>${escapeHtml(user.codigoCensista)} · ${roleLabel(user.rol)}${user.equipo ? ` · ${escapeHtml(user.equipo)}` : ''}</p></div></section>
    <section class="content-section settings-list">
      <div><span>${icon('smartphone')}<b>Dispositivo</b></span><code>${escapeHtml(getDeviceId().slice(0, 13))}...</code></div>
      <div><span>${icon('database')}<b>Catalogo</b></span><span>${state.catalog.length} escuelas · ${escapeHtml(state.catalogMeta?.scope || '')}</span></div>
      <div><span>${icon('cloud')}<b>Sincronizacion</b></span><span>${state.queue.length ? `${state.queue.length} pendientes` : 'Al dia'}</span></div>
      <div><span>${icon('app-window')}<b>Version</b></span><span>${APP_CONFIG.version} · ${APP_CONFIG.buildDate}</span></div>
      <button type="button" data-action="check-app-update"><span>${icon('refresh-cw')}<b>Actualizar aplicacion</b></span><span>Buscar ahora</span></button>
      <button type="button" data-view="guide"><span>${icon('list-checks')}<b>Guia operativa</b></span><span>Abrir en la app</span></button>
      <a href="${APP_CONFIG.trainingManualUrl}" target="_blank" rel="noopener"><span>${icon('presentation')}<b>Manual de capacitacion</b></span><span>35 diapositivas</span></a>
      <a href="${APP_CONFIG.manualUrl}" target="_blank" rel="noopener"><span>${icon('book-open-check')}<b>Manual rapido</b></span><span>Abrir hoja 2</span></a>
      <a href="${APP_CONFIG.printableFormUrl}" target="_blank" rel="noopener"><span>${icon('printer')}<b>Ficha de contingencia</b></span><span>Imprimir hoja 1</span></a>
    </section>
    ${state.installPrompt ? `<button class="btn btn-primary" data-action="install">${icon('download')} Instalar en este dispositivo</button>` : ''}
    <button class="btn btn-danger" data-action="logout">${icon('log-out')} Cerrar sesion</button>
  </section>`;
}

function renderTeamPerformanceAdmin(performance = {}) {
  const teams = performance?.teams || [];
  return `<section class="content-section"><div class="section-heading"><div><h2>KPIs y contingencias por equipo</h2><p>La proyeccion reduce la capacidad en proporcion a los integrantes ausentes. Un integrante de dos equivale al 50%.</p></div></div>
    <div class="data-table-wrap"><table><thead><tr><th>Equipo</th><th>Disponibles</th><th>Escuelas atendidas</th><th>Fichas</th><th>Promedio</th><th>Mediana</th><th>Capacidad</th><th>Plazo restante</th><th>Efecto de ausencia</th></tr></thead><tbody>${teams.map((team) => {
      const forecast = contingencyForecast({
        pendingSchools: team.pendingSchools,
        baseMinutes: state.planningSettings.baseMinutes,
        hoursPerDay: state.planningSettings.hoursPerDay,
        totalMembers: team.totalMembers,
        availableMembers: team.availableMembers
      });
      return `<tr><td><strong>${escapeHtml(team.equipo)}</strong><br><small>${team.members.map((member) => escapeHtml(displayName(member))).join(' / ')}</small></td><td><span class="status-pill ${team.availableMembers === team.totalMembers ? 'status-finalizado' : 'status-con_pendientes'}">${team.availableMembers}/${team.totalMembers}</span></td><td>${team.touchedSchools}/${team.assignedSchools}</td><td>${team.records}</td><td>${minutesLabel(team.averageMinutes)}</td><td>${minutesLabel(team.medianMinutes)}</td><td>${Math.round(forecast.capacityFactor * 100)}%</td><td>${forecast.blocked ? 'Bloqueado' : `${formatNumber(forecast.estimatedDays, 1)} dias`}</td><td>${forecast.blocked ? 'Sin personal disponible' : forecast.delayDays ? `+${formatNumber(forecast.delayDays, 1)} dias` : 'Sin demora'}</td></tr>`;
    }).join('') || '<tr><td colspan="9">Aun no hay equipos con datos.</td></tr>'}</tbody></table></div>
  </section>`;
}

function renderGuide() {
  const user = state.bootstrap?.user || state.session?.user || {};
  const isSupervisor = ['ADMIN', 'SUPERVISOR'].includes(user.rol);
  return `<section class="view guide-view">
    <div class="view-heading">
      <div><p class="eyebrow">Ayuda operativa</p><h1>Guia de campo</h1><p>Consulta rapida para registrar, revisar y sincronizar sin perder trazabilidad.</p></div>
      <a class="btn btn-secondary" href="${APP_CONFIG.trainingManualUrl}" target="_blank" rel="noopener">${icon('presentation')} Manual completo</a>
    </div>
    <section class="guide-hero">
      <div>
        <span class="guide-kicker">${isSupervisor ? 'SUPERVISION' : 'TRABAJO DE CAMPO'}</span>
        <h2>${isSupervisor ? 'Controle por excepcion y asegure la recuperacion.' : 'Revise antes de salir de la escuela.'}</h2>
        <p>${isSupervisor
          ? 'Priorice pendientes, duplicados, falta de carga reciente y cambios de asignacion.'
          : 'Una escuela correcta, un codigo coherente, una foto util y la cola en cero.'}</p>
      </div>
      <button class="btn btn-primary" type="button" data-view="${isSupervisor ? 'admin' : 'register'}">${icon(isSupervisor ? 'layout-dashboard' : 'camera')} ${isSupervisor ? 'Ir a Control' : 'Ir a Registrar'}</button>
    </section>
    <section class="guide-rule-grid" aria-label="Reglas esenciales">
      ${guideRule('1', 'Escuela correcta', 'Compare codigo MEC, nombre y asignacion.', 'school')}
      ${guideRule('2', 'Codigo unico', 'Ficha, app y fotografias deben coincidir.', 'scan-line')}
      ${guideRule('3', 'Foto util', 'Contexto, enfoque, pertinencia y privacidad.', 'camera')}
      ${guideRule('4', 'Cola en cero', 'Confirme la sincronizacion antes del cierre.', 'cloud-upload')}
    </section>
    <section class="guide-grid">
      <article class="content-section guide-card">
        <div class="section-heading"><div><p class="eyebrow">Fotografia</p><h2>Secuencia recomendada</h2></div>${icon('images', 28)}</div>
        <ol class="guide-steps">
          <li><b>Contexto</b><span>Vista general del espacio.</span></li>
          <li><b>Posicion</b><span>Ubicacion del elemento.</span></li>
          <li><b>Detalle</b><span>Elemento, dano o identificacion.</span></li>
          <li><b>Hoja</b><span>Completa, plana y legible.</span></li>
        </ol>
      </article>
      <article class="content-section guide-card">
        <div class="section-heading"><div><p class="eyebrow">Sin conexion</p><h2>Recuperacion segura</h2></div>${icon('wifi-off', 28)}</div>
        <ol class="guide-steps">
          <li><b>Mantenga</b><span>El mismo dispositivo y navegador.</span></li>
          <li><b>Recupere</b><span>Internet y abra Mi jornada.</span></li>
          <li><b>Sincronice</b><span>Deje la app abierta durante el envio.</span></li>
          <li><b>Verifique</b><span>Cero operaciones pendientes.</span></li>
        </ol>
      </article>
      <article class="content-section guide-card">
        <div class="section-heading"><div><p class="eyebrow">Incidencias</p><h2>Reporte minimo</h2></div>${icon('message-square-warning', 28)}</div>
        <p>Incluya usuario sin PIN, codigo MEC, B/P/E/H, fecha y hora, accion realizada, mensaje exacto, conexion y cola pendiente.</p>
        <button class="btn btn-secondary" type="button" data-action="copy-incident-template">${icon('copy')} Copiar plantilla</button>
      </article>
      <article class="content-section guide-card guide-card-warning">
        <div class="section-heading"><div><p class="eyebrow">No hacer</p><h2>Errores criticos</h2></div>${icon('triangle-alert', 28)}</div>
        <ul>
          <li>Seleccionar una escuela parecida con otro codigo.</li>
          <li>Crear otro registro para el mismo B/P/E/H.</li>
          <li>Compartir PIN o fotografiar personas sin autorizacion.</li>
          <li>Marcar Finalizado sin GPS y revision completa.</li>
          <li>Borrar datos del navegador con cola pendiente.</li>
        </ul>
      </article>
    </section>
    <section class="guide-downloads">
      <a class="btn btn-secondary" href="${APP_CONFIG.trainingManualUrl}" target="_blank" rel="noopener">${icon('file-down')} Manual de capacitacion</a>
      <a class="btn btn-secondary" href="${APP_CONFIG.manualUrl}" target="_blank" rel="noopener">${icon('book-open')} Manual rapido</a>
      <a class="btn btn-secondary" href="${APP_CONFIG.printableFormUrl}" target="_blank" rel="noopener">${icon('printer')} Ficha de contingencia</a>
    </section>
  </section>`;
}

function guideRule(number, title, copy, iconName) {
  return `<article><span class="guide-rule-number">${number}</span><span class="guide-rule-icon">${icon(iconName, 22)}</span><div><h2>${title}</h2><p>${copy}</p></div></article>`;
}

function renderCompletionChecklist(draft) {
  const recordReady = Boolean(calculateRecordId(draft));
  const hasPhotos = Boolean(draft.photos.length);
  const hasLocation = Boolean(draft.location);
  const pendingExplained = draft.estado !== 'CON_PENDIENTES' || String(draft.observaciones || '').trim().length >= 10;
  const items = [
    [recordReady, 'Codigo completo'],
    [hasPhotos, 'Foto agregada'],
    [hasLocation, 'GPS obtenido'],
    [pendingExplained, 'Pendiente explicado']
  ];
  return `<div class="completion-checklist" aria-label="Control antes del cierre">
    <strong>${icon('list-checks')} Control antes del cierre</strong>
    <div>${items.map(([ok, label]) => `<span class="${ok ? 'is-ready' : ''}">${icon(ok ? 'check' : 'minus', 14)} ${label}</span>`).join('')}</div>
    <small>Para marcar Finalizado se requiere GPS. Si quedan pendientes, describa exactamente que falta.</small>
  </div>`;
}

function renderEmpty(iconName, title, copy) {
  return `<div class="empty-state">${icon(iconName, 28)}<h3>${escapeHtml(title)}</h3>${copy ? `<p>${escapeHtml(copy)}</p>` : ''}</div>`;
}

function mountView() {
  state.map?.destroy();
  state.map = null;
  if (state.view === 'schools') {
    const element = document.querySelector('#school-map');
    state.map = new SchoolMap(element, (code) => {
      state.selectedSchoolCode = canonicalSchoolCode(code);
      render();
    });
    const schools = filteredSchools();
    state.map.setSchools(schools, state.bootstrap?.progress || {}, state.selectedSchoolCode);
    if (state.location) state.map.showUserLocation(state.location);
    if (state.selectedSchoolCode) state.map.focusSchool(schoolByCode(state.selectedSchoolCode));
  }
  if (state.view === 'register') hydratePhotoPreviews();
  if (state.view === 'photos') hydrateGalleryPhotos();
  if (operationsViews.has(state.view) && !state.admin && !state.adminLoading) loadAdmin();
}

async function hydratePhotoPreviews() {
  for (const image of document.querySelectorAll('[data-blob-preview]')) {
    const stored = await database.getBlob(image.dataset.blobPreview);
    if (!stored?.blob || !image.isConnected) continue;
    const url = URL.createObjectURL(stored.blob);
    image.src = url;
    image.onload = () => URL.revokeObjectURL(url);
  }
}

async function loadAdmin(force = false) {
  if (state.adminLoading) return;
  state.adminLoading = true;
  if (force) state.admin = null;
  try {
    state.admin = normalizeAdminSchoolCodes(await api.adminDashboard());
    if (force || !state.logisticsInitialized) resetLogisticsDraft();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    state.adminLoading = false;
    if (operationsViews.has(state.view)) render();
  }
}

function resetLogisticsDraft() {
  const assignments = primaryAssignmentMap(state.admin?.assignments || []);
  state.logisticsOriginal = { ...assignments };
  state.logisticsDraft = { ...assignments };
  state.logisticsInitialized = true;
}

async function handleSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  submit?.setAttribute('disabled', '');
  try {
    if (form.dataset.form === 'login') await login(form);
    if (form.dataset.form === 'request-access') await requestAccess(form);
    if (form.dataset.form === 'bootstrap-admin') await bootstrapAdmin(form);
    if (form.dataset.form === 'record') await finalizeRecord(form);
    if (form.dataset.form === 'save-user') await saveUser(form);
    if (form.dataset.form === 'save-assignment') await saveAssignment(form);
  } catch (error) {
    toast(error.message || 'No se pudo completar la accion.', 'error', 6500);
  } finally {
    submit?.removeAttribute('disabled');
  }
}

async function login(form) {
  const data = Object.fromEntries(new FormData(form));
  data.codigoCensista = loginCode(data.codigoCensista);
  const session = await api.login(data);
  setSession(session);
  await loadBootstrap();
  const remoteStatus = await loadRemoteRecords(true);
  state.view = 'schools';
  render();
  if (remoteStatus?.error) {
    toast('Ingreso correcto, pero los datos remotos no pudieron verificarse. Revise el aviso y vuelva a intentar.', 'warning', 8000);
  } else {
    toast(`Bienvenido, ${displayName(state.bootstrap?.user || session.user)}.`, 'success');
  }
  syncQueue({ quiet: true });
}

async function requestAccess(form) {
  const data = Object.fromEntries(new FormData(form));
  data.codigoCensista = digits(data.codigoCensista);
  await api.requestAccess(data);
  form.reset();
  toast('Solicitud enviada. Un administrador debe revisarla.', 'success');
}

async function bootstrapAdmin(form) {
  const data = Object.fromEntries(new FormData(form));
  data.codigoCensista = digits(data.codigoCensista);
  await api.bootstrapAdmin(data);
  state.health = await api.health();
  render();
  toast('Administrador inicial creado. Ya puede ingresar.', 'success');
}

async function finalizeRecord(form) {
  updateDraftFromForm();
  if (!form.checkValidity()) {
    form.reportValidity();
    throw new Error('Complete los campos obligatorios de la ficha.');
  }
  const draft = state.activeDraft;
  if (!draft.photos.length) throw new Error('Agregue al menos una fotografia antes de finalizar.');
  const recordId = calculateRecordId(draft);
  if (!recordId) throw new Error('Revise los numeros de bloque, piso, espacio y hoja.');
  if (draft.estado === 'FINALIZADO' && !draft.location) {
    throw new Error('Obtenga el GPS antes de marcar el registro como Finalizado.');
  }
  if (draft.estado === 'CON_PENDIENTES' && String(draft.observaciones || '').trim().length < 10) {
    throw new Error('Describa en Observaciones que falta y la accion requerida.');
  }
  if (!draft.completedAt) {
    draft.completedAt = new Date().toISOString();
    draft.durationSeconds = elapsedSeconds(draft.startedAt, draft.completedAt);
  }
  draft.recordId = recordId;
  const photoNotes = new Map([...document.querySelectorAll('[data-photo-note]')].map((input) => [input.dataset.photoNote, input.value.trim()]));
  draft.photos = draft.photos.map((photo) => ({ ...photo, notas: photoNotes.get(photo.fotoId) || photo.notas || '' }));
  await database.saveDraft(draft);
  await enqueueDraft(draft);
  await database.delete('drafts', draft.draftId);
  state.activeDraft = null;
  await refreshLocalState();
  state.view = 'pending';
  render();
  toast(state.online ? 'Registro preparado para sincronizar.' : 'Registro guardado en la cola local.', 'success');
  if (state.online) await syncQueue();
}

async function enqueueDraft(draft) {
  const record = buildRecordPayload(draft);
  await database.enqueue('saveRecord', { record }, `record-${draft.idempotencyKey}`);
  const pendingPhotos = draft.photos.filter((photo) => !photo.synced);
  for (let index = 0; index < pendingPhotos.length; index += 1) {
    const photo = pendingPhotos[index];
    const metadata = {
      ...photo,
      recordId: record.recordId,
      codigoEscuela: record.codigoEscuela,
      codigoCensista: record.codigoCensista,
      numeroFormulario: record.numeroFormulario,
      numeroHoja: record.numeroHoja,
      bloque: record.bloque,
      piso: record.piso,
      espacio: record.espacio,
      secuencia: photoSequence(photo) || index + 1,
      codigoFoto: photo.codigoFoto,
      tipoElemento: photo.tipoElemento,
      numeroElemento: photo.numeroElemento,
      codigoElemento: photo.codigoElemento,
      etiquetaImpresa: photo.etiquetaImpresa,
      location: draft.location
    };
    await database.enqueue('uploadPhoto', { photo: metadata, blobId: photo.blobId }, `photo-${photo.idempotencyKey}`);
  }
}

function buildRecordPayload(draft) {
  const user = state.bootstrap?.user || state.session?.user;
  const school = schoolByCode(draft.codigoEscuela) || {};
  const schoolCode = canonicalSchoolCode(draft.codigoEscuela);
  const compatibility = {
    codigoRue: school.codigoRue || normalizeRueSchoolCode(draft.codigoEscuela),
    sitioId: school.sitioId || '',
    rueSection: rueSectionForSpace(draft.tipoEspacio)
  };
  return {
    recordId: calculateRecordId(draft),
    idempotencyKey: draft.idempotencyKey,
    codigoEscuela: schoolCode,
    codigoCensista: user.codigoCensista,
    numeroFormulario: digits(draft.numeroFormulario),
    numeroHoja: digits(draft.numeroHoja),
    bloque: digits(draft.bloque),
    piso: digits(draft.piso),
    espacio: digits(draft.espacio),
    tipoEspacio: draft.tipoEspacio,
    ...compatibility,
    rueSpaceKey: rueSpaceKey(draft, school),
    estado: draft.estado,
    observaciones: draft.observaciones,
    danosFallas: draft.danosFallas,
    latitudCaptura: draft.location?.latitud ?? '',
    longitudCaptura: draft.location?.longitud ?? '',
    precisionM: draft.location?.precisionM ?? '',
    cantidadFotos: draft.photos.length,
    cantidadHojasPapel: draft.photos.filter((photo) => photo.tipoFoto === 'HOJA_PAPEL').length,
    createdAt: draft.createdAt,
    startedAt: draft.startedAt || draft.createdAt,
    completedAt: draft.completedAt || new Date().toISOString(),
    durationSeconds: Number(draft.durationSeconds || elapsedSeconds(draft.startedAt || draft.createdAt)),
    updatedAt: new Date().toISOString(),
    deviceId: getDeviceId()
  };
}

async function syncQueue(options = {}) {
  if (state.syncing || !state.session) return;
  if (!navigator.onLine) {
    if (!options.quiet) toast('No hay conexion. Los datos siguen protegidos en la cola local.', 'info');
    return;
  }
  state.syncing = true;
  if (state.view === 'pending') render();
  let completed = 0;
  try {
    const items = await database.listQueue();
    for (const item of items) {
      try {
        if (item.action === 'saveRecord') {
          await api.saveRecord(item.payload.record);
        } else if (item.action === 'uploadPhoto') {
          const stored = await database.getBlob(item.payload.blobId);
          if (!stored?.blob) throw new Error('No se encontro la imagen local asociada.');
          await api.uploadPhoto(item.payload.photo, await blobToBase64(stored.blob));
          await database.deleteBlob(item.payload.blobId);
        }
        await database.deleteQueue(item.queueId);
        completed += 1;
      } catch (error) {
        await database.markQueueError(item, error.message);
        if (['AUTH_REQUIRED', 'SESSION_EXPIRED'].includes(error.code)) {
          setSession(null);
          state.bootstrap = null;
        }
        break;
      }
    }
    await refreshLocalState();
    if (completed && state.session) {
      await loadBootstrap(true);
      await loadRemoteRecords(true);
      if (!options.quiet) toast(`${completed} operacion${completed === 1 ? '' : 'es'} sincronizada${completed === 1 ? '' : 's'}.`, 'success');
    } else if (!state.queue.length && !options.quiet) {
      toast('No hay datos pendientes.', 'success');
    }
  } finally {
    state.syncing = false;
    render();
  }
}

async function saveUser(form) {
  const data = Object.fromEntries(new FormData(form));
  data.codigoCensista = digits(data.codigoCensista);
  data.activo = form.elements.activo.checked;
  data.disponibleCampo = form.elements.disponibleCampo.checked;
  await api.saveUser(data);
  const wasEditing = Boolean(state.editingUserCode);
  state.editingUserCode = '';
  await loadAdmin(true);
  toast(wasEditing ? 'Usuario actualizado.' : 'Usuario creado.', 'success');
}

async function saveAssignment(form) {
  const data = Object.fromEntries(new FormData(form));
  data.activo = form.elements.activo.checked;
  await api.saveAssignment(data);
  await loadAdmin(true);
  toast('Asignacion guardada.', 'success');
}

async function toggleUser(code, active) {
  const user = (state.admin?.users || []).find((item) => String(item.codigoCensista) === String(code));
  if (!user || user.codigoCensista === 'admin') throw new Error('La cuenta administrativa principal esta protegida.');
  const action = active ? 'activar' : 'desactivar';
  if (!confirm(`¿Confirma que desea ${action} a ${displayName(user)}?`)) return;
  await api.saveUser({
    codigoCensista: user.codigoCensista,
    nombres: user.nombres,
    apellidos: user.apellidos,
    telefono: user.telefono || '',
    rol: user.rol,
    equipo: user.equipo || '',
    disponibleCampo: user.disponibleCampo !== false,
    motivoIndisponibilidad: user.motivoIndisponibilidad || '',
    activo: active
  });
  if (state.editingUserCode === user.codigoCensista) state.editingUserCode = '';
  await loadAdmin(true);
  toast(`Usuario ${active ? 'activado' : 'desactivado'}.`, 'success');
}

async function hydrateGalleryPhotos() {
  const photos = (state.remote?.photos || []).filter((photo) => recordKeyOf(photo) === state.gallery.recordKey);
  const pending = photos.filter((photo) => !state.gallery.content[photo.fotoId]?.dataUrl && !state.gallery.content[photo.fotoId]?.loading);
  for (let index = 0; index < pending.length; index += 4) {
    await Promise.all(pending.slice(index, index + 4).map((photo) => loadGalleryPhotoContent(photo)));
  }
}

async function downloadGalleryPhoto(photo, variant) {
  const first = await api.getPhotoContent(photo.fotoId, 0, variant);
  const mimeType = String(first.mimeType || '').toLowerCase();
  const totalChunks = Number(first.totalChunks || 0);
  if (first.variant !== variant || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
    || !first.chunk || totalChunks < 1 || totalChunks > 100) {
    throw new Error('El servidor devolvio una imagen no valida.');
  }
  const chunks = [first.chunk];
  for (let chunkIndex = 1; chunkIndex < totalChunks; chunkIndex += 1) {
    const next = await api.getPhotoContent(photo.fotoId, chunkIndex, variant);
    if (next.variant !== variant || Number(next.chunkIndex) !== chunkIndex
      || Number(next.totalChunks) !== totalChunks || !next.chunk) {
      throw new Error('La descarga de la fotografia quedo incompleta.');
    }
    chunks.push(next.chunk);
  }
  return `data:${mimeType};base64,${chunks.join('')}`;
}

async function loadGalleryPhotoContent(photo) {
  state.gallery.content[photo.fotoId] = { loading: true };
  try {
    const dataUrl = await downloadGalleryPhoto(photo, 'preview');
    state.gallery.content[photo.fotoId] = { dataUrl, loading: false };
    const button = document.querySelector(`[data-gallery-photo="${CSS.escape(photo.fotoId)}"] .gallery-image`);
    if (button) button.innerHTML = `<img src="${dataUrl}" data-photo-quality="preview" alt="${escapeHtml(photo.codigoFoto || 'Fotografia del registro')}" loading="lazy">`;
  } catch (error) {
    state.gallery.content[photo.fotoId] = { loading: false, error: error.message || 'No se pudo cargar.' };
    const placeholder = document.querySelector(`[data-gallery-photo="${CSS.escape(photo.fotoId)}"] .gallery-placeholder`);
    if (placeholder) placeholder.innerHTML = `${icon('image-off', 30)}<span>No se pudo cargar</span>`;
    const copy = document.querySelector(`[data-gallery-photo="${CSS.escape(photo.fotoId)}"] .gallery-card-copy`);
    if (copy && !copy.querySelector('.gallery-error')) {
      copy.insertAdjacentHTML('beforeend', `<p class="gallery-error">${escapeHtml(error.message || 'No se pudo cargar la fotografia.')}</p><button class="btn btn-quiet" data-action="retry-gallery-photo" data-photo="${escapeHtml(photo.fotoId)}">${icon('rotate-cw')} Reintentar</button>`);
    }
    refreshIcons();
  }
}

async function openGalleryPhoto(fotoId) {
  const cached = state.gallery.content[fotoId];
  const photo = (state.remote?.photos || []).find((item) => item.fotoId === fotoId);
  if (!cached?.dataUrl || !photo) {
    toast('La fotografia todavia se esta cargando.', 'info');
    return;
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'photo-dialog';
  dialog.innerHTML = `<div class="photo-dialog-bar"><strong>${escapeHtml(photo.codigoFoto || 'Fotografia')}</strong><button class="icon-btn" aria-label="Cerrar">${icon('x')}</button></div><img src="${cached.originalDataUrl || cached.dataUrl}" data-photo-quality="${cached.originalDataUrl ? 'original' : 'preview'}" alt="${escapeHtml(photo.codigoFoto || 'Fotografia ampliada')}"><p data-photo-loading>${cached.originalDataUrl ? escapeHtml(photo.notas || `${elementLabel(photo.tipoElemento)} ${photo.numeroElemento || ''}`) : 'Cargando alta resolucion...'}</p>`;
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  refreshIcons();
  if (cached.originalDataUrl) return;
  try {
    const originalDataUrl = await downloadGalleryPhoto(photo, 'original');
    const current = state.gallery.content[fotoId] || cached;
    state.gallery.content[fotoId] = { ...current, originalDataUrl };
    if (!dialog.isConnected) return;
    const image = dialog.querySelector('img');
    image.src = originalDataUrl;
    image.dataset.photoQuality = 'original';
    dialog.querySelector('[data-photo-loading]').textContent = photo.notas
      || `${elementLabel(photo.tipoElemento)} ${photo.numeroElemento || ''}`.trim();
  } catch (error) {
    if (!dialog.isConnected) return;
    dialog.querySelector('[data-photo-loading]').textContent = `No se pudo cargar la alta resolucion: ${error.message || 'error desconocido'}`;
  }
}

async function toggleAvailability(code, available) {
  const user = (state.admin?.users || []).find((item) => String(item.codigoCensista) === String(code));
  if (!user) throw new Error('No se encontro el censista.');
  let reason = '';
  if (!available) {
    reason = prompt(`Motivo de ausencia de ${displayName(user)}:`, user.motivoIndisponibilidad || '') || '';
    if (!reason.trim() && !confirm('No se indico un motivo. ¿Registrar igualmente la ausencia?')) return;
  }
  await api.setAvailability(code, available, reason.trim());
  await loadAdmin(true);
  if (state.bootstrap?.user?.equipo === user.equipo) await loadBootstrap(true);
  toast(available ? 'Censista marcado como disponible.' : 'Ausencia registrada y plazo recalculado.', 'success');
}

async function saveLogistics() {
  const items = changedAssignmentItems(state.logisticsOriginal, state.logisticsDraft, operationalCatalog());
  if (!items.length || state.logisticsSaving) return;
  state.logisticsSaving = true;
  render();
  try {
    const result = await api.saveAssignmentsBatch(items);
    await loadBootstrap(true);
    await loadAdmin(true);
    toast(`${result.updated ?? items.length} asignacion${items.length === 1 ? '' : 'es'} actualizada${items.length === 1 ? '' : 's'}.`, 'success');
  } finally {
    state.logisticsSaving = false;
    if (state.view === 'logistics') render();
  }
}

function balanceLogistics() {
  if (!confirm('Se redistribuiran en el borrador todas las escuelas no finalizadas. ¿Continuar?')) return;
  const balanced = balancePendingAssignments(
    operationalCatalog(),
    teamAssignmentOptions(state.admin?.users || []),
    state.logisticsDraft,
    state.bootstrap?.progress || {}
  );
  if (!balanced) throw new Error('No hay encuestadores activos para realizar el balanceo.');
  state.logisticsDraft = balanced;
  render();
  toast('Distribucion propuesta. Revise y pulse Guardar cambios para aplicarla.', 'info', 6500);
}

function exportLogistics() {
  const content = logisticsCsv(
    operationalCatalog(),
    state.admin?.users || [],
    state.logisticsDraft,
    state.bootstrap?.progress || {}
  );
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `cialpa-logistica-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast('CSV de logistica generado.', 'success');
}

async function exportRueCompatibility() {
  if (state.rueExporting) return;
  state.rueExporting = true;
  render();
  try {
    const remote = normalizeRemoteSchoolCodes(await api.listRecords());
    const rows = buildRueCompatibilityRows(remote.records || [], remote.photos || [], operationalCatalog());
    if (!rows.length) throw new Error('Aun no hay registros para conciliar con RUE.');
    const summary = rueCompatibilitySummary(rows);
    const content = rueCompatibilityCsv(rows);
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `cialpa-compatibilidad-rue-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    if (summary.withIssues) {
      toast(`Archivo generado: ${summary.compatible} registros compatibles y ${summary.withIssues} para revisar.`, 'warning', 7500);
    } else {
      toast(`Archivo RUE generado: ${summary.records} registros y ${summary.evidenceRows} evidencias compatibles.`, 'success', 6500);
    }
  } finally {
    state.rueExporting = false;
    render();
  }
}

async function handleClick(event) {
  const viewButton = event.target.closest('[data-view]');
  if (viewButton) {
    state.view = viewButton.dataset.view;
    if (state.view !== 'register') state.activeDraft = null;
    render();
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'reload') location.reload();
  if (action === 'check-app-update') {
    if (state.activeDraft) {
      updateDraftFromForm();
      await database.saveDraft(state.activeDraft);
      await refreshLocalState();
    }
    await checkAppUpdate({ manual: true });
  }
  if (action === 'toggle-pin') {
    const input = button.parentElement.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
    button.innerHTML = icon(input.type === 'password' ? 'eye' : 'eye-off');
    refreshIcons();
  }
  if (action === 'select-school') {
    state.selectedSchoolCode = canonicalSchoolCode(button.dataset.school);
    render();
  }
  if (action === 'clear-school') {
    state.selectedSchoolCode = '';
    render();
  }
  if (action === 'start-record') {
    state.selectedSchoolCode = canonicalSchoolCode(button.dataset.school);
    state.activeDraft = newDraft(state.selectedSchoolCode);
    state.view = 'register';
    render();
  }
  if (action === 'show-school') {
    state.selectedSchoolCode = canonicalSchoolCode(button.dataset.school);
    state.view = 'schools';
    render();
  }
  if (action === 'show-school-photos') {
    state.selectedSchoolCode = canonicalSchoolCode(button.dataset.school);
    state.gallery.schoolCode = state.selectedSchoolCode;
    state.gallery.recordKey = '';
    state.view = 'photos';
    render();
  }
  if (action === 'show-record-photos') {
    const record = (state.remote?.records || []).find((item) => recordKeyOf(item) === button.dataset.record);
    if (!record) throw new Error('El registro ya no esta disponible.');
    state.selectedSchoolCode = record.codigoEscuela;
    state.gallery.schoolCode = record.codigoEscuela;
    state.gallery.recordKey = recordKeyOf(record);
    state.view = 'photos';
    render();
  }
  if (action === 'open-gallery-photo') await openGalleryPhoto(button.dataset.photo);
  if (action === 'retry-gallery-photo') {
    const photo = (state.remote?.photos || []).find((item) => item.fotoId === button.dataset.photo);
    if (photo) {
      delete state.gallery.content[photo.fotoId];
      render();
    }
  }
  if (action === 'reload-gallery') {
    state.gallery.content = {};
    try {
      await loadRemoteRecords(false);
      render();
      toast('Fotografias actualizadas.', 'success');
    } catch (error) {
      render();
      throw error;
    }
  }
  if (action === 'save-draft') await saveActiveDraft();
  if (action === 'capture-photo') {
    updateDraftFromForm();
    document.querySelector(`[data-photo-input="${button.dataset.photoType}"]`)?.click();
  }
  if (action === 'remove-photo') await removePhoto(button.dataset.photo);
  if (action === 'capture-location') await captureDraftLocation();
  if (action === 'locate') await locateOnMap();
  if (action === 'locate-journal') await locateOnMap();
  if (action === 'open-draft') await openDraft(button.dataset.draft);
  if (action === 'edit-record') await openRemoteRecord(button.dataset.record);
  if (action === 'delete-draft') await deleteDraft(button.dataset.draft);
  if (action === 'sync') await syncQueue();
  if (action === 'reload-records') {
    try {
      await loadRemoteRecords(false);
      render();
      toast('Registros actualizados.', 'success');
    } catch (error) {
      render();
      throw error;
    }
  }
  if (action === 'reload-admin') await loadAdmin(true);
  if (action === 'new-user') {
    state.editingUserCode = '';
    render();
    document.querySelector('#user-editor input[name="codigoCensista"]')?.focus();
  }
  if (action === 'edit-user') {
    state.editingUserCode = button.dataset.user;
    render();
    document.querySelector('#user-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  if (action === 'cancel-user-edit') {
    state.editingUserCode = '';
    render();
  }
  if (action === 'toggle-user') await toggleUser(button.dataset.user, button.dataset.active === 'true');
  if (action === 'toggle-availability') await toggleAvailability(button.dataset.user, button.dataset.available === 'true');
  if (action === 'balance-logistics') balanceLogistics();
  if (action === 'undo-logistics') {
    state.logisticsDraft = { ...state.logisticsOriginal };
    render();
    toast('Cambios de asignacion descartados.', 'info');
  }
  if (action === 'save-logistics') await saveLogistics();
  if (action === 'export-logistics') exportLogistics();
  if (action === 'export-rue') await exportRueCompatibility();
  if (action === 'review-access') await reviewAccess(button.dataset.request, button.dataset.status);
  if (action === 'copy-incident-template') await copyIncidentTemplate();
  if (action === 'install') await installApp();
  if (action === 'logout') await logout();
}

async function copyIncidentTemplate() {
  try {
    await navigator.clipboard.writeText(INCIDENT_REPORT_TEMPLATE);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = INCIDENT_REPORT_TEMPLATE;
    textarea.setAttribute('readonly', '');
    textarea.className = 'clipboard-fallback';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  toast('Plantilla de incidencia copiada.', 'success');
}

async function saveActiveDraft() {
  updateDraftFromForm();
  const photoNotes = new Map([...document.querySelectorAll('[data-photo-note]')].map((input) => [input.dataset.photoNote, input.value.trim()]));
  state.activeDraft.photos = state.activeDraft.photos.map((photo) => ({ ...photo, notas: photoNotes.get(photo.fotoId) || photo.notas || '' }));
  await database.saveDraft(state.activeDraft);
  await refreshLocalState();
  toast('Borrador guardado en este celular.', 'success');
}

async function handlePhotoInput(input) {
  const file = input.files?.[0];
  input.value = '';
  if (!file || !state.activeDraft) return;
  const type = input.dataset.photoInput;
  updateDraftFromForm();
  const recordId = calculateRecordId(state.activeDraft);
  if (!recordId) throw new Error('Complete escuela, bloque, piso, espacio y hoja antes de abrir la camara.');
  if (!/^\d+$/.test(state.activeDraft.numeroElemento)) throw new Error('Indique el numero del elemento fotografiado.');
  const sequence = nextPhotoSequence(state.activeDraft);
  const elementType = type === 'HOJA_PAPEL' ? 'HOJA_PAPEL' : state.activeDraft.tipoElemento;
  const elementNumber = type === 'HOJA_PAPEL' ? state.activeDraft.numeroHoja : state.activeDraft.numeroElemento;
  const codigoElemento = `${elementCode(elementType)}${digits(elementNumber).padStart(2, '0')}`;
  const codigoFoto = `${recordId}-${codigoElemento}-FT${String(sequence).padStart(2, '0')}`;
  const stamp = {
    recordId,
    codigoFoto,
    codigoEscuela: state.activeDraft.codigoEscuela,
    numeroFormulario: state.activeDraft.numeroFormulario,
    numeroHoja: state.activeDraft.numeroHoja,
    bloque: digits(state.activeDraft.bloque).padStart(2, '0'),
    piso: digits(state.activeDraft.piso).padStart(2, '0'),
    espacio: digits(state.activeDraft.espacio).padStart(3, '0'),
    codigoElemento,
    tipoElementoLabel: elementLabel(elementType),
    timestampLabel: new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date())
  };
  toast('Preparando la imagen...', 'info', 1800);
  const prepared = await prepareImage(file, type, stamp);
  if (state.activeDraft.photos.some((photo) => photo.sha256 === prepared.sha256)) {
    throw new Error('Esta misma fotografia ya fue agregada al registro.');
  }
  const fotoId = crypto.randomUUID();
  const blobId = await database.saveBlob(prepared.blob, { fotoId, sha256: prepared.sha256 });
  state.activeDraft.photos.push({
    fotoId,
    idempotencyKey: crypto.randomUUID(),
    blobId,
    tipoFoto: type,
    tipoElemento: elementType,
    numeroElemento: digits(elementNumber),
    codigoElemento,
    codigoFoto,
    secuencia: sequence,
    etiquetaImpresa: true,
    mimeType: prepared.mimeType,
    bytes: prepared.bytes,
    width: prepared.width,
    height: prepared.height,
    sha256: prepared.sha256,
    originalName: prepared.originalName,
    capturedAt: prepared.capturedAt,
    imageHeight: prepared.imageHeight,
    footerHeight: prepared.footerHeight,
    notas: ''
  });
  await database.saveDraft(state.activeDraft);
  await refreshLocalState();
  if (type !== 'HOJA_PAPEL') {
    state.activeDraft.numeroElemento = String(Number(state.activeDraft.numeroElemento || 0) + 1);
    await database.saveDraft(state.activeDraft);
  }
  render();
  toast('Fotografia agregada.', 'success');
}

async function removePhoto(fotoId) {
  const photo = state.activeDraft?.photos.find((item) => item.fotoId === fotoId);
  if (!photo || !confirm('¿Quitar esta fotografia del borrador?')) return;
  await database.deleteBlob(photo.blobId);
  state.activeDraft.photos = state.activeDraft.photos.filter((item) => item.fotoId !== fotoId);
  await database.saveDraft(state.activeDraft);
  await refreshLocalState();
  render();
}

async function captureDraftLocation() {
  updateDraftFromForm();
  const location = await captureLocation();
  if (!location) throw new Error('No se pudo obtener el GPS. Revise el permiso de ubicacion.');
  state.activeDraft.location = location;
  render();
  toast(`Ubicacion obtenida con precision aproximada de ${location.precisionM} m.`, 'success');
}

async function locateOnMap() {
  const location = await captureLocation();
  if (!location) throw new Error('No se pudo obtener el GPS. Revise el permiso de ubicacion.');
  state.location = location;
  render();
  toast('Lista ordenada por distancia a su ubicacion.', 'success');
}

async function openDraft(draftId) {
  state.activeDraft = await database.get('drafts', draftId);
  state.selectedSchoolCode = state.activeDraft?.codigoEscuela || '';
  state.view = 'register';
  render();
}

async function openRemoteRecord(recordKey) {
  const record = (state.remote?.records || []).find((item) => recordKeyOf(item) === recordKey);
  if (!record || !isOwnRecord(record)) {
    throw new Error('Este registro no puede editarse con la sesion actual.');
  }
  const photos = (state.remote?.photos || [])
    .filter((photo) => recordKeyOf(photo) === recordKey)
    .sort((left, right) => Number(left.secuencia || 0) - Number(right.secuencia || 0))
    .map((photo) => ({ ...photo, synced: true, blobId: '' }));
  state.activeDraft = {
    draftId: crypto.randomUUID(),
    sourceRecordKey: recordKeyOf(record),
    idempotencyKey: crypto.randomUUID(),
    codigoEscuela: canonicalSchoolCode(record.codigoEscuela),
    numeroFormulario: record.numeroFormulario,
    numeroHoja: record.numeroHoja,
    bloque: record.bloque,
    piso: record.piso,
    espacio: record.espacio,
    tipoEspacio: record.tipoEspacio,
    tipoElemento: 'AMBIENTE',
    numeroElemento: '1',
    estado: record.estado,
    observaciones: record.observaciones || '',
    danosFallas: record.danosFallas || '',
    location: null,
    photos,
    createdAt: record.createdAt || new Date().toISOString(),
    startedAt: record.startedAt || record.createdAt || new Date().toISOString(),
    completedAt: record.completedAt || '',
    durationSeconds: Number(record.durationSeconds || 0)
  };
  state.selectedSchoolCode = record.codigoEscuela;
  state.view = 'register';
  render();
}

async function deleteDraft(draftId) {
  if (!confirm('¿Eliminar este borrador y sus fotos locales? Esta accion no se puede deshacer.')) return;
  const draft = await database.get('drafts', draftId);
  for (const photo of draft?.photos || []) {
    if (photo.blobId) await database.deleteBlob(photo.blobId);
  }
  await database.delete('drafts', draftId);
  await refreshLocalState();
  render();
  toast('Borrador eliminado.', 'success');
}

async function reviewAccess(requestId, status) {
  await api.reviewAccess(requestId, status);
  await loadAdmin(true);
  toast(`Solicitud ${status === 'APROBADA' ? 'aprobada' : 'rechazada'}.`, 'success');
}

async function installApp() {
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  render();
}

async function logout() {
  if (state.queue.length && !confirm('Hay datos pendientes en este celular. ¿Cerrar sesion de todos modos?')) return;
  try { await api.logout(); } catch { /* El cierre local sigue siendo valido. */ }
  setSession(null);
  state.bootstrap = null;
  state.remote = { records: [], photos: [] };
  state.gallery = { schoolCode: '', recordKey: '', content: {} };
  state.admin = null;
  state.editingUserCode = '';
  state.logisticsOriginal = {};
  state.logisticsDraft = {};
  state.logisticsInitialized = false;
  state.view = 'schools';
  render();
}

function handleChange(event) {
  const gallerySchool = event.target.closest('[data-gallery-school]');
  if (gallerySchool) {
    state.gallery.schoolCode = canonicalSchoolCode(gallerySchool.value);
    state.gallery.recordKey = '';
    state.selectedSchoolCode = state.gallery.schoolCode;
    render();
    return;
  }
  const galleryRecord = event.target.closest('[data-gallery-record]');
  if (galleryRecord) {
    state.gallery.recordKey = galleryRecord.value;
    render();
    return;
  }
  const adminFilter = event.target.closest('[data-admin-filter]');
  if (adminFilter) {
    state.adminFilters[adminFilter.dataset.adminFilter] = adminFilter.value;
    if (adminFilter.dataset.adminFilter === 'logisticsDepartment') {
      state.adminFilters.logisticsDistrict = '';
    }
    render();
    return;
  }
  const assignment = event.target.closest('[data-logistics-assignment]');
  if (assignment) {
    const scrollPosition = window.scrollY;
    state.logisticsDraft[assignment.dataset.logisticsAssignment] = assignment.value;
    render();
    requestAnimationFrame(() => window.scrollTo({ top: scrollPosition }));
    return;
  }
  const planningSetting = event.target.closest('[data-planning-setting]');
  if (planningSetting) {
    const minimum = Number(planningSetting.min || 1);
    const maximum = Number(planningSetting.max || Number.MAX_SAFE_INTEGER);
    state.planningSettings[planningSetting.dataset.planningSetting] = Math.min(
      maximum,
      Math.max(minimum, Number(planningSetting.value || minimum))
    );
    saveJson('cialpa-fotos-planning-settings-v1', state.planningSettings);
    render();
    return;
  }
  const filter = event.target.closest('[data-filter]');
  if (filter) {
    state.filters[filter.dataset.filter] = filter.value;
    render();
    return;
  }
  const photoInput = event.target.closest('[data-photo-input]');
  if (photoInput) handlePhotoInput(photoInput).catch((error) => toast(error.message, 'error'));
  if (event.target.closest('#record-form')) updateDraftFromForm();
}

let searchTimer;
function handleInput(event) {
  const schoolFilter = event.target.closest('[data-filter="search"]');
  const adminFilter = event.target.closest('[data-admin-filter$="Search"]');
  const filter = schoolFilter || adminFilter;
  if (!filter) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (schoolFilter) state.filters.search = filter.value;
    if (adminFilter) state.adminFilters[adminFilter.dataset.adminFilter] = filter.value;
    render();
    const selector = schoolFilter
      ? '[data-filter="search"]'
      : `[data-admin-filter="${adminFilter.dataset.adminFilter}"]`;
    const input = document.querySelector(selector);
    input?.focus();
    input?.setSelectionRange?.(input.value.length, input.value.length);
  }, 180);
}

function canonicalSchoolCode(code) {
  return canonicalAppSchoolCode(state.catalog, code);
}

function schoolByCode(code) {
  return findSchoolByCode(state.catalog, code);
}

function normalizeBootstrapSchoolCodes(data = {}) {
  const statusPriority = { PENDIENTE: 0, FINALIZADO: 1, EN_PROCESO: 2, CON_PENDIENTES: 3 };
  const progress = {};
  Object.entries(data.progress || {}).forEach(([code, item]) => {
    const canonical = canonicalSchoolCode(code);
    if (!canonical) return;
    const previous = progress[canonical] || { registros: 0, fotos: 0, estado: 'PENDIENTE' };
    const incomingStatus = String(item?.estado || 'PENDIENTE').toUpperCase();
    progress[canonical] = {
      ...previous,
      ...item,
      registros: Math.max(Number(previous.registros || 0), Number(item?.registros || 0)),
      fotos: Math.max(Number(previous.fotos || 0), Number(item?.fotos || 0)),
      estado: (statusPriority[incomingStatus] || 0) >= (statusPriority[previous.estado] || 0)
        ? incomingStatus
        : previous.estado
    };
  });
  const assignedCodes = [...new Set((data.assignedCodes || []).map(canonicalSchoolCode).filter(Boolean))];
  const role = String(data.user?.rol || '').toUpperCase();
  const allowedSchools = new Set(assignedCodes);
  const scopedProgress = role === 'ADMIN'
    ? progress
    : Object.fromEntries(Object.entries(progress).filter(([code]) => allowedSchools.has(code)));
  const recentRecords = (data.recentRecords || []).map((record) => ({
    ...record,
    codigoEscuela: canonicalSchoolCode(record.codigoEscuela)
  })).filter((record) => role === 'ADMIN' || allowedSchools.has(record.codigoEscuela));
  return {
    ...data,
    assignedCodes,
    showAllSchools: role === 'ADMIN',
    progress: scopedProgress,
    recentRecords
  };
}

function normalizeRemoteSchoolCodes(data = {}) {
  const normalizeItem = (item) => ({
    ...item,
    codigoEscuela: canonicalSchoolCode(item.codigoEscuela),
    codigoRue: item.codigoRue || schoolByCode(item.codigoEscuela)?.codigoRue || normalizeRueSchoolCode(item.codigoEscuela),
    sitioId: item.sitioId || schoolByCode(item.codigoEscuela)?.sitioId || ''
  });
  const role = String((state.bootstrap?.user || state.session?.user || {}).rol || '').toUpperCase();
  const allowedSchools = new Set((state.bootstrap?.assignedCodes || []).map(canonicalSchoolCode).filter(Boolean));
  const records = (data.records || []).map(normalizeItem)
    .filter((item) => role === 'ADMIN' || allowedSchools.has(item.codigoEscuela));
  const recordKeys = new Set(records.map(recordKeyOf).filter(Boolean));
  const photos = (data.photos || []).map(normalizeItem).filter((item) => {
    if (role === 'ADMIN') return true;
    const key = recordKeyOf(item);
    return (key && recordKeys.has(key)) || allowedSchools.has(item.codigoEscuela);
  });
  const recordCodes = new Set(records.map((record) => record.codigoEscuela).filter(Boolean));
  const schools = (data.schools || []).map((school) => {
    const code = canonicalSchoolCode(school.codigo || school.codigoRue);
    const catalogSchool = schoolByCode(code);
    return {
      ...(catalogSchool || {}),
      ...school,
      codigo: code,
      codigoRue: school.codigoRue || catalogSchool?.codigoRue || normalizeRueSchoolCode(code),
      sitioId: school.sitioId || catalogSchool?.sitioId || ''
    };
  }).filter((school) => school.codigo && recordCodes.has(school.codigo));
  return {
    ...data,
    records,
    photos,
    schools
  };
}

function normalizeAdminSchoolCodes(data = {}) {
  const assignments = (data.assignments || []).map((assignment) => ({
    ...assignment,
    codigoEscuela: canonicalSchoolCode(assignment.codigoEscuela)
  }));
  if (!supervisorMode()) return { ...data, assignments };

  const current = state.bootstrap?.user || {};
  const team = String(current.equipo || '').trim();
  const users = (data.users || []).filter((user) => team && String(user.equipo || '').trim() === team);
  const allowedUsers = new Set(users.map((user) => String(user.codigoCensista)));
  const allowedSchools = new Set((state.bootstrap?.assignedCodes || []).map(canonicalSchoolCode).filter(Boolean));
  const scopedAssignments = assignments.filter((assignment) => allowedUsers.has(String(assignment.codigoCensista))
    && allowedSchools.has(assignment.codigoEscuela));
  const records = (data.records || []).map((record) => ({
    ...record,
    codigoEscuela: canonicalSchoolCode(record.codigoEscuela)
  })).filter((record) => allowedUsers.has(String(record.codigoCensista)) && allowedSchools.has(record.codigoEscuela));
  const surveyorSummary = (data.surveyorSummary || []).filter((item) => allowedUsers.has(String(item.codigoCensista)));
  const requests = (data.requests || []).filter((request) => allowedUsers.has(String(request.codigoCensista)));
  const performance = {
    ...(data.performance || {}),
    individuals: (data.performance?.individuals || []).filter((item) => allowedUsers.has(String(item.codigoCensista))),
    teams: (data.performance?.teams || []).filter((item) => String(item.equipo || '').trim() === team)
  };
  return {
    ...data,
    counts: {
      usuarios: users.length,
      asignaciones: scopedAssignments.filter((item) => item.activo !== false).length,
      registros: records.length,
      fotos: surveyorSummary.reduce((sum, item) => sum + Number(item.fotos || 0), 0),
      fotosTotales: Number(data.counts?.fotosTotales || 0),
      fotosHuerfanas: Number(data.dataQuality?.photosOrphaned || data.counts?.fotosHuerfanas || 0),
      solicitudesPendientes: requests.filter((item) => item.estado === 'PENDIENTE').length
    },
    users,
    assignments: scopedAssignments,
    requests,
    surveyorSummary,
    records,
    photoRootUrl: '',
    performance
  };
}

function calculateRecordId(draft) {
  const schoolCode = canonicalSchoolCode(draft?.codigoEscuela);
  if (!schoolCode) return '';
  const values = [draft.bloque, draft.piso, draft.espacio, draft.numeroHoja];
  if (values.some((value) => !/^\d+$/.test(String(value || '')))) return '';
  return `${schoolCode}-B${digits(draft.bloque).padStart(2, '0')}-P${digits(draft.piso).padStart(2, '0')}-E${digits(draft.espacio).padStart(3, '0')}-H${digits(draft.numeroHoja).padStart(2, '0')}`;
}

function digits(value) { return String(value || '').replace(/\D/g, ''); }

function normalizedCensistaCode(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'admin' ? normalized : digits(normalized);
}

function currentUserCode() {
  return normalizedCensistaCode((state.bootstrap?.user || state.session?.user || {}).codigoCensista);
}

function recordKeyOf(record) {
  const explicit = String(record?.recordKey || '').trim();
  if (explicit) return explicit;
  const owner = normalizedCensistaCode(record?.codigoCensista);
  const recordId = String(record?.recordId || '').trim();
  return owner && recordId ? `${owner}:${recordId}` : '';
}

function isOwnRecord(record) {
  const owner = normalizedCensistaCode(record?.codigoCensista);
  return Boolean(owner && currentUserCode() && owner === currentUserCode());
}

function loginCode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'admin' ? normalized : digits(normalized);
}

function spaceOptions(selected) {
  const options = [
    ['PLANTA_GENERAL', 'Planta general'], ['AULA', 'Aula'], ['ADMINISTRACION', 'Administracion'],
    ['BIBLIOTECA', 'Biblioteca'], ['COCINA_COMEDOR', 'Cocina / comedor'], ['DEPOSITO', 'Deposito'],
    ['LABORATORIO', 'Laboratorio'], ['TALLER', 'Taller'], ['SANITARIO', 'Sanitario'],
    ['PASILLO', 'Pasillo / circulacion'], ['EXTERIOR', 'Exterior'], ['OTRO', 'Otro']
  ];
  return options.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
}

function elementOptions(selected) {
  const options = [
    ['AMBIENTE', 'Vista general del espacio'], ['PARED', 'Pared'], ['TABIQUE', 'Tabique'],
    ['PUERTA', 'Puerta'], ['VENTANA', 'Ventana'], ['PILAR', 'Pilar / columna'],
    ['ESCALERA', 'Escalera'], ['RAMPA', 'Rampa'], ['INODORO', 'Inodoro'],
    ['LAVAMANOS', 'Lavamanos'], ['URINARIO', 'Urinario'], ['DUCHA', 'Ducha'],
    ['LUZ', 'Luz / luminaria'], ['INTERRUPTOR', 'Interruptor'], ['TOMACORRIENTE', 'Tomacorriente'],
    ['VENTILADOR', 'Ventilador'], ['AIRE_ACONDICIONADO', 'Aire acondicionado'],
    ['TABLERO_ELECTRICO', 'Tablero electrico'], ['PUNTO_AGUA', 'Punto de agua'],
    ['DESAGUE', 'Desague'], ['DANO_FALLA', 'Dano / falla'], ['OTRO', 'Otro elemento']
  ];
  return options.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
}

function elementCode(type) {
  return ({
    AMBIENTE: 'AM', PARED: 'MU', TABIQUE: 'TA', PUERTA: 'PT', VENTANA: 'VN', PILAR: 'PI',
    ESCALERA: 'ES', RAMPA: 'RM', INODORO: 'WC', LAVAMANOS: 'LV', URINARIO: 'UR', DUCHA: 'DU',
    LUZ: 'LU', INTERRUPTOR: 'IN', TOMACORRIENTE: 'TC', VENTILADOR: 'VE',
    AIRE_ACONDICIONADO: 'AA', TABLERO_ELECTRICO: 'TE', PUNTO_AGUA: 'AP', DESAGUE: 'DG',
    DANO_FALLA: 'DF', HOJA_PAPEL: 'HP', OTRO: 'OT'
  })[type] || 'OT';
}

function elementLabel(type) {
  return ({
    AMBIENTE: 'Vista general', PARED: 'Pared', TABIQUE: 'Tabique', PUERTA: 'Puerta', VENTANA: 'Ventana',
    PILAR: 'Pilar', ESCALERA: 'Escalera', RAMPA: 'Rampa', INODORO: 'Inodoro', LAVAMANOS: 'Lavamanos',
    URINARIO: 'Urinario', DUCHA: 'Ducha', LUZ: 'Luz', INTERRUPTOR: 'Interruptor',
    TOMACORRIENTE: 'Tomacorriente', VENTILADOR: 'Ventilador', AIRE_ACONDICIONADO: 'Aire acondicionado',
    TABLERO_ELECTRICO: 'Tablero electrico', PUNTO_AGUA: 'Punto de agua', DESAGUE: 'Desague',
    DANO_FALLA: 'Dano / falla', HOJA_PAPEL: 'Hoja en papel', OTRO: 'Otro elemento'
  })[type] || type || 'Elemento';
}

function calculateNextPhotoCode(draft) {
  const recordId = calculateRecordId(draft);
  if (!recordId || !/^\d+$/.test(String(draft.numeroElemento || ''))) return 'Complete la identificacion';
  return `${recordId}-${elementCode(draft.tipoElemento)}${digits(draft.numeroElemento).padStart(2, '0')}-FT${String(nextPhotoSequence(draft)).padStart(2, '0')}`;
}

function nextPhotoSequence(draft) {
  return Math.max(0, ...(draft?.photos || []).map(photoSequence)) + 1;
}

function photoSequence(photo) {
  const fromCode = String(photo?.codigoFoto || '').match(/-FT(\d+)$/);
  return Number(photo?.secuencia || fromCode?.[1] || 0);
}

function statusLabel(status = 'PENDIENTE') {
  return ({ PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', FINALIZADO: 'Finalizado', CON_PENDIENTES: 'Con pendientes' })[status] || status;
}

function requestStatusLabel(status = 'PENDIENTE') {
  return ({ PENDIENTE: 'Pendiente', APROBADA: 'Aprobada', RECHAZADA: 'Rechazada' })[status] || status;
}

function roleLabel(role = '') {
  return ({ ADMIN: 'Administrador', SUPERVISOR: 'Supervisor', ENCUESTADOR: 'Encuestador' })[role] || role;
}

function displayName(user = {}) {
  return [user.nombres, user.apellidos].filter(Boolean).join(' ') || user.codigoCensista || 'Usuario';
}

function elapsedSeconds(startedAt, completedAt = new Date().toISOString()) {
  const start = new Date(startedAt || '').getTime();
  const end = new Date(completedAt || '').getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.min(604800, Math.max(0, Math.round((end - start) / 1000)));
}

function elapsedMinutesLabel(startedAt) {
  const seconds = elapsedSeconds(startedAt);
  if (seconds < 60) return '< 1 min';
  return minutesLabel(seconds / 60);
}

function teamAssignmentOptions(users = []) {
  const active = users.filter((item) => item.activo && item.rol === 'ENCUESTADOR');
  const teams = new Map();
  const ungrouped = [];
  active.forEach((user) => {
    const team = String(user.equipo || '').trim();
    if (!team) {
      ungrouped.push(user);
      return;
    }
    if (!teams.has(team)) teams.set(team, []);
    teams.get(team).push(user);
  });
  const grouped = [...teams.entries()]
    .sort((left, right) => left[0].localeCompare(right[0], 'es', { numeric: true }))
    .map(([team, members]) => {
      const sorted = [...members]
        .sort((left, right) => String(left.codigoCensista).localeCompare(String(right.codigoCensista)));
      const representative = sorted[0];
      return {
        ...representative,
        nombres: team,
        apellidos: sorted.map((member) => displayName(member)).join(' / '),
        telefono: '',
        equipo: team,
        memberCodes: sorted.map((member) => String(member.codigoCensista))
      };
    });
  return [...grouped, ...ungrouped];
}

function initials(user = {}) {
  const parts = displayName(user).split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || 'U'}${parts[1]?.[0] || ''}`.toUpperCase();
}

function distanceKm(origin, destination) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const radius = 6371;
  const deltaLat = radians(destination.latitud - origin.latitud);
  const deltaLng = radians(destination.longitud - origin.longitud);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(origin.latitud)) * Math.cos(radians(destination.latitud)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat('es-PY', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Number(value || 0));
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

app.addEventListener('submit', handleSubmit);
app.addEventListener('click', (event) => handleClick(event).catch((error) => toast(error.message, 'error')));
app.addEventListener('change', handleChange);
app.addEventListener('input', handleInput);

window.addEventListener('online', () => {
  state.online = true;
  render();
  syncQueue({ quiet: false });
});
window.addEventListener('offline', () => {
  state.online = false;
  render();
  toast('Sin conexion. Puede seguir trabajando; los datos quedaran en este celular.', 'info');
});
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  state.installPrompt = event;
  if (state.session) render();
});

window.addEventListener('load', () => initializeAppUpdates().catch(() => {}));

boot();
