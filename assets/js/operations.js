export function primaryAssignmentMap(assignments = []) {
  const selected = new Map();
  [...assignments]
    .filter((item) => item?.activo && item.codigoEscuela && item.codigoCensista)
    .sort((left, right) => assignmentTimestamp(left).localeCompare(assignmentTimestamp(right)))
    .forEach((item) => selected.set(String(item.codigoEscuela), String(item.codigoCensista)));
  return Object.fromEntries(selected);
}

export function assignmentTimestamp(item = {}) {
  return String(item.updatedAt || item.fechaAsignacion || '');
}

export function schoolStatus(progress = {}, schoolCode = '') {
  return String(progress?.[schoolCode]?.estado || 'PENDIENTE').toUpperCase();
}

export function isFinished(progress = {}, schoolCode = '') {
  return schoolStatus(progress, schoolCode) === 'FINALIZADO';
}

export function filterLogisticsSchools(schools, progress, assignmentMap, filters = {}) {
  const search = String(filters.search || '').trim().toLocaleLowerCase('es');
  return schools.filter((school) => {
    const status = schoolStatus(progress, school.codigo);
    const surveyor = String(assignmentMap?.[school.codigo] || '');
    const haystack = `${school.codigo} ${school.nombre} ${school.departamento} ${school.distrito} ${school.localidad}`
      .toLocaleLowerCase('es');
    return (!search || haystack.includes(search))
      && (!filters.department || school.departamento === filters.department)
      && (!filters.district || school.distrito === filters.district)
      && (!filters.status || status === filters.status)
      && (!filters.surveyor || (filters.surveyor === '__UNASSIGNED__' ? !surveyor : surveyor === filters.surveyor));
  });
}

export function buildWorkloads(users, schools, assignmentMap, progress, summaries = []) {
  const summaryByUser = new Map(summaries.map((item) => [String(item.codigoCensista), item]));
  const schoolByCode = new Map(schools.map((school) => [String(school.codigo), school]));
  return users
    .filter((user) => user.activo && user.rol !== 'ADMIN')
    .map((user) => {
      const code = String(user.codigoCensista);
      const assignedCodes = Object.keys(assignmentMap || {})
        .filter((schoolCode) => assignmentMap[schoolCode] === code && schoolByCode.has(schoolCode));
      const finalizadas = assignedCodes.filter((schoolCode) => isFinished(progress, schoolCode)).length;
      const summary = summaryByUser.get(code) || {};
      return {
        ...user,
        asignadas: assignedCodes.length,
        finalizadas,
        pendientes: assignedCodes.length - finalizadas,
        registros: Number(summary.registros || 0),
        fotos: Number(summary.fotos || 0),
        ultimaCarga: summary.ultimaCarga || user.ultimoAcceso || ''
      };
    })
    .sort((left, right) => right.pendientes - left.pendientes
      || left.apellidos.localeCompare(right.apellidos, 'es'));
}

export function balancePendingAssignments(schools, users, assignmentMap, progress) {
  const candidates = users
    .filter((user) => user.activo && user.rol === 'ENCUESTADOR')
    .sort((left, right) => String(left.codigoCensista).localeCompare(String(right.codigoCensista)));
  if (!candidates.length) return null;

  const result = { ...(assignmentMap || {}) };
  const pendingSchools = schools
    .filter((school) => !isFinished(progress, school.codigo))
    .sort((left, right) => Number(left.ordenMuestra || 0) - Number(right.ordenMuestra || 0));
  const baseLoads = new Map(candidates.map((user) => [String(user.codigoCensista), 0]));

  schools.filter((school) => isFinished(progress, school.codigo)).forEach((school) => {
    const code = result[school.codigo];
    if (baseLoads.has(code)) baseLoads.set(code, baseLoads.get(code) + 1);
  });

  pendingSchools.forEach((school) => {
    const selected = candidates
      .map((user) => ({ user, load: baseLoads.get(String(user.codigoCensista)) || 0 }))
      .sort((left, right) => left.load - right.load
        || String(left.user.codigoCensista).localeCompare(String(right.user.codigoCensista)))[0].user;
    const code = String(selected.codigoCensista);
    result[school.codigo] = code;
    baseLoads.set(code, (baseLoads.get(code) || 0) + 1);
  });
  return result;
}

export function changedAssignmentItems(original = {}, draft = {}, schools = []) {
  return schools
    .map((school) => ({
      codigoEscuela: String(school.codigo),
      codigoCensista: String(draft[school.codigo] || '')
    }))
    .filter((item) => String(original[item.codigoEscuela] || '') !== item.codigoCensista);
}

export function logisticsMetrics(schools, users, assignmentMap, progress, settings = {}) {
  const total = schools.length;
  const finalizadas = schools.filter((school) => isFinished(progress, school.codigo)).length;
  const pendientes = total - finalizadas;
  const sinAsignar = schools.filter((school) => !assignmentMap?.[school.codigo]).length;
  const minutos = Math.max(1, Number(settings.baseMinutes || 45));
  const horasDia = Math.max(1, Number(settings.hoursPerDay || 6));
  const diasObjetivo = Math.max(1, Number(settings.targetDays || 10));
  const encuestadoresActivos = users.filter((user) => user.activo && user.rol === 'ENCUESTADOR').length;
  const horasPendientes = (pendientes * minutos) / 60;
  const jornadasPersona = horasPendientes / horasDia;
  return {
    total,
    finalizadas,
    pendientes,
    sinAsignar,
    horasPendientes,
    jornadasPersona,
    encuestadoresActivos,
    encuestadoresNecesarios: Math.max(1, Math.ceil(jornadasPersona / diasObjetivo)),
    diasCalendario: encuestadoresActivos ? Math.ceil(jornadasPersona / encuestadoresActivos) : null
  };
}

export function logisticsCsv(schools, users, assignmentMap, progress) {
  const userByCode = new Map(users.map((user) => [String(user.codigoCensista), user]));
  const rows = [[
    'codigo_escuela', 'escuela', 'departamento', 'distrito', 'localidad', 'estado',
    'codigo_censista', 'censista', 'latitud', 'longitud'
  ]];
  schools.forEach((school) => {
    const code = String(assignmentMap?.[school.codigo] || '');
    const user = userByCode.get(code);
    rows.push([
      school.codigo, school.nombre, school.departamento, school.distrito, school.localidad,
      schoolStatus(progress, school.codigo), code,
      user ? `${user.nombres} ${user.apellidos}`.trim() : '', school.latitud, school.longitud
    ]);
  });
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}

export function googleRouteUrl(schools = []) {
  const valid = schools.filter((school) => Number.isFinite(Number(school.latitud))
    && Number.isFinite(Number(school.longitud))).slice(0, 10);
  if (!valid.length) return '';
  const coordinate = (school) => `${school.latitud},${school.longitud}`;
  if (valid.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(coordinate(valid[0]))}`;
  }
  const origin = coordinate(valid[0]);
  const destination = coordinate(valid[valid.length - 1]);
  const waypoints = valid.slice(1, -1).map(coordinate).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}`
    + `&destination=${encodeURIComponent(destination)}`
    + (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
