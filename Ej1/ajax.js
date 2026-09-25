/* =========================================================
   Ejercicio 1 - Adivina el número
   ========================================================= */

const MIN = 1;
const MAX = 1000;
const CLAVE_STATS = 'adivina-numero:estadisticas';

/* ---------- Referencias al HTML ---------- */
const $ = (id) => document.getElementById(id);
const el = {
  tarjeta: $('tarjeta'),
  vistaJuego: $('vistaJuego'),
  vistaVictoria: $('vistaVictoria'),
  formulario: $('formulario'),
  numero: $('numero'),
  intentos: $('intentos'),
  mensaje: $('mensaje'),
  historial: $('historial'),
  rangoRelleno: $('rangoRelleno'),
  rangoTexto: $('rangoTexto'),
  patricioDice: $('patricioDice'),
  victoriaTexto: $('victoriaTexto'),
  insignia: $('insignia'),
  btnReiniciar: $('btnReiniciar'),
  btnOtra: $('btnOtra'),
  btnBorrar: $('btnBorrar'),
  statMejor: $('statMejor'),
  statPartidas: $('statPartidas'),
  statPromedio: $('statPromedio'),
  confeti: $('confeti'),
};
const elM = {
  contenedorJugador: $('modoJugadorContenedor'),
  contenedorMaquina: $('modoMaquinaContenedor'),
  btnModoJugador: $('btnModoJugador'),
  btnModoMaquina: $('btnModoMaquina'),
  vistaJuego: $('vistaMaquinaJuego'),
  vistaVictoria: $('vistaMaquinaVictoria'),
  intentos: $('intentosMaquina'),
  rangoRelleno: $('rangoRellenoMaquina'),
  rangoTexto: $('rangoTextoMaquina'),
  numero: $('numeroMaquina'),
  mensaje: $('mensajeMaquina'),
  historial: $('historialMaquina'),
  btnMasBajo: $('btnMasBajo'),
  btnMasAlto: $('btnMasAlto'),
  btnAcerte: $('btnAcerte'),
  btnReiniciar: $('btnReiniciarMaquina'),
  btnOtra: $('btnOtraMaquina'),
  victoriaTexto: $('victoriaMaquinaTexto'),
  marcadorSubtitulo: $('marcadorSubtitulo'),
};

let modoActual = 'jugador';

let minM, maxM, intentosM, historialM, terminadaM, propuestaM;
const CLAVE_STATS_MAQUINA = 'adivina-numero:estadisticas-maquina';

/* ---------- Estado de la partida actual ---------- */
let secreto;
let intentos;
let minimo;      // límite inferior posible según las pistas
let maximo;      // límite superior posible según las pistas
let historial;
let terminada;

/* ---------- Estadísticas de todo el juego (se guardan en el navegador) ---------- */
let stats = cargarStats();

function cargarStats() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_STATS));
    if (g && Number.isFinite(g.partidas) && Number.isFinite(g.totalIntentos)) {
      return {
        mejor: Number.isFinite(g.mejor) ? g.mejor : null,
        partidas: g.partidas,
        totalIntentos: g.totalIntentos,
      };
    }
  } catch (e) { /* si falla, se empieza de cero */ }
  return { mejor: null, partidas: 0, totalIntentos: 0 };
}

function cargarStatsMaquina() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_STATS_MAQUINA));
    if (g && Number.isFinite(g.partidas) && Number.isFinite(g.totalIntentos)) {
      return {
        mejor: Number.isFinite(g.mejor) ? g.mejor : null,
        partidas: g.partidas,
        totalIntentos: g.totalIntentos,
      };
    }
  } catch (e) { /* si falla, se empieza de cero */ }
  return { mejor: null, partidas: 0, totalIntentos: 0 };
}

function guardarStatsMaquina() {
  try {
    localStorage.setItem(CLAVE_STATS_MAQUINA, JSON.stringify(statsMaquina));
  } catch (e) { /* si no se puede guardar, el juego sigue funcionando */ }
}

let statsMaquina = cargarStatsMaquina();

function guardarStats() {
  try {
    localStorage.setItem(CLAVE_STATS, JSON.stringify(stats));
  } catch (e) { /* si no se puede guardar, el juego sigue funcionando */ }
}

