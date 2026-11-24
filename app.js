/**
 * ============================================================================
 * CONFIGURAÇÃO OBRIGATÓRIA DO ORGANIZADOR
 * Cole abaixo a URL do App da Web gerada no Google Apps Script (termina em /exec).
 * ============================================================================
 */
const API_URL = "https://script.google.com/macros/s/AKfycbx1uqka5q6-1v4oiMsDZKHmjRaTM9PqzWEbp0f3uhCnL6iGJYn-ZLi9bL21rXMy-pi5/exec";

/* ============================================================================
   CONSTANTES E OPÇÕES DO FORMULÁRIO
   ============================================================================ */
const REQUEST_TIMEOUT_MS = 25000;
const DRAFT_STORAGE_KEY = "amigo_secreto_draft_v3";
const FONT_STORAGE_KEY = "amigo_secreto_font_scale";

const WISHES_OPTIONS = [
  "Livros",
  "Maquiagem / beleza",
  "Perfumes / cuidados pessoais",
  "Chocolate / doces",
  "Café / chá",
  "Acessórios",
  "Papelaria",
  "Decoração",
  "Roupas",
  "Calçados",
  "Eletrônicos / tecnologia",
  "Plantas"
];

const AVOID_OPTIONS = [
  "Utensílios / vasilhas de cozinha",
  "Chinelo / calçados",
  "Roupas",
  "Perfumes",
  "Chocolate / doces",
  "Canecas / copos",
  "Itens de decoração",
  "Produtos de higiene"
];

const CLOTHES_SIZES = ["PP", "P", "M", "G", "GG", "XG"];

const DIET_OPTIONS = [
  "Sem restrições",
  "Zero Lactose",
  "Sem Glúten",
  "Sem Amendoim",
  "Outra restrição"
];

const SENSORY_OPTIONS = [
  "Evitar barulho/sons",
  "Evitar luzes piscantes",
  "Evitar certas texturas/materiais",
  "Evitar cheiros fortes"
];

const CONFLICT_PAIRS = [
  { wish: "Roupas", avoid: "Roupas", label: "Roupas" },
  { wish: "Calçados", avoid: "Chinelo / calçados", label: "Calçados / Chinelo" },
  { wish: "Chocolate / doces", avoid: "Chocolate / doces", label: "Chocolate / doces" },
  { wish: "Perfumes / cuidados pessoais", avoid: "Perfumes", label: "Perfumes" },
  { wish: "Decoração", avoid: "Itens de decoração", label: "Decoração" }
];

/* ============================================================================
   ESTADO DA APLICAÇÃO
   ============================================================================ */
const state = {
  participants: [],
  selectedNameForStart: "",
  matchedDuplicateName: "",
  currentScreen: "screen-home",
  currentStep: 1,
  statusFilter: "all",
  lastFailedAction: null,
  formData: createEmptyFormData("")
};

function createEmptyFormData(nome) {
  return {
    nome: nome || "",
    deseja_opcoes: [],
    deseja_outro: "",
    nao_deseja_opcoes: [],
    nao_deseja_outro: "",
    roupa_tamanho: "",
    roupa_numeracao: "",
    roupa_detalhes: "",
    calcado_numeracao: "",
    calcado_nao_sei: false,
    calcado_detalhes: "",
    restricoes_opcoes: [],
    restricoes_outro: "",
    sensorial_opcoes: [],
    sensorial_outro: "",
    outras_observacoes: ""
  };
}

/* ============================================================================
   UTILITÁRIOS E CONSTRUÇÃO SEGURA DE ELEMENTOS DOM
   ============================================================================ */
function createEl(tag, className, textValue) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (textValue !== undefined && textValue !== null) {
    el.textContent = String(textValue);
  }
  return el;
}

function normalizeText(text) {
  if (!text) return "";
  return String(text)
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function sortParticipantsAlpha(list) {
  return list.slice().sort(function (a, b) {
    return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
  });
}

function parseSizeList(sizeStr) {
  if (!sizeStr) return [];
  return String(sizeStr)
    .split(",")
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return CLOTHES_SIZES.indexOf(s) !== -1; });
}

function applyFontScale(scale) {
  const validScales = ["normal", "large", "xlarge"];
  const chosen = validScales.indexOf(scale) !== -1 ? scale : "normal";

  document.documentElement.classList.remove("font-normal", "font-large", "font-xlarge");
  document.documentElement.classList.add("font-" + chosen);

  document.querySelectorAll(".a11y-btn").forEach(function (btn) {
    const active = btn.dataset.font === chosen;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });

  try {
    localStorage.setItem(FONT_STORAGE_KEY, chosen);
  } catch (_) {}
}

function initFontScale() {
  let saved = "normal";
  try {
    saved = localStorage.getItem(FONT_STORAGE_KEY) || "normal";
  } catch (_) {}
  applyFontScale(saved);
}

