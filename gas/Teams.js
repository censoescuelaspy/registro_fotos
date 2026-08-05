function teamView_(row) {
  return {
    equipoId: String(row.equipo_id || ''),
    nombre: String(row.nombre || ''),
    coordinadorCodigo: String(row.coordinador_codigo || ''),
    activo: active_(row.activo),
    createdAt: row.created_at || '',
    createdBy: String(row.created_by || ''),
    updatedAt: row.updated_at || '',
    notas: String(row.notas || '')
  };
}

function teamMemberView_(row) {
  return {
    membershipId: String(row.membership_id || ''),
    equipoId: String(row.equipo_id || ''),
    codigoCensista: String(row.codigo_censista || ''),
    activo: active_(row.activo),
    fechaAsignacion: row.fecha_asignacion || '',
    asignadoPor: String(row.asignado_por || ''),
    updatedAt: row.updated_at || ''
  };
}

function teamContextForCode_(code) {
  const requested = String(code || '');
  const users = objects_(SHEETS.USERS);
  const current = users.filter(function (user) {
    return String(user.codigo_censista) === requested && active_(user.activo);
  })[0];
  const activeTeams = objects_(SHEETS.TEAMS).filter(function (team) { return active_(team.activo); });
  const activeMemberships = objects_(SHEETS.TEAM_MEMBERS).filter(function (member) { return active_(member.activo); });
  const teamIds = {};
  activeTeams.forEach(function (team) {
    if (String(team.coordinador_codigo || '') === requested) teamIds[String(team.equipo_id)] = true;
  });
  activeMemberships.forEach(function (member) {
    if (String(member.codigo_censista || '') === requested) teamIds[String(member.equipo_id)] = true;
  });
  const activeTeamIds = {};
  activeTeams.forEach(function (team) {
    const id = String(team.equipo_id || '');
    if (teamIds[id]) activeTeamIds[id] = true;
  });
  const memberCodes = {};
  memberCodes[requested] = true;
  activeMemberships.forEach(function (member) {
    if (activeTeamIds[String(member.equipo_id || '')]) memberCodes[String(member.codigo_censista || '')] = true;
  });

  // Compatibilidad con las asignaciones previas a la gestion normalizada de equipos.
  const legacyTeam = current ? String(current.equipo || '').trim() : '';
  if (!Object.keys(activeTeamIds).length && legacyTeam) {
    users.forEach(function (user) {
      if (active_(user.activo) && String(user.equipo || '').trim() === legacyTeam) {
        memberCodes[String(user.codigo_censista || '')] = true;
      }
    });
  }
  return {
    teamIds: activeTeamIds,
    memberCodes: memberCodes,
    legacyTeam: legacyTeam,
    users: users,
    teams: activeTeams,
    memberships: activeMemberships
  };
}

function teamIdForSurveyor_(code) {
  const requested = String(code || '');
  const activeTeams = {};
  objects_(SHEETS.TEAMS).forEach(function (team) {
    if (active_(team.activo)) activeTeams[String(team.equipo_id || '')] = true;
  });
  const membership = objects_(SHEETS.TEAM_MEMBERS).filter(function (member) {
    return active_(member.activo)
      && String(member.codigo_censista || '') === requested
      && activeTeams[String(member.equipo_id || '')];
  }).sort(function (left, right) {
    return String(right.updated_at || '').localeCompare(String(left.updated_at || ''));
  })[0];
  return membership ? String(membership.equipo_id || '') : '';
}

function teamRepresentativeCode_(teamId) {
  const requested = String(teamId || '');
  const users = {};
  objects_(SHEETS.USERS).forEach(function (user) {
    if (active_(user.activo) && String(user.rol || '') === ROLE.SURVEYOR) {
      users[String(user.codigo_censista || '')] = true;
    }
  });
  const codes = objects_(SHEETS.TEAM_MEMBERS).filter(function (member) {
    return active_(member.activo) && String(member.equipo_id || '') === requested
      && users[String(member.codigo_censista || '')];
  }).map(function (member) { return String(member.codigo_censista || ''); })
    .sort(function (left, right) { return left.localeCompare(right); });
  if (!codes.length) throw apiError_('TEAM_WITHOUT_MEMBERS', 'El equipo no tiene encuestadores activos.');
  return codes[0];
}

function canManageTeam_(session, team) {
  if (session.rol === ROLE.ADMIN) return true;
  return session.rol === ROLE.SUPERVISOR
    && String(team.coordinador_codigo || '') === String(session.codigoCensista || '');
}

function managementTeamsFor_(session, includeInactive) {
  return objects_(SHEETS.TEAMS).filter(function (team) {
    return (includeInactive || active_(team.activo)) && canManageTeam_(session, team);
  });
}

