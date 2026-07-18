function doGet() {
  try {
    ensureSystem_();
    return jsonResponse_({
      ok: true,
      data: {
        service: SYSTEM_CONFIG.APP_NAME,
        version: SYSTEM_CONFIG.APP_VERSION,
        schemaVersion: SYSTEM_CONFIG.SCHEMA_VERSION,
        bootstrapRequired: bootstrapRequired_(),
        timestamp: nowIso_()
      }
    });
  } catch (error) {
    return errorResponse_(error);
  }
}

function doPost(event) {
  let transport = null;
  try {
    transport = iframeTransport_(event);
    ensureSystem_();
    const request = parseRequest_(event);
    const action = request.action;
    const payload = request.payload || {};
    const client = request.client || {};
    if (action === 'health') {
      return response_({ ok: true, data: {
        service: SYSTEM_CONFIG.APP_NAME,
        version: SYSTEM_CONFIG.APP_VERSION,
        schemaVersion: SYSTEM_CONFIG.SCHEMA_VERSION,
        bootstrapRequired: bootstrapRequired_(),
        timestamp: nowIso_()
      }}, transport);
    }
    if (action === 'requestAccess') return response_({ ok: true, data: requestAccess_(payload, client) }, transport);
    if (action === 'bootstrapAdmin') return response_({ ok: true, data: bootstrapAdmin_(payload, client) }, transport);
    if (action === 'login') return response_({ ok: true, data: login_(payload, client) }, transport);

    const session = sessionFromToken_(request.token);
    let data;
    if (action === 'logout') data = logout_(session, client);
    else if (action === 'bootstrap') data = bootstrap_(session);
    else if (action === 'saveRecord') data = saveRecord_(payload.record || {}, session, client);
    else if (action === 'uploadPhoto') data = uploadPhoto_(payload.photo || {}, payload.base64 || '', session, client);
    else if (action === 'listRecords') data = listRecords_(payload, session);
    else if (action === 'adminDashboard') data = adminDashboard_(session);
    else if (action === 'saveUser') data = saveUser_(payload.user || {}, session, client);
    else if (action === 'saveAssignment') data = saveAssignment_(payload.assignment || {}, session, client);
    else if (action === 'reviewAccess') data = reviewAccess_(payload, session, client);
    else throw apiError_('ACTION_NOT_FOUND', 'Accion no reconocida.');
    return response_({ ok: true, data: data }, transport);
  } catch (error) {
    return errorResponse_(error, transport);
  }
}

function parseRequest_(event) {
  const iframeRequest = event && event.parameter && event.parameter.transport === 'iframe';
  const contents = iframeRequest
    ? event.parameter.request
    : event && event.postData && event.postData.contents;
  if (!contents) {
    throw apiError_('BAD_REQUEST', 'Solicitud vacia.');
  }
  let request;
  try { request = JSON.parse(contents); }
  catch (ignore) { throw apiError_('BAD_REQUEST', 'JSON invalido.'); }
  if (!request || typeof request !== 'object') throw apiError_('BAD_REQUEST', 'Solicitud invalida.');
  request.action = text_(request.action, 'accion', 80, true);
  return request;
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function iframeTransport_(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  if (parameters.transport !== 'iframe') return null;
  const origin = text_(parameters.origin, 'origen', 200, true);
  if (SYSTEM_CONFIG.ALLOWED_ORIGINS.indexOf(origin) < 0) {
    throw apiError_('ORIGIN_NOT_ALLOWED', 'Origen no autorizado.');
  }
  return {
    type: 'iframe',
    origin: origin,
    requestId: text_(parameters.requestId, 'requestId', 100, true)
  };
}

function response_(payload, transport) {
  if (!transport || transport.type !== 'iframe') return jsonResponse_(payload);
  const message = JSON.stringify({
    source: 'CIALPA_GAS',
    requestId: transport.requestId,
    payload: payload
  })
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const targetOrigin = JSON.stringify(transport.origin);
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>'
    + '<script>window.top.postMessage(' + message + ',' + targetOrigin + ');<\/script>'
    + '</body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function errorResponse_(error, transport) {
  const known = Boolean(error && error.apiCode);
  if (!known) console.error(error && error.stack ? error.stack : error);
  return response_({
    ok: false,
    error: {
      code: known ? error.apiCode : 'INTERNAL_ERROR',
      message: known ? error.message : 'Ocurrio un error interno. Intente nuevamente.',
      details: known ? error.apiDetails : null
    }
  }, transport);
}
