function activeTeamMemberCodes_(code) {
  return teamContextForCode_(code).memberCodes;
}

function activeAssignmentsFor_(code) {
  const context = teamContextForCode_(code);
  return objects_(SHEETS.ASSIGNMENTS).filter(function (assignment) {
    if (!active_(assignment.activo)) return false;
    const teamId = String(assignment.equipo_id || '');
    return teamId ? Boolean(context.teamIds[teamId]) : Boolean(context.memberCodes[String(assignment.codigo_censista)]);
  });
}

function recordVisibleToContext_(row, context) {
  const teamId = String(row.equipo_id || '');
  if (teamId) return Boolean(context.teamIds[teamId]);
  return Boolean(context.memberCodes[String(row.codigo_censista || '')]);
}

function canonicalRueCode_(value) {
  const code = String(value == null ? '' : value).replace(/\D/g, '');
  return code ? code.padStart(7, '0') : '';
}

function schoolByAnyCode_(schoolCode, catalog) {
  const requested = String(schoolCode == null ? '' : schoolCode).replace(/\D/g, '');
  if (!requested) return null;
  const requestedRue = canonicalRueCode_(requested);
  return (catalog || objects_(SHEETS.SCHOOLS)).filter(function (school) {
    const appCode = String(school.codigo || '').replace(/\D/g, '');
    const rueCode = canonicalRueCode_(school.codigo_rue || school.codigoRue || appCode);
    return appCode === requested || rueCode === requestedRue;
  })[0] || null;
}

function canonicalAppSchoolCode_(schoolCode, catalog) {
  const school = schoolByAnyCode_(schoolCode, catalog);
  return school ? String(school.codigo || '') : '';
}

function canAccessSchool_(session, schoolCode) {
  if (session.rol === ROLE.ADMIN) return true;
  const catalog = objects_(SHEETS.SCHOOLS);
  const canonical = canonicalAppSchoolCode_(schoolCode, catalog);
  if (!canonical) return false;
  return activeAssignmentsFor_(session.codigoCensista).some(function (assignment) {
    return canonicalAppSchoolCode_(assignment.codigo_escuela, catalog) === canonical;
  });
}

function requireSchoolAccess_(session, schoolCode) {
  const school = schoolByAnyCode_(schoolCode);
  if (!school) {
    throw apiError_('SCHOOL_NOT_FOUND', 'La escuela no existe en el catalogo vigente.');
  }
  if (!canAccessSchool_(session, school.codigo)) {
    throw apiError_('FORBIDDEN', 'La escuela no esta asignada a este usuario ni a su equipo.');
  }
  return school;
}

function rueSectionForSpace_(value) {
  const sections = {
    PLANTA_GENERAL: 'BLOQUES_Y_PLANTAS',
    AULA: 'AULA',
    LABORATORIO: 'LABORATORIO_TALLER',
    TALLER: 'LABORATORIO_TALLER',
    SANITARIO: 'SANITARIO',
    EXTERIOR: 'AREA_RECREACION',
    ADMINISTRACION: 'DEPENDENCIA',
    BIBLIOTECA: 'DEPENDENCIA',
    COCINA_COMEDOR: 'DEPENDENCIA',
    DEPOSITO: 'DEPENDENCIA',
    PASILLO: 'DEPENDENCIA',
    OTRO: 'DEPENDENCIA'
  };
  return sections[String(value || '').toUpperCase()] || '';
}

function rueFloorLabel_(value) {
  const floor = String(value == null ? '' : value).replace(/\D/g, '');
  return !floor || Number(floor) === 0 ? 'PLANTA_BAJA' : 'NIVEL_' + floor.padStart(2, '0');
}

function rueSpaceKey_(rueCode, section, block, floor, space) {
  return 'RUE:' + rueCode + ':' + section + ':B' + String(block).padStart(2, '0')
    + ':' + rueFloorLabel_(floor) + ':E' + String(space).padStart(3, '0');
}