/* ---------- Utilidades ---------- */
function numeroAleatorio() {
  return Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;
}

function textoIntentos(n) {
  return n === 1 ? '1 intento' : `${n} intentos`;
}

function temperatura(distancia) {
  if (distancia <= 10) return '¡Estás ardiendo!';
  if (distancia <= 50) return 'Caliente, caliente...';
  if (distancia <= 150) return 'Tibio, sigue así.';
  if (distancia <= 350) return 'Frío, frío.';
  return '¡Helado! Estás muy lejos.';
}

function mostrarMensaje(texto, tipo = '') {
  el.mensaje.textContent = texto;
  el.mensaje.className = 'mensaje ' + tipo;
}

function sacudirCampo() {
  el.numero.classList.remove('sacudir');
  void el.numero.offsetWidth; // reinicia la animación
  el.numero.classList.add('sacudir');
}

function animarContador(elemento) {
  elemento.classList.remove('pop');
  void elemento.offsetWidth;
  elemento.classList.add('pop');
}

/* ---------- Dibujar en pantalla ---------- */
function dibujarJuego() {
  el.intentos.textContent = intentos;

  // Barra y texto del rango donde puede estar el número
  const total = MAX - MIN + 1;
  el.rangoTexto.textContent = `Está entre ${minimo} y ${maximo}`;
  el.rangoRelleno.style.left = ((minimo - MIN) / total) * 100 + '%';
  el.rangoRelleno.style.width = ((maximo - minimo + 1) / total) * 100 + '%';

  // Historial de números probados
  el.historial.innerHTML = '';
  historial.forEach(({ n, tipo }) => {
    const li = document.createElement('li');
    li.className = 'ficha ' + tipo;
    li.textContent = (tipo === 'bajo' ? '↑ ' : '↓ ') + n;
    li.setAttribute('aria-label', `${n}, ${tipo === 'bajo' ? 'muy bajo' : 'muy alto'}`);
    el.historial.appendChild(li);
  });
}

function dibujarStats(statsAMostrar) {
  el.statMejor.textContent = statsAMostrar.mejor === null ? '—' : textoIntentos(statsAMostrar.mejor);
  el.statPartidas.textContent = statsAMostrar.partidas;
  el.statPromedio.textContent = statsAMostrar.partidas === 0
    ? '—'
    : (statsAMostrar.totalIntentos / statsAMostrar.partidas).toLocaleString('es-AR', { maximumFractionDigits: 1 });
}

function dibujarStatsActivo() {
  dibujarStats(modoActual === 'maquina' ? statsMaquina : stats);
}
/* ---------- Partida nueva / reiniciar ---------- */
function nuevaPartida() {
  secreto = numeroAleatorio();
  intentos = 0;
  minimo = MIN;
  maximo = MAX;
  historial = [];
  terminada = false;

  el.vistaVictoria.classList.add('oculto');
  el.vistaJuego.classList.remove('oculto');
  el.tarjeta.classList.remove('ganada');
  el.numero.value = '';
  limpiarConfeti();

  mostrarMensaje('Escribe tu primer número para empezar.');
  el.patricioDice.textContent = 'Ya tengo el número. ¡Adivina!';

  dibujarJuego();
  dibujarStatsActivo();
  el.numero.focus();
}

/* ---------- Intentar adivinar ---------- */
function intentar(evento) {
  evento.preventDefault();
  if (terminada) return;

  const texto = el.numero.value.trim();
  const n = Number(texto);

  // Validación: entero entre 1 y 1000 (un intento inválido no se cuenta)
  if (texto === '' || !Number.isInteger(n) || n < MIN || n > MAX) {
    mostrarMensaje(`Escribe un número entero entre ${MIN} y ${MAX}.`, 'error');
    sacudirCampo();
    el.numero.focus();
    return;
  }

  intentos++;
  animarContador(el.intentos);

  if (n === secreto) {
    ganar();
    return;
  }

  const esBajo = n < secreto;
  if (esBajo) {
    minimo = Math.max(minimo, n + 1);
    mostrarMensaje('Muy bajo: prueba con un número más alto.', 'bajo');
  } else {
    maximo = Math.min(maximo, n - 1);
    mostrarMensaje('Muy alto: prueba con un número más bajo.', 'alto');
  }

  historial.push({ n, tipo: esBajo ? 'bajo' : 'alto' });
  el.patricioDice.textContent = temperatura(Math.abs(n - secreto));

  el.numero.value = '';
  el.numero.focus();
  dibujarJuego();
}

