const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

test('el backend resuelve el codigo RUE y conserva una unica llave interna', () => {
  const recordsSource = fs.readFileSync(path.join(process.cwd(), 'gas', 'Records.js'), 'utf8');
  const adminSource = fs.readFileSync(path.join(process.cwd(), 'gas', 'Admin.js'), 'utf8');
  const catalog = [{ codigo: '11007', codigo_rue: '0011007', sitio_id: 'CIALPA-S001' }];
  const updatedAssignments = [];
  const appendedAssignments = [];
  const sheets = {
    ESCUELAS: catalog,
    USUARIOS: [{ codigo_censista: '12345', activo: true }],
    ASIGNACIONES: [{ assignment_id: 'A1', codigo_censista: '12345', codigo_escuela: '0011007', activo: true }]
  };
  const context = {
    SHEETS: { SCHOOLS: 'ESCUELAS', USERS: 'USUARIOS', ASSIGNMENTS: 'ASIGNACIONES' },
    ROLE: { ADMIN: 'ADMIN', SUPERVISOR: 'SUPERVISOR' },
    objects_: (name) => sheets[name] || [],
    active_: (value) => value === true,
    boolean_: (value) => value === true,
    requireRole_: () => {},
    digits_: (value) => String(value || '').replace(/\D/g, ''),
    text_: (value) => String(value || ''),
    number_: (value) => Number(value),
    nowIso_: () => '2026-08-01T22:00:00-03:00',
    upsertObject_: (sheet, key, id, values) => updatedAssignments.push({ sheet, key, id, values }),
    appendObject_: (sheet, values) => appendedAssignments.push({ sheet, values }),
    audit_: () => {},
    Utilities: { getUuid: () => 'NEW-ID' }
  };
  vm.createContext(context);
  vm.runInContext(recordsSource, context);
  vm.runInContext(adminSource, context);

  expect(context.canonicalRueCode_('11.007')).toBe('0011007');
  expect(context.schoolByAnyCode_('001-1007', catalog).codigo).toBe('11007');
  expect(context.canonicalAppSchoolCode_('0011007', catalog)).toBe('11007');
  expect(context.canonicalAppSchoolCode_('11007', catalog)).toBe('11007');
  expect(context.canonicalAppSchoolCode_('9999999', catalog)).toBe('');
  expect(context.photoView_({ codigo_escuela: '11007', codigo_rue: '0011007', sitio_id: 'CIALPA-S001' })).toMatchObject({
    codigoEscuela: '11007', codigoRue: '0011007', sitioId: 'CIALPA-S001'
  });

  context.saveAssignment_(
    { codigoCensista: '12345', codigoEscuela: '001-1007', activo: true, notas: '' },
    { codigoCensista: 'ADMIN', rol: 'ADMIN' },
    {}
  );
  expect(updatedAssignments).toHaveLength(1);
  expect(updatedAssignments[0].id).toBe('A1');
  expect(updatedAssignments[0].values.codigo_escuela).toBe('11007');
  expect(appendedAssignments).toHaveLength(0);
});

test('normaliza las claves RUE y protege el CSV de conciliacion', async ({ page }) => {
  await page.goto('/?demo=1');
  const result = await page.evaluate(async () => {
    const rue = await import('./assets/js/rue.js');
    const school = {
      codigo: '11007',
      codigoRue: '0011007',
      sitioId: 'CIALPA-S001',
      codigosRueSitio: ['0011007'],
      nombre: '=FORMULA',
      departamento: 'CAPITAL',
      distrito: 'ASUNCION',
      localidad: 'LA CATEDRAL'
    };
    const record = {
      recordId: '11007-B01-P00-E001-H01',
      recordKey: '1234567:11007-B01-P00-E001-H01',
      codigoEscuela: '11007',
      codigoCensista: '1234567',
      numeroFormulario: '1',
      numeroHoja: '1',
      bloque: '1',
      piso: '0',
      espacio: '1',
      tipoEspacio: 'AULA',
      estado: 'EN_PROCESO'
    };
    const rows = rue.buildRueCompatibilityRows([record], [], [school]);
    const duplicateRows = rue.buildRueCompatibilityRows([
      record,
      { ...record, recordKey: '7654321:11007-B01-P00-E001-H01', codigoCensista: '7654321' }
    ], [], [school]);
    return {
      normalized: rue.normalizeRueSchoolCode('11.007'),
      section: rue.rueSectionForSpace('LABORATORIO'),
      spaceKey: rows[0].clave_espacio_rue,
      compatibility: rows[0].estado_compatibilidad,
      csv: rue.rueCompatibilityCsv(rows),
      duplicateStates: duplicateRows.map((row) => row.estado_compatibilidad),
      appCodeFromRue: rue.canonicalAppSchoolCode([school], '0011007'),
      foundFromFormattedRue: rue.findSchoolByCode([school], '001-1007')?.codigo,
      aliases: rue.schoolCodeAliases(school),
      rowFromRueInput: rue.buildRueCompatibilityRows([
        { ...record, codigoEscuela: '0011007' }
      ], [], [school])[0]
    };
  });

  expect(result.normalized).toBe('0011007');
  expect(result.section).toBe('LABORATORIO_TALLER');
  expect(result.spaceKey).toBe('RUE:0011007:AULA:B01:PLANTA_BAJA:E001');
  expect(result.compatibility).toBe('COMPATIBLE');
  expect(result.csv.startsWith('\uFEFF')).toBeTruthy();
  expect(result.csv).toContain('"\'=FORMULA"');
  expect(result.duplicateStates).toEqual(['ESPACIO_RUE_DUPLICADO', 'ESPACIO_RUE_DUPLICADO']);
  expect(result.appCodeFromRue).toBe('11007');
  expect(result.foundFromFormattedRue).toBe('11007');
  expect(result.aliases).toEqual(['11007', '0011007']);
  expect(result.rowFromRueInput.codigo_escuela_app).toBe('11007');
  expect(result.rowFromRueInput.codigo_establecimiento_rue).toBe('0011007');
});

