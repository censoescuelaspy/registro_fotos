export const DEMO_LOAD_SCHOOL = Object.freeze({
  codigo: '9999001',
  codigoRue: '9999001',
  sitioId: 'CIALPA-TEST-5000',
  numeroSitio: 9999,
  codigosSitio: ['9999001'],
  codigosRueSitio: ['9999001'],
  sedeCompartida: false,
  aulasEstimadasSitio: 75,
  nombre: 'ESCUELA FICTICIA DE PRUEBA DE CARGA - NO OPERATIVA',
  departamento: 'SIMULACION',
  distrito: 'PRUEBA CONTROLADA',
  zona: 'URBANA',
  localidad: 'DATOS SINTETICOS',
  latitud: -25.3005,
  longitud: -57.6359,
  ordenMuestra: 9999,
  simulada: true
});

export const DEMO_LOAD_USER = Object.freeze({
  codigoCensista: '9980001',
  nombres: 'Carga',
  apellidos: 'Simulada',
  equipo: 'Equipo Prueba',
  telefono: '',
  rol: 'ENCUESTADOR',
  disponibleCampo: true,
  activo: true
});

export const DEMO_LOAD_COUNTS = Object.freeze({ records: 75, photosPerRecord: 4, photos: 300 });

const PHOTO_VARIANTS = Object.freeze([
  { tipoFoto: 'EVIDENCIA', tipoElemento: 'AMBIENTE', codigoElemento: 'AM01', numeroElemento: '1', asset: './assets/img/icon-512.png', bytes: 69200 },
  { tipoFoto: 'EVIDENCIA', tipoElemento: 'PARED', codigoElemento: 'MU01', numeroElemento: '1', asset: './assets/img/logo.png', bytes: 65770 },
  { tipoFoto: 'EVIDENCIA', tipoElemento: 'PUERTA', codigoElemento: 'PT01', numeroElemento: '1', asset: './assets/img/icon-192.png', bytes: 17044 },
  { tipoFoto: 'HOJA_PAPEL', tipoElemento: 'HOJA_PAPEL', codigoElemento: 'HP01', numeroElemento: '1', asset: './assets/img/favicon.png', bytes: 65770 }
]);

export function createDemoLoadDataset() {
  const records = [];
  const photos = [];
  const start = Date.parse('2026-08-02T09:00:00-03:00');
  for (let recordIndex = 0; recordIndex < DEMO_LOAD_COUNTS.records; recordIndex += 1) {
    const block = String(Math.floor(recordIndex / 25) + 1);
    const space = String(recordIndex % 25 + 1);
    const recordId = `${DEMO_LOAD_SCHOOL.codigo}-B${block.padStart(2, '0')}-P00-E${space.padStart(3, '0')}-H01`;
    const recordKey = `${DEMO_LOAD_USER.codigoCensista}:${recordId}`;
    const timestamp = new Date(start + recordIndex * 60000).toISOString();
    records.push({
      recordKey,
      recordId,
      codigoEscuela: DEMO_LOAD_SCHOOL.codigo,
      codigoRue: DEMO_LOAD_SCHOOL.codigoRue,
      sitioId: DEMO_LOAD_SCHOOL.sitioId,
      codigoCensista: DEMO_LOAD_USER.codigoCensista,
      numeroFormulario: '9999',
      numeroHoja: '1',
      bloque: block,
      piso: '0',
      espacio: space,
      tipoEspacio: 'AULA',
      estado: 'FINALIZADO',
      observaciones: 'Registro sintetico para prueba de carga. No corresponde a una escuela real.',
      danosFallas: '',
      cantidadFotos: DEMO_LOAD_COUNTS.photosPerRecord,
      cantidadHojasPapel: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      syncedAt: timestamp,
      startedAt: timestamp,
      completedAt: new Date(start + recordIndex * 60000 + 12 * 60000).toISOString(),
      durationSeconds: 720
    });
    PHOTO_VARIANTS.forEach((variant, photoIndex) => {
      const sequence = photoIndex + 1;
      photos.push({
        fotoId: `SIM-${String(recordIndex + 1).padStart(3, '0')}-${String(sequence).padStart(2, '0')}`,
        idempotencyKey: `SIM-IDEMP-${String(recordIndex + 1).padStart(3, '0')}-${String(sequence).padStart(2, '0')}`,
        recordKey,
        recordId,
        codigoEscuela: DEMO_LOAD_SCHOOL.codigo,
        codigoRue: DEMO_LOAD_SCHOOL.codigoRue,
        sitioId: DEMO_LOAD_SCHOOL.sitioId,
        codigoCensista: DEMO_LOAD_USER.codigoCensista,
        tipoFoto: variant.tipoFoto,
        tipoElemento: variant.tipoElemento,
        numeroElemento: variant.numeroElemento,
        codigoElemento: variant.codigoElemento,
        secuencia: sequence,
        codigoFoto: `${recordId}-${variant.codigoElemento}-FT${String(sequence).padStart(2, '0')}`,
        etiquetaImpresa: true,
        nombreArchivo: `${recordId}-${variant.codigoElemento}-FT${String(sequence).padStart(2, '0')}.png`,
        mimeType: 'image/png',
        bytes: variant.bytes,
        sha256: `simulada-${String(recordIndex + 1).padStart(3, '0')}-${sequence}`,
        capturedAt: new Date(start + (recordIndex * 4 + photoIndex) * 15000).toISOString(),
        uploadedAt: timestamp,
        estado: 'ACTIVA',
        notas: `Imagen simulada ${sequence} de 4; recurso ${variant.asset}.`,
        demoAssetUrl: variant.asset
      });
    });
  }
  return { records, photos };
}
