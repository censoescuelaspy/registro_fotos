const HELP_ITEMS = Object.freeze({
  access: ['Acceso a la app', 'Ingrese con el codigo operativo o la cedula habilitada. El PIN es personal: no lo comparta ni lo incluya en reportes de incidencias.'],
  user: ['Usuario de acceso', 'Use exactamente el codigo operativo o la cedula registrados por la coordinacion. Se admiten entre 5 y 12 numeros; la cuenta administradora usa su identificador propio.'],
  pin: ['Contrasena o PIN', 'Escriba su PIN personal. Si no puede ingresar, verifique el usuario, el teclado numerico y la conexion antes de solicitar ayuda. Nunca envie el PIN por capturas o mensajes.'],
  accessRequest: ['Solicitud de acceso', 'Complete identidad, telefono y un PIN inicial. La solicitud no habilita el ingreso hasta que la administracion la revise y apruebe.'],
  schools: ['Escuelas asignadas', 'Confirme codigo RUE, codigo interno, nombre y sitio fisico antes de iniciar. Un supervisor ve solamente las escuelas asignadas a integrantes de su propio equipo.'],
  schoolSearch: ['Buscar escuela', 'Puede buscar por codigo RUE de siete digitos, codigo interno, nombre, departamento, distrito o localidad. No identifique una escuela solo por su denominacion.'],
  department: ['Departamento', 'Limita la lista al departamento seleccionado. Combine este filtro con distrito, estado o busqueda cuando necesite acotar la ruta.'],
  district: ['Distrito', 'Muestra solamente escuelas del distrito elegido dentro del conjunto autorizado para el usuario o su equipo.'],
  status: ['Estado', 'Pendiente: sin cierre; En proceso: existe trabajo iniciado; Con pendientes: falta una accion documentada; Finalizado: registro cerrado y sincronizado.'],
  map: ['Mapa de escuelas', 'Seleccione un punto para revisar la escuela. Antes de salir, abra sus ubicaciones con conexion para que el mapa quede disponible; confirme el punto con nombre y codigos.'],
  route: ['Ruta y ubicacion', 'Abre la ubicacion en el servicio de mapas. El punto es una ayuda de llegada: confirme en campo el acceso, el nombre y los codigos de la escuela.'],
  schoolCode: ['Codigo de escuela', 'El codigo RUE tiene siete digitos y puede comenzar con cero. La app conserva ademas el codigo interno para trazabilidad; ambos deben referir a la misma institucion.'],
  physicalSite: ['Sitio fisico CIALPA', 'Identifica la construccion que se visita. Dos instituciones pueden tener codigos diferentes y compartir el mismo edificio; en ese caso se releva la construccion una sola vez segun la asignacion.'],
  register: ['Nuevo registro', 'Abra la escuela correcta, copie los numeros de la ficha en papel y mantenga iguales bloque, piso, espacio y hoja en el croquis, CIALPA Fotos y RUE.'],
  recordId: ['Identificador del registro', 'Se forma automaticamente con escuela, bloque, piso, espacio y hoja. No lo escriba manualmente; revise que coincida con la ficha antes de fotografiar.'],
  formNumber: ['Numero de formulario', 'Copie el numero impreso en la ficha. Complete los casilleros numericos desde la derecha hacia la izquierda para conservar la alineacion.'],
  sheetNumber: ['Numero de hoja', 'Indique la hoja exacta del formulario que corresponde a este ambiente. La foto de papel debe mostrar la hoja completa, plana y legible.'],
  block: ['Bloque', 'Use la misma numeracion del croquis y de RUE. B01 significa primer bloque; no renumere los bloques entre herramientas.'],
  floor: ['Piso o planta', 'Use P00 para planta baja y P01 para primer piso. La app traduce Piso 0 como Planta baja para compatibilidad con RUE.'],
  space: ['Espacio', 'Numere cada ambiente dentro del bloque y piso, por ejemplo E001. Mantenga el mismo numero en la ficha, las fotos y el sistema.'],
  spaceType: ['Tipo de espacio', 'Seleccione el uso observado: aula, sanitario, administracion, exterior u otro. Esta seleccion determina la seccion equivalente para conciliacion con RUE.'],
  element: ['Elemento fotografiado', 'Seleccione el componente visible: pared, puerta, ventana, instalacion, dano u otro. Para una vista general use Ambiente.'],
  elementNumber: ['Numero del elemento', 'Copie el numero asignado en el croquis. Una puerta PT01 o un dano DF01 deben conservar el mismo numero en todas las fotos relacionadas.'],
  photoCode: ['Codigo de la proxima foto', 'La app combina registro, elemento y secuencia. Compruebe los numeros antes de abrir la camara; la franja se agrega sin cubrir la imagen original.'],
  photos: ['Evidencia fotografica', 'Siga la secuencia contexto, posicion, detalle y hoja. Evite dedos, reflejos, contraluz, zoom digital, personas sin autorizacion y fotos repetidas.'],
  contextPhoto: ['Foto del espacio', 'Primero tome una vista general que permita reconocer el ambiente y ubicar el elemento. Luego agregue los detalles necesarios.'],
  paperPhoto: ['Foto de la hoja', 'Apoye el papel en una superficie plana, use luz uniforme, mantenga la camara paralela e incluya las cuatro esquinas con texto enfocado.'],
  photoNote: ['Nota de la foto', 'Agregue solo una aclaracion util para interpretar la evidencia. No incluya PIN, datos personales innecesarios ni informacion ajena al relevamiento.'],
  gps: ['Ubicacion GPS', 'Obtenga la posicion en la escuela. La precision depende del dispositivo y del entorno; espere una lectura estable. Es obligatoria para cerrar como Finalizado.'],
  observations: ['Observaciones', 'Describa hechos verificables y acciones pendientes. Si el estado es Con pendientes, explique exactamente que falta y que debe hacerse.'],
  damage: ['Danos y fallas', 'Registre el hallazgo de forma concreta y use DF en el croquis. Cuando corresponda, conserve una vista general y otra cercana con el mismo numero.'],
  saveDraft: ['Guardar borrador', 'Guarda el trabajo en este dispositivo sin cerrarlo. No borre datos del navegador, no desinstale la app y no cambie de dispositivo mientras haya trabajo local.'],
  finalize: ['Finalizar y sincronizar', 'Revise codigo, fotos, GPS y observaciones. Con conexion se envia al servidor; sin conexion queda en cola para reintentar desde Mi jornada.'],
  journal: ['Mi jornada', 'Reune borradores, cola pendiente y registros sincronizados. Antes de retirarse, confirme que la cola indique cero o que todo este guardado localmente.'],
  drafts: ['Borradores', 'Son fichas guardadas solo en este navegador. Abra el borrador correcto para continuar y elimine uno unicamente cuando confirme que ya no se necesita.'],
  queue: ['Cola pendiente', 'Contiene operaciones aun no recibidas por el servidor. Recupere internet, mantenga la app abierta, pulse Sincronizar y espere hasta ver cero.'],
  synced: ['Registros sincronizados', 'Ya fueron recibidos por el servidor. Puede editar sus propios registros; los de otro integrante del equipo se muestran solo para consulta.'],
  edit: ['Editar registro', 'Corrija sus propios datos o agregue evidencias. Al finalizar otra vez se actualiza la ficha y se envian solamente las fotos nuevas.'],
  kpiRecords: ['Fichas registradas', 'Cantidad de registros creados por la persona o el equipo dentro del alcance visible. No equivale necesariamente a escuelas finalizadas.'],
  kpiAverage: ['Promedio por ficha', 'Tiempo medio de las fichas con inicio y finalizacion validos. Comparelo con la mediana para detectar jornadas atipicas.'],
  kpiMedian: ['Mediana por ficha', 'Tiempo central: la mitad de las fichas tarda menos y la otra mitad mas. Es menos sensible a casos excepcionalmente largos.'],
  kpiPhotos: ['Cantidad de fotos', 'Total de evidencias asociadas a las fichas visibles. La calidad y pertinencia importan mas que acumular fotografias repetidas.'],
  kpiCapacity: ['Capacidad actual', 'Proporcion de integrantes disponibles respecto del total del equipo. Una ausencia reduce la capacidad y puede aumentar el plazo previsto.'],
  kpiDeadline: ['Plazo restante', 'Estimacion basada en escuelas pendientes, minutos por escuela, horas de campo e integrantes disponibles. Es una proyeccion operativa, no una fecha garantizada.'],
  control: ['Control del equipo', 'El supervisor ve avance, registros, KPIs, escuelas y personal de su propio equipo. La administracion conserva la vista general de todo el operativo.'],
  compatibility: ['Compatibilidad con RUE', 'La conciliacion conserva codigo interno, codigo RUE, sitio fisico y claves de bloque, planta y espacio. El CSV no escribe automaticamente dentro de RUE.'],
  surveyors: ['Encuestadores del equipo', 'Muestra al supervisor y a los encuestadores que comparten su equipo. La disponibilidad permite estimar capacidad y contingencias sin cambiar la autoria de las fichas.'],
  availability: ['Disponibilidad de campo', 'Marque una ausencia real y registre un motivo breve. El tablero recalcula la capacidad y la demora estimada del equipo.'],
  role: ['Rol', 'Encuestador registra sus escuelas; supervisor controla su equipo; administrador gestiona el operativo completo y las autorizaciones.'],
  team: ['Equipo', 'Agrupa supervisor, encuestadores y escuelas para visibilidad y seguimiento. Un supervisor no debe consultar informacion de otros equipos.'],
  active: ['Estado del usuario', 'Un usuario activo puede ingresar segun su rol. Desactivar una cuenta no elimina sus registros ni su trazabilidad historica.'],
  logistics: ['Logistica del equipo', 'Para supervisores, esta vista se limita a sus escuelas y integrantes. Las estimaciones apoyan la planificacion y deben ajustarse a distancia y condiciones del territorio.'],
  minutes: ['Minutos por escuela', 'Duracion base esperada de una visita. Ajustela con evidencia del piloto y considerando viaje, complejidad y condiciones locales.'],
  hours: ['Horas de campo por dia', 'Tiempo efectivo disponible para relevamiento, sin confundirlo con toda la jornada ni ignorar traslados y pausas operativas.'],
  targetDays: ['Plazo objetivo', 'Cantidad de dias disponibles para completar las escuelas pendientes. La app calcula cuantos equipos o jornadas se requieren.'],
  balance: ['Balancear pendientes', 'Propone distribuir escuelas aun pendientes entre integrantes disponibles. Revise territorio, distancias y seguridad antes de guardar.'],
  assignment: ['Equipo asignado', 'Indica quien tiene responsabilidad operativa sobre la escuela. Los cambios deben coordinarse y guardarse antes de salir a campo.'],
  requests: ['Solicitudes de acceso', 'La aprobacion o rechazo corresponde a la administracion. El supervisor solo ve solicitudes relacionadas con usuarios ya identificados en su equipo.'],
  device: ['Dispositivo', 'Los borradores y la cola offline pertenecen a este navegador y dispositivo. No cambie de equipo ni borre datos mientras existan pendientes.'],
  catalog: ['Catalogo vigente', 'Cantidad y alcance de las escuelas cargadas en la app. Confirme que su asignacion aparezca antes de salir al terreno.'],
  sync: ['Sincronizacion', 'Al dia significa que no quedan operaciones locales pendientes. Si hay cola, recupere conexion y mantenga abierta la app hasta completar el envio.'],
  version: ['Version instalada', 'Sirve para reportar incidencias y comprobar que el dispositivo recibio la actualizacion mas reciente. Incluya version y fecha, nunca el PIN.'],
  guide: ['Guia operativa', 'Resume llegada, codificacion, fotografias, trabajo sin conexion, cierre e incidencias. Use los enlaces para consultar el manual y la ficha imprimible.']
});