/* ---------- Ganar ---------- */
function ganar() {
  terminada = true;

  // Se actualizan las estadísticas en el momento
  stats.partidas++;
  stats.totalIntentos += intentos;
  const esRecord = stats.mejor === null || intentos < stats.mejor;
  if (esRecord) stats.mejor = intentos;
  guardarStats();
  dibujarStatsActivo();
  dibujarJuego();

  el.victoriaTexto.textContent = `El número era ${secreto} y lo lograste en ${textoIntentos(intentos)}.`;
  el.insignia.classList.toggle('oculto', !esRecord);
  el.patricioDice.textContent = '¡Lo sabía! Eres un vidente.';

  el.vistaJuego.classList.add('oculto');
  el.vistaVictoria.classList.remove('oculto');

  el.tarjeta.classList.remove('ganada');
  void el.tarjeta.offsetWidth;
  el.tarjeta.classList.add('ganada');

  lanzarConfeti();
  el.btnOtra.focus();
}

/* =========================================================
   Modo: la máquina adivina
   ========================================================= */

function cambiarModo(modo) {
  modoActual = modo;
  const esMaquina = modo === 'maquina';

  elM.contenedorJugador.classList.toggle('oculto', esMaquina);
  elM.contenedorMaquina.classList.toggle('oculto', !esMaquina);

  elM.btnModoJugador.classList.toggle('modo-activo', !esMaquina);
  elM.btnModoJugador.setAttribute('aria-selected', String(!esMaquina));
  elM.btnModoMaquina.classList.toggle('modo-activo', esMaquina);
  elM.btnModoMaquina.setAttribute('aria-selected', String(esMaquina));

  elM.marcadorSubtitulo.textContent = esMaquina ? 'Modo: yo adivino' : 'Modo: vos adivinás';
  el.patricioDice.textContent = esMaquina
    ? 'Pensá tu número... yo lo voy a encontrar.'
    : 'Ya tengo el número. ¡Adivina!';

  dibujarStatsActivo();
}

function nuevaPartidaMaquina() {
  minM = MIN;
  maxM = MAX;
  intentosM = 0;
  historialM = [];
  terminadaM = false;

  elM.vistaVictoria.classList.add('oculto');
  elM.vistaJuego.classList.remove('oculto');

  siguienteIntentoMaquina();
}

function siguienteIntentoMaquina() {
  intentosM++;
  propuestaM = Math.floor((minM + maxM) / 2);
  elM.numero.textContent = propuestaM;
  mostrarMensajeMaquina('¿Es más alto, más bajo, o acerté?');
  dibujarMaquina();
}

function mostrarMensajeMaquina(texto, tipo = '') {
  elM.mensaje.textContent = texto;
  elM.mensaje.className = 'mensaje ' + tipo;
}

function dibujarMaquina() {
  elM.intentos.textContent = intentosM;

  const total = MAX - MIN + 1;
  elM.rangoTexto.textContent = `Está entre ${minM} y ${maxM}`;
  elM.rangoRelleno.style.left = ((minM - MIN) / total) * 100 + '%';
  elM.rangoRelleno.style.width = ((maxM - minM + 1) / total) * 100 + '%';

  elM.historial.innerHTML = '';
  historialM.forEach(({ n, tipo }) => {
    const li = document.createElement('li');
    li.className = 'ficha ' + tipo;
    li.textContent = (tipo === 'bajo' ? '↓ ' : '↑ ') + n;
    li.setAttribute('aria-label', `${n}, ${tipo === 'bajo' ? 'tu número es más bajo' : 'tu número es más alto'}`);
    elM.historial.appendChild(li);
  });
}

