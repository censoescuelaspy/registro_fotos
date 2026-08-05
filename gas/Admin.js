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
    updatedAt: row.updated_at || '',
    equipoId: String(row.equipo_id || '')
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

function recordsPhotosAudit_(records, photos, schoolCatalog) {
  const keys = {};
  const linkedCounts = {};
  const recordsWithoutKey = [];
  const recordsOutsideCatalog = [];
  const photosOutsideCatalog = [];
  const orphanPhotos = [];
  (records || []).forEach(function (record) {
    const key = String(record.record_key || record.recordKey || '').trim();
    if (key) keys[key] = record;
    else recordsWithoutKey.push(record);
    if (!canonicalAppSchoolCode_(record.codigo_escuela || record.codigoEscuela, schoolCatalog)) {
      recordsOutsideCatalog.push(record);
    }
  });
  (photos || []).forEach(function (photo) {
    const key = String(photo.record_key || photo.recordKey || '').trim();
    if (key && keys[key]) linkedCounts[key] = (linkedCounts[key] || 0) + 1;
    else orphanPhotos.push(photo);
    if (!canonicalAppSchoolCode_(photo.codigo_escuela || photo.codigoEscuela, schoolCatalog)) {
      photosOutsideCatalog.push(photo);
    }
  });
  const countMismatches = (records || []).filter(function (record) {
    const key = String(record.record_key || record.recordKey || '').trim();
    return Number(record.cantidad_fotos || record.cantidadFotos || 0) !== Number(linkedCounts[key] || 0);
  });
  const issues = recordsWithoutKey.length + recordsOutsideCatalog.length + photosOutsideCatalog.length
    + orphanPhotos.length + countMismatches.length;
  return {
    status: issues ? 'REVISAR' : 'OK',
    recordsTotal: (records || []).length,
    photosTotal: (photos || []).length,
    photosLinked: (photos || []).length - orphanPhotos.length,
    photosOrphaned: orphanPhotos.length,
    recordsWithoutKey: recordsWithoutKey.length,
    recordsOutsideCatalog: recordsOutsideCatalog.length,
    photosOutsideCatalog: photosOutsideCatalog.length,
    countMismatches: countMismatches.length,
    generatedAt: nowIso_(),
    samples: {
      orphanPhotos: orphanPhotos.slice(0, 10).map(function (photo) {
        return {
          fotoId: String(photo.foto_id || photo.fotoId || ''),
          recordKey: String(photo.record_key || photo.recordKey || ''),
          codigoEscuela: String(photo.codigo_escuela || photo.codigoEscuela || '')
        };
      }),
      recordsOutsideCatalog: recordsOutsideCatalog.slice(0, 10).map(function (record) {
        return {
          recordKey: String(record.record_key || record.recordKey || ''),
          recordId: String(record.record_id || record.recordId || ''),
          codigoEscuela: String(record.codigo_escuela || record.codigoEscuela || '')
        };
      }),
      countMismatches: countMismatches.slice(0, 10).map(function (record) {
        const key = String(record.record_key || record.recordKey || '').trim();
        return {
          recordKey: key,
          recordId: String(record.record_id || record.recordId || ''),
          declaredPhotos: Number(record.cantidad_fotos || record.cantidadFotos || 0),
          linkedPhotos: Number(linkedCounts[key] || 0)
        };
      })
    }
  };
}

