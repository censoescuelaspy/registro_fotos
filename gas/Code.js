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
  try {
    ensureSystem_();
    const request = parseRequest_(event);
    const action = request.action;
    const payload = request.payload || {};
    const client = request.client || {};
    if (action === 'health') {
      return jsonResponse_({ ok: true, data: {
        service: SYSTEM_CONFIG.APP_NAME,
        version: SYSTEM_CONFIG.APP_VERSION,
        schemaVersion: SYSTEM_CONFIG.SCHEMA_VERSION,
        bootstrapRequired: bootstrapRequired_(),
        timestamp: nowIso_()
      }});
    }
    if (action === 'requestAccess') return jsonResponse_({ ok: true, data: requestAccess_(payload, client) });
    if (action === 'bootstrapAdmin') return jsonResponse_({ ok: true, data: bootstrapAdmin_(payload, client) });
    if (action === 'login') return jsonResponse_({ ok: true, data: login_(payload, client) });

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
    return jsonResponse_({ ok: true, data: data });
  } catch (error) {
    return errorResponse_(error);
  }
}

function parseRequest_(event) {
  if (!event || !event.postData || !event.postData.contents) {
    throw apiError_('BAD_REQUEST', 'Solicitud vacia.');
  }
  let request;
  try { request = JSON.parse(event.postData.contents); }
  catch (ignore) { throw apiError_('BAD_REQUEST', 'JSON invalido.'); }
  if (!request || typeof request !== 'object') throw apiError_('BAD_REQUEST', 'Solicitud invalida.');
  request.action = text_(request.action, 'accion', 80, true);
  return request;
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function errorResponse_(error) {
  const known = Boolean(error && error.apiCode);
  if (!known) console.error(error && error.stack ? error.stack : error);
  return jsonResponse_({
    ok: false,
    error: {
      code: known ? error.apiCode : 'INTERNAL_ERROR',
      message: known ? error.message : 'Ocurrio un error interno. Intente nuevamente.',
      details: known ? error.apiDetails : null
    }
  });
}