function showAlert(message, type, retryFn) {
  const alertType = type || "error";
  const box = document.getElementById("global-alert");
  const textEl = document.getElementById("global-alert-text");
  const retryBtn = document.getElementById("btn-retry-load");

  textEl.textContent = message;
  box.className = "alert alert-" + alertType;
  box.classList.remove("hidden");

  state.lastFailedAction = retryFn || null;
  retryBtn.classList.toggle("hidden", typeof retryFn !== "function");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideAlert() {
  const box = document.getElementById("global-alert");
  box.classList.add("hidden");
  document.getElementById("global-alert-text").textContent = "";
  document.getElementById("btn-retry-load").classList.add("hidden");
  state.lastFailedAction = null;
}

function showLoading(text) {
  document.getElementById("global-loading-text").textContent = text || "Carregando...";
  document.getElementById("global-loading").classList.remove("hidden");
}

function hideLoading() {
  document.getElementById("global-loading").classList.add("hidden");
}

/* ============================================================================
   NAVEGAÇÃO ENTRE TELAS COM SUPORTE AO BOTÃO "VOLTAR" DO CELULAR
   ============================================================================ */
function navigateTo(screenId, step, pushHistory) {
  const targetStep = step || 1;
  const shouldPush = pushHistory !== false;

  hideAlert();
  state.currentScreen = screenId;
  state.currentStep = targetStep;

  document.querySelectorAll(".screen").forEach(function (s) {
    s.classList.add("hidden");
  });

  const target = document.getElementById(screenId);
  if (target) {
    target.classList.remove("hidden");
  }

  if (shouldPush) {
    try {
      window.history.pushState({ screenId: screenId, step: targetStep }, "");
    } catch (_) {}
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function saveSessionDraft() {
  if (!state.formData || !state.formData.nome) return;
  try {
    sessionStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        step: state.currentStep,
        formData: state.formData
      })
    );
  } catch (_) {}
}

function clearSessionDraft() {
  try {
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (_) {}
}

/* ============================================================================
   COMUNICAÇÃO COM A API (GOOGLE APPS SCRIPT)
   ============================================================================ */
function validateApiUrl() {
  if (!API_URL || API_URL.indexOf("COLE_AQUI") !== -1 || API_URL.indexOf("https://") !== 0) {
    return "Atenção organizador: falta colar a URL do Google Apps Script na linha 7 do arquivo app.js.";
  }
  if (API_URL.slice(-4) === "/dev") {
    return "Atenção organizador: a URL configurada no app.js termina em '/dev' (modo de teste). Use a URL que termina em '/exec'.";
  }
  return null;
}

async function fetchWithTimeout(url, options) {
  const reqOptions = options || {};
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const mergedOptions = Object.assign({}, reqOptions, { signal: controller.signal });
    return await fetch(url, mergedOptions);
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error("A conexão demorou demais para responder. Verifique sua internet e tente novamente.");
    }
    throw new Error("Sem conexão com o servidor no momento. Verifique sua internet e tente novamente.");
  } finally {
    clearTimeout(timer);
  }
}

async function parseApiJson(response) {
  const rawText = await response.text();
  try {
    return JSON.parse(rawText);
  } catch (_) {
    if (rawText.indexOf("<!DOCTYPE") !== -1 || rawText.indexOf("accounts.google.com") !== -1) {
      throw new Error(
        "A planilha solicitou permissão de login. O organizador precisa publicar o Apps Script com 'Quem pode acessar: Qualquer pessoa' e usar a URL terminada em /exec."
      );
    }
    throw new Error("Resposta inesperada do servidor da planilha.");
  }
}

async function fetchParticipants(retryAction) {
  const configError = validateApiUrl();
  if (configError) {
    showAlert(configError, "error", null);
    return false;
  }

  hideAlert();
  showLoading("Carregando lista de participantes...");

  try {
    const separator = API_URL.indexOf("?") !== -1 ? "&" : "?";
    const response = await fetchWithTimeout(API_URL + separator + "t=" + Date.now(), {
      method: "GET",
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error("Erro de comunicação (" + response.status + ").");
    }

    const result = await parseApiJson(response);
    if (!result.ok) {
      throw new Error(result.error || "Erro ao ler os dados da planilha.");
    }

    state.participants = sortParticipantsAlpha(result.participants || []);
    return true;
  } catch (err) {
    showAlert(err.message, "error", retryAction || null);
    return false;
  } finally {
    hideLoading();
  }
}

async function postToApi(payload) {
  const configError = validateApiUrl();
  if (configError) {
    throw new Error(configError);
  }

  // Envio como text/plain evita preflight CORS (OPTIONS) no Google Apps Script
  const response = await fetchWithTimeout(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload),
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error("Falha na comunicação com a planilha (" + response.status + ").");
  }

  const result = await parseApiJson(response);
  if (!result.ok) {
    throw new Error(result.error || "Não foi possível salvar os dados.");
  }

  return result;
}

/* ============================================================================
   SELEÇÃO E CADASTRO DE PARTICIPANTES (TELA 2)
   ============================================================================ */
function hasAnyPreference(p) {
  const cleaned = applyConditionalCleanup(p);
  return Boolean(
    (cleaned.deseja_opcoes && cleaned.deseja_opcoes.length) ||
      cleaned.deseja_outro ||
      (cleaned.nao_deseja_opcoes && cleaned.nao_deseja_opcoes.length) ||
      cleaned.nao_deseja_outro ||
      cleaned.roupa_tamanho ||
      cleaned.roupa_numeracao ||
      cleaned.roupa_detalhes ||
      cleaned.calcado_numeracao ||
      cleaned.calcado_nao_sei ||
      cleaned.calcado_detalhes ||
      (cleaned.restricoes_opcoes && cleaned.restricoes_opcoes.length) ||
      cleaned.restricoes_outro ||
      (cleaned.sensorial_opcoes && cleaned.sensorial_opcoes.length) ||
      cleaned.sensorial_outro ||
      cleaned.outras_observacoes
  );
}

