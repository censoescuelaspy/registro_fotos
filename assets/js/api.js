import { APP_CONFIG } from './config.js';

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
