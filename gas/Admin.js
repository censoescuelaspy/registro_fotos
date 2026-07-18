function assignmentView_(row) {
  return {
    assignmentId: String(row.assignment_id || ''),
    codigoCensista: String(row.codigo_censista || ''),
    codigoEscuela: String(row.codigo_escuela || ''),
    activo: active_(row.activo),
    fechaAsignacion: row.fecha_asignacion || '',
    asignadoPor: String(row.asignado_por || ''),
    notas: String(row.notas || ''),
    updatedAt: row.updated_at || ''
  };
}
function requestView_(row) {
  return {
    solicitudId: String(row.solicitud_id || ''),
    codigoCensista: String(row.codigo_censista || ''),
    nombres: String(row.nombres || ''),
    apellidos: String(row.apellidos || ''),
    telefono: String(row.telefono || ''),
    requestedAt: row.requested_at || '',
    estado: String(row.estado || ''),
    revisadoPor: String(row.revisado_por || ''),
    revisadoAt: row.revisado_at || '',
    notas: String(row.notas || '')
  };
}

function adminDashboard_(session) {
  requireRole_(session, [ROLE.ADMIN, ROLE.SUPERVISOR]);
  const users = objects_(SHEETS.USERS);
  const assignments = objects_(SHEETS.ASSIGNMENTS);
  const requests = objects_(SHEETS.REQUESTS);
  const records = objects_(SHEETS.RECORDS);
  const photos = objects_(SHEETS.PHOTOS).filter(function (photo) { return !photo.deleted_at; });
  const photoCounts = {};
  photos.forEach(function (photo) {
    const key = String(photo.codigo_censista);
    photoCounts[key] = (photoCounts[key] || 0) + 1;
  });
  const summaryMap = {};
  users.forEach(function (user) {
    summaryMap[String(user.codigo_censista)] = {
      codigoCensista: String(user.codigo_censista),
      nombres: String(user.nombres || ''),
      apellidos: String(user.apellidos || ''),
      rol: String(user.rol || ''),
      escuelasAsignadas: 0,
      registros: 0,
      finalizados: 0,
      conPendientes: 0,
      fotos: photoCounts[String(user.codigo_censista)] || 0,
      ultimaCarga: ''
    };
  });
  assignments.filter(function (item) { return active_(item.activo); }).forEach(function (item) {
    const summary = summaryMap[String(item.codigo_censista)];
    if (summary) summary.escuelasAsignadas += 1;
  });
  records.forEach(function (record) {
    const summary = summaryMap[String(record.codigo_censista)];
    if (!summary) return;
    summary.registros += 1;
    if (String(record.estado) === 'FINALIZADO') summary.finalizados += 1;
    if (String(record.estado) === 'CON_PENDIENTES') summary.conPendientes += 1;
    const updated = String(record.updated_at || record.synced_at || '');
    if (updated > summary.ultimaCarga) summary.ultimaCarga = updated;
  });
  return {
    counts: {
      usuarios: users.length,
      asignaciones: assignments.filter(function (item) { return active_(item.activo); }).length,
      registros: records.length,
      fotos: photos.length,
      solicitudesPendientes: requests.filter(function (item) { return String(item.estado) === 'PENDIENTE'; }).length
    },
    users: users.map(publicUser_).sort(function (a, b) { return (a.apellidos + a.nombres).localeCompare(b.apellidos + b.nombres); }),
    assignments: assignments.map(assignmentView_),
    requests: requests.map(requestView_),
    surveyorSummary: Object.keys(summaryMap).map(function (key) { return summaryMap[key]; })
      .sort(function (a, b) { return b.registros - a.registros || a.apellidos.localeCompare(b.apellidos); }),
    records: records.sort(function (a, b) {
      return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    }).slice(0, 200).map(recordView_),
    photoRootUrl: configValue_('photo_root_folder_url', '')
  };
}

