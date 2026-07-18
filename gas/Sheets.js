function spreadsheet_() {
  return SpreadsheetApp.openById(SYSTEM_CONFIG.SPREADSHEET_ID);
}

function ensureSystem_() {
  if (CacheService.getScriptCache().get(SYSTEM_CONFIG.CACHE_SCHEMA_KEY)) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (CacheService.getScriptCache().get(SYSTEM_CONFIG.CACHE_SCHEMA_KEY)) return;
    setupSystem_();
    CacheService.getScriptCache().put(SYSTEM_CONFIG.CACHE_SCHEMA_KEY, '1', 21600);
  } finally {
    lock.releaseLock();
  }
}

function setupSystem() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const result = setupSystem_();
    CacheService.getScriptCache().put(SYSTEM_CONFIG.CACHE_SCHEMA_KEY, '1', 21600);
    return result;
  } finally {
    lock.releaseLock();
  }
}

function secureStorage() {
  const sheetFile = DriveApp.getFileById(SYSTEM_CONFIG.SPREADSHEET_ID);
  sheetFile.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.NONE);
  const folder = rootFolder_();
  folder.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.NONE);
  return {
    ok: true,
    spreadsheetId: SYSTEM_CONFIG.SPREADSHEET_ID,
    rootFolderId: folder.getId(),
    spreadsheetAccess: String(sheetFile.getSharingAccess()),
    spreadsheetPermission: String(sheetFile.getSharingPermission()),
    folderAccess: String(folder.getSharingAccess()),
    folderPermission: String(folder.getSharingPermission())
  };
}

function setupSystem_() {
  const book = spreadsheet_();
  book.setSpreadsheetLocale('es_PY');
  book.setSpreadsheetTimeZone('America/Asuncion');
  const existingConfig = book.getSheetByName(SHEETS.CONFIG);
  if (!existingConfig) {
    const first = book.getSheets()[0];
    const blank = first && first.getName() === 'Hoja 1' && first.getLastRow() <= 1
      && first.getRange(1, 1).getDisplayValue() === '';
    if (blank) first.setName(SHEETS.CONFIG);
  }

  Object.keys(SHEETS).forEach(function (key) {
    const sheetName = SHEETS[key];
    ensureSheet_(sheetName, HEADERS[sheetName]);
  });
  ensureConfigValues_();
  seedSchools_();
  applyValidations_();
  hideSensitiveColumns_();
  const folder = rootFolder_();
  return {
    ok: true,
    spreadsheetId: SYSTEM_CONFIG.SPREADSHEET_ID,
    rootFolderId: folder.getId(),
    schools: PILOT_SCHOOLS.length,
    schemaVersion: SYSTEM_CONFIG.SCHEMA_VERSION
  };
}

function ensureSheet_(name, requiredHeaders) {
  if (!Array.isArray(requiredHeaders) || !requiredHeaders.length) {
    throw apiError_('SCHEMA_ERROR', 'No se definieron encabezados para la hoja ' + name + '.');
  }
  const book = spreadsheet_();
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(function (item) { return String(item || '').trim(); });
  const hasHeader = current.some(Boolean);
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
  } else {
    const missing = requiredHeaders.filter(function (header) { return current.indexOf(header) < 0; });
    if (missing.length) {
      sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
    }
  }
  formatSheet_(sheet, requiredHeaders.length);
  return sheet;
}

function formatSheet_(sheet, columnCount) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columnCount)
    .setBackground('#123f69')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrap(true);
  sheet.setRowHeight(1, 34);
  if ([SHEETS.CONFIG, SHEETS.SESSIONS, SHEETS.AUDIT].indexOf(sheet.getName()) < 0 && !sheet.getFilter()) {
    sheet.getRange(1, 1, sheet.getMaxRows(), columnCount).createFilter();
  }
  const widths = {
    CONFIG: [180, 280, 390, 180],
    USUARIOS: [130, 170, 170, 120, 90, 90, 80, 130, 175, 175, 175],
    ESCUELAS: [100, 320, 120, 180, 90, 200, 110, 110, 90, 100, 110, 175, 175],
    ASIGNACIONES: [220, 130, 110, 80, 175, 130, 240, 175],
    REGISTROS: [250, 250, 220, 110, 130, 90, 80, 70, 70, 80, 150, 120, 260, 260, 110, 110, 90, 90, 90, 175, 175, 175, 220],
    FOTOS: [220, 220, 250, 250, 110, 130, 90, 80, 70, 70, 80, 110, 160, 100, 110, 80, 300, 100, 320, 110, 90, 180, 220, 250, 200, 110, 110, 90, 175, 175, 110, 250, 175],
    SOLICITUDES: [220, 130, 170, 170, 130, 90, 90, 175, 110, 130, 175, 250]
  }[sheet.getName()];
  if (widths) widths.forEach(function (width, index) { if (index < columnCount) sheet.setColumnWidth(index + 1, width); });
}

