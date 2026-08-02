export const RUE_COMPATIBILITY_SCHEMA = 'RUE-CIALPA-1.0';

const RUE_SECTION_BY_SPACE = Object.freeze({
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
});

export const RUE_EXPORT_HEADERS = Object.freeze([
  'contrato_version',
  'codigo_establecimiento_rue',
  'codigo_escuela_app',
  'nombre_establecimiento',
  'departamento',
  'distrito',
  'localidad',
  'sitio_fisico_cialpa',
  'sede_compartida',
  'codigos_rue_sitio',
  'seccion_rue',
  'clave_espacio_rue',
  'record_id_app',
  'record_key_app',
  'numero_formulario_papel',
  'numero_hoja_papel',
  'bloque',
  'planta_rue',
  'piso_app',
  'espacio',
  'tipo_espacio_app',
  'estado_registro_app',
  'observaciones',
  'danos_fallas',
  'latitud_captura',
  'longitud_captura',
  'precision_m',
  'codigo_censista',
  'created_at',
  'updated_at',
  'codigo_foto',
  'tipo_evidencia',
  'tipo_elemento',
  'numero_elemento',
  'secuencia',
  'captured_at',
  'uploaded_at',
  'drive_url',
  'sha256',
  'estado_compatibilidad'
]);

function digits(value) {
  return String(value == null ? '' : value).replace(/\D/g, '');
}

export function normalizeRueSchoolCode(value) {
  const normalized = digits(value);
  return normalized ? normalized.padStart(7, '0') : '';
}

export function schoolCodeAliases(school = {}) {
  const appCode = digits(school.codigo);
  const rueCode = normalizeRueSchoolCode(school.codigoRue || appCode);
  return [...new Set([appCode, rueCode].filter(Boolean))];
}

export function findSchoolByCode(catalog = [], value = '') {
  const requested = digits(value);
  if (!requested) return null;
  const requestedRue = normalizeRueSchoolCode(requested);
  return catalog.find((school) => {
    const aliases = schoolCodeAliases(school);
    return aliases.includes(requested) || aliases.includes(requestedRue);
  }) || null;
}

export function canonicalAppSchoolCode(catalog = [], value = '') {
  const school = findSchoolByCode(catalog, value);
  return school ? digits(school.codigo) : digits(value);
}

export function rueSectionForSpace(value) {
  return RUE_SECTION_BY_SPACE[String(value || '').trim().toUpperCase()] || '';
}

export function rueFloorLabel(value) {
  const floor = digits(value);
  if (!floor || Number(floor) === 0) return 'PLANTA_BAJA';
  return `NIVEL_${floor.padStart(2, '0')}`;
}

export function rueSpaceKey(record = {}, school = {}) {
  const schoolCode = normalizeRueSchoolCode(school.codigoRue || record.codigoRue || record.codigoEscuela);
  const section = rueSectionForSpace(record.tipoEspacio) || 'SIN_SECCION';
  const block = digits(record.bloque).padStart(2, '0');
  const space = digits(record.espacio).padStart(3, '0');
  if (!schoolCode || !digits(record.bloque) || !digits(record.espacio)) return '';
  return `RUE:${schoolCode}:${section}:B${block}:${rueFloorLabel(record.piso)}:E${space}`;
}

function recordKeyOf(record = {}) {
  const explicit = String(record.recordKey || '').trim();
  if (explicit) return explicit;
  const owner = String(record.codigoCensista || '').trim();
  const recordId = String(record.recordId || '').trim();
  return owner && recordId ? `${owner}:${recordId}` : recordId;
}

function catalogMaps(catalog = []) {
  const byCode = new Map();
  for (const school of catalog) {
    for (const code of schoolCodeAliases(school)) byCode.set(code, school);
  }
  return byCode;
}

function compatibilityIssues(record, school, rueCode, section, siteId) {
  const issues = [];
  if (!school) issues.push('ESCUELA_NO_CATALOGADA');
  if (!/^\d{7}$/.test(rueCode)) issues.push('CODIGO_RUE_INVALIDO');
  if (!siteId) issues.push('SITIO_FISICO_NO_DEFINIDO');
  if (!section) issues.push('TIPO_ESPACIO_SIN_MAPEO_RUE');
  if (!String(record.recordId || '').trim()) issues.push('REGISTRO_SIN_IDENTIFICADOR');
  if (record.codigoRue && school?.codigoRue
    && normalizeRueSchoolCode(record.codigoRue) !== normalizeRueSchoolCode(school.codigoRue)) {
    issues.push('CODIGO_RUE_NO_COINCIDE_CATALOGO');
  }
  if (record.sitioId && school?.sitioId && String(record.sitioId) !== String(school.sitioId)) {
    issues.push('SITIO_NO_COINCIDE_CATALOGO');
  }
  return issues;
}

