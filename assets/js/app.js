import { APP_CONFIG } from './config.js';
import { ApiClient, ApiError, getDeviceId } from './api.js';
import { LocalDatabase } from './db.js';
import { blobToBase64, captureLocation, prepareImage } from './image.js';
import { SchoolMap } from './map.js';

const app = document.querySelector('#app');
const toastRegion = document.querySelector('#toast-region');
const api = new ApiClient();
const database = new LocalDatabase();

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
  remote: { records: [], photos: [] },
  admin: null,
  adminLoading: false,
  syncing: false,
  installPrompt: null,
  online: navigator.onLine
};

api.setSession(state.session);

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
  element.innerHTML = `${icon(tone === 'error' ? 'circle-alert' : tone === 'success' ? 'circle-check' : 'info')}<span>${escapeHtml(message)}</span>`;
  toastRegion.append(element);
  refreshIcons();
  setTimeout(() => element.remove(), timeout);
}

function setSession(session) {
  state.session = session;
  api.setSession(session);
  saveJson(APP_CONFIG.sessionStorageKey, session);
}

async function boot() {
  try {
    await database.open();
    const [catalogResponse, health] = await Promise.all([
      fetch(APP_CONFIG.schoolCatalogUrl, { cache: 'no-cache' }).then((response) => {
        if (!response.ok) throw new Error('No se pudo cargar el catalogo de escuelas.');
        return response.json();
      }),
      api.health().catch((error) => ({ ok: false, error }))
    ]);
    state.catalogMeta = catalogResponse;
    state.catalog = catalogResponse.schools || [];
    state.health = health;
    await refreshLocalState();
    if (state.session && new Date(state.session.expiresAt || 0) > new Date()) {
      await loadBootstrap(true);
      await loadRemoteRecords(true);
    } else if (state.session) {
      setSession(null);
    }
    render();
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
  try {
    state.bootstrap = await api.bootstrap();
    saveJson('cialpa-fotos-bootstrap-cache-v1', state.bootstrap);
  } catch (error) {
    const cached = loadJson('cialpa-fotos-bootstrap-cache-v1');
    if (allowCache && cached) {
      state.bootstrap = cached;
      toast('Sin conexion: se muestran las asignaciones guardadas en este celular.', 'info');
      return;
    }
    if (['AUTH_REQUIRED', 'SESSION_EXPIRED', 'AUTH_INVALID'].includes(error.code)) {
      setSession(null);
      state.bootstrap = null;
      toast('La sesion vencio. Ingrese nuevamente.', 'error');
      return;
    }
    throw error;
  }
}

async function loadRemoteRecords(allowCache = false) {
  const user = state.bootstrap?.user || state.session?.user;
  if (!user) return;
  try {
    state.remote = await api.listRecords({ codigoCensista: user.codigoCensista });
    saveJson(APP_CONFIG.recordsCacheKey, { codigoCensista: user.codigoCensista, data: state.remote });
  } catch (error) {
    const cached = loadJson(APP_CONFIG.recordsCacheKey);
    if (allowCache && cached?.codigoCensista === user.codigoCensista) {
      state.remote = cached.data || { records: [], photos: [] };
      return;
    }
    if (allowCache) {
      state.remote = { records: [], photos: [] };
      return;
    }
    throw error;
  }
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
        ${APP_CONFIG.demo ? `<div class="alert alert-info">${icon('flask-conical')} Prueba local: cedula <strong>1234567</strong>, PIN <strong>1234</strong>.</div>` : ''}
        <form data-form="login" class="form-stack">
          <label>Codigo de censista / cedula
            <input name="codigoCensista" inputmode="numeric" autocomplete="username" required minlength="5" maxlength="12" placeholder="Solo numeros">
          </label>
          <label>PIN
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
            <label>Codigo / cedula<input name="codigoCensista" inputmode="numeric" required maxlength="12"></label>
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
            <label>Codigo / cedula<input name="codigoCensista" inputmode="numeric" required></label>
            <label>Nombres<input name="nombres" required></label>
            <label>Apellidos<input name="apellidos" required></label>
            <label>PIN nuevo<input name="pin" type="password" inputmode="numeric" minlength="4" maxlength="12" required></label>
            <button class="btn btn-secondary full-row" type="submit">${icon('shield-plus')} Crear administrador</button>
          </form>
        </details>` : ''}
        <p class="version-line">Version ${APP_CONFIG.version} · ${APP_CONFIG.buildDate}</p>
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
    ['pending', 'clipboard-list', 'Mi trabajo'],
    ...(canAdmin ? [['admin', 'users', 'Administrar']] : []),
    ['account', 'circle-user-round', 'Cuenta']
  ];
  return `<header class="topbar">
      <button class="brand-button" data-view="schools" aria-label="Ir a escuelas">
        <img src="./assets/img/logo.png" alt="" width="72">
        <span><strong>CIALPA Fotos</strong><small>Registro de campo</small></span>
      </button>
      <div class="topbar-actions">
        <span class="network-chip ${state.online ? 'is-online' : 'is-offline'}">${icon(state.online ? 'wifi' : 'wifi-off', 15)} ${state.online ? 'En linea' : 'Sin conexion'}</span>
        <button class="icon-btn sync-button ${state.queue.length ? 'has-badge' : ''}" data-action="sync" title="Sincronizar pendientes" aria-label="Sincronizar pendientes">
          ${icon('refresh-cw')}<span class="button-badge">${state.queue.length}</span>
        </button>
        <a class="icon-btn" href="${APP_CONFIG.manualUrl}" target="_blank" rel="noopener" title="Manual del censista" aria-label="Abrir manual del censista">${icon('circle-help')}</a>
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
      <div class="side-footer">v${APP_CONFIG.version}</div>
    </aside>
    <main class="main-content" id="main-content">${renderCurrentView()}</main>
    <nav class="bottom-nav" aria-label="Navegacion movil">
      ${navItems.map(([view, iconName, label]) => navButton(view, iconName, label, true)).join('')}
    </nav>`;
}

function navButton(view, iconName, label, mobile = false) {
  const active = state.view === view;
  return `<button data-view="${view}" class="nav-button ${active ? 'is-active' : ''}" ${active ? 'aria-current="page"' : ''}>
    ${icon(iconName, mobile ? 20 : 18)}<span>${label}</span>
    ${view === 'pending' && state.queue.length ? `<b>${state.queue.length}</b>` : ''}
  </button>`;
}

function renderCurrentView() {
  if (state.view === 'register') return renderRegister();
  if (state.view === 'pending') return renderPending();
  if (state.view === 'admin') return renderAdmin();
  if (state.view === 'account') return renderAccount();
  return renderSchools();
}

function availableSchools() {
  if (!state.bootstrap) return [];
  if (state.bootstrap.showAllSchools) return state.catalog;
  const assigned = new Set(state.bootstrap.assignedCodes || []);
  return state.catalog.filter((school) => assigned.has(school.codigo));
}

function filteredSchools() {
  const search = state.filters.search.trim().toLocaleLowerCase('es');
  const progress = state.bootstrap?.progress || {};
  let schools = availableSchools().filter((school) => {
    const haystack = `${school.codigo} ${school.nombre} ${school.distrito} ${school.localidad}`.toLocaleLowerCase('es');
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
      <label class="search-field">${icon('search')}<input data-filter="search" value="${escapeHtml(state.filters.search)}" placeholder="Codigo, escuela, distrito..."></label>
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
  return `<article class="selected-school">
    <button class="icon-btn close-selected" data-action="clear-school" title="Cerrar detalle">${icon('x')}</button>
    <span class="status-pill status-${(progress.estado || 'PENDIENTE').toLowerCase()}">${statusLabel(progress.estado || 'PENDIENTE')}</span>
    <h2>${escapeHtml(school.nombre)}</h2>
    <p><strong>${escapeHtml(school.codigo)}</strong> · ${escapeHtml(school.distrito)} · ${escapeHtml(school.localidad)}</p>
    <div class="selected-school-stats"><span>${progress.registros || 0} registros</span><span>${progress.fotos || 0} fotos</span></div>
    <div class="button-row">
      <button class="btn btn-primary" data-action="start-record" data-school="${school.codigo}">${icon('camera')} Registrar</button>
      <a class="btn btn-secondary" href="https://www.google.com/maps/dir/?api=1&destination=${school.latitud},${school.longitud}" target="_blank" rel="noopener">${icon('navigation')} Ir</a>
    </div>
  </article>`;
}

function renderSchoolRow(school) {
  const progress = state.bootstrap?.progress?.[school.codigo] || {};
  const active = state.selectedSchoolCode === school.codigo;
  return `<button class="school-row ${active ? 'is-active' : ''}" data-action="select-school" data-school="${school.codigo}">
    <span class="school-status-dot status-${(progress.estado || 'PENDIENTE').toLowerCase()}"></span>
    <span class="school-row-main"><strong>${escapeHtml(school.nombre)}</strong><small>${escapeHtml(school.codigo)} · ${escapeHtml(school.distrito)}</small></span>
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
  return `<section class="view view-register">
    <div class="view-heading">
      <div><p class="eyebrow">Registro progresivo</p><h1>${draft.sourceRecordKey || (draft.draftId && state.drafts.some((item) => item.draftId === draft.draftId)) ? 'Continuar registro' : 'Nuevo registro'}</h1><p>Identificador: <strong class="record-code">${escapeHtml(recordId || 'Complete los numeros requeridos')}</strong></p></div>
      <button class="btn btn-secondary" data-action="save-draft">${icon('save')} Guardar borrador</button>
    </div>
    <form id="record-form" data-form="record" class="record-layout" novalidate>
      <section class="form-panel">
        <div class="panel-heading"><span class="step-number">1</span><div><h2>Relacion con la ficha</h2><p>Use exactamente los numeros escritos en el papel.</p></div></div>
        <div class="form-grid two-cols">
          <label class="full-row">Escuela
            <select name="codigoEscuela" required>
              ${schools.map((item) => `<option value="${item.codigo}" ${item.codigo === draft.codigoEscuela ? 'selected' : ''}>${escapeHtml(item.codigo)} · ${escapeHtml(item.nombre)}</option>`).join('')}
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
        ${school ? `<div class="school-context">${icon('school')}<span><strong>${escapeHtml(school.nombre)}</strong><small>${escapeHtml(school.distrito)} · ${escapeHtml(school.localidad)}</small></span></div>` : ''}
      </section>
      <section class="form-panel photo-panel">
        <div class="panel-heading"><span class="step-number">2</span><div><h2>Fotografias</h2><p>Cada imagen conservara el identificador del registro.</p></div><span class="count-badge">${draft.photos.length}</span></div>
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
      </section>
      <div class="record-actions">
        <div><strong>${draft.photos.length} foto${draft.photos.length === 1 ? '' : 's'}</strong><small>${state.online ? 'Se sincronizara al finalizar' : 'Quedara en cola hasta recuperar conexion'}</small></div>
        <button class="btn btn-primary btn-large" type="submit">${icon(state.online ? 'cloud-upload' : 'archive')} Finalizar y ${state.online ? 'sincronizar' : 'guardar en cola'}</button>
      </div>
    </form>
  </section>`;
}

function newDraft(code = '') {
  return {
    draftId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    codigoEscuela: code,
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
    createdAt: new Date().toISOString()
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
      <div class="photo-copy"><strong>${escapeHtml(photo.codigoFoto)}</strong><small>${escapeHtml(elementLabel(photo.tipoElemento))} ${escapeHtml(photo.numeroElemento || '')} · ${formatBytes(photo.bytes)}</small><span class="synced-label">${icon('cloud-check', 14)} Sincronizada</span></div>
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
  return `<section class="view">
    <div class="view-heading"><div><p class="eyebrow">Continuidad de campo</p><h1>Mi trabajo</h1><p>${remoteRecords.length} registros sincronizados · ${state.drafts.length} borradores · ${state.queue.length} operaciones en cola</p></div><div class="button-row"><button class="btn btn-secondary" data-action="reload-records">${icon('rotate-cw')} Actualizar</button><button class="btn btn-primary" data-action="sync" ${!state.queue.length || state.syncing ? 'disabled' : ''}>${icon('refresh-cw')} ${state.syncing ? 'Sincronizando...' : 'Sincronizar ahora'}</button></div></div>
    <div class="summary-strip">
      <div><span>Borradores</span><strong>${state.drafts.length}</strong></div>
      <div><span>Registros en cola</span><strong>${state.queue.filter((item) => item.action === 'saveRecord').length}</strong></div>
      <div><span>Fotos en cola</span><strong>${state.queue.filter((item) => item.action === 'uploadPhoto').length}</strong></div>
      <div><span>Con error</span><strong>${state.queue.filter((item) => item.lastError).length}</strong></div>
    </div>
    <section class="content-section">
      <div class="section-heading"><div><h2>Borradores locales</h2><p>Registros que todavia pueden modificarse.</p></div></div>
      <div class="draft-list">${state.drafts.length ? state.drafts.map(renderDraftRow).join('') : renderEmpty('file-check-2', 'No hay borradores.', 'Los registros incompletos apareceran aqui.')}</div>
    </section>
    <section class="content-section">
      <div class="section-heading"><div><h2>Cola de sincronizacion</h2><p>Se procesa en orden: primero el registro y luego sus fotos.</p></div></div>
      <div class="queue-list">${state.queue.length ? state.queue.map(renderQueueRow).join('') : renderEmpty('cloud-check', 'Todo esta sincronizado.', 'No quedan datos pendientes en este celular.')}</div>
    </section>
    <section class="content-section">
      <div class="section-heading"><div><h2>Registros sincronizados</h2><p>Puede reabrir un registro propio para agregar evidencia sin perder su numeracion.</p></div></div>
      <div class="draft-list">${remoteRecords.length ? remoteRecords.map(renderSyncedRecordRow).join('') : renderEmpty('notebook-tabs', 'Aun no hay registros sincronizados.', 'Los registros recibidos por el servidor apareceran aqui.')}</div>
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
  const school = schoolByCode(record.codigoEscuela);
  const own = record.codigoCensista === (state.bootstrap?.user || state.session?.user || {}).codigoCensista;
  return `<article class="list-card"><div class="list-card-icon">${icon('cloud-check')}</div><div><strong>${escapeHtml(record.recordId)}</strong><span>${escapeHtml(school?.nombre || record.codigoEscuela)} · ${record.cantidadFotos || 0} fotos</span><small>${statusLabel(record.estado)} · ${formatDateTime(record.updatedAt || record.syncedAt)}</small></div>${own ? `<div class="list-card-actions"><button class="btn btn-secondary" data-action="continue-record" data-record="${escapeHtml(record.recordKey)}">${icon('pencil')} Continuar</button></div>` : ''}</article>`;
}

function renderAdmin() {
  const user = state.bootstrap?.user || {};
  if (!['ADMIN', 'SUPERVISOR'].includes(user.rol)) return renderEmpty('shield-alert', 'Acceso restringido.', 'Esta vista requiere rol de supervision o administracion.');
  if (!state.admin) return `<section class="view"><div class="view-heading"><div><p class="eyebrow">Control operativo</p><h1>Administracion</h1></div></div><div class="loading-panel"><div class="spinner"></div><p>Cargando avance y asignaciones...</p></div></section>`;
  const counts = state.admin.counts || {};
  return `<section class="view">
    <div class="view-heading"><div><p class="eyebrow">Control operativo</p><h1>Administracion</h1><p>Usuarios, asignaciones y avance del relevamiento fotografico.</p></div><div class="button-row">${state.admin.photoRootUrl ? `<a class="btn btn-secondary" href="${escapeHtml(state.admin.photoRootUrl)}" target="_blank" rel="noopener">${icon('folder-open')} Abrir fotos</a>` : ''}<button class="btn btn-secondary" data-action="reload-admin">${icon('refresh-cw')} Actualizar</button></div></div>
    <div class="summary-strip admin-summary">
      <div><span>Usuarios</span><strong>${counts.usuarios || 0}</strong></div><div><span>Asignaciones</span><strong>${counts.asignaciones || 0}</strong></div><div><span>Registros</span><strong>${counts.registros || 0}</strong></div><div><span>Fotos</span><strong>${counts.fotos || 0}</strong></div><div><span>Solicitudes</span><strong>${counts.solicitudesPendientes || 0}</strong></div>
    </div>
    <section class="content-section"><div class="section-heading"><div><h2>Avance por censista</h2><p>Resumen ordenado por cantidad de registros recibidos.</p></div></div>
      <div class="data-table-wrap"><table><thead><tr><th>Censista</th><th>Escuelas</th><th>Registros</th><th>Finalizados</th><th>Con pendientes</th><th>Fotos</th><th>Ultima carga</th></tr></thead><tbody>${(state.admin.surveyorSummary || []).map((item) => `<tr><td><strong>${escapeHtml(item.nombres)} ${escapeHtml(item.apellidos)}</strong><br><small>${escapeHtml(item.codigoCensista)}</small></td><td>${item.escuelasAsignadas || 0}</td><td>${item.registros || 0}</td><td>${item.finalizados || 0}</td><td>${item.conPendientes || 0}</td><td>${item.fotos || 0}</td><td>${formatDateTime(item.ultimaCarga)}</td></tr>`).join('') || '<tr><td colspan="7">Aun no hay usuarios.</td></tr>'}</tbody></table></div>
    </section>
    <div class="admin-grid">
      ${user.rol === 'ADMIN' ? `<section class="content-section"><div class="section-heading"><div><h2>Encuestadores</h2><p>El codigo es el numero de cedula.</p></div></div>
        <form data-form="save-user" class="form-grid two-cols compact-form">
          <label>Codigo / cedula<input name="codigoCensista" inputmode="numeric" required maxlength="12"></label>
          <label>PIN inicial<input name="pin" type="password" inputmode="numeric" minlength="4" maxlength="12" required></label>
          <label>Nombres<input name="nombres" required maxlength="80"></label><label>Apellidos<input name="apellidos" required maxlength="80"></label>
          <label>Rol<select name="rol"><option>ENCUESTADOR</option><option>SUPERVISOR</option><option>ADMIN</option></select></label>
          <label class="checkbox-label"><input name="activo" type="checkbox" checked> Usuario activo</label>
          <button class="btn btn-primary full-row" type="submit">${icon('user-plus')} Guardar usuario</button>
        </form>
        <div class="mini-table">${(state.admin.users || []).map((item) => `<div><span class="avatar small">${escapeHtml(initials(item))}</span><span><strong>${escapeHtml(displayName(item))}</strong><small>${escapeHtml(item.codigoCensista)} · ${roleLabel(item.rol)}</small></span><b class="status-pill ${item.activo ? 'status-finalizado' : 'status-pendiente'}">${item.activo ? 'Activo' : 'Inactivo'}</b></div>`).join('')}</div>
      </section>` : ''}
      <section class="content-section"><div class="section-heading"><div><h2>Asignar escuela</h2><p>Una escuela puede asignarse a mas de un censista.</p></div></div>
        <form data-form="save-assignment" class="form-grid compact-form">
          <label>Encuestador<select name="codigoCensista" required><option value="">Seleccione...</option>${(state.admin.users || []).filter((item) => item.activo).map((item) => `<option value="${item.codigoCensista}">${escapeHtml(displayName(item))} · ${escapeHtml(item.codigoCensista)}</option>`).join('')}</select></label>
          <label>Escuela<select name="codigoEscuela" required><option value="">Seleccione...</option>${state.catalog.map((school) => `<option value="${school.codigo}">${escapeHtml(school.codigo)} · ${escapeHtml(school.nombre)}</option>`).join('')}</select></label>
          <label class="checkbox-label"><input name="activo" type="checkbox" checked> Asignacion activa</label>
          <button class="btn btn-primary" type="submit">${icon('link')} Guardar asignacion</button>
        </form>
        <div class="mini-table assignments">${(state.admin.assignments || []).slice(-30).reverse().map((item) => `<div><span>${icon('school')}</span><span><strong>${escapeHtml(item.codigoEscuela)}</strong><small>${escapeHtml(item.codigoCensista)}</small></span><b class="status-pill ${item.activo ? 'status-finalizado' : 'status-pendiente'}">${item.activo ? 'Activa' : 'Inactiva'}</b></div>`).join('') || '<p class="table-empty">Sin asignaciones.</p>'}</div>
      </section>
    </div>
    <section class="content-section"><div class="section-heading"><div><h2>Solicitudes de acceso</h2><p>Revise identidad antes de habilitar un usuario.</p></div></div>
      <div class="request-list">${(state.admin.requests || []).filter((item) => item.estado === 'PENDIENTE').map((item) => `<article class="list-card"><div class="list-card-icon">${icon('user-round-search')}</div><div><strong>${escapeHtml(item.nombres)} ${escapeHtml(item.apellidos)}</strong><span>${escapeHtml(item.codigoCensista)} · ${escapeHtml(item.telefono || 'Sin telefono')}</span><small>${formatDateTime(item.requestedAt)}</small></div>${user.rol === 'ADMIN' ? `<div class="list-card-actions"><button class="btn btn-secondary" data-action="review-access" data-request="${item.solicitudId}" data-status="RECHAZADA">Rechazar</button><button class="btn btn-primary" data-action="review-access" data-request="${item.solicitudId}" data-status="APROBADA">Aprobar</button></div>` : '<span class="status-pill status-pendiente">Requiere administrador</span>'}</article>`).join('') || renderEmpty('inbox', 'No hay solicitudes pendientes.', '')}</div>
    </section>
    <section class="content-section"><div class="section-heading"><div><h2>Registros recientes</h2><p>Ultimas cargas recibidas de todos los usuarios autorizados.</p></div></div>
      <div class="data-table-wrap"><table><thead><tr><th>Registro</th><th>Escuela</th><th>Censista</th><th>Estado</th><th>Fotos</th><th>Actualizacion</th></tr></thead><tbody>${(state.admin.records || []).map((record) => `<tr><td><strong>${escapeHtml(record.recordId)}</strong></td><td>${escapeHtml(record.codigoEscuela)}</td><td>${escapeHtml(record.codigoCensista)}</td><td><span class="status-pill status-${String(record.estado || 'PENDIENTE').toLowerCase()}">${statusLabel(record.estado)}</span></td><td>${record.cantidadFotos || 0}</td><td>${formatDateTime(record.updatedAt || record.syncedAt)}</td></tr>`).join('') || '<tr><td colspan="6">Aun no hay registros.</td></tr>'}</tbody></table></div>
    </section>
  </section>`;
}

function renderAccount() {
  const user = state.bootstrap?.user || state.session?.user || {};
  return `<section class="view account-view"><div class="view-heading"><div><p class="eyebrow">Sesion actual</p><h1>Mi cuenta</h1></div></div>
    <section class="profile-panel"><span class="avatar large">${escapeHtml(initials(user))}</span><div><h2>${escapeHtml(displayName(user))}</h2><p>${escapeHtml(user.codigoCensista)} · ${roleLabel(user.rol)}</p></div></section>
    <section class="content-section settings-list">
      <div><span>${icon('smartphone')}<b>Dispositivo</b></span><code>${escapeHtml(getDeviceId().slice(0, 13))}...</code></div>
      <div><span>${icon('database')}<b>Catalogo</b></span><span>${state.catalog.length} escuelas · ${escapeHtml(state.catalogMeta?.scope || '')}</span></div>
      <div><span>${icon('cloud')}<b>Sincronizacion</b></span><span>${state.queue.length ? `${state.queue.length} pendientes` : 'Al dia'}</span></div>
      <div><span>${icon('app-window')}<b>Version</b></span><span>${APP_CONFIG.version} · ${APP_CONFIG.buildDate}</span></div>
      <a href="${APP_CONFIG.manualUrl}" target="_blank" rel="noopener"><span>${icon('book-open-check')}<b>Manual del censista</b></span><span>Abrir hoja 2</span></a>
      <a href="${APP_CONFIG.printableFormUrl}" target="_blank" rel="noopener"><span>${icon('printer')}<b>Ficha de contingencia</b></span><span>Imprimir hoja 1</span></a>
    </section>
    ${state.installPrompt ? `<button class="btn btn-primary" data-action="install">${icon('download')} Instalar en este dispositivo</button>` : ''}
    <button class="btn btn-danger" data-action="logout">${icon('log-out')} Cerrar sesion</button>
  </section>`;
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
      state.selectedSchoolCode = code;
      render();
    });
    const schools = filteredSchools();
    state.map.setSchools(schools, state.bootstrap?.progress || {}, state.selectedSchoolCode);
    if (state.location) state.map.showUserLocation(state.location);
    if (state.selectedSchoolCode) state.map.focusSchool(schoolByCode(state.selectedSchoolCode));
  }
  if (state.view === 'register') hydratePhotoPreviews();
  if (state.view === 'admin' && !state.admin && !state.adminLoading) loadAdmin();
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
    state.admin = await api.adminDashboard();
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    state.adminLoading = false;
    if (state.view === 'admin') render();
  }
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
  data.codigoCensista = digits(data.codigoCensista);
  const session = await api.login(data);
  setSession(session);
  await loadBootstrap();
  await loadRemoteRecords(true);
  state.view = 'schools';
  render();
  toast(`Bienvenido, ${displayName(state.bootstrap?.user || session.user)}.`, 'success');
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
  return {
    recordId: calculateRecordId(draft),
    idempotencyKey: draft.idempotencyKey,
    codigoEscuela: draft.codigoEscuela,
    codigoCensista: user.codigoCensista,
    numeroFormulario: digits(draft.numeroFormulario),
    numeroHoja: digits(draft.numeroHoja),
    bloque: digits(draft.bloque),
    piso: digits(draft.piso),
    espacio: digits(draft.espacio),
    tipoEspacio: draft.tipoEspacio,
    estado: draft.estado,
    observaciones: draft.observaciones,
    danosFallas: draft.danosFallas,
    latitudCaptura: draft.location?.latitud ?? '',
    longitudCaptura: draft.location?.longitud ?? '',
    precisionM: draft.location?.precisionM ?? '',
    cantidadFotos: draft.photos.length,
    cantidadHojasPapel: draft.photos.filter((photo) => photo.tipoFoto === 'HOJA_PAPEL').length,
    createdAt: draft.createdAt,
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
  await api.saveUser(data);
  form.reset();
  form.elements.activo.checked = true;
  await loadAdmin(true);
  toast('Usuario guardado.', 'success');
}

async function saveAssignment(form) {
  const data = Object.fromEntries(new FormData(form));
  data.activo = form.elements.activo.checked;
  await api.saveAssignment(data);
  await loadAdmin(true);
  toast('Asignacion guardada.', 'success');
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
  if (action === 'toggle-pin') {
    const input = button.parentElement.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
    button.innerHTML = icon(input.type === 'password' ? 'eye' : 'eye-off');
    refreshIcons();
  }
  if (action === 'select-school') {
    state.selectedSchoolCode = button.dataset.school;
    render();
  }
  if (action === 'clear-school') {
    state.selectedSchoolCode = '';
    render();
  }
  if (action === 'start-record') {
    state.selectedSchoolCode = button.dataset.school;
    state.activeDraft = newDraft(button.dataset.school);
    state.view = 'register';
    render();
  }
  if (action === 'save-draft') await saveActiveDraft();
  if (action === 'capture-photo') {
    updateDraftFromForm();
    document.querySelector(`[data-photo-input="${button.dataset.photoType}"]`)?.click();
  }
  if (action === 'remove-photo') await removePhoto(button.dataset.photo);
  if (action === 'capture-location') await captureDraftLocation();
  if (action === 'locate') await locateOnMap();
  if (action === 'open-draft') await openDraft(button.dataset.draft);
  if (action === 'continue-record') await openRemoteRecord(button.dataset.record);
  if (action === 'delete-draft') await deleteDraft(button.dataset.draft);
  if (action === 'sync') await syncQueue();
  if (action === 'reload-records') {
    await loadRemoteRecords(true);
    render();
    toast('Registros actualizados.', 'success');
  }
  if (action === 'reload-admin') await loadAdmin(true);
  if (action === 'review-access') await reviewAccess(button.dataset.request, button.dataset.status);
  if (action === 'install') await installApp();
  if (action === 'logout') await logout();
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
  const record = (state.remote?.records || []).find((item) => item.recordKey === recordKey);
  const user = state.bootstrap?.user || state.session?.user || {};
  if (!record || record.codigoCensista !== user.codigoCensista) {
    throw new Error('Este registro no puede editarse con la sesion actual.');
  }
  const photos = (state.remote?.photos || [])
    .filter((photo) => photo.recordKey === record.recordKey)
    .sort((left, right) => Number(left.secuencia || 0) - Number(right.secuencia || 0))
    .map((photo) => ({ ...photo, synced: true, blobId: '' }));
  state.activeDraft = {
    draftId: crypto.randomUUID(),
    sourceRecordKey: record.recordKey,
    idempotencyKey: crypto.randomUUID(),
    codigoEscuela: record.codigoEscuela,
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
    createdAt: record.createdAt || new Date().toISOString()
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
  state.admin = null;
  state.view = 'schools';
  render();
}

function handleChange(event) {
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
  const filter = event.target.closest('[data-filter="search"]');
  if (!filter) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.filters.search = filter.value;
    render();
    document.querySelector('[data-filter="search"]')?.focus();
  }, 180);
}

function schoolByCode(code) {
  return state.catalog.find((school) => school.codigo === code) || null;
}

function calculateRecordId(draft) {
  if (!draft?.codigoEscuela) return '';
  const values = [draft.bloque, draft.piso, draft.espacio, draft.numeroHoja];
  if (values.some((value) => !/^\d+$/.test(String(value || '')))) return '';
  return `${draft.codigoEscuela}-B${digits(draft.bloque).padStart(2, '0')}-P${digits(draft.piso).padStart(2, '0')}-E${digits(draft.espacio).padStart(3, '0')}-H${digits(draft.numeroHoja).padStart(2, '0')}`;
}

function digits(value) { return String(value || '').replace(/\D/g, ''); }

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

function roleLabel(role = '') {
  return ({ ADMIN: 'Administrador', SUPERVISOR: 'Supervisor', ENCUESTADOR: 'Encuestador' })[role] || role;
}

function displayName(user = {}) {
  return [user.nombres, user.apellidos].filter(Boolean).join(' ') || user.codigoCensista || 'Usuario';
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

if ('serviceWorker' in navigator && !APP_CONFIG.demo) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

boot();