function saveUser_(input, session, client) {
  requireRole_(session, [ROLE.ADMIN]);
  const code = digits_(input.codigoCensista, 'codigo de censista', 5, 12);
  const role = requireIn_(input.rol, [ROLE.SURVEYOR, ROLE.SUPERVISOR, ROLE.ADMIN], 'rol');
  const existing = objects_(SHEETS.USERS).filter(function (user) {
    return String(user.codigo_censista) === code;
  })[0];
  const pin = input.pin ? validatePin_(input.pin) : '';
  if (!existing && !pin) throw apiError_('VALIDATION_ERROR', 'Debe definir un PIN para el usuario nuevo.');
  const salt = pin ? randomSecret_().slice(0, 32) : String(existing.pin_salt || '');
  const now = nowIso_();
  upsertObject_(SHEETS.USERS, 'codigo_censista', code, {
    codigo_censista: code,
    nombres: text_(input.nombres, 'nombres', 80, true),
    apellidos: text_(input.apellidos, 'apellidos', 80, true),
    rol: role,
    pin_salt: salt,
    pin_hash: pin ? hashPin_(pin, salt) : String(existing.pin_hash || ''),
    activo: input.activo !== false,
    telefono: text_(input.telefono, 'telefono', 30, false),
    created_at: existing ? existing.created_at : now,
    updated_at: now,
    ultimo_acceso: existing ? existing.ultimo_acceso : ''
  });
  audit_(session, existing ? 'ACTUALIZAR_USUARIO' : 'CREAR_USUARIO', 'USUARIO', code, { rol: role }, client);
  return { ok: true };
}

function saveAssignment_(input, session, client) {
  requireRole_(session, [ROLE.ADMIN, ROLE.SUPERVISOR]);
  const surveyor = digits_(input.codigoCensista, 'codigo de censista', 5, 12);
  const school = digits_(input.codigoEscuela, 'codigo de escuela', 3, 12);
  const userExists = objects_(SHEETS.USERS).some(function (user) {
    return String(user.codigo_censista) === surveyor && active_(user.activo);
  });
  if (!userExists) throw apiError_('USER_NOT_FOUND', 'El usuario no existe o esta inactivo.');
  const schoolExists = objects_(SHEETS.SCHOOLS).some(function (row) { return String(row.codigo) === school; });
  if (!schoolExists) throw apiError_('SCHOOL_NOT_FOUND', 'La escuela no existe.');
  const key = surveyor + ':' + school;
  const existing = objects_(SHEETS.ASSIGNMENTS).filter(function (assignment) {
    return String(assignment.codigo_censista) + ':' + String(assignment.codigo_escuela) === key;
  })[0];
  const now = nowIso_();
  if (existing) {
    upsertObject_(SHEETS.ASSIGNMENTS, 'assignment_id', existing.assignment_id, {
      activo: input.activo !== false,
      asignado_por: session.codigoCensista,
      notas: text_(input.notas, 'notas', 500, false),
      updated_at: now
    });
  } else {
    appendObject_(SHEETS.ASSIGNMENTS, {
      assignment_id: Utilities.getUuid(),
      codigo_censista: surveyor,
      codigo_escuela: school,
      activo: input.activo !== false,
      fecha_asignacion: now,
      asignado_por: session.codigoCensista,
      notas: text_(input.notas, 'notas', 500, false),
      updated_at: now
    });
  }
  audit_(session, 'GUARDAR_ASIGNACION', 'ASIGNACION', key, { activo: input.activo !== false }, client);
  return { ok: true };
}

function reviewAccess_(payload, session, client) {
  requireRole_(session, [ROLE.ADMIN]);
  const requestId = text_(payload.solicitudId, 'solicitud', 100, true);
  const status = requireIn_(payload.estado, ['APROBADA', 'RECHAZADA'], 'estado');
  const request = objects_(SHEETS.REQUESTS).filter(function (item) {
    return String(item.solicitud_id) === requestId;
  })[0];
  if (!request) throw apiError_('REQUEST_NOT_FOUND', 'No se encontro la solicitud.');
  if (String(request.estado) !== 'PENDIENTE') throw apiError_('REQUEST_REVIEWED', 'La solicitud ya fue revisada.');
  const now = nowIso_();
  if (status === 'APROBADA') {
    const code = String(request.codigo_censista);
    const existing = objects_(SHEETS.USERS).filter(function (user) { return String(user.codigo_censista) === code; })[0];
    upsertObject_(SHEETS.USERS, 'codigo_censista', code, {
      codigo_censista: code,
      nombres: request.nombres,
      apellidos: request.apellidos,
      rol: existing ? existing.rol : ROLE.SURVEYOR,
      pin_salt: request.pin_salt,
      pin_hash: request.pin_hash,
      activo: true,
      telefono: request.telefono,
      created_at: existing ? existing.created_at : now,
      updated_at: now,
      ultimo_acceso: existing ? existing.ultimo_acceso : ''
    });
  }
  upsertObject_(SHEETS.REQUESTS, 'solicitud_id', requestId, {
    estado: status,
    revisado_por: session.codigoCensista,
    revisado_at: now,
    notas: text_(payload.notas, 'notas', 500, false)
  });
  audit_(session, 'REVISAR_SOLICITUD', 'SOLICITUD', requestId, { estado: status }, client);
  return { ok: true };
}
