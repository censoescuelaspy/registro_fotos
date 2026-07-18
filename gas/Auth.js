function hashPin_(pin, salt) {
  return sha256_(salt + ':' + String(pin));
}

function validatePin_(pin) {
  const normalized = String(pin || '');
  if (!/^\d{4,12}$/.test(normalized)) {
    throw apiError_('VALIDATION_ERROR', 'El PIN debe tener entre 4 y 12 numeros.');
  }
  return normalized;
}

function secureEqual_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function active_(value) {
  return value === '' || value == null ? false : boolean_(value);
}

function publicUser_(row) {
  return {
    codigoCensista: String(row.codigo_censista || ''),
    nombres: String(row.nombres || ''),
    apellidos: String(row.apellidos || ''),
    telefono: String(row.telefono || ''),
    rol: String(row.rol || ''),
    activo: active_(row.activo),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    ultimoAcceso: row.ultimo_acceso || ''
  };
}

function bootstrapRequired_() {
  return !objects_(SHEETS.USERS).some(function (user) {
    return String(user.rol) === ROLE.ADMIN && active_(user.activo);
  });
}

function bootstrapAdmin_(payload, client) {
  if (!bootstrapRequired_()) throw apiError_('BOOTSTRAP_COMPLETE', 'El administrador inicial ya fue creado.');
  const supplied = text_(payload.bootstrapKey, 'clave inicial', 80, true);
  const expected = configValue_('bootstrap_key', '');
  if (!expected || !secureEqual_(sha256_(supplied), sha256_(expected))) {
    throw apiError_('BOOTSTRAP_INVALID', 'La clave inicial no es valida.');
  }
  const code = digits_(payload.codigoCensista, 'codigo de censista', 5, 12);
  const pin = validatePin_(payload.pin);
  const salt = randomSecret_().slice(0, 32);
  const now = nowIso_();
  appendObject_(SHEETS.USERS, {
    codigo_censista: code,
    nombres: text_(payload.nombres, 'nombres', 80, true),
    apellidos: text_(payload.apellidos, 'apellidos', 80, true),
    rol: ROLE.ADMIN,
    pin_salt: salt,
    pin_hash: hashPin_(pin, salt),
    activo: true,
    telefono: '',
    created_at: now,
    updated_at: now,
    ultimo_acceso: ''
  });
  setConfigValue_('bootstrap_key', '', 'Consumida al crear el primer administrador');
  setConfigValue_('bootstrap_completed_at', now, 'Fecha de creacion del primer administrador');
  audit_(null, 'BOOTSTRAP_ADMIN', 'USUARIO', code, {}, client);
  return { ok: true };
}

function requestAccess_(payload, client) {
  const code = digits_(payload.codigoCensista, 'codigo de censista', 5, 12);
  if (objects_(SHEETS.USERS).some(function (user) { return String(user.codigo_censista) === code && active_(user.activo); })) {
    throw apiError_('USER_EXISTS', 'El usuario ya existe. Intente ingresar o contacte al administrador.');
  }
  const pin = validatePin_(payload.pin);
  const salt = randomSecret_().slice(0, 32);
  const existing = objects_(SHEETS.REQUESTS).filter(function (request) {
    return String(request.codigo_censista) === code && String(request.estado) === 'PENDIENTE';
  })[0];
  const now = nowIso_();
  upsertObject_(SHEETS.REQUESTS, 'codigo_censista', code, {
    solicitud_id: existing ? existing.solicitud_id : Utilities.getUuid(),
    codigo_censista: code,
    nombres: text_(payload.nombres, 'nombres', 80, true),
    apellidos: text_(payload.apellidos, 'apellidos', 80, true),
    telefono: text_(payload.telefono, 'telefono', 30, false),
    pin_salt: salt,
    pin_hash: hashPin_(pin, salt),
    requested_at: now,
    estado: 'PENDIENTE',
    revisado_por: '',
    revisado_at: '',
    notas: ''
  });
  audit_(null, 'SOLICITAR_ACCESO', 'SOLICITUD', code, {}, client);
  return { ok: true };
}