const FIELD_KEYS = Object.freeze({
  codigoCensista: 'user', pin: 'pin', telefono: 'accessRequest', nombres: 'accessRequest', apellidos: 'accessRequest',
  codigoEscuela: 'schoolCode', numeroFormulario: 'formNumber', numeroHoja: 'sheetNumber', bloque: 'block', piso: 'floor',
  espacio: 'space', tipoEspacio: 'spaceType', tipoElemento: 'element', numeroElemento: 'elementNumber', notaFoto: 'photoNote',
  estado: 'status', observaciones: 'observations', danosFallas: 'damage', rol: 'role', equipo: 'team',
  motivoIndisponibilidad: 'availability', activo: 'active', disponibleCampo: 'availability'
});

const ACTION_KEYS = Object.freeze({
  'start-record': 'register', 'save-draft': 'saveDraft', 'capture-paper': 'paperPhoto',
  'capture-location': 'gps', sync: 'queue', 'edit-record': 'edit', 'export-rue': 'compatibility',
  'toggle-availability': 'availability', 'balance-logistics': 'balance', 'save-logistics': 'assignment',
  'export-logistics': 'logistics', 'review-access': 'requests', install: 'device', 'copy-incident-template': 'guide'
});

const VIEW_KEYS = Object.freeze({
  schools: 'schools', register: 'register', journal: 'journal', admin: 'control', surveyors: 'surveyors',
  logistics: 'logistics', requests: 'requests', guide: 'guide', account: 'device'
});