function recordView_(row) {
  return {
    recordKey: String(row.record_key || ''),
    recordId: String(row.record_id || ''),
    codigoEscuela: String(row.codigo_escuela || ''),
    codigoRue: String(row.codigo_rue || canonicalRueCode_(row.codigo_escuela)),
    sitioId: String(row.sitio_id || ''),
    codigoCensista: String(row.codigo_censista || ''),
    equipoId: String(row.equipo_id || ''),
    numeroFormulario: String(row.numero_formulario || ''),
    numeroHoja: String(row.numero_hoja || ''),
    bloque: String(row.bloque || ''),
    piso: String(row.piso || ''),
    espacio: String(row.espacio || ''),
    tipoEspacio: String(row.tipo_espacio || ''),
    estado: String(row.estado || ''),
    observaciones: String(row.observaciones || ''),
    danosFallas: String(row.danos_fallas || ''),
    rueSection: String(row.rue_seccion || rueSectionForSpace_(row.tipo_espacio)),
    rueSpaceKey: String(row.rue_clave_espacio || ''),
    latitudCaptura: row.latitud_captura === '' ? '' : Number(row.latitud_captura),
    longitudCaptura: row.longitud_captura === '' ? '' : Number(row.longitud_captura),
    precisionM: row.precision_m === '' ? '' : Number(row.precision_m),
    cantidadFotos: Number(row.cantidad_fotos || 0),
    cantidadHojasPapel: Number(row.cantidad_hojas_papel || 0),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    syncedAt: row.synced_at || '',
    startedAt: row.started_at || '',
    completedAt: row.completed_at || '',
    durationSeconds: Number(row.duration_seconds || 0)
  };
}

function photoView_(row) {
  return {
    fotoId: String(row.foto_id || ''),
    recordKey: String(row.record_key || ''),
    recordId: String(row.record_id || ''),
    codigoEscuela: String(row.codigo_escuela || ''),
    codigoRue: String(row.codigo_rue || canonicalRueCode_(row.codigo_escuela)),
    sitioId: String(row.sitio_id || ''),
    codigoCensista: String(row.codigo_censista || ''),
    tipoFoto: String(row.tipo_foto || ''),
    tipoElemento: String(row.tipo_elemento || ''),
    numeroElemento: String(row.numero_elemento || ''),
    codigoElemento: String(row.codigo_elemento || ''),
    secuencia: Number(row.secuencia || 0),
    codigoFoto: String(row.codigo_foto || ''),
    etiquetaImpresa: boolean_(row.etiqueta_impresa),
    nombreArchivo: String(row.nombre_archivo || ''),
    mimeType: String(row.mime_type || ''),
    bytes: Number(row.bytes || 0),
    sha256: String(row.sha256 || ''),
    driveUrl: String(row.drive_url || ''),
    thumbnailUrl: String(row.thumbnail_url || ''),
    latitud: row.latitud === '' ? '' : Number(row.latitud),
    longitud: row.longitud === '' ? '' : Number(row.longitud),
    precisionM: row.precision_m === '' ? '' : Number(row.precision_m),
    capturedAt: row.captured_at || '',
    uploadedAt: row.uploaded_at || '',
    estado: String(row.estado || ''),
    notas: String(row.notas || '')
  };
}

function bootstrap_(session) {
  const assignments = activeAssignmentsFor_(session.codigoCensista);
  const showAll = session.rol === ROLE.ADMIN;
  const context = teamContextForCode_(session.codigoCensista);
  const schoolCatalog = objects_(SHEETS.SCHOOLS);
  const records = objects_(SHEETS.RECORDS).filter(function (row) {
    return showAll || recordVisibleToContext_(row, context);
  });
  const progress = {};
  records.forEach(function (record) {
    const code = canonicalAppSchoolCode_(record.codigo_escuela, schoolCatalog) || String(record.codigo_escuela);
    if (!progress[code]) progress[code] = { registros: 0, fotos: 0, estado: 'PENDIENTE' };
    progress[code].registros += 1;
    progress[code].fotos += Number(record.cantidad_fotos || 0);
    const status = String(record.estado || 'EN_PROCESO');
    if (status === 'CON_PENDIENTES') progress[code].estado = 'CON_PENDIENTES';
    else if (status === 'EN_PROCESO' && progress[code].estado !== 'CON_PENDIENTES') progress[code].estado = 'EN_PROCESO';
    else if (progress[code].estado === 'PENDIENTE') progress[code].estado = status;
  });
  return {
    user: publicUser_(session.user),
    assignedCodes: assignments.map(function (item) {
      return canonicalAppSchoolCode_(item.codigo_escuela, schoolCatalog) || String(item.codigo_escuela);
    })
      .filter(function (code, index, items) { return items.indexOf(code) === index; }),
    showAllSchools: showAll,
    progress: progress,
    recentRecords: records.sort(function (a, b) {
      return String(b.updated_at || '').localeCompare(String(a.updated_at || ''));
    }).slice(0, 20).map(recordView_),
    performance: performanceForUser_(session.codigoCensista)
  };
}

