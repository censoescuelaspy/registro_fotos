import { APP_CONFIG } from './config.js';

export class ApiError extends Error {
  constructor(message, code = 'API_ERROR', details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

const demoStoreKey = 'cialpa-fotos-demo-data-v1';

function demoData() {
  const saved = localStorage.getItem(demoStoreKey);
  if (saved) return JSON.parse(saved);
  const initial = {
    records: [],
    photos: [],
    users: [
      {
        codigoCensista: '1234567',
        nombres: 'Administrador',
        apellidos: 'Demostracion',
        rol: 'ADMIN',
        activo: true
      }
    ],
    assignments: [],
    requests: []
  };
  localStorage.setItem(demoStoreKey, JSON.stringify(initial));
  return initial;
}

function saveDemo(data) {
  localStorage.setItem(demoStoreKey, JSON.stringify(data));
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
      const assignedCodes = data.assignments
        .filter((item) => item.activo && item.codigoCensista === user.codigoCensista)
        .map((item) => item.codigoEscuela);
      const progress = data.records.reduce((accumulator, record) => {
        const current = accumulator[record.codigoEscuela] || { registros: 0, fotos: 0, estado: 'PENDIENTE' };
        current.registros += 1;
        current.fotos += Number(record.cantidadFotos || 0);
        current.estado = record.estado || 'EN_PROCESO';
        accumulator[record.codigoEscuela] = current;
        return accumulator;
      }, {});
      return {
        user,
        assignedCodes,
        showAllSchools: ['ADMIN', 'SUPERVISOR'].includes(user.rol),
        progress,
        recentRecords: data.records.slice(-20).reverse()
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
          driveUrl: ''
        });
      }
      saveDemo(data);
      return { ok: true, fotoId: payload.photo.fotoId, uploadedAt: now };
    case 'listRecords':
      return { records: data.records, photos: data.photos };
    case 'adminDashboard':
      {
      const surveyorSummary = data.users.map((user) => {
        const records = data.records.filter((record) => record.codigoCensista === user.codigoCensista);
        return {
          ...user,
          escuelasAsignadas: data.assignments.filter((item) => item.activo && item.codigoCensista === user.codigoCensista).length,
          registros: records.length,
          finalizados: records.filter((record) => record.estado === 'FINALIZADO').length,
          conPendientes: records.filter((record) => record.estado === 'CON_PENDIENTES').length,
          fotos: data.photos.filter((photo) => photo.codigoCensista === user.codigoCensista).length,
          ultimaCarga: records.map((record) => record.updatedAt || record.syncedAt || '').sort().pop() || ''
        };
      });
      return {
        counts: {
          usuarios: data.users.length,
          asignaciones: data.assignments.filter((item) => item.activo).length,
          registros: data.records.length,
          fotos: data.photos.length,
          solicitudesPendientes: data.requests.filter((item) => item.estado === 'PENDIENTE').length
        },
        users: data.users,
        assignments: data.assignments,
        requests: data.requests,
        records: data.records.slice(-100).reverse(),
        surveyorSummary,
        photoRootUrl: ''
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

  async request(action, payload = {}, options = {}) {
    if (this.config.demo) {
      return demoRequest(action, { ...payload, session: this.session });
    }
    if (!this.config.gasExecUrl) {
      throw new ApiError('El servicio de sincronizacion aun no esta configurado.', 'BACKEND_NOT_CONFIGURED');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeout || 45000);
    try {
      const response = await fetch(this.config.gasExecUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action,
          token: this.session?.token || '',
          payload,
          client: {
            version: this.config.version,
            deviceId: getDeviceId(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            userAgent: navigator.userAgent.slice(0, 500)
          }
        }),
        redirect: 'follow',
        signal: controller.signal
      });
      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch {
        throw new ApiError('El servidor devolvio una respuesta no valida.', 'INVALID_RESPONSE');
      }
      if (!response.ok || result.ok === false) {
        throw new ApiError(
          result.error?.message || `Error del servidor (${response.status}).`,
          result.error?.code || 'SERVER_ERROR',
          result.error?.details || null
        );
      }
      return result.data ?? result;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ApiError('La conexion tardo demasiado. El registro puede quedar en cola.', 'TIMEOUT');
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError('No se pudo conectar con el servicio de sincronizacion.', 'NETWORK_ERROR');
    } finally {
      clearTimeout(timeout);
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
  adminDashboard() { return this.request('adminDashboard'); }
  saveUser(user) { return this.request('saveUser', { user }); }
  saveAssignment(assignment) { return this.request('saveAssignment', { assignment }); }
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