function renderParticipantRadioList(filterQuery) {
  const container = document.getElementById("participant-radio-list");
  const emptyEl = document.getElementById("filter-name-empty");
  const normalizedQuery = normalizeText(filterQuery || "");

  const filtered = state.participants.filter(function (p) {
    return normalizeText(p.nome).indexOf(normalizedQuery) !== -1;
  });

  container.textContent = "";
  emptyEl.classList.toggle("hidden", filtered.length > 0);

  filtered.forEach(function (p, idx) {
    const radioId = "part-radio-" + idx;
    const isSelected = state.selectedNameForStart === p.nome;
    const filled = hasAnyPreference(p);

    const label = createEl("label", "name-option-card" + (isSelected ? " is-selected" : ""));
    label.setAttribute("for", radioId);

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "participant-choice";
    input.id = radioId;
    input.value = p.nome;
    input.checked = isSelected;

    input.addEventListener("change", function () {
      selectParticipantForStart(p.nome);
    });

    const leftDiv = createEl("div", "name-option-left");
    const circle = createEl("span", "radio-circle");
    circle.setAttribute("aria-hidden", "true");

    const infoDiv = createEl("div", "name-option-info");
    const nameSpan = createEl("span", "name-option-title", p.nome);
    const statusSpan = createEl(
      "span",
      "name-option-status" + (filled ? " status-done" : ""),
      filled ? "✓ Já preencheu (toque para editar)" : "Ainda não preencheu"
    );

    infoDiv.appendChild(nameSpan);
    infoDiv.appendChild(statusSpan);
    leftDiv.appendChild(circle);
    leftDiv.appendChild(infoDiv);

    label.appendChild(input);
    label.appendChild(leftDiv);
    container.appendChild(label);
  });

  updateSelectedNameFeedback();
}

function selectParticipantForStart(nome) {
  state.selectedNameForStart = nome;
  const currentFilter = document.getElementById("filter-select-name").value;
  renderParticipantRadioList(currentFilter);
}

function updateSelectedNameFeedback() {
  const feedbackEl = document.getElementById("selected-name-feedback");
  const startBtn = document.getElementById("btn-start-form");

  if (!state.selectedNameForStart) {
    feedbackEl.classList.add("hidden");
    feedbackEl.textContent = "";
    startBtn.textContent = "Continuar com o nome escolhido →";
    return;
  }

  const participant = state.participants.find(function (p) {
    return p.nome === state.selectedNameForStart;
  });
  if (!participant) return;

  const filled = hasAnyPreference(participant);
  feedbackEl.classList.remove("hidden");
  feedbackEl.textContent = filled
    ? "Nome selecionado: " + participant.nome + ". Encontramos suas respostas salvas! Na próxima tela elas já virão preenchidas para você revisar ou alterar."
    : "Nome selecionado: " + participant.nome + ". Toque no botão azul abaixo para começar a preencher.";

  startBtn.textContent = "Continuar como " + participant.nome + " →";
}

/* ============================================================================
   CONTROLES VISUAIS DO FORMULÁRIO
   ============================================================================ */
function renderCheckboxGroup(containerId, options, selectedValues, onChange) {
  const container = document.getElementById(containerId);
  container.textContent = "";

  options.forEach(function (option, index) {
    const id = containerId + "-opt-" + index;
    const isChecked = selectedValues.indexOf(option) !== -1;

    const label = createEl("label", "checkbox-card" + (isChecked ? " is-checked" : ""));
    label.setAttribute("for", id);

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.value = option;
    input.checked = isChecked;

    const box = createEl("span", "checkbox-box");
    box.setAttribute("aria-hidden", "true");

    const text = createEl("span", "checkbox-label", option);

    input.addEventListener("change", function () {
      onChange(option, input.checked);
    });

    label.appendChild(input);
    label.appendChild(box);
    label.appendChild(text);
    container.appendChild(label);
  });
}

function renderClothesSizeButtons() {
  const container = document.getElementById("clothes-size-buttons");
  container.textContent = "";
  const selectedSizes = parseSizeList(state.formData.roupa_tamanho);

  CLOTHES_SIZES.forEach(function (size) {
    const isSelected = selectedSizes.indexOf(size) !== -1;
    const btn = createEl("button", "size-btn" + (isSelected ? " is-selected" : ""), size);
    btn.type = "button";
    btn.setAttribute("aria-pressed", isSelected ? "true" : "false");

    btn.addEventListener("click", function () {
      const updated = selectedSizes.slice();
      const idx = updated.indexOf(size);
      if (idx === -1) {
        updated.push(size);
      } else {
        updated.splice(idx, 1);
      }
      updated.sort(function (a, b) {
        return CLOTHES_SIZES.indexOf(a) - CLOTHES_SIZES.indexOf(b);
      });
      state.formData.roupa_tamanho = updated.join(", ");
      saveSessionDraft();
      renderClothesSizeButtons();
    });

    container.appendChild(btn);
  });
}

/* ============================================================================
   LÓGICA CONDICIONAL, AVISO DE CONFLITO E LIMPEZA AUTOMÁTICA
   ============================================================================ */
function shouldShowClothesSection(dataObj) {
  const data = dataObj || state.formData;
  return (
    Array.isArray(data.deseja_opcoes) &&
    data.deseja_opcoes.indexOf("Roupas") !== -1 &&
    (!Array.isArray(data.nao_deseja_opcoes) || data.nao_deseja_opcoes.indexOf("Roupas") === -1)
  );
}

function shouldShowShoesSection(dataObj) {
  const data = dataObj || state.formData;
  return (
    Array.isArray(data.deseja_opcoes) &&
    data.deseja_opcoes.indexOf("Calçados") !== -1 &&
    (!Array.isArray(data.nao_deseja_opcoes) || data.nao_deseja_opcoes.indexOf("Chinelo / calçados") === -1)
  );
}

