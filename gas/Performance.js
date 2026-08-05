function median_(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort(function (a, b) { return a - b; });
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function rounded_(value, decimals) {
  const factor = Math.pow(10, decimals || 0);
  return Math.round(Number(value || 0) * factor) / factor;
}

function validDurationSeconds_(row) {
  const seconds = Number(row.duration_seconds || 0);
  return Number.isFinite(seconds) && seconds > 0 && seconds <= 604800 ? seconds : 0;
}

function syncDelaySeconds_(row) {
  const completed = new Date(row.completed_at || '').getTime();
  const synced = new Date(row.synced_at || '').getTime();
  if (!Number.isFinite(completed) || !Number.isFinite(synced) || synced < completed) return 0;
  return Math.min(604800, Math.round((synced - completed) / 1000));
}

function performanceForMember_(user, records, photos, assignedCount) {
  const code = String(user.codigo_censista || '');
  const ownRecords = records.filter(function (row) {
    return String(row.codigo_censista) === code;
  });
  const ownPhotos = photos.filter(function (row) {
    return String(row.codigo_censista) === code && !row.deleted_at;
  });
  const durations = ownRecords.map(validDurationSeconds_).filter(Boolean);
  const syncDelays = ownRecords.map(syncDelaySeconds_).filter(Boolean);
  const completed = ownRecords.filter(function (row) {
    return String(row.estado) === 'FINALIZADO';
  }).length;
  const pending = ownRecords.filter(function (row) {
    return String(row.estado) === 'CON_PENDIENTES';
  }).length;
  const latest = ownRecords.map(function (row) {
    return String(row.updated_at || row.synced_at || '');
  }).sort().pop() || String(user.ultimo_acceso || '');
  return {
    codigoCensista: code,
    nombres: String(user.nombres || ''),
    apellidos: String(user.apellidos || ''),
    equipo: String(user.equipo || ''),
    disponibleCampo: fieldAvailable_(user.disponible_campo),
    motivoIndisponibilidad: String(user.motivo_indisponibilidad || ''),
    assignedSchools: Number(assignedCount || 0),
    records: ownRecords.length,
    completedRecords: completed,
    pendingRecords: pending,
    completionRate: ownRecords.length ? rounded_(completed / ownRecords.length * 100, 1) : 0,
    photos: ownPhotos.length,
    timedRecords: durations.length,
    averageMinutes: durations.length ? rounded_(durations.reduce(function (sum, value) { return sum + value; }, 0) / durations.length / 60, 1) : 0,
    medianMinutes: durations.length ? rounded_(median_(durations) / 60, 1) : 0,
    totalHours: rounded_(durations.reduce(function (sum, value) { return sum + value; }, 0) / 3600, 1),
    averageSyncDelayMinutes: syncDelays.length ? rounded_(syncDelays.reduce(function (sum, value) { return sum + value; }, 0) / syncDelays.length / 60, 1) : 0,
    lastActivity: latest
  };
}

function performanceDashboard_(catalog, teamFilter) {
  const requestedTeam = String(teamFilter || '').trim();
  const users = objects_(SHEETS.USERS).filter(function (user) {
    return active_(user.activo) && String(user.rol) === ROLE.SURVEYOR
      && (!requestedTeam || String(user.equipo || '').trim() === requestedTeam);
  });
  const records = objects_(SHEETS.RECORDS);
  const photos = linkedActivePhotos_(records, objects_(SHEETS.PHOTOS));
  const assignments = objects_(SHEETS.ASSIGNMENTS).filter(function (item) {
    return active_(item.activo);
  });
  const schoolCatalog = catalog || objects_(SHEETS.SCHOOLS);
  const usersByCode = {};
  users.forEach(function (user) { usersByCode[String(user.codigo_censista)] = user; });
  const assignedByTeam = {};
  assignments.forEach(function (assignment) {
    const owner = usersByCode[String(assignment.codigo_censista)];
    const team = owner ? String(owner.equipo || '') : '';
    if (!assignedByTeam[team]) assignedByTeam[team] = {};
    const schoolCode = canonicalAppSchoolCode_(assignment.codigo_escuela, schoolCatalog) || String(assignment.codigo_escuela);
    assignedByTeam[team][schoolCode] = true;
  });
  const individuals = users.map(function (user) {
    const team = String(user.equipo || '');
    return performanceForMember_(user, records, photos, Object.keys(assignedByTeam[team] || {}).length);
  });
  const teamNames = Object.keys(individuals.reduce(function (result, item) {
    if (item.equipo) result[item.equipo] = true;
    return result;
  }, {})).sort();
  const teams = teamNames.map(function (team) {
    const members = individuals.filter(function (item) { return item.equipo === team; });
    const durations = records.filter(function (row) {
      const user = usersByCode[String(row.codigo_censista)];
      return user && String(user.equipo || '') === team;
    }).map(validDurationSeconds_).filter(Boolean);
    const assignedCodes = Object.keys(assignedByTeam[team] || {});
    const touched = {};
    records.forEach(function (row) {
      const user = usersByCode[String(row.codigo_censista)];
      const schoolCode = canonicalAppSchoolCode_(row.codigo_escuela, schoolCatalog) || String(row.codigo_escuela);
      if (user && String(user.equipo || '') === team) touched[schoolCode] = true;
    });
    return {
      equipo: team,
      members: members,
      totalMembers: members.length,
      availableMembers: members.filter(function (item) { return item.disponibleCampo; }).length,
      assignedSchools: assignedCodes.length,
      touchedSchools: Object.keys(touched).length,
      pendingSchools: Math.max(0, assignedCodes.length - Object.keys(touched).length),
      records: members.reduce(function (sum, item) { return sum + item.records; }, 0),
      completedRecords: members.reduce(function (sum, item) { return sum + item.completedRecords; }, 0),
      photos: members.reduce(function (sum, item) { return sum + item.photos; }, 0),
      timedRecords: durations.length,
      averageMinutes: durations.length ? rounded_(durations.reduce(function (sum, value) { return sum + value; }, 0) / durations.length / 60, 1) : 0,
      medianMinutes: durations.length ? rounded_(median_(durations) / 60, 1) : 0,
      lastActivity: members.map(function (item) { return item.lastActivity || ''; }).sort().pop() || ''
    };
  });
  return { generatedAt: nowIso_(), individuals: individuals, teams: teams };
}

function performanceForUser_(code) {
  const dashboard = performanceDashboard_();
  const individual = dashboard.individuals.filter(function (item) {
    return item.codigoCensista === String(code);
  })[0] || null;
  const team = individual ? dashboard.teams.filter(function (item) {
    return item.equipo === individual.equipo;
  })[0] || null : null;
  return { generatedAt: dashboard.generatedAt, individual: individual, team: team };
}