function adminDashboard_(session) {
  requireRole_(session, [ROLE.ADMIN, ROLE.SUPERVISOR]);
  const isAdmin = session.rol === ROLE.ADMIN;
  const context = teamContextForCode_(session.codigoCensista);
  const management = teamManagementData_(session);
  const allUsers = objects_(SHEETS.USERS);
  const managementCodes = {};
  management.managementUsers.forEach(function (user) { managementCodes[String(user.codigoCensista)] = true; });
  const users = isAdmin ? allUsers : allUsers.filter(function (user) {
    return managementCodes[String(user.codigo_censista || '')];
  });
  const allowedCodes = {};
  if (isAdmin) allUsers.forEach(function (user) { allowedCodes[String(user.codigo_censista)] = true; });
  else Object.keys(context.memberCodes).forEach(function (code) { allowedCodes[code] = true; });
  const assignments = objects_(SHEETS.ASSIGNMENTS).filter(function (item) {
    if (isAdmin) return true;
    const teamId = String(item.equipo_id || '');
    return teamId ? Boolean(context.teamIds[teamId]) : Boolean(allowedCodes[String(item.codigo_censista)]);
  });
  const requests = objects_(SHEETS.REQUESTS).filter(function (item) {
    return isAdmin || allowedCodes[String(item.codigo_censista)];
  });
  const records = objects_(SHEETS.RECORDS).filter(function (item) {
    return isAdmin || recordVisibleToContext_(item, context);
  });
  const schoolCatalog = objects_(SHEETS.SCHOOLS);
  const recordsByKey = {};
  records.forEach(function (record) { recordsByKey[String(record.record_key || '')] = true; });
  const photos = objects_(SHEETS.PHOTOS).filter(function (photo) {
    return !photo.deleted_at && (isAdmin || recordsByKey[String(photo.record_key || '')]);
  });
  const dataQuality = recordsPhotosAudit_(records, photos, schoolCatalog);
  const linkedPhotos = linkedActivePhotos_(records, photos);
  const photoCounts = {};
  linkedPhotos.forEach(function (photo) {
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
  const activeMemberships = objects_(SHEETS.TEAM_MEMBERS).filter(function (member) { return active_(member.activo); });
  assignments.filter(function (item) { return active_(item.activo); }).forEach(function (item) {
    const assignmentTeamId = String(item.equipo_id || '');
    const owner = users.filter(function (user) {
      return String(user.codigo_censista) === String(item.codigo_censista);
    })[0];
    const team = owner ? String(owner.equipo || '').trim() : '';
    const teamMemberCodes = {};
    if (assignmentTeamId) activeMemberships.forEach(function (member) {
      if (String(member.equipo_id || '') === assignmentTeamId) teamMemberCodes[String(member.codigo_censista || '')] = true;
    });
    users.forEach(function (user) {
      const sameOwner = String(user.codigo_censista) === String(item.codigo_censista);
      const sameTeam = team && String(user.equipo || '').trim() === team;
      const normalizedMember = assignmentTeamId && teamMemberCodes[String(user.codigo_censista || '')];
      if (!sameOwner && !sameTeam && !normalizedMember) return;
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
  const activeAssignmentTeamBySchool = {};
  objects_(SHEETS.ASSIGNMENTS).forEach(function (assignment) {
    if (!active_(assignment.activo)) return;
    const code = canonicalAppSchoolCode_(assignment.codigo_escuela, schoolCatalog)
      || String(assignment.codigo_escuela || '');
    activeAssignmentTeamBySchool[code] = String(assignment.equipo_id || '');
  });
  const manageableSchoolCodes = schoolCatalog.filter(function (school) {
    if (isAdmin) return true;
    const teamId = activeAssignmentTeamBySchool[String(school.codigo || '')] || '';
    return !teamId || Boolean(context.teamIds[teamId]);
  }).map(function (school) { return String(school.codigo || ''); });
  return {
    counts: {
      usuarios: users.length,
      asignaciones: assignments.filter(function (item) { return active_(item.activo); }).length,
      registros: records.length,
      fotos: linkedPhotos.length,
      fotosTotales: photos.length,
      fotosHuerfanas: dataQuality.photosOrphaned,
      solicitudesPendientes: requests.filter(function (item) { return String(item.estado) === 'PENDIENTE'; }).length
    },
    users: users.map(publicUser_).sort(function (a, b) { return (a.apellidos + a.nombres).localeCompare(b.apellidos + b.nombres); }),
    assignments: assignments.map(function (row) { return assignmentView_(row, schoolCatalog); }),
    teams: management.teams,
    teamMembers: management.teamMembers,
    managementUsers: management.managementUsers,
    manageableSchoolCodes: manageableSchoolCodes,
    requests: requests.map(requestView_),
    surveyorSummary: Object.keys(summaryMap).map(function (key) { return summaryMap[key]; })
      .sort(function (a, b) { return b.registros - a.registros || a.apellidos.localeCompare(b.apellidos); }),
    records: records.sort(function (a, b) {
      return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    }).slice(0, 200).map(recordView_),
    dataQuality: dataQuality,
    photoRootUrl: isAdmin ? configValue_('photo_root_folder_url', '') : '',
    performance: performanceDashboard_(schoolCatalog, '', isAdmin ? null : context.teamIds)
  };
}

function saveUser_(input, session, client) {
  requireRole_(session, [ROLE.ADMIN]);
  const code = digits_(input.codigoCensista, 'codigo de censista', 5, 12);
  const role = requireIn_(input.rol, [ROLE.SURVEYOR, ROLE.SUPERVISOR, ROLE.ADMIN], 'rol');
  const team = text_(input.equipo, 'equipo', 60, false);
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
      && !teamContextForCode_(session.codigoCensista).memberCodes[code]) {
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
  const result = saveAssignmentsBatch_([input], session, client);
  return { ok: true, updated: result.updated };
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
  const seenSchools = {};
  const normalized = items.map(function (item) {
    const requestedSchool = digits_(item.codigoEscuela, 'codigo de escuela', 3, 12);
    const schoolRow = schoolByAnyCode_(requestedSchool, schoolCatalog);
    if (!schoolRow) throw apiError_('SCHOOL_NOT_FOUND', 'La escuela ' + requestedSchool + ' no existe.');
    const school = String(schoolRow.codigo || '');
    const surveyor = item.codigoCensista
      ? digits_(item.codigoCensista, 'codigo de censista', 5, 12)
      : '';
    const teamId = text_(item.equipoId, 'equipo', 100, false);
    const assignmentId = text_(item.assignmentId, 'asignacion', 100, false);
    const activate = item.activo !== false && Boolean(teamId || surveyor);
    if (seenSchools[school]) throw apiError_('VALIDATION_ERROR', 'La escuela ' + school + ' esta repetida en el lote.');
    seenSchools[school] = true;
    return {
      codigoEscuela: school,
      codigoCensista: surveyor,
      equipoId: teamId,
      assignmentId: assignmentId,
      activo: activate,
      notas: text_(item.notas, 'notas', 500, false)
    };
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const isSupervisor = session.rol === ROLE.SUPERVISOR;
    const teams = objects_(SHEETS.TEAMS);
    const memberships = objects_(SHEETS.TEAM_MEMBERS);
    const users = objects_(SHEETS.USERS);
    const activeTeamIds = {};
    const managedTeamIds = {};
    teams.forEach(function (team) {
      const id = String(team.equipo_id || '');
      if (active_(team.activo)) activeTeamIds[id] = true;
      if (canManageTeam_(session, team)) managedTeamIds[id] = true;
    });
    const teamByUser = {};
    const membersByTeam = {};
    memberships.forEach(function (member) {
      const teamId = String(member.equipo_id || '');
      const code = String(member.codigo_censista || '');
      if (!active_(member.activo) || !activeTeamIds[teamId]) return;
      teamByUser[code] = teamId;
      if (!membersByTeam[teamId]) membersByTeam[teamId] = [];
      membersByTeam[teamId].push(code);
    });
    const validSurveyors = {};
    users.forEach(function (user) {
      if (active_(user.activo) && String(user.rol || '') === ROLE.SURVEYOR) {
        validSurveyors[String(user.codigo_censista || '')] = true;
      }
    });
    Object.keys(membersByTeam).forEach(function (teamId) {
      membersByTeam[teamId] = membersByTeam[teamId].filter(function (code) { return validSurveyors[code]; }).sort();
    });
    const sheet = spreadsheet_().getSheetByName(SHEETS.ASSIGNMENTS);
    const names = headers_(SHEETS.ASSIGNMENTS);
    const indexes = {};
    names.forEach(function (name, index) { indexes[name] = index; });
    const rowCount = Math.max(0, sheet.getLastRow() - 1);
    const values = rowCount ? sheet.getRange(2, 1, rowCount, names.length).getValues() : [];
    const now = nowIso_();

    const newRows = [];
    normalized.forEach(function (item) {
      let teamId = item.equipoId || teamByUser[item.codigoCensista] || '';
      let surveyor = item.codigoCensista;
      if (item.activo) {
        if (!teamId || !activeTeamIds[teamId]) throw apiError_('TEAM_INACTIVE', 'Seleccione un equipo activo para la escuela ' + item.codigoEscuela + '.');
        if (isSupervisor && !managedTeamIds[teamId]) throw apiError_('FORBIDDEN', 'Solo puede asignar escuelas a equipos bajo su coordinacion.');
        if (surveyor && teamByUser[surveyor] !== teamId) {
          throw apiError_('MEMBER_NOT_IN_TEAM', 'El encuestador seleccionado no integra el equipo indicado.');
        }
        surveyor = surveyor || (membersByTeam[teamId] || [])[0] || '';
        if (!surveyor) throw apiError_('TEAM_WITHOUT_MEMBERS', 'El equipo seleccionado no tiene encuestadores activos.');
      }
      const matching = [];
      values.forEach(function (row, index) {
        const rowSchool = canonicalAppSchoolCode_(row[indexes.codigo_escuela], schoolCatalog)
          || String(row[indexes.codigo_escuela] || '');
        if (rowSchool === item.codigoEscuela) {
          row[indexes.codigo_escuela] = item.codigoEscuela;
          matching.push(index);
        }
      });
      matching.forEach(function (index) {
        const row = values[index];
        if (!active_(row[indexes.activo])) return;
        const currentTeamId = String(row[indexes.equipo_id] || teamByUser[String(row[indexes.codigo_censista] || '')] || '');
        if (isSupervisor && currentTeamId && !managedTeamIds[currentTeamId]) {
          throw apiError_('FORBIDDEN', 'La escuela ' + item.codigoEscuela + ' pertenece a otro equipo.');
        }
      });
      let selected = -1;
      if (item.activo) {
        for (let position = matching.length - 1; position >= 0; position -= 1) {
          const index = matching[position];
          const sameAssignment = item.assignmentId && String(values[index][indexes.assignment_id] || '') === item.assignmentId;
          const sameTeam = String(values[index][indexes.equipo_id] || teamByUser[String(values[index][indexes.codigo_censista] || '')] || '') === teamId;
          if (sameAssignment || sameTeam || String(values[index][indexes.codigo_censista] || '') === surveyor) {
            selected = index;
            break;
          }
        }
      }
      matching.forEach(function (index) {
        const row = values[index];
        const shouldUpdate = active_(row[indexes.activo]) || index === selected
          || item.assignmentId && String(row[indexes.assignment_id] || '') === item.assignmentId;
        if (!shouldUpdate) return;
        row[indexes.activo] = item.activo && index === selected;
        row[indexes.asignado_por] = session.codigoCensista;
        row[indexes.updated_at] = now;
        if (index === selected) {
          row[indexes.codigo_censista] = surveyor;
          row[indexes.equipo_id] = teamId;
          if (item.notas) row[indexes.notas] = item.notas;
        }
      });
      if (item.activo && selected < 0) {
        const object = {
          assignment_id: Utilities.getUuid(),
          codigo_censista: surveyor,
          codigo_escuela: item.codigoEscuela,
          activo: true,
          fecha_asignacion: now,
          asignado_por: session.codigoCensista,
          notas: item.notas || 'Asignacion actualizada desde logistica',
          updated_at: now,
          equipo_id: teamId
        };
        newRows.push(names.map(function (name) { return safeCell_(object[name]); }));
      }
    });

    if (values.length) sheet.getRange(2, 1, values.length, names.length).setValues(values);
    if (newRows.length) {
      const startRow = Math.max(2, sheet.getLastRow() + 1);
      const requiredRows = startRow + newRows.length - 1;
      if (requiredRows > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
      sheet.getRange(startRow, 1, newRows.length, names.length).setValues(newRows);
    }
  } finally {
    lock.releaseLock();
  }
  audit_(session, 'GUARDAR_ASIGNACIONES_LOTE', 'ASIGNACION', 'LOTE', {
    cantidad: normalized.length,
    inactivadas: normalized.filter(function (item) { return !item.activo; }).length
  }, client);
  return { ok: true, updated: normalized.length };
}

function saveTeamAssignmentsBatch_(items, session, client) {
  return saveAssignmentsBatch_(items, session, client);
}

function setAssignmentActive_(input, session, client) {
  return saveAssignmentsBatch_([input], session, client);
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