const ACCESSIBLE_HELP_TITLES = Object.freeze({
  saveDraft: 'Conservar trabajo local',
  edit: 'Corregir una ficha sincronizada'
});

const TEXT_RULES = [
  [/escuelas asignadas|escuelas visibles|escuelas finalizadas|^escuelas$/i, 'schools'],
  [/buscar|busqueda/i, 'schoolSearch'], [/departamento/i, 'department'], [/distrito/i, 'district'],
  [/mapa|ubicacion|ruta/i, 'map'], [/codigo rue|codigo de escuela|codigo mec/i, 'schoolCode'], [/sitio fisico|sede fisica/i, 'physicalSite'],
  [/identificador|registro b\/p\/e\/h/i, 'recordId'], [/formulario/i, 'formNumber'], [/numero de hoja|^hoja$/i, 'sheetNumber'],
  [/bloque/i, 'block'], [/piso|planta/i, 'floor'], [/tipo de espacio/i, 'spaceType'], [/espacio/i, 'space'],
  [/elemento/i, 'element'], [/foto|evidencia|imagenes/i, 'photos'], [/gps|precision/i, 'gps'], [/observacion/i, 'observations'], [/dano|falla/i, 'damage'],
  [/borrador/i, 'drafts'], [/cola|pendiente de sincron/i, 'queue'], [/sincron/i, 'sync'], [/mediana/i, 'kpiMedian'], [/promedio/i, 'kpiAverage'],
  [/capacidad/i, 'kpiCapacity'], [/plazo|dias estimados/i, 'kpiDeadline'], [/fichas|registros/i, 'kpiRecords'],
  [/encuestador|censista|usuarios visibles|personal/i, 'surveyors'], [/disponibilidad|ausente/i, 'availability'], [/rol/i, 'role'], [/equipo/i, 'team'],
  [/logistica|asignado|asignacion|carga por equipo/i, 'logistics'], [/minutos por escuela/i, 'minutes'], [/horas de campo/i, 'hours'],
  [/solicitud/i, 'requests'], [/compatibilidad|conciliar|rue/i, 'compatibility'], [/catalogo/i, 'catalog'], [/version/i, 'version'], [/guia|manual/i, 'guide'],
  [/estado/i, 'status']
];