function responderMaquina(tipo) {
  if (terminadaM) return;

  if (tipo === 'acerto') {
    ganarMaquina();
    return;
  }

  const esBajo = tipo === 'bajo'; // el número secreto es más bajo que mi propuesta
  historialM.push({ n: propuestaM, tipo: esBajo ? 'bajo' : 'alto' });
  animarContador(elM.intentos); // reutiliza la animación del contador de intentos

  if (esBajo) {
    maxM = propuestaM - 1;
  } else {
    minM = propuestaM + 1;
  }

  if (minM > maxM) {
    mostrarMensajeMaquina('Mmm, creo que hubo un error en alguna pista. Reiniciá para intentar de nuevo.', 'error');
    terminadaM = true;
    return;
  }

  siguienteIntentoMaquina();
}

function ganarMaquina() {
  terminadaM = true;

  statsMaquina.partidas++;
  statsMaquina.totalIntentos += intentosM;
  const esRecord = statsMaquina.mejor === null || intentosM < statsMaquina.mejor;
  if (esRecord) statsMaquina.mejor = intentosM;
  guardarStatsMaquina();
  dibujarStatsActivo();

  elM.victoriaTexto.textContent = `Tu número era ${propuestaM} y lo encontré en ${textoIntentos(intentosM)}.`;
  el.patricioDice.textContent = '¡Ja! Nunca fallo.';

  elM.vistaJuego.classList.add('oculto');
  elM.vistaVictoria.classList.remove('oculto');

  el.tarjeta.classList.remove('ganada');
  void el.tarjeta.offsetWidth;
  el.tarjeta.classList.add('ganada');

  lanzarConfeti();
  elM.btnOtra.focus();
}

/* ---------- Confeti ---------- */
const COLORES_CONFETI = ['#cf4f14', '#fbe9b0', '#ffc4d3', '#19b9b4', '#ffffff', '#f7c948'];
let temporizadorConfeti;

function lanzarConfeti() {
  limpiarConfeti();
  const fragmento = document.createDocumentFragment();

  for (let i = 0; i < 120; i++) {
    const pieza = document.createElement('span');
    pieza.className = 'pieza';
    pieza.style.left = Math.random() * 100 + '%';
    pieza.style.setProperty('--w', 6 + Math.random() * 8 + 'px');
    pieza.style.setProperty('--c', COLORES_CONFETI[i % COLORES_CONFETI.length]);
    pieza.style.setProperty('--d', 2.5 + Math.random() * 2.5 + 's');
    pieza.style.setProperty('--r', Math.random() * 0.8 + 's');
    pieza.style.setProperty('--dx', Math.random() * 240 - 120 + 'px');
    pieza.style.setProperty('--g', Math.random() * 900 - 450 + 'deg');
    fragmento.appendChild(pieza);
  }

  el.confeti.appendChild(fragmento);
  temporizadorConfeti = setTimeout(limpiarConfeti, 6500);
}

function limpiarConfeti() {
  clearTimeout(temporizadorConfeti);
  el.confeti.innerHTML = '';
}

/* ---------- Borrar estadísticas ---------- */
function borrarStats() {
  if (!confirm('¿Seguro que quieres borrar el mejor puntaje, las partidas y el promedio de este modo?')) return;
  if (modoActual === 'maquina') {
    statsMaquina = { mejor: null, partidas: 0, totalIntentos: 0 };
    guardarStatsMaquina();
  } else {
    stats = { mejor: null, partidas: 0, totalIntentos: 0 };
    guardarStats();
  }
  dibujarStatsActivo();
}
/* ---------- Eventos ---------- */
el.formulario.addEventListener('submit', intentar);
el.btnReiniciar.addEventListener('click', nuevaPartida);
el.btnOtra.addEventListener('click', nuevaPartida);
el.btnBorrar.addEventListener('click', borrarStats);
elM.btnModoJugador.addEventListener('click', () => cambiarModo('jugador'));
elM.btnModoMaquina.addEventListener('click', () => cambiarModo('maquina'));
elM.btnMasBajo.addEventListener('click', () => responderMaquina('bajo'));
elM.btnMasAlto.addEventListener('click', () => responderMaquina('alto'));
elM.btnAcerte.addEventListener('click', () => responderMaquina('acerto'));
elM.btnReiniciar.addEventListener('click', nuevaPartidaMaquina);
elM.btnOtra.addEventListener('click', nuevaPartidaMaquina);

/* ---------- Arranque ---------- */
nuevaPartida();
nuevaPartidaMaquina();