function teamManagementData_(session) {
  requireRole_(session, [ROLE.ADMIN, ROLE.SUPERVISOR]);
  const teams = managementTeamsFor_(session, true);
  const teamIds = {};
  teams.forEach(function (team) { teamIds[String(team.equipo_id || '')] = true; });
  const memberships = objects_(SHEETS.TEAM_MEMBERS).filter(function (member) {
    return teamIds[String(member.equipo_id || '')];
  });
  const activeMemberTeam = {};
  objects_(SHEETS.TEAM_MEMBERS).forEach(function (member) {
    if (active_(member.activo)) activeMemberTeam[String(member.codigo_censista || '')] = String(member.equipo_id || '');
  });
  const users = objects_(SHEETS.USERS).filter(function (user) {
    if (session.rol === ROLE.ADMIN) return true;
    const code = String(user.codigo_censista || '');
    const memberTeam = activeMemberTeam[code];
    return code === String(session.codigoCensista || '')
      || String(user.rol || '') === ROLE.SURVEYOR && (!memberTeam || teamIds[memberTeam]);
  });
  return {
    teams: teams.map(teamView_).sort(function (left, right) {
      return left.nombre.localeCompare(right.nombre, 'es', { numeric: true });
    }),
    teamMembers: memberships.map(teamMemberView_),
    managementUsers: users.map(publicUser_).sort(function (left, right) {
      return (left.apellidos + left.nombres).localeCompare(right.apellidos + right.nombres, 'es');
    })
  };
}

function legacyTeamId_(name) {
  const normalized = String(name || '').trim();
  const numbered = normalized.match(/^Equipo\s+(\d+)$/i);
  if (numbered) return 'equipo-' + numbered[1];
  const slug = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  return 'legacy-' + (slug || 'sin-nombre');
}

function backfillLegacyTeams_() {
  const users = objects_(SHEETS.USERS);
  const existingTeams = objects_(SHEETS.TEAMS);
  const existingMembers = objects_(SHEETS.TEAM_MEMBERS);
  const now = nowIso_();
  const legacyNames = {};
  users.forEach(function (user) {
    const name = String(user.equipo || '').trim();
    if (name) legacyNames[name] = true;
  });
  const teamByName = {};
  existingTeams.forEach(function (team) {
    teamByName[String(team.nombre || '').trim().toLocaleLowerCase('es')] = String(team.equipo_id || '');
  });
  Object.keys(legacyNames).sort(function (left, right) {
    return left.localeCompare(right, 'es', { numeric: true });
  }).forEach(function (name) {
    const key = name.toLocaleLowerCase('es');
    if (teamByName[key]) return;
    const supervisors = users.filter(function (user) {
      return active_(user.activo) && String(user.rol || '') === ROLE.SUPERVISOR
        && String(user.equipo || '').trim() === name;
    }).map(function (user) { return String(user.codigo_censista || ''); }).sort();
    const teamId = legacyTeamId_(name);
    appendObject_(SHEETS.TEAMS, {
      equipo_id: teamId,
      nombre: name,
      coordinador_codigo: supervisors[0] || '',
      activo: true,
      created_at: now,
      created_by: 'MIGRACION_' + SYSTEM_CONFIG.SCHEMA_VERSION,
      updated_at: now,
      notas: 'Migrado desde USUARIOS.equipo; no elimina datos historicos'
    });
    teamByName[key] = teamId;
  });

  const activeMembershipByUser = {};
  existingMembers.forEach(function (member) {
    if (active_(member.activo)) activeMembershipByUser[String(member.codigo_censista || '')] = true;
  });
  users.forEach(function (user) {
    const code = String(user.codigo_censista || '');
    const name = String(user.equipo || '').trim();
    if (!name || !active_(user.activo) || String(user.rol || '') !== ROLE.SURVEYOR || activeMembershipByUser[code]) return;
    const teamId = teamByName[name.toLocaleLowerCase('es')];
    const existing = existingMembers.some(function (member) {
      return String(member.equipo_id || '') === teamId && String(member.codigo_censista || '') === code;
    });
    if (!existing) appendObject_(SHEETS.TEAM_MEMBERS, {
      membership_id: Utilities.getUuid(),
      equipo_id: teamId,
      codigo_censista: code,
      activo: true,
      fecha_asignacion: now,
      asignado_por: 'MIGRACION_' + SYSTEM_CONFIG.SCHEMA_VERSION,
      updated_at: now
    });
    activeMembershipByUser[code] = true;
  });

  const teamByUser = {};
  objects_(SHEETS.TEAM_MEMBERS).forEach(function (member) {
    if (active_(member.activo)) teamByUser[String(member.codigo_censista || '')] = String(member.equipo_id || '');
  });
  objects_(SHEETS.ASSIGNMENTS).forEach(function (assignment) {
    if (String(assignment.equipo_id || '')) return;
    const teamId = teamByUser[String(assignment.codigo_censista || '')] || '';
    if (teamId) upsertObject_(SHEETS.ASSIGNMENTS, 'assignment_id', assignment.assignment_id, {
      equipo_id: teamId,
      updated_at: assignment.updated_at || now
    });
  });
  objects_(SHEETS.RECORDS).forEach(function (record) {
    if (String(record.equipo_id || '')) return;
    const teamId = teamByUser[String(record.codigo_censista || '')] || '';
    if (teamId) upsertObject_(SHEETS.RECORDS, 'record_key', record.record_key, { equipo_id: teamId });
  });
}

