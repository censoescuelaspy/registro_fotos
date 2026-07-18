const SYSTEM_CONFIG = Object.freeze({
  APP_NAME: 'CIALPA Fotos',
  APP_VERSION: '1.0.2',
  SCHEMA_VERSION: '2026-07-18.1',
  SPREADSHEET_ID: '1R_vG-q96SbzoYmMg9AL-PMY1YUeSyRTl5tJSfuGNqUo',
  ROOT_FOLDER_NAME: 'CIALPA_REGISTRO_FOTOS',
  SESSION_HOURS: 12,
  MAX_PHOTO_BYTES: 15 * 1024 * 1024,
  MAX_TEXT: 1000,
  CACHE_SCHEMA_KEY: 'schema-ready-2026-07-18.1'
});

const SHEETS = Object.freeze({
  CONFIG: 'CONFIG',
  USERS: 'USUARIOS',
  SESSIONS: 'SESIONES',
  SCHOOLS: 'ESCUELAS',
  ASSIGNMENTS: 'ASIGNACIONES',
  RECORDS: 'REGISTROS',
  PHOTOS: 'FOTOS',
  REQUESTS: 'SOLICITUDES',
  AUDIT: 'AUDITORIA'
});

const HEADERS = Object.freeze({
  CONFIG: ['clave', 'valor', 'descripcion', 'updated_at'],
  USUARIOS: [
    'codigo_censista', 'nombres', 'apellidos', 'rol', 'pin_salt', 'pin_hash', 'activo',
    'telefono', 'created_at', 'updated_at', 'ultimo_acceso'
  ],
  SESIONES: [
    'token_hash', 'codigo_censista', 'rol', 'created_at', 'expires_at', 'revoked',
    'last_seen', 'device_id', 'user_agent'
  ],
  ESCUELAS: [
    'codigo', 'nombre', 'departamento', 'distrito', 'zona', 'localidad', 'latitud',
    'longitud', 'es_muestra', 'orden_muestra', 'estado', 'created_at', 'updated_at'
  ],
  ASIGNACIONES: [
    'assignment_id', 'codigo_censista', 'codigo_escuela', 'activo', 'fecha_asignacion',
    'asignado_por', 'notas', 'updated_at'
  ],
  REGISTROS: [
    'record_key', 'record_id', 'idempotency_key', 'codigo_escuela', 'codigo_censista',
    'numero_formulario', 'numero_hoja', 'bloque', 'piso', 'espacio', 'tipo_espacio',
    'estado', 'observaciones', 'danos_fallas', 'latitud_captura', 'longitud_captura',
    'precision_m', 'cantidad_fotos', 'cantidad_hojas_papel', 'created_at', 'updated_at',
    'synced_at', 'device_id'
  ],
  FOTOS: [
    'foto_id', 'idempotency_key', 'record_key', 'record_id', 'codigo_escuela',
    'codigo_censista', 'numero_formulario', 'numero_hoja', 'bloque', 'piso', 'espacio',
    'tipo_foto', 'tipo_elemento', 'numero_elemento', 'codigo_elemento', 'secuencia',
    'codigo_foto', 'etiqueta_impresa', 'nombre_archivo', 'mime_type', 'bytes', 'sha256',
    'drive_file_id', 'drive_url', 'thumbnail_url', 'latitud', 'longitud', 'precision_m',
    'captured_at', 'uploaded_at', 'estado', 'notas', 'deleted_at'
  ],
  SOLICITUDES: [
    'solicitud_id', 'codigo_censista', 'nombres', 'apellidos', 'telefono', 'pin_salt',
    'pin_hash', 'requested_at', 'estado', 'revisado_por', 'revisado_at', 'notas'
  ],
  AUDITORIA: [
    'event_id', 'timestamp', 'codigo_censista', 'rol', 'accion', 'entidad',
    'entidad_id', 'detalle_json', 'device_id', 'user_agent'
  ]
});