function applyConditionalCleanup(data) {
  const cleaned = Object.assign({}, data, {
    deseja_opcoes: (data.deseja_opcoes || []).slice(),
    nao_deseja_opcoes: (data.nao_deseja_opcoes || []).slice(),
    restricoes_opcoes: (data.restricoes_opcoes || []).slice(),
    sensorial_opcoes: (data.sensorial_opcoes || []).slice()
  });

  if (!shouldShowClothesSection(cleaned)) {
    cleaned.roupa_tamanho = "";
    cleaned.roupa_numeracao = "";
    cleaned.roupa_detalhes = "";
  }

  if (!shouldShowShoesSection(cleaned)) {
    cleaned.calcado_numeracao = "";
    cleaned.calcado_nao_sei = false;
    cleaned.calcado_detalhes = "";
  } else if (cleaned.calcado_nao_sei) {
    cleaned.calcado_numeracao = "";
  }

  return cleaned;
}

function clearConditionalDomIfNeeded() {
  if (!shouldShowClothesSection()) {
    state.formData.roupa_tamanho = "";
    state.formData.roupa_numeracao = "";
    state.formData.roupa_detalhes = "";
    document.getElementById("clothes-number").value = "";
    document.getElementById("clothes-details").value = "";
    renderClothesSizeButtons();
  }

  if (!shouldShowShoesSection()) {
    state.formData.calcado_numeracao = "";
    state.formData.calcado_nao_sei = false;
    state.formData.calcado_detalhes = "";
    document.getElementById("shoes-number").value = "";
    document.getElementById("shoes-unknown").checked = false;
    document.getElementById("shoes-details").value = "";
    updateShoesUnknownUI();
  }
}

function renderConflictWarning() {
  const box = document.getElementById("conflict-warning");
  const conflicts = CONFLICT_PAIRS.filter(function (pair) {
    return (
      state.formData.deseja_opcoes.indexOf(pair.wish) !== -1 &&
      state.formData.nao_deseja_opcoes.indexOf(pair.avoid) !== -1
    );
  }).map(function (pair) {
    return pair.label;
  });

  if (conflicts.length === 0) {
    box.classList.add("hidden");
    box.textContent = "";
    return;
  }

  box.classList.remove("hidden");
  box.textContent =
    'Atenção: você marcou "' +
    conflicts.join(", ") +
    '" tanto no que gostaria de ganhar (Etapa 1) quanto no que NÃO gostaria (Etapa 2). Se marcou por engano, basta tocar na opção para desmarcar.';
}

function updateShoesUnknownUI() {
  const checkbox = document.getElementById("shoes-unknown");
  const label = checkbox.closest(".checkbox-card");
  const numberInput = document.getElementById("shoes-number");

  label.classList.toggle("is-checked", checkbox.checked);
  numberInput.disabled = checkbox.checked;
  if (checkbox.checked) {
    numberInput.value = "";
    state.formData.calcado_numeracao = "";
  }
}

/* ============================================================================
   CONTROLE DO FORMULÁRIO EM 4 ETAPAS
   ============================================================================ */
function startFormForParticipant(participant, initialStep) {
  state.formData = {
    nome: participant.nome,
    deseja_opcoes: (participant.deseja_opcoes || []).slice(),
    deseja_outro: participant.deseja_outro || "",
    nao_deseja_opcoes: (participant.nao_deseja_opcoes || []).slice(),
    nao_deseja_outro: participant.nao_deseja_outro || "",
    roupa_tamanho: participant.roupa_tamanho || "",
    roupa_numeracao: participant.roupa_numeracao || "",
    roupa_detalhes: participant.roupa_detalhes || "",
    calcado_numeracao: participant.calcado_numeracao || "",
    calcado_nao_sei: Boolean(participant.calcado_nao_sei),
    calcado_detalhes: participant.calcado_detalhes || "",
    restricoes_opcoes: (participant.restricoes_opcoes || []).slice(),
    restricoes_outro: participant.restricoes_outro || "",
    sensorial_opcoes: (participant.sensorial_opcoes || []).slice(),
    sensorial_outro: participant.sensorial_outro || "",
    outras_observacoes: participant.outras_observacoes || ""
  };

  populateFormDomFromState();
  navigateTo("screen-form", initialStep || 1, true);
  renderCurrentStep();
  saveSessionDraft();
}

function populateFormDomFromState() {
  document.getElementById("form-participant-name").textContent = state.formData.nome;

  document.getElementById("wishes-other").value = state.formData.deseja_outro;
  document.getElementById("avoid-other").value = state.formData.nao_deseja_outro;
  document.getElementById("clothes-number").value = state.formData.roupa_numeracao;
  document.getElementById("clothes-details").value = state.formData.roupa_detalhes;
  document.getElementById("shoes-number").value = state.formData.calcado_numeracao;
  document.getElementById("shoes-unknown").checked = state.formData.calcado_nao_sei;
  document.getElementById("shoes-details").value = state.formData.calcado_detalhes;
  document.getElementById("diet-other").value = state.formData.restricoes_outro;
  document.getElementById("sensory-other").value = state.formData.sensorial_outro;
  document.getElementById("other-notes").value = state.formData.outras_observacoes;

  renderAllOptionGroups();
  updateShoesUnknownUI();
}