function validateRecord_(input, session) {
  const requestedCode = digits_(input.codigoEscuela, 'codigo de escuela', 3, 12);
  const school = requireSchoolAccess_(session, requestedCode);
  const code = String(school.codigo || '');
  const block = digits_(input.bloque, 'bloque', 1, 3);
  const floor = digits_(input.piso, 'piso', 1, 2);
  const space = digits_(input.espacio, 'espacio', 1, 4);
  const sheet = digits_(input.numeroHoja, 'numero de hoja', 1, 3);
  const expectedId = code + '-B' + block.padStart(2, '0') + '-P' + floor.padStart(2, '0')
    + '-E' + space.padStart(3, '0') + '-H' + sheet.padStart(2, '0');
  if (String(input.recordId || '') !== expectedId) {
    throw apiError_('VALIDATION_ERROR', 'El identificador del registro no coincide con sus campos.');
  }
  const status = requireIn_(input.estado, RECORD_STATUS, 'estado');
  const idempotency = text_(input.idempotencyKey, 'clave de idempotencia', 80, true);
  const spaceType = text_(input.tipoEspacio, 'tipo de espacio', 80, true).toUpperCase();
  const rueCode = String(school.codigo_rue || canonicalRueCode_(code));
  const rueSection = rueSectionForSpace_(spaceType);
  if (!rueSection) throw apiError_('VALIDATION_ERROR', 'El tipo de espacio no tiene equivalencia RUE.');
  const activeAssignment = activeAssignmentsFor_(session.codigoCensista).filter(function (assignment) {
    return canonicalAppSchoolCode_(assignment.codigo_escuela) === code;
  })[0];
  return {
    record_key: session.codigoCensista + ':' + expectedId,
    record_id: expectedId,
    idempotency_key: idempotency,
    codigo_escuela: code,
    codigo_censista: session.codigoCensista,
    numero_formulario: digits_(input.numeroFormulario, 'numero de formulario', 1, 4),
    numero_hoja: sheet,
    bloque: block,
    piso: floor,
    espacio: space,
    tipo_espacio: spaceType,
    estado: status,
    observaciones: text_(input.observaciones, 'observaciones', 1000, false),
    danos_fallas: text_(input.danosFallas, 'danos y fallas', 1000, false),
    latitud_captura: number_(input.latitudCaptura, 'latitud', -90, 90, true),
    longitud_captura: number_(input.longitudCaptura, 'longitud', -180, 180, true),
    precision_m: number_(input.precisionM, 'precision', 0, 100000, true),
    cantidad_fotos: number_(input.cantidadFotos, 'cantidad de fotos', 0, 500, false),
    cantidad_hojas_papel: number_(input.cantidadHojasPapel, 'cantidad de hojas', 0, 100, false),
    created_at: text_(input.createdAt, 'fecha de creacion', 40, false) || nowIso_(),
    updated_at: nowIso_(),
    synced_at: nowIso_(),
    device_id: text_(input.deviceId, 'dispositivo', 100, false),
    started_at: text_(input.startedAt, 'inicio', 40, false),
    completed_at: text_(input.completedAt, 'finalizacion', 40, false),
    duration_seconds: number_(input.durationSeconds, 'duracion', 0, 604800, false),
    codigo_rue: rueCode,
    sitio_id: String(school.sitio_id || ''),
    rue_seccion: rueSection,
    rue_clave_espacio: rueSpaceKey_(rueCode, rueSection, block, floor, space),
    equipo_id: activeAssignment
      ? String(activeAssignment.equipo_id || teamIdForSurveyor_(session.codigoCensista) || '')
      : String(teamIdForSurveyor_(session.codigoCensista) || '')
  };
}