test('el backend limita al supervisor a escuelas y registros de su equipo', () => {
  const recordsSource = fs.readFileSync(path.join(process.cwd(), 'gas', 'Records.js'), 'utf8');
  const sheets = {
    USUARIOS: [
      { codigo_censista: '5678901', equipo: 'Equipo 1', rol: 'SUPERVISOR', activo: true },
      { codigo_censista: '2345678', equipo: 'Equipo 1', rol: 'ENCUESTADOR', activo: true },
      { codigo_censista: '3456789', equipo: 'Equipo 2', rol: 'ENCUESTADOR', activo: true }
    ],
    ASIGNACIONES: [
      { codigo_censista: '2345678', codigo_escuela: '11007', activo: true },
      { codigo_censista: '3456789', codigo_escuela: '10038', activo: true }
    ],
    ESCUELAS: [
      { codigo: '11007', codigo_rue: '0011007', sitio_id: 'CIALPA-S001' },
      { codigo: '10038', codigo_rue: '0010038', sitio_id: 'CIALPA-S002' }
    ],
    REGISTROS: [
      { record_key: '2345678:R1', record_id: 'R1', codigo_censista: '2345678', codigo_escuela: '11007', estado: 'FINALIZADO', cantidad_fotos: 1 },
      { record_key: '3456789:R2', record_id: 'R2', codigo_censista: '3456789', codigo_escuela: '10038', estado: 'FINALIZADO', cantidad_fotos: 1 }
    ],
    FOTOS: [
      { foto_id: 'F1', record_key: '2345678:R1', codigo_censista: '2345678', codigo_escuela: '11007', estado: 'ACTIVA', mime_type: 'image/jpeg', drive_file_id: 'D1' },
      { foto_id: 'F2', record_key: '3456789:R2', codigo_censista: '3456789', codigo_escuela: '10038', estado: 'ACTIVA', mime_type: 'image/jpeg', drive_file_id: 'D2' }
    ]
  };
  const context = {
    SHEETS: { USERS: 'USUARIOS', ASSIGNMENTS: 'ASIGNACIONES', SCHOOLS: 'ESCUELAS', RECORDS: 'REGISTROS', PHOTOS: 'FOTOS' },
    ROLE: { ADMIN: 'ADMIN', SUPERVISOR: 'SUPERVISOR', SURVEYOR: 'ENCUESTADOR' },
    RECORD_STATUS: ['EN_PROCESO', 'FINALIZADO', 'CON_PENDIENTES'],
    objects_: (name) => sheets[name] || [],
    active_: (value) => value === true,
    boolean_: (value) => value === true,
    digits_: (value) => String(value || '').replace(/\D/g, ''),
    text_: (value) => String(value || ''),
    number_: (value) => Number(value),
    apiError_: (code, message) => Object.assign(new Error(message), { apiCode: code }),
    SYSTEM_CONFIG: { MAX_PHOTO_BYTES: 15 * 1024 * 1024 },
    Utilities: { base64Encode: (bytes) => Buffer.from(bytes).toString('base64') },
    DriveApp: { getFileById: () => ({ getBlob: () => ({ getBytes: () => [1, 2, 3] }) }) },
    publicUser_: (user) => ({ codigoCensista: user.codigo_censista, rol: user.rol, equipo: user.equipo }),
    performanceForUser_: () => ({ individual: null, team: null })
  };
  vm.createContext(context);
  vm.runInContext(recordsSource, context);
  context.publicUser_ = (user) => ({ codigoCensista: user.codigo_censista, rol: user.rol, equipo: user.equipo });
  context.performanceForUser_ = () => ({ individual: null, team: null });
  const session = { codigoCensista: '5678901', rol: 'SUPERVISOR', user: sheets.USUARIOS[0] };

  expect(context.canAccessSchool_(session, '11007')).toBe(true);
  expect(context.canAccessSchool_(session, '10038')).toBe(false);
  const bootstrap = context.bootstrap_(session);
  expect(bootstrap.showAllSchools).toBe(false);
  expect(bootstrap.assignedCodes).toEqual(['11007']);
  expect(Object.keys(bootstrap.progress)).toEqual(['11007']);

  const listed = context.listRecords_({}, session);
  expect(listed.records).toHaveLength(1);
  expect(listed.records[0].codigoCensista).toBe('2345678');
  expect(listed.photos).toHaveLength(1);
  expect(listed.photos[0].codigoCensista).toBe('2345678');
  expect(context.getPhotoContent_({ fotoId: 'F1' }, session)).toMatchObject({ fotoId: 'F1', mimeType: 'image/jpeg', chunkIndex: 0, totalChunks: 1, chunk: 'AQID' });
  const largeBytes = Array(225001).fill(7);
  context.DriveApp.getFileById = () => ({ getBlob: () => ({ getBytes: () => largeBytes }) });
  const firstChunk = context.getPhotoContent_({ fotoId: 'F1', chunkIndex: 0 }, session);
  const secondChunk = context.getPhotoContent_({ fotoId: 'F1', chunkIndex: 1 }, session);
  expect(firstChunk.totalChunks).toBe(2);
  expect(firstChunk.chunk).toHaveLength(300000);
  expect(firstChunk.chunk + secondChunk.chunk).toBe(Buffer.from(largeBytes).toString('base64'));
  expect(() => context.getPhotoContent_({ fotoId: 'F2' }, session)).toThrow(/no esta asignada/i);
});