function renderAllOptionGroups() {
  renderCheckboxGroup("wishes-options", WISHES_OPTIONS, state.formData.deseja_opcoes, function (opt, checked) {
    toggleArrayItem(state.formData.deseja_opcoes, opt, checked);
    clearConditionalDomIfNeeded();
    renderConflictWarning();
    renderAllOptionGroups();
    saveSessionDraft();
  });

  renderCheckboxGroup("avoid-options", AVOID_OPTIONS, state.formData.nao_deseja_opcoes, function (opt, checked) {
    toggleArrayItem(state.formData.nao_deseja_opcoes, opt, checked);
    clearConditionalDomIfNeeded();
    renderConflictWarning();
    renderAllOptionGroups();
    saveSessionDraft();
  });

  renderCheckboxGroup("diet-options", DIET_OPTIONS, state.formData.restricoes_opcoes, function (opt, checked) {
    if (opt === "Sem restrições" && checked) {
      state.formData.restricoes_opcoes = ["Sem restrições"];
    } else if (opt !== "Sem restrições" && checked) {
      state.formData.restricoes_opcoes = state.formData.restricoes_opcoes.filter(function (item) {
        return item !== "Sem restrições";
      });
      toggleArrayItem(state.formData.restricoes_opcoes, opt, true);
    } else {
      toggleArrayItem(state.formData.restricoes_opcoes, opt, false);
    }
    renderAllOptionGroups();
    saveSessionDraft();
  });

  renderCheckboxGroup("sensory-options", SENSORY_OPTIONS, state.formData.sensorial_opcoes, function (opt, checked) {
    toggleArrayItem(state.formData.sensorial_opcoes, opt, checked);
    renderAllOptionGroups();
    saveSessionDraft();
  });

  renderClothesSizeButtons();
}

function toggleArrayItem(arr, item, shouldInclude) {
  const idx = arr.indexOf(item);
  if (shouldInclude && idx === -1) {
    arr.push(item);
  } else if (!shouldInclude && idx !== -1) {
    arr.splice(idx, 1);
  }
}

function syncTextInputsToState() {
  state.formData.deseja_outro = document.getElementById("wishes-other").value.trim();
  state.formData.nao_deseja_outro = document.getElementById("avoid-other").value.trim();

  if (shouldShowClothesSection()) {
    state.formData.roupa_numeracao = document.getElementById("clothes-number").value.trim();
    state.formData.roupa_detalhes = document.getElementById("clothes-details").value.trim();
  } else {
    state.formData.roupa_tamanho = "";
    state.formData.roupa_numeracao = "";
    state.formData.roupa_detalhes = "";
  }

  if (shouldShowShoesSection()) {
    state.formData.calcado_nao_sei = document.getElementById("shoes-unknown").checked;
    state.formData.calcado_numeracao = state.formData.calcado_nao_sei
      ? ""
      : document.getElementById("shoes-number").value.trim();
    state.formData.calcado_detalhes = document.getElementById("shoes-details").value.trim();
  } else {
    state.formData.calcado_numeracao = "";
    state.formData.calcado_nao_sei = false;
    state.formData.calcado_detalhes = "";
  }

  state.formData.restricoes_outro = document.getElementById("diet-other").value.trim();
  state.formData.sensorial_outro = document.getElementById("sensory-other").value.trim();
  state.formData.outras_observacoes = document.getElementById("other-notes").value.trim();
  saveSessionDraft();
}