function login_(payload, client) {
  const code = digits_(payload.codigoCensista, 'codigo de censista', 5, 12);
  const throttle = CacheService.getScriptCache();
  const throttleKey = 'login-fail-' + code;
  const failures = Number(throttle.get(throttleKey) || 0);
  if (failures >= 8) throw apiError_('AUTH_THROTTLED', 'Demasiados intentos. Espere diez minutos.');
  const user = objects_(SHEETS.USERS).filter(function (item) {
    return String(item.codigo_censista) === code;
  })[0];
  const candidateHash = user ? hashPin_(String(payload.pin || ''), String(user.pin_salt || '')) : sha256_(String(payload.pin || ''));
  if (!user || !active_(user.activo) || !secureEqual_(candidateHash, String(user.pin_hash || ''))) {
    throttle.put(throttleKey, String(failures + 1), 600);
    audit_(null, 'LOGIN_FALLIDO', 'USUARIO', code, {}, client);
    throw apiError_('AUTH_INVALID', 'Cedula o PIN incorrectos.');
  }
  throttle.remove(throttleKey);
  const token = randomSecret_();
  const tokenHash = sha256_(token);
  const created = new Date();
  const expires = new Date(created.getTime() + SYSTEM_CONFIG.SESSION_HOURS * 60 * 60 * 1000);
  appendObject_(SHEETS.SESSIONS, {
    token_hash: tokenHash,
    codigo_censista: code,
    rol: String(user.rol),
    created_at: created.toISOString(),
    expires_at: expires.toISOString(),
    revoked: false,
    last_seen: created.toISOString(),
    device_id: client && client.deviceId || '',
    user_agent: client && String(client.userAgent || '').slice(0, 500) || ''
  });
  upsertObject_(SHEETS.USERS, 'codigo_censista', code, {
    ultimo_acceso: created.toISOString(),
    updated_at: user.updated_at || created.toISOString()
  });
  const session = { codigoCensista: code, rol: String(user.rol), tokenHash: tokenHash };
  audit_(session, 'LOGIN', 'USUARIO', code, {}, client);
  return { token: token, expiresAt: expires.toISOString(), user: publicUser_(user) };
}

function sessionFromToken_(token) {
  if (!token) throw apiError_('AUTH_REQUIRED', 'Debe iniciar sesion.');
  const tokenHash = sha256_(token);
  const row = objects_(SHEETS.SESSIONS).filter(function (session) {
    return String(session.token_hash) === tokenHash;
  })[0];
  if (!row || active_(row.revoked)) throw apiError_('AUTH_REQUIRED', 'La sesion no es valida.');
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    upsertObject_(SHEETS.SESSIONS, 'token_hash', tokenHash, { revoked: true, last_seen: nowIso_() });
    throw apiError_('SESSION_EXPIRED', 'La sesion vencio.');
  }
  const user = objects_(SHEETS.USERS).filter(function (item) {
    return String(item.codigo_censista) === String(row.codigo_censista);
  })[0];
  if (!user || !active_(user.activo)) throw apiError_('AUTH_REQUIRED', 'El usuario esta inactivo.');
  return {
    codigoCensista: String(user.codigo_censista),
    rol: String(user.rol),
    tokenHash: tokenHash,
    user: user
  };
}

function requireRole_(session, allowed) {
  if (allowed.indexOf(session.rol) < 0) {
    throw apiError_('FORBIDDEN', 'No tiene permiso para realizar esta accion.');
  }
}

function logout_(session, client) {
  upsertObject_(SHEETS.SESSIONS, 'token_hash', session.tokenHash, { revoked: true, last_seen: nowIso_() });
  audit_(session, 'LOGOUT', 'USUARIO', session.codigoCensista, {}, client);
  return { ok: true };
}