function saveTeam_(input, session, client) {
  requireRole_(session, [ROLE.ADMIN, ROLE.SUPERVISOR]);
  const id = text_(input.equipoId, 'equipo', 100, false);
  const name = text_(input.nombre, 'nombre del equipo', 60, true);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let teamId;
  let existing;
  let coordinator;
  try {
    const teams = objects_(SHEETS.TEAMS);
    existing = id ? teams.filter(function (team) { return String(team.equipo_id || '') === id; })[0] : null;
    if (id && !existing) throw apiError_('TEAM_NOT_FOUND', 'El equipo no existe.');
    if (existing && !canManageTeam_(session, existing)) throw apiError_('FORBIDDEN', 'No puede modificar este equipo.');
    if (teams.some(function (team) {
      return String(team.equipo_id || '') !== id
        && String(team.nombre || '').trim().toLocaleLowerCase('es') === name.toLocaleLowerCase('es');
    })) throw apiError_('TEAM_NAME_EXISTS', 'Ya existe un equipo con ese nombre.');
    coordinator = String(session.codigoCensista || '');
    if (session.rol === ROLE.ADMIN) {
      coordinator = input.coordinadorCodigo
        ? digits_(input.coordinadorCodigo, 'coordinador', 5, 12)
        : '';
      if (coordinator) {
        const valid = objects_(SHEETS.USERS).some(function (user) {
          return String(user.codigo_censista || '') === coordinator && active_(user.activo)
            && [ROLE.SUPERVISOR, ROLE.ADMIN].indexOf(String(user.rol || '')) >= 0;
        });
        if (!valid) throw apiError_('COORDINATOR_NOT_FOUND', 'El coordinador no existe, esta inactivo o no tiene el rol requerido.');
      }
    }
    const now = nowIso_();
    teamId = existing ? String(existing.equipo_id || '') : Utilities.getUuid();
    upsertObject_(SHEETS.TEAMS, 'equipo_id', teamId, {
      equipo_id: teamId,
      nombre: name,
      coordinador_codigo: coordinator,
      activo: existing ? active_(existing.activo) : true,
      created_at: existing ? existing.created_at : now,
      created_by: existing ? existing.created_by : session.codigoCensista,
      updated_at: now,
      notas: text_(input.notas, 'notas', 500, false)
    });
  } finally {
    lock.releaseLock();
  }
  audit_(session, existing ? 'ACTUALIZAR_EQUIPO' : 'CREAR_EQUIPO', 'EQUIPO', teamId, {
    nombre: name,
    coordinadorCodigo: coordinator
  }, client);
  return { ok: true, equipoId: teamId };
}

