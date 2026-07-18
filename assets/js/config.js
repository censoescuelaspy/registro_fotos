export const APP_CONFIG = Object.freeze({
  appName: 'CIALPA Fotos',
  version: '1.0.2',
  buildDate: '2026-07-18',
  gasExecUrl: 'https://script.google.com/macros/s/AKfycbz8RmR-TqSb3FzaLSgMO2NlTTOfRPWuYjSC5ZyXw1Vr5iL-PBYeDIerNvCVj--hNjYk/exec',
  schoolCatalogUrl: './assets/data/pilot-schools.json',
  manualUrl: './docs/FICHA_CONTINGENCIA_PLANO_MANUAL_CIALPA_v1.4.pdf#page=2',
  printableFormUrl: './docs/FICHA_CONTINGENCIA_PLANO_MANUAL_CIALPA_v1.4.pdf#page=1',
  sessionStorageKey: 'cialpa-fotos-session-v1',
  deviceStorageKey: 'cialpa-fotos-device-v1',
  recordsCacheKey: 'cialpa-fotos-records-cache-v1',
  maxSourceBytes: 50 * 1024 * 1024,
  maxUploadBytes: 15 * 1024 * 1024,
  sessionHours: 12,
  demo: new URLSearchParams(location.search).get('demo') === '1'
    || ['localhost', '127.0.0.1'].includes(location.hostname)
});