function saveRecord_(input, session, client) {
  const record = validateRecord_(input, session);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const byIdempotency = objects_(SHEETS.RECORDS).filter(function (row) {
      return String(row.idempotency_key) === record.idempotency_key;
    })[0];
    if (byIdempotency) return { ok: true, recordId: byIdempotency.record_id, syncedAt: byIdempotency.synced_at, duplicate: true };
    const previous = objects_(SHEETS.RECORDS).filter(function (row) {
      return String(row.record_key) === record.record_key;
    })[0];
    if (previous) record.created_at = previous.created_at || record.created_at;
    const counts = photoCountsForRecord_(record.record_key);
    record.cantidad_fotos = counts.photos;
    record.cantidad_hojas_papel = counts.paper;
    upsertObject_(SHEETS.RECORDS, 'record_key', record.record_key, record);
  } finally {
    lock.releaseLock();
  }
  audit_(session, 'GUARDAR_REGISTRO', 'REGISTRO', record.record_key, { estado: record.estado }, client);
  return { ok: true, recordId: record.record_id, syncedAt: record.synced_at };
}

function getOrCreateFolder_(parent, name) {
  const safeName = String(name || '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 160) || 'SIN_IDENTIFICAR';
  const matches = parent.getFoldersByName(safeName);
  return matches.hasNext() ? matches.next() : parent.createFolder(safeName);
}

function validatePhoto_(input, session) {
  const requestedCode = digits_(input.codigoEscuela, 'codigo de escuela', 3, 12);
  const schoolRow = requireSchoolAccess_(session, requestedCode);
  const school = String(schoolRow.codigo || '');
  const recordId = text_(input.recordId, 'identificador de registro', 160, true);
  const recordKey = session.codigoCensista + ':' + recordId;
  const record = objects_(SHEETS.RECORDS).filter(function (row) { return String(row.record_key) === recordKey; })[0];
  if (!record) throw apiError_('RECORD_NOT_FOUND', 'Primero debe sincronizarse el registro asociado.');
  if (String(record.codigo_escuela) !== school || recordId !== String(record.record_id)) {
    throw apiError_('VALIDATION_ERROR', 'La foto no coincide con la escuela y el registro asociados.');
  }
  const type = requireIn_(input.tipoFoto, PHOTO_TYPES, 'tipo de foto');
  const elementType = requireIn_(input.tipoElemento, ELEMENT_TYPES, 'tipo de elemento');
  const mimeType = String(input.mimeType || '').toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(mimeType) < 0) {
    throw apiError_('VALIDATION_ERROR', 'Formato de imagen no permitido.');
  }
  const elementNumber = digits_(input.numeroElemento, 'numero de elemento', 1, 3);
  const sequence = number_(input.secuencia, 'secuencia', 1, 999, false);
  const expectedElementCode = ELEMENT_CODES[elementType] + elementNumber.padStart(2, '0');
  const suppliedElementCode = text_(input.codigoElemento, 'codigo de elemento', 20, true).toUpperCase();
  if (suppliedElementCode !== expectedElementCode) {
    throw apiError_('VALIDATION_ERROR', 'El codigo de elemento no coincide con su tipo y numero.');
  }
  const photoCode = text_(input.codigoFoto, 'codigo de foto', 300, true).toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(photoCode)) throw apiError_('VALIDATION_ERROR', 'Codigo de foto invalido.');
  const expectedPhotoCode = recordId + '-' + expectedElementCode + '-FT' + String(sequence).padStart(2, '0');
  if (photoCode !== expectedPhotoCode) {
    throw apiError_('VALIDATION_ERROR', 'El codigo de foto no coincide con el registro y el elemento.');
  }
  const hash = text_(input.sha256, 'huella digital', 64, true).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(hash)) throw apiError_('VALIDATION_ERROR', 'La huella digital de la imagen no es valida.');
  return {
    foto_id: text_(input.fotoId, 'identificador de foto', 100, true),
    idempotency_key: text_(input.idempotencyKey, 'clave de idempotencia', 100, true),
    record_key: recordKey,
    record_id: recordId,
    codigo_escuela: school,
    codigo_censista: session.codigoCensista,
    numero_formulario: String(record.numero_formulario || ''),
    numero_hoja: String(record.numero_hoja || ''),
    bloque: String(record.bloque || ''),
    piso: String(record.piso || ''),
    espacio: String(record.espacio || ''),
    tipo_foto: type,
    tipo_elemento: elementType,
    numero_elemento: elementNumber,
    codigo_elemento: expectedElementCode,
    secuencia: sequence,
    codigo_foto: photoCode,
    etiqueta_impresa: boolean_(input.etiquetaImpresa),
    mime_type: mimeType,
    bytes: number_(input.bytes, 'tamano', 1, SYSTEM_CONFIG.MAX_PHOTO_BYTES, false),
    sha256: hash,
    latitud: input.location ? number_(input.location.latitud, 'latitud', -90, 90, true) : '',
    longitud: input.location ? number_(input.location.longitud, 'longitud', -180, 180, true) : '',
    precision_m: input.location ? number_(input.location.precisionM, 'precision', 0, 100000, true) : '',
    captured_at: text_(input.capturedAt, 'fecha de captura', 40, false),
    notas: text_(input.notas, 'notas', 500, false),
    codigo_rue: String(record.codigo_rue || schoolRow.codigo_rue || canonicalRueCode_(school)),
    sitio_id: String(record.sitio_id || schoolRow.sitio_id || '')
  };
}