function saveTeamMembers_(input, session, client) {
  requireRole_(session, [ROLE.ADMIN, ROLE.SUPERVISOR]);
  const teamId = text_(input.equipoId, 'equipo', 100, true);
  const team = objects_(SHEETS.TEAMS).filter(function (item) {
    return String(item.equipo_id || '') === teamId;
  })[0];
  if (!team || !canManageTeam_(session, team)) throw apiError_('FORBIDDEN', 'No puede administrar este equipo.');
  if (!active_(team.activo)) throw apiError_('TEAM_INACTIVE', 'Active el equipo antes de modificar integrantes.');
  const requestedCodes = Array.isArray(input.codigosCensistas) ? input.codigosCensistas : [];
  if (requestedCodes.length > 50) throw apiError_('VALIDATION_ERROR', 'El equipo supera el maximo de 50 integrantes.');
  const selected = {};
  const users = objects_(SHEETS.USERS);
  requestedCodes.forEach(function (value) {
    const code = digits_(value, 'codigo de censista', 5, 12);
    const valid = users.some(function (user) {
      return String(user.codigo_censista || '') === code && active_(user.activo)
        && String(user.rol || '') === ROLE.SURVEYOR;
    });
    if (!valid) throw apiError_('USER_NOT_FOUND', 'El encuestador ' + code + ' no existe, esta inactivo o no tiene el rol requerido.');
    selected[code] = true;
  });
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const allTeams = {};
    objects_(SHEETS.TEAMS).forEach(function (item) { allTeams[String(item.equipo_id || '')] = item; });
    const memberships = objects_(SHEETS.TEAM_MEMBERS);
    const now = nowIso_();
    Object.keys(selected).forEach(function (code) {
      memberships.forEach(function (member) {
        const otherTeamId = String(member.equipo_id || '');
        if (!active_(member.activo) || String(member.codigo_censista || '') !== code || otherTeamId === teamId) return;
        const otherTeam = allTeams[otherTeamId];
        if (session.rol !== ROLE.ADMIN && (!otherTeam || !canManageTeam_(session, otherTeam))) {
          throw apiError_('MEMBER_ASSIGNED_ELSEWHERE', 'El encuestador ' + code + ' pertenece a un equipo de otra coordinacion.');
        }
      });
    });
    const affected = {};
    memberships.forEach(function (member) {
      const code = String(member.codigo_censista || '');
      const memberTeam = String(member.equipo_id || '');
      const removeFromTarget = memberTeam === teamId && active_(member.activo) && !selected[code];
      const moveFromManagedTeam = memberTeam !== teamId && active_(member.activo) && selected[code];
      if (!removeFromTarget && !moveFromManagedTeam) return;
      upsertObject_(SHEETS.TEAM_MEMBERS, 'membership_id', member.membership_id, {
        activo: false,
        asignado_por: session.codigoCensista,
        updated_at: now
      });
      affected[code] = true;
    });
    Object.keys(selected).forEach(function (code) {
      const existing = memberships.filter(function (member) {
        return String(member.equipo_id || '') === teamId && String(member.codigo_censista || '') === code;
      }).sort(function (left, right) {
        return String(right.updated_at || '').localeCompare(String(left.updated_at || ''));
      })[0];
      if (existing) upsertObject_(SHEETS.TEAM_MEMBERS, 'membership_id', existing.membership_id, {
        activo: true,
        asignado_por: session.codigoCensista,
        updated_at: now
      });
      else appendObject_(SHEETS.TEAM_MEMBERS, {
        membership_id: Utilities.getUuid(),
        equipo_id: teamId,
        codigo_censista: code,
        activo: true,
        fecha_asignacion: now,
        asignado_por: session.codigoCensista,
        updated_at: now
      });
      affected[code] = true;
    });
    Object.keys(affected).forEach(function (code) {
      upsertObject_(SHEETS.USERS, 'codigo_censista', code, {
        equipo: selected[code] ? String(team.nombre || '') : '',
        updated_at: now
      });
    });
  } finally {
    lock.releaseLock();
  }
  audit_(session, 'GUARDAR_INTEGRANTES_EQUIPO', 'EQUIPO', teamId, {
    integrantes: Object.keys(selected)
  }, client);
  return { ok: true, integrantes: Object.keys(selected).length };
}

function setTeamActive_(input, session, client) {
  requireRole_(session, [ROLE.ADMIN, ROLE.SUPERVISOR]);
  const teamId = text_(input.equipoId, 'equipo', 100, true);
  const team = objects_(SHEETS.TEAMS).filter(function (item) {
    return String(item.equipo_id || '') === teamId;
  })[0];
  if (!team || !canManageTeam_(session, team)) throw apiError_('FORBIDDEN', 'No puede administrar este equipo.');
  const activate = input.activo !== false;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  let assignmentsDeactivated = 0;
  try {
    const now = nowIso_();
    upsertObject_(SHEETS.TEAMS, 'equipo_id', teamId, { activo: activate, updated_at: now });
    if (!activate) objects_(SHEETS.ASSIGNMENTS).forEach(function (assignment) {
      if (String(assignment.equipo_id || '') !== teamId || !active_(assignment.activo)) return;
      upsertObject_(SHEETS.ASSIGNMENTS, 'assignment_id', assignment.assignment_id, {
        activo: false,
        asignado_por: session.codigoCensista,
        updated_at: now,
        notas: 'Inactivada automaticamente al inactivar el equipo'
      });
      assignmentsDeactivated += 1;
    });
  } finally {
    lock.releaseLock();
  }
  audit_(session, activate ? 'ACTIVAR_EQUIPO' : 'INACTIVAR_EQUIPO', 'EQUIPO', teamId, {
    asignacionesInactivadas: assignmentsDeactivated
  }, client);
  return { ok: true, activo: activate, asignacionesInactivadas: assignmentsDeactivated };
}