function applyValidations_() {
  const roles = SpreadsheetApp.newDataValidation().requireValueInList([ROLE.SURVEYOR, ROLE.SUPERVISOR, ROLE.ADMIN], true).setAllowInvalid(false).build();
  const recordStates = SpreadsheetApp.newDataValidation().requireValueInList(RECORD_STATUS, true).setAllowInvalid(false).build();
  const requestStates = SpreadsheetApp.newDataValidation().requireValueInList(['PENDIENTE', 'APROBADA', 'RECHAZADA'], true).setAllowInvalid(false).build();
  const users = spreadsheet_().getSheetByName(SHEETS.USERS);
  users.getRange(2, headerIndex_(SHEETS.USERS, 'rol'), users.getMaxRows() - 1, 1).setDataValidation(roles);
  users.getRange(2, headerIndex_(SHEETS.USERS, 'activo'), users.getMaxRows() - 1, 1).insertCheckboxes();
  const assignments = spreadsheet_().getSheetByName(SHEETS.ASSIGNMENTS);
  assignments.getRange(2, headerIndex_(SHEETS.ASSIGNMENTS, 'activo'), assignments.getMaxRows() - 1, 1).insertCheckboxes();
  const records = spreadsheet_().getSheetByName(SHEETS.RECORDS);
  records.getRange(2, headerIndex_(SHEETS.RECORDS, 'estado'), records.getMaxRows() - 1, 1).setDataValidation(recordStates);
  const requests = spreadsheet_().getSheetByName(SHEETS.REQUESTS);
  requests.getRange(2, headerIndex_(SHEETS.REQUESTS, 'estado'), requests.getMaxRows() - 1, 1).setDataValidation(requestStates);
}

function hideSensitiveColumns_() {
  const users = spreadsheet_().getSheetByName(SHEETS.USERS);
  ['pin_salt', 'pin_hash'].forEach(function (header) { users.hideColumns(headerIndex_(SHEETS.USERS, header)); });
  const requests = spreadsheet_().getSheetByName(SHEETS.REQUESTS);
  ['pin_salt', 'pin_hash'].forEach(function (header) { requests.hideColumns(headerIndex_(SHEETS.REQUESTS, header)); });
  const sessions = spreadsheet_().getSheetByName(SHEETS.SESSIONS);
  if (!sessions.isSheetHidden()) sessions.hideSheet();
  const audit = spreadsheet_().getSheetByName(SHEETS.AUDIT);
  if (!audit.isSheetHidden()) audit.hideSheet();
}

function ensureConfigValues_() {
  const defaults = [
    ['app_name', SYSTEM_CONFIG.APP_NAME, 'Nombre de la aplicacion'],
    ['app_version', SYSTEM_CONFIG.APP_VERSION, 'Version de frontend y backend'],
    ['schema_version', SYSTEM_CONFIG.SCHEMA_VERSION, 'Version de estructura de hojas'],
    ['bootstrap_key', randomSecret_().slice(0, 20).toUpperCase(), 'Clave de un solo uso para crear el primer administrador'],
    ['bootstrap_completed_at', '', 'Fecha de creacion del primer administrador'],
    ['photo_root_folder_id', '', 'Carpeta privada de Google Drive para fotografias'],
    ['photo_root_folder_url', '', 'Enlace administrativo a la carpeta de fotografias']
  ];
  defaults.forEach(function (entry) {
    if (configValue_(entry[0], null) === null) {
      appendObject_(SHEETS.CONFIG, { clave: entry[0], valor: entry[1], descripcion: entry[2], updated_at: nowIso_() });
    } else if (entry[0] === 'app_version' || entry[0] === 'schema_version') {
      setConfigValue_(entry[0], entry[1], entry[2]);
    }
  });
}

function configValue_(key, fallback) {
  const row = objects_(SHEETS.CONFIG).filter(function (item) { return String(item.clave) === key; })[0];
  return row ? String(row.valor == null ? '' : row.valor) : fallback;
}