function uploadPhoto_(input, base64, session, client) {
  const photo = validatePhoto_(input, session);
  const existing = objects_(SHEETS.PHOTOS).filter(function (row) {
    return String(row.idempotency_key) === photo.idempotency_key;
  })[0];
  if (existing) return { ok: true, fotoId: existing.foto_id, uploadedAt: existing.uploaded_at, driveUrl: existing.drive_url, duplicate: true };
  if (!base64 || String(base64).length > Math.ceil(SYSTEM_CONFIG.MAX_PHOTO_BYTES * 4 / 3) + 100) {
    throw apiError_('PHOTO_TOO_LARGE', 'La imagen supera el limite permitido.');
  }
  let bytes;
  try { bytes = Utilities.base64Decode(String(base64)); }
  catch (ignore) { throw apiError_('VALIDATION_ERROR', 'Contenido de imagen invalido.'); }
  if (!bytes.length || bytes.length > SYSTEM_CONFIG.MAX_PHOTO_BYTES) {
    throw apiError_('PHOTO_TOO_LARGE', 'La imagen supera el limite permitido.');
  }
  if (Math.abs(bytes.length - photo.bytes) > 2) throw apiError_('PHOTO_CORRUPT', 'El tamano de la imagen no coincide.');
  const actualHash = sha256BytesHex_(bytes);
  if (!secureEqual_(actualHash, photo.sha256)) throw apiError_('PHOTO_CORRUPT', 'La huella digital de la imagen no coincide.');

  const extension = photo.mime_type === 'image/png' ? '.png' : photo.mime_type === 'image/webp' ? '.webp' : '.jpg';
  const fileName = photo.codigo_foto + extension;
  const root = rootFolder_();
  const schoolFolder = getOrCreateFolder_(root, photo.codigo_escuela);
  const surveyorFolder = getOrCreateFolder_(schoolFolder, photo.codigo_censista);
  const recordFolder = getOrCreateFolder_(surveyorFolder, photo.record_id);
  const typeFolder = getOrCreateFolder_(recordFolder, photo.tipo_foto);
  const blob = Utilities.newBlob(bytes, photo.mime_type, fileName);
  const file = typeFolder.createFile(blob);
  file.setDescription(JSON.stringify({
    codigoFoto: photo.codigo_foto,
    recordId: photo.record_id,
    codigoEscuela: photo.codigo_escuela,
    codigoRue: photo.codigo_rue,
    sitioId: photo.sitio_id,
    codigoCensista: photo.codigo_censista,
    bloque: photo.bloque,
    piso: photo.piso,
    espacio: photo.espacio,
    codigoElemento: photo.codigo_elemento,
    etiquetaImpresa: photo.etiqueta_impresa,
    sha256: photo.sha256
  }));
  const now = nowIso_();
  photo.nombre_archivo = fileName;
  photo.drive_file_id = file.getId();
  photo.drive_url = file.getUrl();
  photo.thumbnail_url = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(file.getId()) + '&sz=w400';
  photo.uploaded_at = now;
  photo.estado = 'ACTIVA';
  photo.deleted_at = '';
  appendObject_(SHEETS.PHOTOS, photo);
  syncRecordPhotoCounts_(photo.record_key);
  audit_(session, 'SUBIR_FOTO', 'FOTO', photo.foto_id, {
    recordId: photo.record_id,
    codigoFoto: photo.codigo_foto,
    bytes: bytes.length
  }, client);
  return { ok: true, fotoId: photo.foto_id, uploadedAt: now, driveUrl: photo.drive_url };
}