function goToStep(stepNumber, pushHistory) {
  syncTextInputsToState();
  state.currentStep = stepNumber;
  if (pushHistory !== false) {
    try {
      window.history.pushState({ screenId: "screen-form", step: stepNumber }, "");
    } catch (_) {}
  }
  renderCurrentStep();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCurrentStep() {
  const step = state.currentStep;

  document.getElementById("step-progress-text").textContent = "Etapa " + step + " de 4";
  document.getElementById("step-progress-fill").style.width = String(step * 25) + "%";
  document.getElementById("step-progressbar").setAttribute("aria-valuenow", String(step));

  for (let i = 1; i <= 4; i++) {
    document.getElementById("step-" + i).classList.toggle("hidden", i !== step);
  }

  if (step === 2) {
    renderConflictWarning();
  }

  if (step === 3) {
    const showClothes = shouldShowClothesSection();
    const showShoes = shouldShowShoesSection();

    document.getElementById("section-clothes").classList.toggle("hidden", !showClothes);
    document.getElementById("section-shoes").classList.toggle("hidden", !showShoes);
    clearConditionalDomIfNeeded();
  }

  if (step === 4) {
    document.getElementById("save-error").classList.add("hidden");
    renderReviewSummary();
  }

  const btnPrev = document.getElementById("btn-step-prev");
  const btnNext = document.getElementById("btn-step-next");
  const btnSave = document.getElementById("btn-step-save");

  btnPrev.textContent = step === 1 ? "← Escolher outro nome" : "← Voltar";
  btnNext.classList.toggle("hidden", step === 4);
  btnSave.classList.toggle("hidden", step !== 4);
}

function buildReviewBlock(title, valueText, editStepNumber) {
  const item = createEl("div", "review-item");
  const header = createEl("div", "review-item-header");
  const titleEl = createEl("p", "review-item-title", title);
  header.appendChild(titleEl);

  if (editStepNumber) {
    const editBtn = createEl("button", "btn-link", "Alterar Etapa " + editStepNumber);
    editBtn.type = "button";
    editBtn.addEventListener("click", function () {
      goToStep(editStepNumber, true);
    });
    header.appendChild(editBtn);
  }

  const valEl = createEl("p", "review-item-value", valueText);
  item.appendChild(header);
  item.appendChild(valEl);
  return item;
}

function renderReviewSummary() {
  const cleaned = applyConditionalCleanup(state.formData);
  const container = document.getElementById("review-summary");
  const emptyNotice = document.getElementById("empty-review-notice");

  emptyNotice.classList.toggle("hidden", hasAnyPreference(cleaned));
  container.textContent = "";

  container.appendChild(buildReviewBlock("Participante", cleaned.nome, null));
  container.appendChild(buildReviewBlock("O que gostaria de ganhar", formatWishes(cleaned), 1));
  container.appendChild(buildReviewBlock("O que NÃO gostaria de ganhar", formatAvoid(cleaned), 2));
  container.appendChild(
    buildReviewBlock("Especificidades (tamanhos, restrições e observações)", formatSpecifics(cleaned), 3)
  );
}

/* ============================================================================
   FORMATAÇÃO NATURAL E LEGÍVEL (REVISÃO E TABELA PÚBLICA)
   ============================================================================ */
function formatWishes(p) {
  const parts = [];
  if (p.deseja_opcoes && p.deseja_opcoes.length > 0) {
    parts.push(p.deseja_opcoes.join(", "));
  }
  if (p.deseja_outro) {
    parts.push("Detalhes: " + p.deseja_outro);
  }
  return parts.length > 0 ? parts.join(" | ") : "—";
}

function formatAvoid(p) {
  const parts = [];
  if (p.nao_deseja_opcoes && p.nao_deseja_opcoes.length > 0) {
    parts.push(p.nao_deseja_opcoes.join(", "));
  }
  if (p.nao_deseja_outro) {
    parts.push("Detalhes: " + p.nao_deseja_outro);
  }
  return parts.length > 0 ? parts.join(" | ") : "—";
}

function formatSpecifics(p) {
  const cleaned = applyConditionalCleanup(p);
  const parts = [];

  const clothesParts = [];
  if (cleaned.roupa_tamanho) clothesParts.push(cleaned.roupa_tamanho);
  if (cleaned.roupa_numeracao) clothesParts.push("Nº " + cleaned.roupa_numeracao);
  if (cleaned.roupa_detalhes) clothesParts.push(cleaned.roupa_detalhes);
  if (clothesParts.length > 0) {
    parts.push("Roupas: " + clothesParts.join(" — "));
  }

  const shoesParts = [];
  if (cleaned.calcado_nao_sei) {
    shoesParts.push("Não sabe / prefere explicar");
  } else if (cleaned.calcado_numeracao) {
    shoesParts.push("Nº " + cleaned.calcado_numeracao);
  }
  if (cleaned.calcado_detalhes) shoesParts.push(cleaned.calcado_detalhes);
  if (shoesParts.length > 0) {
    parts.push("Calçados: " + shoesParts.join(" — "));
  }

  const dietParts = [];
  if (cleaned.restricoes_opcoes && cleaned.restricoes_opcoes.length > 0) {
    dietParts.push(cleaned.restricoes_opcoes.join(", "));
  }
  if (cleaned.restricoes_outro) {
    dietParts.push(cleaned.restricoes_outro);
  }
  if (dietParts.length > 0) {
    parts.push("Restrição: " + dietParts.join(" — "));
  }

  const sensoryParts = [];
  if (cleaned.sensorial_opcoes && cleaned.sensorial_opcoes.length > 0) {
    sensoryParts.push(cleaned.sensorial_opcoes.join(", "));
  }
  if (cleaned.sensorial_outro) {
    sensoryParts.push(cleaned.sensorial_outro);
  }
  if (sensoryParts.length > 0) {
    parts.push("Sensorial/Materiais: " + sensoryParts.join(" — "));
  }

  if (cleaned.outras_observacoes) {
    parts.push("Obs.: " + cleaned.outras_observacoes);
  }

  return parts.length > 0 ? parts.join(" | ") : "—";
}

/* ============================================================================
   LISTA PÚBLICA (TABELA DESKTOP + CARTÕES EMPILHADOS MOBILE)
   ============================================================================ */
function createStatusBadge(filled) {
  return createEl(
    "span",
    "status-badge " + (filled ? "status-badge-filled" : "status-badge-pending"),
    filled ? "Preenchido" : "Ainda não preencheu"
  );
}

function buildCardRow(labelTitle, valueText) {
  const row = createEl("div", "participant-card-row");
  row.appendChild(createEl("span", "participant-card-label", labelTitle));
  row.appendChild(createEl("p", "participant-card-value", valueText));
  return row;
}

function renderPublicList() {
  const searchInput = document.getElementById("search-participant");
  const clearBtn = document.getElementById("btn-clear-search");
  const filterText = searchInput.value || "";
  const normalizedFilter = normalizeText(filterText);

  clearBtn.classList.toggle("hidden", filterText.trim().length === 0);

  const totalCount = state.participants.length;
  const filledCount = state.participants.filter(function (p) {
    return hasAnyPreference(p);
  }).length;
  const pendingCount = totalCount - filledCount;

  document.getElementById("count-all").textContent = String(totalCount);
  document.getElementById("count-filled").textContent = String(filledCount);
  document.getElementById("count-pending").textContent = String(pendingCount);

  const filtered = state.participants.filter(function (p) {
    const matchesName = normalizeText(p.nome).indexOf(normalizedFilter) !== -1;
    if (!matchesName) return false;

    const isFilled = hasAnyPreference(p);
    if (state.statusFilter === "filled") return isFilled;
    if (state.statusFilter === "pending") return !isFilled;
    return true;
  });

  document.getElementById("list-count").textContent =
    "Exibindo " + filtered.length + " de " + totalCount + " participantes em ordem alfabética.";

  const tableBody = document.getElementById("table-body");
  const mobileCards = document.getElementById("mobile-cards");
  const emptyMsg = document.getElementById("empty-search-msg");

  tableBody.textContent = "";
  mobileCards.textContent = "";

  if (filtered.length === 0) {
    emptyMsg.classList.remove("hidden");
    return;
  }

  emptyMsg.classList.add("hidden");

  filtered.forEach(function (p) {
    const filled = hasAnyPreference(p);
    const wishes = formatWishes(p);
    const avoid = formatAvoid(p);
    const specs = formatSpecifics(p);

    // Linha da Tabela (Desktop)
    const tr = document.createElement("tr");
    const nameTd = createEl("td", "participant-name-cell");
    nameTd.appendChild(createEl("div", "", p.nome));
    nameTd.appendChild(createStatusBadge(filled));

    tr.appendChild(nameTd);
    tr.appendChild(createEl("td", "", wishes));
    tr.appendChild(createEl("td", "", avoid));
    tr.appendChild(createEl("td", "", specs));
    tableBody.appendChild(tr);

    // Cartão Empilhado (Celular)
    const card = createEl("article", "participant-card");
    const cardHeader = createEl("div", "participant-card-header");
    cardHeader.appendChild(createEl("h3", "participant-card-name", p.nome));
    cardHeader.appendChild(createStatusBadge(filled));

    card.appendChild(cardHeader);
    card.appendChild(buildCardRow("O que deseja", wishes));
    card.appendChild(buildCardRow("O que não deseja", avoid));
    card.appendChild(buildCardRow("Especificidades", specs));
    mobileCards.appendChild(card);
  });
}

/* ============================================================================
   EVENTOS E INICIALIZAÇÃO
   ============================================================================ */
async function openSelectNameScreen() {
  const ok = await fetchParticipants(openSelectNameScreen);
  if (!ok) return;

  state.selectedNameForStart = "";
  state.matchedDuplicateName = "";
  document.getElementById("filter-select-name").value = "";
  document.getElementById("new-participant-name").value = "";
  document.getElementById("new-name-error").classList.add("hidden");
  document.getElementById("btn-use-existing-name").classList.add("hidden");

  renderParticipantRadioList("");
  navigateTo("screen-select-name", 1, true);
}

async function openPublicListScreen() {
  const ok = await fetchParticipants(openPublicListScreen);
  if (!ok) return;

  state.statusFilter = "all";
  document.querySelectorAll(".filter-chip").forEach(function (chip) {
    const active = chip.dataset.statusFilter === "all";
    chip.classList.toggle("is-active", active);
    chip.setAttribute("aria-pressed", active ? "true" : "false");
  });

  document.getElementById("search-participant").value = "";
  renderPublicList();
  navigateTo("screen-list", 1, true);
}

async function returnToSelectPerson() {
  syncTextInputsToState();
  clearSessionDraft();
  if (state.participants.length === 0) {
    await openSelectNameScreen();
    return;
  }
  renderParticipantRadioList(document.getElementById("filter-select-name").value);
  navigateTo("screen-select-name", 1, true);
}

document.addEventListener("DOMContentLoaded", function () {
  initFontScale();

  try {
    window.history.replaceState({ screenId: "screen-home", step: 1 }, "");
  } catch (_) {}

  document.querySelectorAll(".a11y-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyFontScale(btn.dataset.font);
    });
  });

  document.getElementById("btn-retry-load").addEventListener("click", function () {
    if (typeof state.lastFailedAction === "function") {
      state.lastFailedAction();
    }
  });

  window.addEventListener("popstate", function (event) {
    const histState = event.state;
    if (!histState || !histState.screenId) {
      navigateTo("screen-home", 1, false);
      return;
    }

    if (histState.screenId === "screen-form") {
      if (!state.formData || !state.formData.nome) {
        navigateTo("screen-home", 1, false);
        return;
      }
      syncTextInputsToState();
      navigateTo("screen-form", histState.step || 1, false);
      renderCurrentStep();
      return;
    }

    navigateTo(histState.screenId, 1, false);
  });

  document.getElementById("btn-go-fill").addEventListener("click", openSelectNameScreen);
  document.getElementById("btn-go-list").addEventListener("click", openPublicListScreen);

  document.getElementById("btn-back-home-from-name").addEventListener("click", function () {
    clearSessionDraft();
    navigateTo("screen-home", 1, true);
  });

  document.getElementById("btn-back-home-from-list").addEventListener("click", function () {
    navigateTo("screen-home", 1, true);
  });

  document.getElementById("btn-change-person").addEventListener("click", returnToSelectPerson);

  document.getElementById("filter-select-name").addEventListener("input", function (e) {
    renderParticipantRadioList(e.target.value);
  });

  document.getElementById("btn-start-form").addEventListener("click", function () {
    if (!state.selectedNameForStart) {
      showAlert("Toque primeiro na caixinha com o seu nome na lista abaixo.", "info", null);
      return;
    }

    const participant = state.participants.find(function (p) {
      return p.nome === state.selectedNameForStart;
    });
    if (!participant) {
      showAlert("Participante não encontrado. Atualize a página e tente novamente.", "error", null);
      return;
    }

    startFormForParticipant(participant, 1);
  });

  document.getElementById("btn-use-existing-name").addEventListener("click", function () {
    if (!state.matchedDuplicateName) return;
    const existing = state.participants.find(function (p) {
      return p.nome === state.matchedDuplicateName;
    });
    if (existing) {
      startFormForParticipant(existing, 1);
    }
  });

  const handleCreateParticipant = async function () {
    const input = document.getElementById("new-participant-name");
    const errBox = document.getElementById("new-name-error");
    const errText = document.getElementById("new-name-error-text");
    const useExistingBtn = document.getElementById("btn-use-existing-name");
    const addBtn = document.getElementById("btn-add-participant");

    errBox.classList.add("hidden");
    useExistingBtn.classList.add("hidden");
    state.matchedDuplicateName = "";

    const rawName = input.value.trim().replace(/\s+/g, " ");
    const normalized = normalizeText(rawName);

    if (!normalized || rawName.length < 2) {
      errText.textContent = "Por favor, digite seu nome (pelo menos 2 letras).";
      errBox.classList.remove("hidden");
      return;
    }

    const duplicate = state.participants.find(function (p) {
      return normalizeText(p.nome) === normalized;
    });
    if (duplicate) {
      state.matchedDuplicateName = duplicate.nome;
      errText.textContent = 'O nome "' + duplicate.nome + '" já está na lista! Não é necessário cadastrar de novo.';
      useExistingBtn.textContent = "Abrir o cadastro de " + duplicate.nome + " →";
      useExistingBtn.classList.remove("hidden");
      errBox.classList.remove("hidden");
      return;
    }

    addBtn.disabled = true;
    addBtn.textContent = "Cadastrando seu nome...";

    try {
      const result = await postToApi({
        action: "create_participant",
        nome: rawName
      });

      const created = result.participant;
      state.participants = sortParticipantsAlpha(state.participants.concat([created]));
      startFormForParticipant(created, 1);
    } catch (err) {
      errText.textContent = err.message;
      errBox.classList.remove("hidden");
    } finally {
      addBtn.disabled = false;
      addBtn.textContent = "Cadastrar meu nome e começar";
    }
  };

  document.getElementById("btn-add-participant").addEventListener("click", handleCreateParticipant);
  document.getElementById("new-participant-name").addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreateParticipant();
    }
  });

  [
    "wishes-other",
    "avoid-other",
    "clothes-number",
    "clothes-details",
    "shoes-number",
    "shoes-details",
    "diet-other",
    "sensory-other",
    "other-notes"
  ].forEach(function (inputId) {
    document.getElementById(inputId).addEventListener("input", function () {
      syncTextInputsToState();
    });
  });

  document.getElementById("shoes-unknown").addEventListener("change", function () {
    updateShoesUnknownUI();
    syncTextInputsToState();
  });

  document.getElementById("btn-step-prev").addEventListener("click", function () {
    if (state.currentStep === 1) {
      returnToSelectPerson();
    } else {
      goToStep(state.currentStep - 1, true);
    }
  });

  document.getElementById("btn-step-next").addEventListener("click", function () {
    if (state.currentStep < 4) {
      goToStep(state.currentStep + 1, true);
    }
  });

  document.getElementById("btn-step-save").addEventListener("click", async function () {
    syncTextInputsToState();
    const cleanedData = applyConditionalCleanup(state.formData);

    const btnSave = document.getElementById("btn-step-save");
    const btnPrev = document.getElementById("btn-step-prev");
    const btnChangePerson = document.getElementById("btn-change-person");
    const saveErr = document.getElementById("save-error");

    saveErr.classList.add("hidden");
    btnSave.disabled = true;
    btnPrev.disabled = true;
    btnChangePerson.disabled = true;
    btnSave.textContent = "Salvando...";

    try {
      const result = await postToApi({
        action: "save_preferences",
        data: cleanedData
      });

      const saved = result.participant;
      const idx = state.participants.findIndex(function (p) {
        return normalizeText(p.nome) === normalizeText(saved.nome);
      });
      if (idx !== -1) {
        state.participants[idx] = saved;
      } else {
        state.participants.push(saved);
      }
      state.participants = sortParticipantsAlpha(state.participants);

      clearSessionDraft();
      document.getElementById("success-message").textContent =
        "As preferências de " + saved.nome + " foram gravadas com sucesso e já estão atualizadas na lista pública.";
      navigateTo("screen-success", 1, true);
    } catch (err) {
      saveErr.textContent =
        "Não foi possível salvar agora: " + err.message + ' Suas respostas continuam preenchidas nesta tela — tente tocar em "Confirmar e Salvar" novamente.';
      saveErr.classList.remove("hidden");
    } finally {
      btnSave.disabled = false;
      btnPrev.disabled = false;
      btnChangePerson.disabled = false;
      btnSave.textContent = "Confirmar e Salvar";
    }
  });

  document.getElementById("btn-success-list").addEventListener("click", async function () {
    if (state.participants.length === 0) {
      await openPublicListScreen();
      return;
    }
    state.statusFilter = "all";
    document.querySelectorAll(".filter-chip").forEach(function (chip) {
      const active = chip.dataset.statusFilter === "all";
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });
    document.getElementById("search-participant").value = "";
    renderPublicList();
    navigateTo("screen-list", 1, true);
  });

  document.getElementById("btn-success-home").addEventListener("click", function () {
    clearSessionDraft();
    navigateTo("screen-home", 1, true);
  });

  document.getElementById("btn-refresh-list").addEventListener("click", async function () {
    const ok = await fetchParticipants(null);
    if (ok) {
      renderPublicList();
    }
  });

  document.getElementById("search-participant").addEventListener("input", function () {
    renderPublicList();
  });

  document.getElementById("btn-clear-search").addEventListener("click", function () {
    const searchInput = document.getElementById("search-participant");
    searchInput.value = "";
    renderPublicList();
    searchInput.focus();
  });

  document.querySelectorAll(".filter-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      state.statusFilter = chip.dataset.statusFilter;
      document.querySelectorAll(".filter-chip").forEach(function (c) {
        const active = c === chip;
        c.classList.toggle("is-active", active);
        c.setAttribute("aria-pressed", active ? "true" : "false");
      });
      renderPublicList();
    });
  });

  // Restaura rascunho da sessão caso o celular recarregue a aba durante o preenchimento
  try {
    const rawDraft = sessionStorage.getItem(DRAFT_STORAGE_KEY);
    if (rawDraft) {
      const parsed = JSON.parse(rawDraft);
      if (parsed && parsed.formData && parsed.formData.nome) {
        state.formData = parsed.formData;
        populateFormDomFromState();
        navigateTo("screen-form", parsed.step || 1, false);
        renderCurrentStep();
      }
    }
  } catch (_) {}
});