let popover;
let lastAnchor;

function normalizedText(element) {
  return String(element?.textContent || '').replace(/\s+/g, ' ').trim();
}

function itemFor(key) {
  return HELP_ITEMS[key] || HELP_ITEMS.guide;
}

function inferTextKey(element) {
  const text = normalizedText(element);
  const match = TEXT_RULES.find(([pattern]) => pattern.test(text));
  return match?.[1] || '';
}

function createHelpButton(key) {
  const [title] = itemFor(key);
  const accessibleTitle = ACCESSIBLE_HELP_TITLES[key] || title;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'context-help-button';
  button.dataset.helpKey = key;
  button.setAttribute('aria-label', `Informacion: ${accessibleTitle}`);
  button.setAttribute('aria-haspopup', 'dialog');
  button.title = `Informacion: ${accessibleTitle}`;
  button.textContent = 'i';
  return button;
}

function attachHelp(element, key, mode = 'inline') {
  if (!element || !key || element.dataset.helpEnhanced === 'true') return;
  const button = createHelpButton(key);
  element.dataset.helpEnhanced = 'true';
  if (mode === 'label') {
    element.classList.add('has-context-help');
    element.insertBefore(button, element.firstElementChild || null);
  } else if (mode === 'sibling') {
    element.insertAdjacentElement('afterend', button);
  } else {
    element.append(button);
  }
}

function ensurePopover() {
  if (popover?.isConnected) return popover;
  popover = document.createElement('aside');
  popover.id = 'context-help-popover';
  popover.className = 'context-help-popover';
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-modal', 'false');
  popover.setAttribute('aria-labelledby', 'context-help-title');
  popover.hidden = true;
  popover.innerHTML = '<div class="context-help-heading"><span class="context-help-symbol">i</span><strong id="context-help-title"></strong><button type="button" class="context-help-close" data-close-context-help aria-label="Cerrar informacion">×</button></div><p id="context-help-copy"></p><small>Orientacion basada en el Manual operativo CIALPA. Consulte la Guia de campo para el procedimiento completo.</small>';
  document.body.append(popover);
  return popover;
}