function photoCountsForRecord_(recordKey) {
  const rows = objects_(SHEETS.PHOTOS).filter(function (photo) {
    return String(photo.record_key) === String(recordKey) && !photo.deleted_at;
  });
  return {
    photos: rows.length,
    paper: rows.filter(function (photo) { return String(photo.tipo_foto) === 'HOJA_PAPEL'; }).length
  };
}

function syncRecordPhotoCounts_(recordKey) {
  const counts = photoCountsForRecord_(recordKey);
  upsertObject_(SHEETS.RECORDS, 'record_key', recordKey, {
    cantidad_fotos: counts.photos,
    cantidad_hojas_papel: counts.paper,
    updated_at: nowIso_(),
    synced_at: nowIso_()
  });
}

function linkedActivePhotos_(records, photos) {
  const recordKeys = {};
  (records || []).forEach(function (record) {
    const key = String(record.record_key || record.recordKey || '').trim();
    if (key) recordKeys[key] = true;
  });
  return (photos || []).filter(function (photo) {
    const key = String(photo.record_key || photo.recordKey || '').trim();
    return key && recordKeys[key] && !(photo.deleted_at || photo.deletedAt);
  });
}

function recordSchoolView_(school, fallbackCode) {
  const code = String(school ? school.codigo || '' : fallbackCode || '').replace(/\D/g, '');
  const rueCode = String(school ? school.codigo_rue || school.codigoRue || '' : '').replace(/\D/g, '')
    || canonicalRueCode_(code);
  const sharedRueCodes = String(school ? school.codigos_rue_sitio || school.codigosRueSitio || '' : '')
    .split('|').map(function (item) { return String(item || '').trim(); }).filter(Boolean);
  return {
    codigo: code,
    codigoRue: rueCode,
    sitioId: String(school ? school.sitio_id || school.sitioId || '' : ''),
    codigosRueSitio: sharedRueCodes.length ? sharedRueCodes : (rueCode ? [rueCode] : []),
    sedeCompartida: school ? boolean_(school.sede_compartida || school.sedeCompartida) : false,
    nombre: String(school ? school.nombre || '' : '') || 'Escuela no catalogada ' + code,
    departamento: String(school ? school.departamento || '' : ''),
    distrito: String(school ? school.distrito || '' : ''),
    zona: String(school ? school.zona || '' : ''),
    localidad: String(school ? school.localidad || '' : ''),
    latitud: school && school.latitud !== '' ? Number(school.latitud) : '',
    longitud: school && school.longitud !== '' ? Number(school.longitud) : ''
  };
}

function listRecords_(payload, session) {
  const showAll = session.rol === ROLE.ADMIN;
  const schoolCatalog = objects_(SHEETS.SCHOOLS);
  const requestedSchoolFilter = payload && payload.codigoEscuela ? String(payload.codigoEscuela) : '';
  const schoolFilterRow = requestedSchoolFilter ? schoolByAnyCode_(requestedSchoolFilter, schoolCatalog) : null;
  if (requestedSchoolFilter && !schoolFilterRow) {
    throw apiError_('SCHOOL_NOT_FOUND', 'La escuela no existe en el catalogo vigente.');
  }
  const schoolFilter = schoolFilterRow ? String(schoolFilterRow.codigo || '') : '';
  const requestedSurveyor = payload && payload.codigoCensista ? digits_(payload.codigoCensista, 'codigo de censista', 5, 12) : '';
  const surveyorFilter = requestedSurveyor && showAll ? requestedSurveyor : '';
  const context = showAll ? null : teamContextForCode_(session.codigoCensista);
  const records = objects_(SHEETS.RECORDS).filter(function (row) {
    const rowSchoolCode = canonicalAppSchoolCode_(row.codigo_escuela, schoolCatalog) || String(row.codigo_escuela);
    return (!surveyorFilter || String(row.codigo_censista) === surveyorFilter)
      && (showAll || recordVisibleToContext_(row, context))
      && (!schoolFilter || rowSchoolCode === schoolFilter);
  });
  const keys = {};
  records.forEach(function (row) {
    const key = String(row.record_key || '').trim();
    if (key) keys[key] = true;
  });
  const photos = objects_(SHEETS.PHOTOS).filter(function (row) {
    const key = String(row.record_key || '').trim();
    return key && keys[key] && !row.deleted_at;
  });
  const schoolCodes = {};
  records.forEach(function (row) {
    const school = schoolByAnyCode_(row.codigo_escuela, schoolCatalog);
    const code = String(school ? school.codigo || '' : row.codigo_escuela || '').replace(/\D/g, '');
    if (code) schoolCodes[code] = school || null;
  });
  const schools = Object.keys(schoolCodes).map(function (code) {
    return recordSchoolView_(schoolCodes[code], code);
  }).sort(function (left, right) {
    return left.nombre.localeCompare(right.nombre);
  });
  return { records: records.map(recordView_), photos: photos.map(photoView_), schools: schools };
}

