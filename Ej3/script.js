/* =========================================================
 * Endpoints utilizados:
 *   GET /breeds/list/all                        -> todas las razas y sub-razas
 *   GET /breeds/image/random/:n                 -> n perros aleatorios (máx. 50)
 *   GET /breed/:raza/images/random/:n           -> n imágenes aleatorias de una raza
 *   GET /breed/:raza/:sub/images/random/:n      -> n imágenes aleatorias de una sub-raza
 *   GET /breed/:raza/images                     -> todas las imágenes de una raza
 *   GET /breed/:raza/:sub/images                -> todas las imágenes de una sub-raza
 * ========================================================= */

const API = "https://dog.ceo/api";
const LS_FAVS = "dog_favorites";
const LS_HISTORY = "dog_history";
const LS_BEST_STREAK = "dog_best_streak";
const MAX_HISTORY = 12;

/* ESTADO */
const state = {
  breeds: {},            
  folders: [],           
  results: [],           
  favorites: loadStorage(LS_FAVS),  
  history: loadStorage(LS_HISTORY), 
  gallery: { page: 0, limit: 12, breed: "", sub: "", all: [], random: true },
  quiz: { url: "", answer: "", answered: false, correct: 0, total: 0, streak: 0, best: Number(localStorage.getItem(LS_BEST_STREAK)) || 0 },
};


const $ = (id) => document.getElementById(id);

function loadStorage(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch (e) {
    console.warn("No se pudo guardar en localStorage", e);
  }
}

