function assignmentView_(row, schoolCatalog) {
  const school = schoolByAnyCode_(row.codigo_escuela, schoolCatalog);
  return {
    assignmentId: String(row.assignment_id || ''),
    codigoCensista: String(row.codigo_censista || ''),
    codigoEscuela: String(school ? school.codigo : row.codigo_escuela || ''),
    codigoRue: String(school ? school.codigo_rue || canonicalRueCode_(school.codigo) : canonicalRueCode_(row.codigo_escuela)),
    sitioId: String(school ? school.sitio_id || '' : ''),
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
  const isAdmin = session.rol === ROLE.ADMIN;
  const team = isAdmin ? '' : String(session.user.equipo || '').trim();
  const allUsers = objects_(SHEETS.USERS);
  const users = isAdmin ? allUsers : allUsers.filter(function (user) {
    return team && String(user.equipo || '').trim() === team;
  });
  const allowedCodes = {};
  users.forEach(function (user) { allowedCodes[String(user.codigo_censista)] = true; });
  const assignments = objects_(SHEETS.ASSIGNMENTS).filter(function (item) {
    return isAdmin || allowedCodes[String(item.codigo_censista)];
  });
  const requests = objects_(SHEETS.REQUESTS).filter(function (item) {
    return isAdmin || allowedCodes[String(item.codigo_censista)];
  });
  const records = objects_(SHEETS.RECORDS).filter(function (item) {
    return isAdmin || allowedCodes[String(item.codigo_censista)];
  });
  const schoolCatalog = objects_(SHEETS.SCHOOLS);
  const photos = objects_(SHEETS.PHOTOS).filter(function (photo) {
    return !photo.deleted_at && (isAdmin || allowedCodes[String(photo.codigo_censista)]);
  });
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
      equipo: String(user.equipo || ''),
      escuelasAsignadas: 0,
      registros: 0,
      finalizados: 0,
      conPendientes: 0,
      fotos: photoCounts[String(user.codigo_censista)] || 0,
      ultimaCarga: ''
    };
  });
  assignments.filter(function (item) { return active_(item.activo); }).forEach(function (item) {
    const owner = users.filter(function (user) {
      return String(user.codigo_censista) === String(item.codigo_censista);
    })[0];
    const team = owner ? String(owner.equipo || '').trim() : '';
    users.forEach(function (user) {
      const sameOwner = String(user.codigo_censista) === String(item.codigo_censista);
      const sameTeam = team && String(user.equipo || '').trim() === team;
      if (!sameOwner && !sameTeam) return;
      const summary = summaryMap[String(user.codigo_censista)];
      if (summary) summary.escuelasAsignadas += 1;
    });
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
    assignments: assignments.map(function (row) { return assignmentView_(row, schoolCatalog); }),
    requests: requests.map(requestView_),
    surveyorSummary: Object.keys(summaryMap).map(function (key) { return summaryMap[key]; })
      .sort(function (a, b) { return b.registros - a.registros || a.apellidos.localeCompare(b.apellidos); }),
    records: records.sort(function (a, b) {
      return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    }).slice(0, 200).map(recordView_),
    photoRootUrl: isAdmin ? configValue_('photo_root_folder_url', '') : '',
    performance: performanceDashboard_(schoolCatalog, team)
  };
}

function saveUser_(input, session, client) {
  requireRole_(session, [ROLE.ADMIN]);
  const code = digits_(input.codigoCensista, 'codigo de censista', 5, 12);
  const role = requireIn_(input.rol, [ROLE.SURVEYOR, ROLE.SUPERVISOR, ROLE.ADMIN], 'rol');
  const team = text_(input.equipo, 'equipo', 30, false);
  if (team && !/^Equipo [1-8]$/.test(team)) {
    throw apiError_('VALIDATION_ERROR', 'El equipo debe estar entre Equipo 1 y Equipo 8.');
  }
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
    ultimo_acceso: existing ? existing.ultimo_acceso : '',
    equipo: team,
    disponible_campo: input.disponibleCampo !== false,
    motivo_indisponibilidad: input.disponibleCampo === false
      ? text_(input.motivoIndisponibilidad, 'motivo de indisponibilidad', 250, false)
      : '',
    disponibilidad_updated_at: now
  });
  audit_(session, existing ? 'ACTUALIZAR_USUARIO' : 'CREAR_USUARIO', 'USUARIO', code, {
    rol: role,
    equipo: team
  }, client);
  return { ok: true };
}

