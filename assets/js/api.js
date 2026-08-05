import { APP_CONFIG } from './config.js';
import { DEMO_LOAD_SCHOOL, DEMO_LOAD_USER, createDemoLoadDataset } from './demo-load.js';

function isGasMessageOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && (
      url.hostname === 'script.google.com'
      || url.hostname === 'script.googleusercontent.com'
      || url.hostname.endsWith('.script.googleusercontent.com')
      || url.hostname.endsWith('-script.googleusercontent.com')
    );
  } catch (ignore) {
    return false;
  }
}

export class ApiError extends Error {
  constructor(message, code = 'API_ERROR', details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

const demoStoreKey = APP_CONFIG.loadTest ? 'cialpa-fotos-demo-load-data-v1' : 'cialpa-fotos-demo-data-v1';
const demoAssetCache = new Map();

async function demoAssetBase64(url) {
  if (!demoAssetCache.has(url)) {
    demoAssetCache.set(url, fetch(url).then(async (response) => {
      if (!response.ok) throw new ApiError('No se pudo leer la imagen simulada.', 'DEMO_ASSET_MISSING');
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = '';
      for (let index = 0; index < bytes.length; index += 8192) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
      }
      return btoa(binary);
    }));
  }
  return demoAssetCache.get(url);
}

function demoData() {
  const saved = localStorage.getItem(demoStoreKey);
  if (saved) return JSON.parse(saved);
  const loadDataset = APP_CONFIG.loadTest ? createDemoLoadDataset() : { records: [], photos: [] };
  const initial = {
    records: loadDataset.records,
    photos: loadDataset.photos,
    users: [
      {
        codigoCensista: '1234567',
        nombres: 'Administrador',
        apellidos: 'Demostracion',
        rol: 'ADMIN',
        disponibleCampo: true,
        activo: true
      },
      {
        codigoCensista: '2345678',
        nombres: 'Ana',
        apellidos: 'Lopez',
        equipo: 'Equipo 1',
        telefono: '0981000001',
        rol: 'ENCUESTADOR',
        disponibleCampo: true,
        activo: true
      },
      {
        codigoCensista: '3456789',
        nombres: 'Bruno',
        apellidos: 'Diaz',
        equipo: 'Equipo 2',
        telefono: '0981000002',
        rol: 'ENCUESTADOR',
        disponibleCampo: true,
        activo: true
      },
      {
        codigoCensista: '5678901',
        nombres: 'Sofia',
        apellidos: 'Supervisora',
        equipo: 'Equipo 1',
        telefono: '0981000003',
        rol: 'SUPERVISOR',
        disponibleCampo: true,
        activo: true
      },
      ...(APP_CONFIG.loadTest ? [DEMO_LOAD_USER] : [])
    ],
    assignments: [
      { assignmentId: crypto.randomUUID(), codigoCensista: '2345678', codigoEscuela: '11007', activo: true, updatedAt: new Date().toISOString() },
      { assignmentId: crypto.randomUUID(), codigoCensista: '3456789', codigoEscuela: '10038', activo: true, updatedAt: new Date().toISOString() },
      ...(APP_CONFIG.loadTest ? [{ assignmentId: crypto.randomUUID(), codigoCensista: DEMO_LOAD_USER.codigoCensista, codigoEscuela: DEMO_LOAD_SCHOOL.codigo, activo: true, updatedAt: new Date().toISOString() }] : [])
    ],
    requests: []
  };
  localStorage.setItem(demoStoreKey, JSON.stringify(initial));
  return initial;
}

function saveDemo(data) {
  localStorage.setItem(demoStoreKey, JSON.stringify(data));
}

function demoScope(data, payload = {}) {
  const current = data.users.find((user) => user.codigoCensista === payload.session?.user?.codigoCensista)
    || payload.session?.user || {};
  const users = current.rol === 'ADMIN'
    ? data.users
    : data.users.filter((user) => current.equipo && user.equipo === current.equipo);
  const userCodes = new Set(users.map((user) => user.codigoCensista));
  const assignments = data.assignments.filter((item) => userCodes.has(item.codigoCensista));
  const schoolCodes = new Set(assignments.filter((item) => item.activo).map((item) => item.codigoEscuela));
  const records = data.records.filter((record) => userCodes.has(record.codigoCensista) && schoolCodes.has(record.codigoEscuela));
  const recordKeys = new Set(records.map((record) => record.recordKey || `${record.codigoCensista}:${record.recordId}`));
  const photos = data.photos.filter((photo) => recordKeys.has(photo.recordKey || `${photo.codigoCensista}:${photo.recordId}`));
  return { current, users, userCodes, assignments, schoolCodes, records, recordKeys, photos };
}

function demoPhotoView(photo) {
  const { demoBase64, demoAssetUrl, ...metadata } = photo;
  return metadata;
}

function demoRecordKey(item) {
  return String(item.recordKey || (item.codigoCensista && item.recordId ? `${item.codigoCensista}:${item.recordId}` : '')).trim();
}

function demoLinkedPhotos(records = [], photos = []) {
  const keys = new Set(records.map(demoRecordKey).filter(Boolean));
  return photos.filter((photo) => keys.has(demoRecordKey(photo)));
}

function demoDataQuality(records = [], photos = []) {
  const keys = new Set(records.map(demoRecordKey).filter(Boolean));
  const linked = demoLinkedPhotos(records, photos);
  const linkedCounts = linked.reduce((counts, photo) => {
    const key = demoRecordKey(photo);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const orphanPhotos = photos.filter((photo) => !keys.has(demoRecordKey(photo)));
  const countMismatches = records.filter((record) => Number(record.cantidadFotos || 0) !== Number(linkedCounts[demoRecordKey(record)] || 0));
  const recordsWithoutKey = records.filter((record) => !demoRecordKey(record));
  const issues = recordsWithoutKey.length + orphanPhotos.length + countMismatches.length;
  return {
    status: issues ? 'REVISAR' : 'OK',
    recordsTotal: records.length,
    photosTotal: photos.length,
    photosLinked: linked.length,
    photosOrphaned: orphanPhotos.length,
    recordsWithoutKey: recordsWithoutKey.length,
    recordsOutsideCatalog: 0,
    photosOutsideCatalog: 0,
    countMismatches: countMismatches.length,
    generatedAt: new Date().toISOString(),
    samples: {
      orphanPhotos: orphanPhotos.slice(0, 10).map((photo) => ({ fotoId: photo.fotoId || '', recordKey: demoRecordKey(photo), codigoEscuela: photo.codigoEscuela || '' })),
      recordsOutsideCatalog: [],
      countMismatches: countMismatches.slice(0, 10).map((record) => ({
        recordKey: demoRecordKey(record),
        recordId: record.recordId || '',
        declaredPhotos: Number(record.cantidadFotos || 0),
        linkedPhotos: Number(linkedCounts[demoRecordKey(record)] || 0)
      }))
    }
  };
}

function demoPerformance(data, teamFilter = '') {
  const linkedPhotos = demoLinkedPhotos(data.records, data.photos);
  const individuals = data.users.filter((user) => user.rol === 'ENCUESTADOR' && (!teamFilter || user.equipo === teamFilter)).map((user) => {
    const records = data.records.filter((record) => record.codigoCensista === user.codigoCensista);
    const durations = records.map((record) => Number(record.durationSeconds || 0)).filter((value) => value > 0);
    const average = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length / 60 : 0;
    const sorted = [...durations].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    const median = sorted.length
      ? (sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) / 60
      : 0;
    const completed = records.filter((record) => record.estado === 'FINALIZADO').length;
    return {
      ...user,
      assignedSchools: data.assignments.filter((item) => item.activo && item.codigoCensista === user.codigoCensista).length,
      records: records.length,
      completedRecords: completed,
      pendingRecords: records.filter((record) => record.estado === 'CON_PENDIENTES').length,
      completionRate: records.length ? Math.round(completed / records.length * 1000) / 10 : 0,
      photos: linkedPhotos.filter((photo) => photo.codigoCensista === user.codigoCensista).length,
      timedRecords: durations.length,
      averageMinutes: Math.round(average * 10) / 10,
      medianMinutes: Math.round(median * 10) / 10,
      totalHours: Math.round(durations.reduce((sum, value) => sum + value, 0) / 360) / 10,
      averageSyncDelayMinutes: 0,
      lastActivity: records.map((record) => record.updatedAt || record.syncedAt || '').sort().pop() || ''
    };
  });
  const teams = [...new Set(individuals.map((item) => item.equipo).filter(Boolean))].map((equipo) => {
    const members = individuals.filter((item) => item.equipo === equipo);
    const assigned = new Set(members.flatMap((member) => data.assignments
      .filter((item) => item.activo && item.codigoCensista === member.codigoCensista)
      .map((item) => item.codigoEscuela)));
    const touched = new Set(data.records.filter((record) => members.some((member) => member.codigoCensista === record.codigoCensista))
      .map((record) => record.codigoEscuela));
    return {
      equipo,
      members,
      totalMembers: members.length,
      availableMembers: members.filter((member) => member.disponibleCampo !== false).length,
      assignedSchools: assigned.size,
      touchedSchools: touched.size,
      pendingSchools: Math.max(0, assigned.size - touched.size),
      records: members.reduce((sum, member) => sum + member.records, 0),
      completedRecords: members.reduce((sum, member) => sum + member.completedRecords, 0),
      photos: members.reduce((sum, member) => sum + member.photos, 0),
      timedRecords: members.reduce((sum, member) => sum + member.timedRecords, 0),
      averageMinutes: members.length ? members.reduce((sum, member) => sum + member.averageMinutes, 0) / members.length : 0,
      medianMinutes: members.length ? members.reduce((sum, member) => sum + member.medianMinutes, 0) / members.length : 0,
      lastActivity: members.map((member) => member.lastActivity || '').sort().pop() || ''
    };
  });
  return { generatedAt: new Date().toISOString(), individuals, teams };
}

async function demoRequest(action, payload = {}) {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const data = demoData();
  const now = new Date().toISOString();
  switch (action) {
    case 'health':
      return { ok: true, service: 'demo', version: APP_CONFIG.version, bootstrapRequired: false };
    case 'login': {
      const user = data.users.find(
        (item) => item.codigoCensista === String(payload.codigoCensista || '').replace(/\D/g, '')
          && item.activo
      );
      if (!user || payload.pin !== '1234') {
        throw new ApiError('Cedula o PIN incorrectos.', 'AUTH_INVALID');
      }
      return {
        token: `demo-${crypto.randomUUID()}`,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        user
      };
    }
    case 'requestAccess':
      data.requests.push({
        solicitudId: crypto.randomUUID(),
        codigoCensista: payload.codigoCensista,
        nombres: payload.nombres,
        apellidos: payload.apellidos,
        telefono: payload.telefono || '',
        estado: 'PENDIENTE',
        requestedAt: now
      });
      saveDemo(data);
      return { ok: true };
    case 'bootstrapAdmin':
      throw new ApiError('La demostracion ya tiene administrador.', 'BOOTSTRAP_COMPLETE');
    case 'logout':
      return { ok: true };
    case 'bootstrap': {
      const user = data.users.find((item) => item.codigoCensista === payload.session?.user?.codigoCensista)
        || payload.session?.user;
      const scope = demoScope(data, payload);
      const assignedCodes = data.assignments
        .filter((item) => item.activo && (user.rol === 'ADMIN' || scope.userCodes.has(item.codigoCensista)))
        .map((item) => item.codigoEscuela);
      const visibleRecords = user.rol === 'ADMIN' ? data.records : scope.records;
      const progress = visibleRecords.reduce((accumulator, record) => {
        const current = accumulator[record.codigoEscuela] || { registros: 0, fotos: 0, estado: 'PENDIENTE' };
        current.registros += 1;
        current.fotos += Number(record.cantidadFotos || 0);
        current.estado = record.estado || 'EN_PROCESO';
        accumulator[record.codigoEscuela] = current;
        return accumulator;
      }, {});
      const performance = demoPerformance(data);
      const individual = performance.individuals.find((item) => item.codigoCensista === user.codigoCensista) || null;
      return {
        user,
        assignedCodes,
        showAllSchools: user.rol === 'ADMIN',
        progress,
        recentRecords: visibleRecords.slice(-20).reverse(),
        performance: {
          generatedAt: performance.generatedAt,
          individual,
          team: individual ? performance.teams.find((item) => item.equipo === individual.equipo) || null : null
        }
      };
    }
    case 'saveRecord': {
      const position = data.records.findIndex((item) => item.recordId === payload.record.recordId);
      const record = {
        ...payload.record,
        recordKey: payload.record.recordKey || `${payload.record.codigoCensista}:${payload.record.recordId}`,
        syncedAt: now
      };
      if (position >= 0) data.records[position] = { ...data.records[position], ...record };
      else data.records.push(record);
      saveDemo(data);
      return { ok: true, recordId: record.recordId, syncedAt: now };
    }
    case 'uploadPhoto':
      if (!data.photos.some((item) => item.idempotencyKey === payload.photo.idempotencyKey)) {
        data.photos.push({
          ...payload.photo,
          recordKey: payload.photo.recordKey || `${payload.photo.codigoCensista}:${payload.photo.recordId}`,
          uploadedAt: now,
          driveUrl: '',
          demoBase64: payload.base64 || ''
        });
      }
      saveDemo(data);
      return { ok: true, fotoId: payload.photo.fotoId, uploadedAt: now };
    case 'listRecords':
      {
        const scope = demoScope(data, payload);
        return scope.current.rol === 'ADMIN'
          ? { records: data.records, photos: data.photos.map(demoPhotoView), schools: [] }
          : { records: scope.records, photos: scope.photos.map(demoPhotoView), schools: [] };
      }
    case 'getPhotoContent': {
      const scope = demoScope(data, payload);
      const visiblePhotos = scope.current.rol === 'ADMIN' ? data.photos : scope.photos;
      const photo = visiblePhotos.find((item) => item.fotoId === payload.fotoId);
      if (!photo) throw new ApiError('La fotografia no existe o no esta autorizada.', 'PHOTO_NOT_FOUND');
      const base64 = photo.demoBase64 || await demoAssetBase64(photo.demoAssetUrl);
      const chunkSize = 300000;
      const totalChunks = Math.max(1, Math.ceil(base64.length / chunkSize));
      const chunkIndex = Math.max(0, Math.min(totalChunks - 1, Number(payload.chunkIndex || 0)));
      return {
        fotoId: photo.fotoId,
        mimeType: photo.mimeType || 'image/jpeg',
        bytes: Number(photo.bytes || 0),
        chunkIndex,
        totalChunks,
        chunk: base64.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize)
      };
    }
    case 'adminDashboard':
      {
      const scope = demoScope(data, payload);
      const dashboardUsers = scope.current.rol === 'ADMIN' ? data.users : scope.users;
      const dashboardAssignments = scope.current.rol === 'ADMIN' ? data.assignments : scope.assignments;
      const dashboardRecords = scope.current.rol === 'ADMIN' ? data.records : scope.records;
      const dashboardPhotos = scope.current.rol === 'ADMIN' ? data.photos : scope.photos;
      const linkedPhotos = demoLinkedPhotos(dashboardRecords, dashboardPhotos);
      const dataQuality = demoDataQuality(dashboardRecords, dashboardPhotos);
      const dashboardRequests = scope.current.rol === 'ADMIN'
        ? data.requests
        : data.requests.filter((request) => scope.userCodes.has(request.codigoCensista));
      const surveyorSummary = dashboardUsers.map((user) => {
        const records = dashboardRecords.filter((record) => record.codigoCensista === user.codigoCensista);
        return {
          ...user,
          escuelasAsignadas: dashboardAssignments.filter((item) => item.activo && item.codigoCensista === user.codigoCensista).length,
          registros: records.length,
          finalizados: records.filter((record) => record.estado === 'FINALIZADO').length,
          conPendientes: records.filter((record) => record.estado === 'CON_PENDIENTES').length,
          fotos: linkedPhotos.filter((photo) => photo.codigoCensista === user.codigoCensista).length,
          ultimaCarga: records.map((record) => record.updatedAt || record.syncedAt || '').sort().pop() || ''
        };
      });
      return {
        counts: {
          usuarios: dashboardUsers.length,
          asignaciones: dashboardAssignments.filter((item) => item.activo).length,
          registros: dashboardRecords.length,
          fotos: linkedPhotos.length,
          fotosTotales: dashboardPhotos.length,
          fotosHuerfanas: dataQuality.photosOrphaned,
          solicitudesPendientes: dashboardRequests.filter((item) => item.estado === 'PENDIENTE').length
        },
        users: dashboardUsers,
        assignments: dashboardAssignments,
        requests: dashboardRequests,
        records: dashboardRecords.slice(-100).reverse(),
        surveyorSummary,
        dataQuality,
        photoRootUrl: '',
        performance: demoPerformance(data, scope.current.rol === 'ADMIN' ? '' : scope.current.equipo)
      };
      }
    case 'saveUser': {
      const position = data.users.findIndex((item) => item.codigoCensista === payload.user.codigoCensista);
      const user = { ...payload.user, activo: payload.user.activo !== false };
      if (position >= 0) data.users[position] = { ...data.users[position], ...user };
      else data.users.push(user);
      saveDemo(data);
      return { ok: true };
    }
    case 'setAvailability': {
      const user = data.users.find((item) => item.codigoCensista === payload.codigoCensista);
      if (!user) throw new ApiError('No se encontro el censista.', 'USER_NOT_FOUND');
      user.disponibleCampo = payload.disponibleCampo !== false;
      user.motivoIndisponibilidad = user.disponibleCampo ? '' : String(payload.motivoIndisponibilidad || '');
      user.disponibilidadUpdatedAt = now;
      saveDemo(data);
      return { ok: true, disponibleCampo: user.disponibleCampo };
    }
    case 'saveAssignment': {
      const assignment = payload.assignment;
      const position = data.assignments.findIndex(
        (item) => item.codigoCensista === assignment.codigoCensista
          && item.codigoEscuela === assignment.codigoEscuela
      );
      if (position >= 0) data.assignments[position] = { ...data.assignments[position], ...assignment };
      else data.assignments.push({ ...assignment, assignmentId: crypto.randomUUID() });
      saveDemo(data);
      return { ok: true };
    }
    case 'saveAssignmentsBatch': {
      const items = Array.isArray(payload.assignments) ? payload.assignments : [];
      for (const item of items) {
        data.assignments.forEach((assignment) => {
          if (assignment.codigoEscuela === item.codigoEscuela) assignment.activo = false;
        });
        if (!item.codigoCensista) continue;
        const existing = data.assignments.find((assignment) => assignment.codigoEscuela === item.codigoEscuela
          && assignment.codigoCensista === item.codigoCensista);
        if (existing) Object.assign(existing, { activo: true, updatedAt: now });
        else data.assignments.push({
          assignmentId: crypto.randomUUID(),
          codigoCensista: item.codigoCensista,
          codigoEscuela: item.codigoEscuela,
          activo: true,
          fechaAsignacion: now,
          updatedAt: now
        });
      }
      saveDemo(data);
      return { ok: true, updated: items.length };
    }
    case 'reviewAccess': {
      const request = data.requests.find((item) => item.solicitudId === payload.solicitudId);
      if (request) request.estado = payload.estado;
      saveDemo(data);
      return { ok: true };
    }
    default:
      throw new ApiError(`Accion de demostracion no implementada: ${action}`, 'DEMO_UNSUPPORTED');
  }
}

export class ApiClient {
  constructor(config = APP_CONFIG) {
    this.config = config;
    this.session = null;
  }

  setSession(session) {
    this.session = session || null;
  }

  requestViaIframe(request, timeoutMs) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();
      const target = `cialpa-gas-${requestId}`;
      const iframe = document.createElement('iframe');
      const form = document.createElement('form');
      let settled = false;

      iframe.name = target;
      iframe.hidden = true;
      iframe.title = 'Comunicacion segura con el servidor';
      iframe.referrerPolicy = 'no-referrer';
      form.hidden = true;
      form.method = 'POST';
      form.action = this.config.gasExecUrl;
      form.target = target;
      form.enctype = 'multipart/form-data';
      form.acceptCharset = 'UTF-8';

      const addField = (name, value) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.append(input);
      };
      addField('transport', 'iframe');
      addField('requestId', requestId);
      addField('origin', location.origin);
      addField('request', JSON.stringify(request));

      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        iframe.remove();
        form.remove();
      };
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        callback(value);
      };
      const onMessage = (event) => {
        if (!isGasMessageOrigin(event.origin)) return;
        const message = event.data;
        if (!message || message.source !== 'CIALPA_GAS' || message.requestId !== requestId) return;
        finish(resolve, message.payload);
      };
      const timer = setTimeout(() => {
        finish(reject, new ApiError('La conexion tardo demasiado. El registro puede quedar en cola.', 'TIMEOUT'));
      }, timeoutMs);

      window.addEventListener('message', onMessage);
      document.body.append(iframe, form);
      try {
        form.submit();
      } catch (error) {
        finish(reject, error);
      }
    });
  }

  async request(action, payload = {}, options = {}) {
    if (this.config.demo) {
      return demoRequest(action, { ...payload, session: this.session });
    }
    if (!this.config.gasExecUrl) {
      throw new ApiError('El servicio de sincronizacion aun no esta configurado.', 'BACKEND_NOT_CONFIGURED');
    }
    try {
      const result = await this.requestViaIframe({
        action,
        token: this.session?.token || '',
        payload,
        client: {
          version: this.config.version,
          deviceId: getDeviceId(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
          userAgent: navigator.userAgent.slice(0, 500)
        }
      }, options.timeout || 45000);
      if (!result || result.ok === false) {
        throw new ApiError(
          result?.error?.message || 'El servidor devolvio una respuesta no valida.',
          result?.error?.code || 'SERVER_ERROR',
          result?.error?.details || null
        );
      }
      return result.data ?? result;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('No se pudo conectar con el servicio de sincronizacion.', 'NETWORK_ERROR');
    }
  }

  health() { return this.request('health', {}, { timeout: 15000 }); }
  login(credentials) { return this.request('login', credentials); }
  logout() { return this.request('logout'); }
  requestAccess(data) { return this.request('requestAccess', data); }
  bootstrapAdmin(data) { return this.request('bootstrapAdmin', data); }
  bootstrap() { return this.request('bootstrap'); }
  saveRecord(record) { return this.request('saveRecord', { record }); }
  uploadPhoto(photo, base64) { return this.request('uploadPhoto', { photo, base64 }, { timeout: 90000 }); }
  listRecords(filters = {}) { return this.request('listRecords', filters); }
  getPhotoContent(fotoId, chunkIndex = 0) { return this.request('getPhotoContent', { fotoId, chunkIndex }, { timeout: 90000 }); }
  adminDashboard() { return this.request('adminDashboard'); }
  saveUser(user) { return this.request('saveUser', { user }); }
  setAvailability(codigoCensista, disponibleCampo, motivoIndisponibilidad = '') {
    return this.request('setAvailability', { codigoCensista, disponibleCampo, motivoIndisponibilidad });
  }
  saveAssignment(assignment) { return this.request('saveAssignment', { assignment }); }
  saveAssignmentsBatch(assignments) { return this.request('saveAssignmentsBatch', { assignments }); }
  reviewAccess(solicitudId, estado, notas = '') {
    return this.request('reviewAccess', { solicitudId, estado, notas });
  }
}

export function getDeviceId() {
  let deviceId = localStorage.getItem(APP_CONFIG.deviceStorageKey);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(APP_CONFIG.deviceStorageKey, deviceId);
  }
  return deviceId;
}