async function fetchDog(path) {
  const res = await fetch(`${API}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === "error") {
    throw new Error(data.message || `Error HTTP ${res.status}`);
  }
  return data.message;
}

function capitalize(text) {
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}


function folderFromUrl(url) {
  const m = url.match(/\/breeds\/([^/]+)\//);
  return m ? m[1] : "";
}

function labelFromFolder(folder) {
  if (!folder) return "Desconocida";
  const [breed, ...sub] = folder.split("-");
  return capitalize(sub.length ? `${sub.join(" ")} ${breed}` : breed);
}

function labelFromUrl(url) {
  return labelFromFolder(folderFromUrl(url));
}

function setStatus(id, msg) {
  $(id).textContent = msg || "";
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isFavorite(url) {
  return state.favorites.includes(url);
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* NAVEGACIÓN */
function showSection(sectionId) {
  document.querySelectorAll(".app-section").forEach((s) => {
    s.hidden = s.id !== sectionId;
  });
  document.querySelectorAll(".nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.section === sectionId);
  });
  if (sectionId === "section-gallery" && state.gallery.all.length === 0) loadGallery();
  if (sectionId === "section-quiz" && !state.quiz.url) loadQuizQuestion();
  if (sectionId === "section-favorites") renderFavorites();
}

/* RAZAS */
async function loadBreeds() {
  try {
    state.breeds = await fetchDog("/breeds/list/all");
    state.folders = [];
    Object.entries(state.breeds).forEach(([breed, subs]) => {
      if (subs.length === 0) state.folders.push(breed);
      else subs.forEach((s) => state.folders.push(`${breed}-${s}`));
    });
    $("total-breeds").textContent = Object.keys(state.breeds).length;
    fillBreedSelect("opt-breed");
    fillBreedSelect("gallery-breed");
    renderBreedCloud();
  } catch (e) {
    console.error(e);
    $("total-breeds").textContent = "no disponible";
    setStatus("generator-status", "No se pudo cargar la lista de razas.");
  }
}

function fillBreedSelect(selectId) {
  const select = $(selectId);
  const first = select.options[0];
  select.innerHTML = "";
  select.appendChild(first);
  Object.keys(state.breeds).forEach((breed) => {
    const opt = document.createElement("option");
    opt.value = breed;
    const n = state.breeds[breed].length;
    opt.textContent = capitalize(breed) + (n ? ` (${n} sub-razas)` : "");
    select.appendChild(opt);
  });
}

// Llena el select de sub-razas según la raza elegida
function fillSubBreedSelect(selectId, breed) {
  const select = $(selectId);
  const first = select.options[0];
  select.innerHTML = "";
  select.appendChild(first);
  const subs = breed ? state.breeds[breed] || [] : [];
  subs.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = capitalize(s);
    select.appendChild(opt);
  });
  select.disabled = subs.length === 0;
  select.value = "";
}

function renderBreedCloud() {
  const filter = $("breed-search").value.trim().toLowerCase();
  const cloud = $("breed-cloud");
  cloud.innerHTML = "";
  Object.keys(state.breeds)
    .filter((b) => b.toLowerCase().includes(filter))
    .forEach((breed) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "breed-chip";
      btn.textContent = capitalize(breed);
      btn.addEventListener("click", () => {
        $("gallery-breed").value = breed;
        fillSubBreedSelect("gallery-subbreed", breed);
        state.gallery.breed = breed;
        state.gallery.sub = "";
        state.gallery.page = 0;
        loadGallery();
      });
      cloud.appendChild(btn);
    });
}

/* GENERADOR */
function buildRandomPath(breed, sub, count) {
  if (breed && sub) return `/breed/${breed}/${sub}/images/random/${count}`;
  if (breed) return `/breed/${breed}/images/random/${count}`;
  return `/breeds/image/random/${count}`;
}

async function generateDogs() {
  const breed = $("opt-breed").value;
  const sub = $("opt-subbreed").value;
  const count = parseInt($("opt-count").value, 10) || 1;

  $("btn-generate").disabled = true;
  setStatus("generator-status", "Buscando perros...");
  try {
    const msg = await fetchDog(buildRandomPath(breed, sub, count));
    state.results = Array.isArray(msg) ? msg : [msg];
    state.results.forEach(addToHistory);
    setStatus("generator-status", "");
    renderResults();
  } catch (e) {
    console.error(e);
    setStatus("generator-status", "No se pudo obtener el perro: " + e.message);
  } finally {
    $("btn-generate").disabled = false;
  }
}

function renderResults() {
  const box = $("generator-results");
  box.innerHTML = "";
  state.results.forEach((url) => box.appendChild(createDogCard(url)));
}

function resetOptions() {
  $("opt-breed").value = "";
  fillSubBreedSelect("opt-subbreed", "");
  $("opt-count").value = "1";
}

/* TARJETA REUTILIZABLE */
function createDogCard(url) {
  const card = document.createElement("article");
  card.className = "dog-card";

  const img = document.createElement("img");
  img.src = url;
  img.alt = `Perro de raza ${labelFromUrl(url)}`;
  img.loading = "lazy";
  card.appendChild(img);

  const name = document.createElement("p");
  name.className = "dog-card-breed";
  name.textContent = labelFromUrl(url);
  card.appendChild(name);

  const actions = document.createElement("div");
  actions.className = "dog-card-actions";

  const btnFav = document.createElement("button");
  btnFav.type = "button";
  btnFav.className = "btn-fav";
  btnFav.textContent = isFavorite(url) ? "Quitar de favoritos" : "Agregar a favoritos";
  btnFav.addEventListener("click", () => toggleFavorite(url));

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Abrir imagen";

  const btnCopy = document.createElement("button");
  btnCopy.type = "button";
  btnCopy.textContent = "Copiar URL";
  btnCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      btnCopy.textContent = "¡Copiada!";
      setTimeout(() => (btnCopy.textContent = "Copiar URL"), 1500);
    } catch {
      window.prompt("Copiá la URL:", url);
    }
  });

  actions.append(btnFav, link, btnCopy);
  card.appendChild(actions);
  return card;
}

/* HISTORIAL */
function addToHistory(url) {
  state.history = [url, ...state.history.filter((u) => u !== url)].slice(0, MAX_HISTORY);
  saveStorage(LS_HISTORY, state.history);
  renderHistory();
}

function renderHistory() {
  const list = $("history-list");
  list.innerHTML = "";
  if (state.history.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Todavía no generaste ningún perro.";
    list.appendChild(li);
    return;
  }
  state.history.forEach((url) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "history-item";
    btn.textContent = labelFromUrl(url);
    btn.addEventListener("click", () => {
      state.results = [url];
      renderResults();
    });
    li.appendChild(btn);
    list.appendChild(li);
  });
}

/* FAVORITOS */
function toggleFavorite(url) {
  if (isFavorite(url)) state.favorites = state.favorites.filter((u) => u !== url);
  else state.favorites.push(url);
  saveStorage(LS_FAVS, state.favorites);
  updateFavCount();
  // Se redibuja todo lo que muestra botones de favorito
  renderResults();
  renderGallery();
  renderFavorites();
}

function updateFavCount() {
  $("fav-count").textContent = `(${state.favorites.length})`;
}

function renderFavorites() {
  const grid = $("fav-grid");
  grid.innerHTML = "";
  $("fav-empty").hidden = state.favorites.length > 0;
  $("btn-clear-favs").hidden = state.favorites.length === 0;
  state.favorites.forEach((url) => grid.appendChild(createDogCard(url)));
}

/* GALERÍA */
async function loadGallery() {
  const g = state.gallery;
  setStatus("gallery-status", "Cargando galería...");
  $("btn-prev").disabled = true;
  $("btn-next").disabled = true;
  try {
    if (!g.breed) {
      // Sin raza: selección aleatoria (la API permite hasta 50 por pedido)
      g.random = true;
      const msg = await fetchDog(`/breeds/image/random/${Math.min(g.limit, 50)}`);
      g.all = Array.isArray(msg) ? msg : [msg];
      g.page = 0;
    } else {
      g.random = false;
      const path = g.sub ? `/breed/${g.breed}/${g.sub}/images` : `/breed/${g.breed}/images`;
      g.all = await fetchDog(path);
    }
    setStatus("gallery-status", g.all.length ? "" : "No hay imágenes para esa selección.");
    renderGallery();
  } catch (e) {
    console.error(e);
    g.all = [];
    setStatus("gallery-status", "No se pudo cargar la galería: " + e.message);
    renderGallery();
  }
}

function renderGallery() {
  const g = state.gallery;
  const grid = $("gallery-grid");
  grid.innerHTML = "";

  const pages = Math.max(1, Math.ceil(g.all.length / g.limit));
  if (g.page >= pages) g.page = pages - 1;
  const slice = g.random ? g.all : g.all.slice(g.page * g.limit, (g.page + 1) * g.limit);
  slice.forEach((url) => grid.appendChild(createDogCard(url)));

  $("gallery-page").textContent = g.random ? 1 : g.page + 1;
  $("gallery-pages").textContent = g.random ? 1 : pages;
  $("btn-prev").disabled = g.random || g.page === 0;
  $("btn-next").disabled = g.random || g.page >= pages - 1;

  if (g.random) {
    $("gallery-info").textContent = "Mostrando una selección aleatoria. Usá \"Recargar\" para ver otra.";
  } else if (g.all.length) {
    const nombre = g.sub ? `${capitalize(g.sub)} ${capitalize(g.breed)}` : capitalize(g.breed);
    $("gallery-info").textContent = `${nombre}: ${g.all.length} imágenes en total.`;
  } else {
    $("gallery-info").textContent = "";
  }
}

/* QUIZ */
async function loadQuizQuestion() {
  const q = state.quiz;
  q.answered = false;
  $("quiz-card").hidden = true;
  $("btn-quiz-next").hidden = true;
  $("quiz-feedback").textContent = "";
  setStatus("quiz-status", "Buscando un perro...");
  try {
    if (state.folders.length === 0) await loadBreeds();
    const url = await fetchDog("/breeds/image/random");
    q.url = url;
    q.answer = folderFromUrl(url);
    const others = shuffle(state.folders.filter((f) => f !== q.answer)).slice(0, 3);
    renderQuiz(shuffle([q.answer, ...others]));
    setStatus("quiz-status", "");
  } catch (e) {
    console.error(e);
    q.url = "";
    setStatus("quiz-status", "No se pudo cargar la pregunta: " + e.message);
  }
}

function renderQuiz(options) {
  $("quiz-image").src = state.quiz.url;
  const box = $("quiz-options");
  box.innerHTML = "";
  options.forEach((folder) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quiz-option";
    btn.dataset.folder = folder;
    btn.textContent = labelFromFolder(folder);
    btn.addEventListener("click", () => answerQuiz(folder));
    box.appendChild(btn);
  });
  $("quiz-card").hidden = false;
}

function answerQuiz(folder) {
  const q = state.quiz;
  if (q.answered) return;
  q.answered = true;
  q.total++;

  const ok = folder === q.answer;
  if (ok) {
    q.correct++;
    q.streak++;
    if (q.streak > q.best) {
      q.best = q.streak;
      saveStorage(LS_BEST_STREAK, String(q.best));
    }
  } else {
    q.streak = 0;
  }

  document.querySelectorAll(".quiz-option").forEach((btn) => {
    btn.disabled = true;
    if (btn.dataset.folder === q.answer) btn.classList.add("correct");
    else if (btn.dataset.folder === folder) btn.classList.add("incorrect");
  });

  $("quiz-feedback").textContent = ok
    ? "¡Correcto!"
    : `Incorrecto. Era: ${labelFromFolder(q.answer)}`;
  $("btn-quiz-next").hidden = false;
  renderQuizScore();
}

function renderQuizScore() {
  const q = state.quiz;
  $("quiz-correct").textContent = q.correct;
  $("quiz-total").textContent = q.total;
  $("quiz-streak").textContent = q.streak;
  $("quiz-best-streak").textContent = q.best;
}

/* EVENTOS */
function bindEvents() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => showSection(btn.dataset.section));
  });

  // Generador
  $("btn-generate").addEventListener("click", generateDogs);
  $("btn-reset-options").addEventListener("click", resetOptions);
  $("opt-breed").addEventListener("change", (e) => {
    fillSubBreedSelect("opt-subbreed", e.target.value);
    generateDogs();
  });
  $("opt-subbreed").addEventListener("change", generateDogs);
  $("opt-count").addEventListener("change", generateDogs);
  $("btn-clear-history").addEventListener("click", () => {
    state.history = [];
    saveStorage(LS_HISTORY, state.history);
    renderHistory();
  });

  // Galería
  $("gallery-breed").addEventListener("change", (e) => {
    state.gallery.breed = e.target.value;
    state.gallery.sub = "";
    state.gallery.page = 0;
    fillSubBreedSelect("gallery-subbreed", e.target.value);
    loadGallery();
  });
  $("gallery-subbreed").addEventListener("change", (e) => {
    state.gallery.sub = e.target.value;
    state.gallery.page = 0;
    loadGallery();
  });
  $("gallery-limit").addEventListener("change", (e) => {
    state.gallery.limit = parseInt(e.target.value, 10);
    state.gallery.page = 0;
    // en modo aleatorio hay que pedir otra cantidad; en modo raza alcanza con repaginar
    if (state.gallery.random) loadGallery();
    else renderGallery();
  });
  $("btn-gallery-reload").addEventListener("click", loadGallery);
  $("btn-prev").addEventListener("click", () => {
    if (state.gallery.page > 0) {
      state.gallery.page--;
      renderGallery();
    }
  });
  $("btn-next").addEventListener("click", () => {
    state.gallery.page++;
    renderGallery();
  });
  $("breed-search").addEventListener("input", debounce(renderBreedCloud, 200));

  // Quiz
  $("btn-quiz-next").addEventListener("click", loadQuizQuestion);
  $("btn-quiz-reset").addEventListener("click", () => {
    Object.assign(state.quiz, { correct: 0, total: 0, streak: 0 });
    renderQuizScore();
    loadQuizQuestion();
  });

  // Favoritos
  $("btn-clear-favs").addEventListener("click", () => {
    if (confirm("¿Vaciar todos los favoritos?")) {
      state.favorites = [];
      saveStorage(LS_FAVS, state.favorites);
      updateFavCount();
      renderFavorites();
      renderResults();
      renderGallery();
    }
  });
}

/* INICIO */
document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();
  updateFavCount();
  renderHistory();
  renderFavorites();
  renderQuizScore();
  showSection("section-generator");
  await loadBreeds();
  generateDogs(); // arranca mostrando un perro
});