function setConfigValue_(key, value, description) {
  upsertObject_(SHEETS.CONFIG, 'clave', key, {
    clave: key, valor: value, descripcion: description || '', updated_at: nowIso_()
  });
}

function seedSchools_() {
  const sheet = spreadsheet_().getSheetByName(SHEETS.SCHOOLS);
  const names = headers_(SHEETS.SCHOOLS);
  const existingRows = objects_(SHEETS.SCHOOLS);
  const byCode = {};
  existingRows.forEach(function (row) { byCode[String(row.codigo)] = row; });
  PILOT_SCHOOLS.forEach(function (school) {
    const previous = byCode[school.codigo] || {};
    byCode[school.codigo] = {
      codigo: school.codigo,
      nombre: school.nombre,
      departamento: school.departamento,
      distrito: school.distrito,
      zona: school.zona,
      localidad: school.localidad,
      latitud: school.latitud,
      longitud: school.longitud,
      es_muestra: true,
      orden_muestra: school.ordenMuestra,
      estado: previous.estado || 'ACTIVA',
      created_at: previous.created_at || nowIso_(),
      updated_at: nowIso_()
    };
  });
  const orderedCodes = existingRows.map(function (row) { return String(row.codigo); });
  PILOT_SCHOOLS.forEach(function (school) {
    if (orderedCodes.indexOf(school.codigo) < 0) orderedCodes.push(school.codigo);
  });
  const values = orderedCodes.map(function (code) {
    const row = byCode[code];
    return names.map(function (name) { return safeCell_(row[name]); });
  });
  if (values.length) sheet.getRange(2, 1, values.length, names.length).setValues(values);
}

function rootFolder_() {
  const configured = configValue_('photo_root_folder_id', '');
  if (configured) {
    try { return DriveApp.getFolderById(configured); } catch (ignore) { /* Se recrea debajo. */ }
  }
  const matches = DriveApp.getFoldersByName(SYSTEM_CONFIG.ROOT_FOLDER_NAME);
  const folder = matches.hasNext() ? matches.next() : DriveApp.createFolder(SYSTEM_CONFIG.ROOT_FOLDER_NAME);
  setConfigValue_('photo_root_folder_id', folder.getId(), 'Carpeta privada de Google Drive para fotografias');
  setConfigValue_('photo_root_folder_url', folder.getUrl(), 'Enlace administrativo a la carpeta de fotografias');
  return folder;
}

function headers_(sheetName) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw apiError_('SCHEMA_ERROR', 'No existe la hoja ' + sheetName + '.');
  return sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getDisplayValues()[0]
    .map(function (item) { return String(item || '').trim(); });
}

function headerIndex_(sheetName, header) {
  const index = headers_(sheetName).indexOf(header);
  if (index < 0) throw apiError_('SCHEMA_ERROR', 'Falta la columna ' + header + ' en ' + sheetName + '.');
  return index + 1;
}

function objects_(sheetName) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  const names = headers_(sheetName);
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, names.length).getValues();
  return values.map(function (row, index) {
    const object = { __row: index + 2 };
    names.forEach(function (name, position) { object[name] = row[position]; });
    return object;
  });
}

function appendObject_(sheetName, object) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  const names = headers_(sheetName);
  sheet.appendRow(names.map(function (name) { return safeCell_(object[name]); }));
  return sheet.getLastRow();
}

function upsertObject_(sheetName, keyName, keyValue, object) {
  const sheet = spreadsheet_().getSheetByName(sheetName);
  const names = headers_(sheetName);
  const existing = objects_(sheetName).filter(function (row) { return String(row[keyName]) === String(keyValue); })[0];
  if (!existing) return appendObject_(sheetName, object);
  const merged = {};
  names.forEach(function (name) { merged[name] = Object.prototype.hasOwnProperty.call(object, name) ? object[name] : existing[name]; });
  sheet.getRange(existing.__row, 1, 1, names.length).setValues([names.map(function (name) { return safeCell_(merged[name]); })]);
  return existing.__row;
}

function audit_(session, action, entity, entityId, details, client) {
  appendObject_(SHEETS.AUDIT, {
    event_id: Utilities.getUuid(),
    timestamp: nowIso_(),
    codigo_censista: session ? session.codigoCensista : '',
    rol: session ? session.rol : '',
    accion: action,
    entidad: entity,
    entidad_id: entityId || '',
    detalle_json: JSON.stringify(details || {}).slice(0, 5000),
    device_id: client && client.deviceId || '',
    user_agent: client && String(client.userAgent || '').slice(0, 500) || ''
  });
}