export function buildRueCompatibilityRows(records = [], photos = [], catalog = []) {
  const schools = catalogMaps(catalog);
  const photosByRecord = new Map();
  for (const photo of photos) {
    const key = recordKeyOf(photo);
    if (!photosByRecord.has(key)) photosByRecord.set(key, []);
    photosByRecord.get(key).push(photo);
  }

  const rows = [];
  for (const record of records) {
    const school = schools.get(digits(record.codigoEscuela)) || null;
    const rueCode = normalizeRueSchoolCode(school?.codigoRue || record.codigoRue || record.codigoEscuela);
    const section = String(record.rueSection || rueSectionForSpace(record.tipoEspacio));
    const siteId = String(school?.sitioId || record.sitioId || '');
    const recordKey = recordKeyOf(record);
    const issues = compatibilityIssues(record, school, rueCode, section, siteId);
    const evidence = photosByRecord.get(recordKey) || [];
    const common = {
      contrato_version: RUE_COMPATIBILITY_SCHEMA,
      codigo_establecimiento_rue: rueCode,
      codigo_escuela_app: String(school?.codigo || record.codigoEscuela || ''),
      nombre_establecimiento: String(school?.nombre || ''),
      departamento: String(school?.departamento || ''),
      distrito: String(school?.distrito || ''),
      localidad: String(school?.localidad || ''),
      sitio_fisico_cialpa: siteId,
      sede_compartida: school?.sedeCompartida ? 'SI' : 'NO',
      codigos_rue_sitio: (school?.codigosRueSitio || [rueCode]).join('|'),
      seccion_rue: section,
      clave_espacio_rue: String(record.rueSpaceKey || rueSpaceKey(record, school || {})),
      record_id_app: String(record.recordId || ''),
      record_key_app: recordKey,
      numero_formulario_papel: String(record.numeroFormulario || ''),
      numero_hoja_papel: String(record.numeroHoja || ''),
      bloque: String(record.bloque || ''),
      planta_rue: rueFloorLabel(record.piso),
      piso_app: String(record.piso || ''),
      espacio: String(record.espacio || ''),
      tipo_espacio_app: String(record.tipoEspacio || ''),
      estado_registro_app: String(record.estado || ''),
      observaciones: String(record.observaciones || ''),
      danos_fallas: String(record.danosFallas || ''),
      latitud_captura: String(record.latitudCaptura ?? ''),
      longitud_captura: String(record.longitudCaptura ?? ''),
      precision_m: String(record.precisionM ?? ''),
      codigo_censista: String(record.codigoCensista || ''),
      created_at: String(record.createdAt || ''),
      updated_at: String(record.updatedAt || record.syncedAt || ''),
      estado_compatibilidad: issues.length ? issues.join('|') : 'COMPATIBLE'
    };
    const items = evidence.length ? evidence : [null];
    for (const photo of items) {
      rows.push({
        ...common,
        codigo_foto: String(photo?.codigoFoto || ''),
        tipo_evidencia: String(photo?.tipoFoto || ''),
        tipo_elemento: String(photo?.tipoElemento || ''),
        numero_elemento: String(photo?.numeroElemento || ''),
        secuencia: String(photo?.secuencia ?? ''),
        captured_at: String(photo?.capturedAt || ''),
        uploaded_at: String(photo?.uploadedAt || ''),
        drive_url: String(photo?.driveUrl || ''),
        sha256: String(photo?.sha256 || '')
      });
    }
  }
  const recordsBySpace = new Map();
  for (const row of rows) {
    if (!row.clave_espacio_rue) continue;
    if (!recordsBySpace.has(row.clave_espacio_rue)) recordsBySpace.set(row.clave_espacio_rue, new Set());
    recordsBySpace.get(row.clave_espacio_rue).add(row.record_key_app || row.record_id_app);
  }
  for (const row of rows) {
    if ((recordsBySpace.get(row.clave_espacio_rue)?.size || 0) <= 1) continue;
    row.estado_compatibilidad = row.estado_compatibilidad === 'COMPATIBLE'
      ? 'ESPACIO_RUE_DUPLICADO'
      : `${row.estado_compatibilidad}|ESPACIO_RUE_DUPLICADO`;
  }
  return rows;
}

export function rueCompatibilitySummary(rows = []) {
  const records = new Map();
  for (const row of rows) {
    const key = row.record_key_app || row.record_id_app;
    const current = records.get(key) || { compatible: true };
    if (row.estado_compatibilidad !== 'COMPATIBLE') current.compatible = false;
    records.set(key, current);
  }
  const compatible = [...records.values()].filter((item) => item.compatible).length;
  return {
    records: records.size,
    compatible,
    withIssues: records.size - compatible,
    evidenceRows: rows.filter((row) => row.codigo_foto).length
  };
}

function safeCsvValue(value) {
  let text = String(value == null ? '' : value);
  if (/^[=+@]/.test(text) || (/^-/.test(text) && !/^-\d+(?:[.,]\d+)?$/.test(text))) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function rueCompatibilityCsv(rows = []) {
  const lines = [RUE_EXPORT_HEADERS.map(safeCsvValue).join(';')];
  for (const row of rows) {
    lines.push(RUE_EXPORT_HEADERS.map((header) => safeCsvValue(row[header])).join(';'));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