function setAvailability_(input, session, client) {
  requireRole_(session, [ROLE.ADMIN, ROLE.SUPERVISOR]);
  const code = digits_(input.codigoCensista, 'codigo de censista', 5, 12);
  const user = objects_(SHEETS.USERS).filter(function (item) {
    return String(item.codigo_censista) === code && active_(item.activo);
  })[0];
  if (!user || String(user.rol) !== ROLE.SURVEYOR) {
    throw apiError_('USER_NOT_FOUND', 'El censista no existe o no esta activo.');
  }
  if (session.rol === ROLE.SUPERVISOR
      && String(user.equipo || '').trim() !== String(session.user.equipo || '').trim()) {
    throw apiError_('FORBIDDEN', 'Solo puede actualizar integrantes de su propio equipo.');
  }
  const available = input.disponibleCampo !== false;
  const now = nowIso_();
  upsertObject_(SHEETS.USERS, 'codigo_censista', code, {
    disponible_campo: available,
    motivo_indisponibilidad: available
      ? ''
      : text_(input.motivoIndisponibilidad, 'motivo de indisponibilidad', 250, false),
    disponibilidad_updated_at: now,
    updated_at: now
  });
  audit_(session, 'CAMBIAR_DISPONIBILIDAD', 'USUARIO', code, {
    disponibleCampo: available,
    motivo: available ? '' : text_(input.motivoIndisponibilidad, 'motivo', 250, false)
  }, client);
  return { ok: true, disponibleCampo: available };
}