function getPhotoContent_(payload, session) {
  const fotoId = text_(payload && payload.fotoId, 'identificador de foto', 100, true);
  const variant = String(payload && payload.variant || 'original').trim().toLowerCase();
  if (['preview', 'original'].indexOf(variant) < 0) {
    throw apiError_('VALIDATION_ERROR', 'La variante de fotografia no es valida.');
  }
  const photo = objects_(SHEETS.PHOTOS).filter(function (row) {
    return String(row.foto_id) === fotoId && !row.deleted_at && String(row.estado || 'ACTIVA') === 'ACTIVA';
  })[0];
  if (!photo) throw apiError_('PHOTO_NOT_FOUND', 'La fotografia no existe o ya no esta activa.');
  if (session.rol !== ROLE.ADMIN) {
    const record = objects_(SHEETS.RECORDS).filter(function (row) {
      return String(row.record_key || '') === String(photo.record_key || '');
    })[0];
    const context = teamContextForCode_(session.codigoCensista);
    if (!record || !recordVisibleToContext_(record, context)) {
      throw apiError_('FORBIDDEN', 'La fotografia no pertenece a un registro visible para su equipo.');
    }
  }
  const storedMimeType = String(photo.mime_type || '').toLowerCase();
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(storedMimeType) < 0) {
    throw apiError_('PHOTO_FORMAT_INVALID', 'El formato de la fotografia no esta permitido.');
  }
  const driveFileId = text_(photo.drive_file_id, 'archivo de Drive', 200, true);
  let file;
  let blob;
  try {
    file = DriveApp.getFileById(driveFileId);
    blob = variant === 'preview' ? file.getThumbnail() : file.getBlob();
    if (!blob) blob = file.getBlob();
  } catch (ignore) {
    throw apiError_('PHOTO_FILE_MISSING', 'El archivo de la fotografia no esta disponible en Drive.');
  }
  const bytes = blob.getBytes();
  if (!bytes.length || bytes.length > SYSTEM_CONFIG.MAX_PHOTO_BYTES) {
    throw apiError_('PHOTO_TOO_LARGE', 'La fotografia supera el limite permitido.');
  }
  const base64 = Utilities.base64Encode(bytes);
  const blobMimeType = String(blob.getContentType ? blob.getContentType() || '' : '').toLowerCase();
  const mimeType = ['image/jpeg', 'image/png', 'image/webp'].indexOf(blobMimeType) >= 0
    ? blobMimeType : storedMimeType;
  const chunkSize = 300000;
  const totalChunks = Math.ceil(base64.length / chunkSize);
  const chunkIndex = payload && payload.chunkIndex != null
    ? number_(payload.chunkIndex, 'fragmento de fotografia', 0, Math.max(0, totalChunks - 1), false)
    : 0;
  return {
    fotoId: fotoId,
    variant: variant,
    mimeType: mimeType,
    bytes: bytes.length,
    chunkIndex: chunkIndex,
    totalChunks: totalChunks,
    chunk: base64.slice(chunkIndex * chunkSize, (chunkIndex + 1) * chunkSize)
  };
}