const ROLE = Object.freeze({ ADMIN: 'ADMIN', SUPERVISOR: 'SUPERVISOR', SURVEYOR: 'ENCUESTADOR' });
const RECORD_STATUS = Object.freeze(['EN_PROCESO', 'FINALIZADO', 'CON_PENDIENTES']);
const PHOTO_TYPES = Object.freeze(['EVIDENCIA', 'HOJA_PAPEL']);
const ELEMENT_TYPES = Object.freeze([
  'AMBIENTE', 'PARED', 'TABIQUE', 'PUERTA', 'VENTANA', 'PILAR', 'ESCALERA', 'RAMPA',
  'INODORO', 'LAVAMANOS', 'URINARIO', 'DUCHA', 'LUZ', 'INTERRUPTOR', 'TOMACORRIENTE',
  'VENTILADOR', 'AIRE_ACONDICIONADO', 'TABLERO_ELECTRICO', 'PUNTO_AGUA', 'DESAGUE',
  'DANO_FALLA', 'HOJA_PAPEL', 'OTRO'
]);

const ELEMENT_CODES = Object.freeze({
  AMBIENTE: 'AM', PARED: 'MU', TABIQUE: 'TA', PUERTA: 'PT', VENTANA: 'VN', PILAR: 'PI',
  ESCALERA: 'ES', RAMPA: 'RM', INODORO: 'WC', LAVAMANOS: 'LV', URINARIO: 'UR', DUCHA: 'DU',
  LUZ: 'LU', INTERRUPTOR: 'IN', TOMACORRIENTE: 'TC', VENTILADOR: 'VE',
  AIRE_ACONDICIONADO: 'AA', TABLERO_ELECTRICO: 'TE', PUNTO_AGUA: 'AP', DESAGUE: 'DG',
  DANO_FALLA: 'DF', HOJA_PAPEL: 'HP', OTRO: 'OT'
});

function apiError_(code, message, details) {
  const error = new Error(message);
  error.apiCode = code;
  error.apiDetails = details || null;
  return error;
}

function nowIso_() {
  return new Date().toISOString();
}

function digits_(value, field, minLength, maxLength) {
  const result = String(value == null ? '' : value).replace(/\D/g, '');
  if (result.length < (minLength || 1) || result.length > (maxLength || 20)) {
    throw apiError_('VALIDATION_ERROR', 'Valor invalido para ' + field + '.');
  }
  return result;
}

function text_(value, field, maxLength, required) {
  const result = String(value == null ? '' : value).trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
  if (required && !result) throw apiError_('VALIDATION_ERROR', 'Falta ' + field + '.');
  if (result.length > (maxLength || SYSTEM_CONFIG.MAX_TEXT)) {
    throw apiError_('VALIDATION_ERROR', field + ' supera el largo permitido.');
  }
  return result;
}

function number_(value, field, min, max, allowBlank) {
  if ((value === '' || value == null) && allowBlank) return '';
  const result = Number(value);
  if (!isFinite(result) || result < min || result > max) {
    throw apiError_('VALIDATION_ERROR', 'Valor invalido para ' + field + '.');
  }
  return result;
}

function boolean_(value) {
  if (value === true || value === 1) return true;
  return ['TRUE', '1', 'SI', 'SÍ', 'YES'].indexOf(String(value || '').toUpperCase()) >= 0;
}

function requireIn_(value, allowed, field) {
  const normalized = String(value || '').toUpperCase();
  if (allowed.indexOf(normalized) < 0) {
    throw apiError_('VALIDATION_ERROR', 'Opcion invalida para ' + field + '.');
  }
  return normalized;
}

function sha256_(value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');
}

function sha256BytesHex_(bytes) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return digest.map(function (byte) {
    const unsigned = byte < 0 ? byte + 256 : byte;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
}

function randomSecret_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function safeCell_(value) {
  if (typeof value !== 'string') return value == null ? '' : value;
  if (/^[=+@]/.test(value) || (/^-/.test(value) && !/^-\d+(\.\d+)?$/.test(value))) return "'" + value;
  return value;
}