function saveAssignment_(input, session, client) {
  requireRole_(session, [ROLE.ADMIN, ROLE.SUPERVISOR]);
  const surveyor = digits_(input.codigoCensista, 'codigo de censista', 5, 12);
  const requestedSchool = digits_(input.codigoEscuela, 'codigo de escuela', 3, 12);
  const schoolCatalog = objects_(SHEETS.SCHOOLS);
  const schoolRow = schoolByAnyCode_(requestedSchool, schoolCatalog);
  if (!schoolRow) throw apiError_('SCHOOL_NOT_FOUND', 'La escuela no existe.');
  const school = String(schoolRow.codigo || '');
  const activate = input.activo !== false;
  const targetUser = objects_(SHEETS.USERS).filter(function (user) {
    return String(user.codigo_censista) === surveyor && active_(user.activo);
  })[0];
  const userExists = Boolean(targetUser);
  if (activate && !userExists) throw apiError_('USER_NOT_FOUND', 'El usuario no existe o esta inactivo.');
  if (session.rol === ROLE.SUPERVISOR) {
    const supervisorTeam = String(session.user.equipo || '').trim();
    if (!targetUser || !supervisorTeam || String(targetUser.equipo || '').trim() !== supervisorTeam) {
      throw apiError_('FORBIDDEN', 'Solo puede asignar integrantes de su propio equipo.');
    }
    const allowedSchools = {};
    activeAssignmentsFor_(session.codigoCensista).forEach(function (assignment) {
      const allowedCode = canonicalAppSchoolCode_(assignment.codigo_escuela, schoolCatalog)
        || String(assignment.codigo_escuela);
      allowedSchools[allowedCode] = true;
    });
    if (!allowedSchools[school]) {
      throw apiError_('FORBIDDEN', 'Solo puede reasignar escuelas que ya pertenecen a su equipo.');
    }
  }
  const key = surveyor + ':' + school;
  const existing = objects_(SHEETS.ASSIGNMENTS).filter(function (assignment) {
    const assignedSchool = canonicalAppSchoolCode_(assignment.codigo_escuela, schoolCatalog) || String(assignment.codigo_escuela);
    return String(assignment.codigo_censista) + ':' + assignedSchool === key;
  })[0];
  const now = nowIso_();
  if (existing) {
    upsertObject_(SHEETS.ASSIGNMENTS, 'assignment_id', existing.assignment_id, {
      codigo_escuela: school,
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

function saveAssignmentsBatch_(items, session, client) {
  requireRole_(session, [ROLE.ADMIN, ROLE.SUPERVISOR]);
  if (!Array.isArray(items) || !items.length) {
    throw apiError_('VALIDATION_ERROR', 'No se recibieron cambios de asignacion.');
  }
  if (items.length > 200) {
    throw apiError_('VALIDATION_ERROR', 'El lote supera el maximo de 200 escuelas.');
  }

  const schoolCatalog = objects_(SHEETS.SCHOOLS);
  const supervisorTeam = session.rol === ROLE.SUPERVISOR ? String(session.user.equipo || '').trim() : '';
  const allowedSchools = {};
  if (supervisorTeam) {
    activeAssignmentsFor_(session.codigoCensista).forEach(function (assignment) {
      const code = canonicalAppSchoolCode_(assignment.codigo_escuela, schoolCatalog)
        || String(assignment.codigo_escuela);
      allowedSchools[code] = true;
    });
  }
  const validUsers = {};
  objects_(SHEETS.USERS).forEach(function (user) {
    const sameTeam = !supervisorTeam || String(user.equipo || '').trim() === supervisorTeam;
    if (active_(user.activo) && String(user.rol) !== ROLE.ADMIN && sameTeam) {
      validUsers[String(user.codigo_censista)] = true;
    }
  });
  const seenSchools = {};
  const normalized = items.map(function (item) {
    const requestedSchool = digits_(item.codigoEscuela, 'codigo de escuela', 3, 12);
    const schoolRow = schoolByAnyCode_(requestedSchool, schoolCatalog);
    if (!schoolRow) throw apiError_('SCHOOL_NOT_FOUND', 'La escuela ' + requestedSchool + ' no existe.');
    const school = String(schoolRow.codigo || '');
    if (supervisorTeam && !allowedSchools[school]) {
      throw apiError_('FORBIDDEN', 'La escuela ' + school + ' no pertenece al equipo del supervisor.');
    }
    const surveyor = item.codigoCensista
      ? digits_(item.codigoCensista, 'codigo de censista', 5, 12)
      : '';
    if (seenSchools[school]) throw apiError_('VALIDATION_ERROR', 'La escuela ' + school + ' esta repetida en el lote.');
    if (surveyor && !validUsers[surveyor]) {
      throw apiError_('USER_NOT_FOUND', 'El censista ' + surveyor + ' no existe, esta inactivo o no es personal de campo.');
    }
    seenSchools[school] = true;
    return { codigoEscuela: school, codigoCensista: surveyor };
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = spreadsheet_().getSheetByName(SHEETS.ASSIGNMENTS);
    const names = headers_(SHEETS.ASSIGNMENTS);
    const indexes = {};
    names.forEach(function (name, index) { indexes[name] = index; });
    const rowCount = Math.max(0, sheet.getLastRow() - 1);
    const values = rowCount ? sheet.getRange(2, 1, rowCount, names.length).getValues() : [];
    const now = nowIso_();

    normalized.forEach(function (item) {
      const matching = [];
      values.forEach(function (row, index) {
        const rowSchool = canonicalAppSchoolCode_(row[indexes.codigo_escuela], schoolCatalog)
          || String(row[indexes.codigo_escuela] || '');
        if (rowSchool === item.codigoEscuela) {
          row[indexes.codigo_escuela] = item.codigoEscuela;
          matching.push(index);
        }
      });
      let selected = -1;
      if (item.codigoCensista) {
        for (let position = matching.length - 1; position >= 0; position -= 1) {
          const index = matching[position];
          if (String(values[index][indexes.codigo_censista] || '') === item.codigoCensista) {
            selected = index;
            break;
          }
        }
      }
      matching.forEach(function (index) {
        const row = values[index];
        row[indexes.activo] = index === selected;
        row[indexes.asignado_por] = session.codigoCensista;
        row[indexes.updated_at] = now;
      });
      if (item.codigoCensista && selected < 0) {
        const object = {
          assignment_id: Utilities.getUuid(),
          codigo_censista: item.codigoCensista,
          codigo_escuela: item.codigoEscuela,
          activo: true,
          fecha_asignacion: now,
          asignado_por: session.codigoCensista,
          notas: 'Asignacion actualizada desde logistica',
          updated_at: now
        };
        const newRow = names.map(function (name) { return safeCell_(object[name]); });
        const blankRow = values.findIndex(function (row) {
          return !row[indexes.assignment_id]
            && !row[indexes.codigo_censista]
            && !row[indexes.codigo_escuela];
        });
        if (blankRow >= 0) values[blankRow] = newRow;
        else values.push(newRow);
      }
    });

    if (values.length > sheet.getMaxRows() - 1) {
      sheet.insertRowsAfter(sheet.getMaxRows(), values.length - (sheet.getMaxRows() - 1));
    }
    if (values.length) sheet.getRange(2, 1, values.length, names.length).setValues(values);
  } finally {
    lock.releaseLock();
  }
  audit_(session, 'GUARDAR_ASIGNACIONES_LOTE', 'ASIGNACION', 'LOTE', {
    cantidad: normalized.length,
    sinAsignar: normalized.filter(function (item) { return !item.codigoCensista; }).length
  }, client);
  return { ok: true, updated: normalized.length };
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
      ultimo_acceso: existing ? existing.ultimo_acceso : '',
      equipo: existing ? existing.equipo : '',
      disponible_campo: existing ? fieldAvailable_(existing.disponible_campo) : true,
      motivo_indisponibilidad: existing ? existing.motivo_indisponibilidad : '',
      disponibilidad_updated_at: existing ? existing.disponibilidad_updated_at : now
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