function positionPopover(anchor) {
  const panel = ensurePopover();
  const rect = anchor.getBoundingClientRect();
  const margin = 12;
  panel.style.left = `${Math.max(margin, Math.min(window.innerWidth - panel.offsetWidth - margin, rect.left))}px`;
  const below = rect.bottom + 8;
  const top = below + panel.offsetHeight <= window.innerHeight - margin
    ? below
    : Math.max(margin, rect.top - panel.offsetHeight - 8);
  panel.style.top = `${top}px`;
}

function openHelp(key, anchor) {
  const panel = ensurePopover();
  const [title, copy] = itemFor(key);
  panel.querySelector('#context-help-title').textContent = title;
  panel.querySelector('#context-help-copy').textContent = copy;
  panel.hidden = false;
  lastAnchor?.setAttribute('aria-expanded', 'false');
  lastAnchor = anchor;
  lastAnchor.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => positionPopover(anchor));
}

function closeHelp({ restoreFocus = false } = {}) {
  if (!popover || popover.hidden) return;
  popover.hidden = true;
  lastAnchor?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) lastAnchor?.focus();
  lastAnchor = null;
}

export function enhanceContextHelp(root = document) {
  root.querySelectorAll('label').forEach((label) => {
    const control = label.querySelector('input[name], select[name], textarea[name]');
    const key = control ? FIELD_KEYS[control.name] : inferTextKey(label);
    if (key) {
      if (control && !control.hasAttribute('aria-label')) {
        const labelText = [...label.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (labelText) control.setAttribute('aria-label', labelText);
      }
      attachHelp(label, key, 'label');
    }
  });

  root.querySelectorAll('[data-filter="search"]').forEach((input) => attachHelp(input.closest('label'), 'schoolSearch', 'label'));
  root.querySelectorAll('[data-planning-setting]').forEach((input) => {
    const key = { baseMinutes: 'minutes', hoursPerDay: 'hours', targetDays: 'targetDays' }[input.dataset.planningSetting];
    attachHelp(input.closest('label'), key, 'label');
  });

  root.querySelectorAll('h1, h2, h3').forEach((element) => {
    const key = inferTextKey(element);
    if (key) attachHelp(element, key, 'sibling');
  });
  root.querySelectorAll('th, .summary-strip span, .settings-list b').forEach((element) => {
    const key = inferTextKey(element);
    if (key) attachHelp(element, key);
  });

  root.querySelectorAll('[data-action="capture-photo"]').forEach((element) => {
    if (element.closest('.action-with-help')) return;
    const key = element.dataset.photoType === 'HOJA_PAPEL' ? 'paperPhoto' : 'contextPhoto';
    const wrapper = document.createElement('div');
    wrapper.className = 'action-with-help';
    element.replaceWith(wrapper);
    wrapper.append(element, createHelpButton(key));
  });

  root.querySelectorAll('[data-action]').forEach((element) => {
    const key = ACTION_KEYS[element.dataset.action];
    if (!key || element.matches('[data-help-key]') || element.closest('.table-actions, .record-actions')) return;
    const container = element.closest('.button-row') || element.parentElement;
    if (!container || container.querySelector(`.context-help-button[data-help-key="${key}"]`)) return;
    container.append(createHelpButton(key));
  });

  root.querySelectorAll('[data-view]').forEach((element) => {
    const key = VIEW_KEYS[element.dataset.view];
    if (!key || element.closest('.side-nav, .bottom-nav, .operations-tabs') == null) return;
    element.setAttribute('title', `${normalizedText(element)}. ${itemFor(key)[1]}`);
    element.setAttribute('aria-description', itemFor(key)[1]);
  });

  root.querySelectorAll('[data-logistics-assignment]').forEach((select) => {
    const cell = select.closest('td');
    if (cell && !cell.querySelector('.context-help-button')) cell.append(createHelpButton('assignment'));
  });
}

export function initializeContextHelp() {
  ensurePopover();
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-help-key]');
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      openHelp(button.dataset.helpKey, button);
      return;
    }
    if (event.target.closest('[data-close-context-help]')) {
      closeHelp({ restoreFocus: true });
      return;
    }
    if (!event.target.closest('#context-help-popover')) closeHelp();
  }, true);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeHelp({ restoreFocus: true });
  });
  window.addEventListener('resize', () => {
    if (lastAnchor && popover && !popover.hidden) positionPopover(lastAnchor);
  });
  window.addEventListener('scroll', () => {
    if (lastAnchor && popover && !popover.hidden) positionPopover(lastAnchor);
  }, true);
}
