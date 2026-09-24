/* =========================================================
   MikuChat · js/app.js — interfaz principal
   ========================================================= */

const ICON = "https://i.ibb.co/spjbhzgR/images.jpg";

const App = {
  me: null,          // usuario logueado (registro completo de idb "users")
  view: "chats",     // "chats" | "status" | "admin"
  openConv: null,    // { kind:"dm", user } o { kind:"group", id }
  contacts: [],       // [usernames]
  groups: [],          // [registros de grupo]
  blocks: []            // [usernames bloqueados]
};

function $(sel, root) { return (root || document).querySelector(sel); }
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function fmtTime(ts) { const d = new Date(ts); return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0"); }
function root() { return document.getElementById("app"); }
function toast(msg) {
  const t = el("div", "toast"); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

document.addEventListener("DOMContentLoaded", boot0);
async function boot0() {
  await seedAdmins();
  const session = loadSession();
  if (session) {
    const user = await idbGet("users", session);
    if (user && !user.blockedGlobally) { await boot(user); return; }
  }
  renderAuth();
}

/* ================= AUTENTICACIÓN ================= */
function renderAuth() {
  root().innerHTML = `
  <div class="auth-wrap">
    <div class="auth-card">
      <img class="auth-logo" src="${ICON}" alt="MikuChat">
      <h1>MikuChat</h1>
      <p class="auth-sub">Mensajería estilo WhatsApp, con temática MikuQuiz 🎤</p>
      <div class="auth-tabs">
        <button class="auth-tab on" id="tab-login">Ya tengo cuenta</button>
        <button class="auth-tab" id="tab-register">Crear cuenta</button>
      </div>
      <div id="auth-body"></div>
    </div>
  </div>`;
  $("#tab-login").onclick = () => { setAuthTab(true); renderLoginForm(); };
  $("#tab-register").onclick = () => { setAuthTab(false); renderRegisterForm(); };
  renderLoginForm();
}
function setAuthTab(loginOn) {
  $("#tab-login").classList.toggle("on", loginOn);
  $("#tab-register").classList.toggle("on", !loginOn);
}
function renderLoginForm() {
  $("#auth-body").innerHTML = `
    <div class="field"><label>Usuario</label><input id="li-user" placeholder="Tu usuario" maxlength="20"></div>
    <div class="field"><label>Contraseña</label><input id="li-pass" type="password" placeholder="Tu contraseña"></div>
    <div class="auth-err" id="li-err"></div>
    <button class="btn" id="li-go" style="width:100%">🔓 Entrar</button>`;
  $("#li-go").onclick = async () => {
    try {
      const user = await loginUser($("#li-user").value, $("#li-pass").value);
      saveSession(user.username);
      await boot(user);
    } catch (e) { $("#li-err").textContent = e.message; }
  };
}
function renderRegisterForm() {
  $("#auth-body").innerHTML = `
    <div class="field"><label>Usuario</label><input id="re-user" placeholder="3-20 caracteres" maxlength="20"></div>
    <div class="field"><label>Contraseña</label><input id="re-pass" type="password" placeholder="Mínimo 4 caracteres"></div>
    <div class="field"><label>Foto de perfil (opcional)</label>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="avatar-preview" id="re-avatar-preview">🙂</div>
        <button class="btn small secondary" id="re-avatar-btn">📷 Elegir foto</button>
        <input type="file" id="re-avatar-file" accept="image/*" style="display:none">
      </div>
    </div>
    <div class="auth-err" id="re-err"></div>
    <button class="btn" id="re-go" style="width:100%">✨ Crear cuenta</button>`;
  let photo = null;
  $("#re-avatar-btn").onclick = () => $("#re-avatar-file").click();
  $("#re-avatar-file").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    photo = await fileToSquareDataUrl(f, 160);
    $("#re-avatar-preview").innerHTML = `<img src="${photo}">`;
  };
  $("#re-go").onclick = async () => {
    try {
      const user = await registerUser($("#re-user").value, $("#re-pass").value, photo);
      saveSession(user.username);
      toast("Cuenta creada. Tu código: " + user.code);
      await boot(user);
    } catch (e) { $("#re-err").textContent = e.message; }
  };
}

function fileToSquareDataUrl(file, size) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject; img.src = r.result;
    };
    r.onerror = reject; r.readAsDataURL(file);
  });
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject; r.readAsDataURL(file);
  });
}

/* ================= ARRANQUE DE SESIÓN ================= */
async function boot(user) {
  App.me = user;
  await Net.start(user.username);
  Net.on("data", handleIncoming);
  Net.on("dupe", () => toast("⚠️ Ya iniciaste sesión con este usuario en otra pestaña/dispositivo activo"));
  await refreshLocalLists();
  renderShell();
}

async function refreshLocalLists() {
  const contacts = await idbAll("contacts");
  App.contacts = contacts.filter(c => c.owner === App.me.username).map(c => c.contact);
  const groups = await idbAll("groups");
  App.groups = groups.filter(g => g.members.includes(App.me.username));
  const blocks = await idbAll("blocks");
  App.blocks = blocks.filter(b => b.owner === App.me.username).map(b => b.blocked);
}

function logout() {
  Net.stop();
  clearSession();
  App.me = null; App.openConv = null;
  renderAuth();
}

/* ================= RED: mensajes entrantes ================= */
async function handleIncoming(payload) {
  if (!payload || !payload.t) return;

  if (payload.t === "dm") {
    if (App.blocks.includes(payload.from)) return; // bloqueado: se ignora
    const convId = "dm:" + [payload.from, App.me.username].sort().join("|");
    await idbPut("messages", {
      uid: payload.uid, convId, from: payload.from, to: App.me.username,
      kind: "dm", type: payload.type, content: payload.content, ts: payload.ts, deletedFor: []
    });
    // si no lo tenía como contacto, se agrega automáticamente (igual que WhatsApp con un número nuevo)
    if (!App.contacts.includes(payload.from)) {
      await idbPut("contacts", { id: App.me.username + "::" + payload.from, owner: App.me.username, contact: payload.from, addedAt: Date.now() });
      App.contacts.push(payload.from);
    }
    onConvUpdated(convId);
    return;
  }

  if (payload.t === "group-msg") {
    const g = App.groups.find(x => x.id === payload.groupId);
    if (!g || App.blocks.includes(payload.from)) return;
    const convId = "group:" + payload.groupId;
    await idbPut("messages", {
      uid: payload.uid, convId, from: payload.from, to: payload.groupId,
      kind: "group", type: payload.type, content: payload.content, ts: payload.ts, deletedFor: []
    });
    onConvUpdated(convId);
    return;
  }

  if (payload.t === "group-invite") {
    if (!payload.group.members.includes(App.me.username)) return;
    await idbPut("groups", payload.group);
    App.groups = App.groups.filter(g => g.id !== payload.group.id).concat(payload.group);
    toast("👥 Te agregaron al grupo \"" + payload.group.name + "\"");
    if (App.view === "chats") renderChatList();
    return;
  }

  if (payload.t === "group-update") {
    const existing = await idbGet("groups", payload.group.id);
    if (!existing && !payload.group.members.includes(App.me.username)) return;
    await idbPut("groups", payload.group);
    App.groups = App.groups.filter(g => g.id !== payload.group.id);
    if (payload.group.members.includes(App.me.username)) App.groups.push(payload.group);
    if (App.openConv && App.openConv.kind === "group" && App.openConv.id === payload.group.id) renderConvHeader();
    if (App.view === "chats") renderChatList();
    return;
  }

  if (payload.t === "delete") {
    const list = await idbByIndex("messages", "byUid", payload.uid);
    for (const m of list) {
      if (payload.forEveryone) { m.type = "text"; m.content = "🗑️ Mensaje eliminado"; }
      else { m.deletedFor = Array.from(new Set([...(m.deletedFor || []), App.me.username])); }
      await idbPut("messages", m);
    }
    if (App.openConv) renderMessages();
    return;
  }

  if (payload.t === "status") {
    if (payload.audience === "contacts" && !App.contacts.includes(payload.from)) return;
    if (App.blocks.includes(payload.from)) return;
    await idbPut("statuses", { username: payload.from, type: payload.type, content: payload.content, ts: payload.ts, uid: payload.uid });
    if (App.view === "status") renderStatusTab();
    return;
  }

  if (payload.t === "block-you") {
    // alguien te bloqueó; no necesitamos hacer nada visible, WhatsApp tampoco avisa
    return;
  }
}

function onConvUpdated(convId) {
  if (App.openConv && convKeyOfOpen() === convId) renderMessages();
  else if (App.view === "chats") renderChatList();
}
function convKeyOfOpen() {
  if (!App.openConv) return null;
  return App.openConv.kind === "dm"
    ? "dm:" + [App.openConv.user, App.me.username].sort().join("|")
    : "group:" + App.openConv.id;
}

/* ================= SHELL PRINCIPAL ================= */
function renderShell() {
  root().innerHTML = `
  <div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="side-header">
        <div class="me-avatar" id="me-avatar-btn">${avatarHtml(App.me)}</div>
        <div class="side-tabs">
          <button class="side-tab on" data-v="chats" title="Chats">💬</button>
          <button class="side-tab" data-v="status" title="Estados">🟢</button>
          ${App.me.role === "admin" ? `<button class="side-tab" data-v="admin" title="Admin">🛡️</button>` : ""}
        </div>
        <button class="icon-btn" id="btn-logout" title="Cerrar sesión">⏻</button>
      </div>
      <div id="side-body"></div>
    </aside>
    <main class="conv-pane" id="conv-pane">
      <div class="conv-empty">
        <img src="${ICON}"><h2>MikuChat</h2>
        <p>Selecciona un chat, un grupo o mira los estados 🎵</p>
      </div>
    </main>
  </div>
  <div id="modal-root"></div>`;

  document.querySelectorAll(".side-tab").forEach(b => b.onclick = () => switchView(b.dataset.v));
  $("#btn-logout").onclick = () => { if (confirm("¿Cerrar sesión?")) logout(); };
  $("#me-avatar-btn").onclick = openProfileModal;
  switchView("chats");
}

function avatarHtml(u, size) {
  size = size || 40;
  const badge = u.role === "admin" ? `<span class="admin-badge" title="Administrador">✔️</span>` : "";
  const inner = u.photo
    ? `<img src="${u.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span>${esc((u.username || "?")[0].toUpperCase())}</span>`;
  return `<div class="avatar" style="width:${size}px;height:${size}px">${inner}${badge}</div>`;
}

function switchView(v) {
  App.view = v; App.openConv = null;
  document.querySelectorAll(".side-tab").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  root().querySelector(".shell")?.classList.remove("show-conv");
  if (v === "chats") renderChatList();
  if (v === "status") renderStatusTab();
  if (v === "admin") renderAdminTab();
  $("#conv-pane").innerHTML = `<div class="conv-empty"><img src="${ICON}"><h2>MikuChat</h2><p>Selecciona un chat, un grupo o mira los estados 🎵</p></div>`;
}

/* ================= LISTA DE CHATS ================= */
async function renderChatList() {
  const body = $("#side-body"); if (!body) return;
  body.innerHTML = `
    <div class="side-actions">
      <button class="btn small" id="btn-add-contact">➕ Contacto</button>
      <button class="btn small secondary" id="btn-new-group">👥 Grupo</button>
    </div>
    <div class="chat-list" id="chat-list"></div>`;
  $("#btn-add-contact").onclick = openAddContactModal;
  $("#btn-new-group").onclick = openNewGroupModal;

  const items = [];
  // chat conmigo mismo ("Tú")
  items.push({ kind: "dm", user: App.me.username, label: App.me.username + " (Tú)", self: true });
  for (const c of App.contacts) items.push({ kind: "dm", user: c, label: c });
  for (const g of App.groups) items.push({ kind: "group", id: g.id, label: g.name, group: g });

  const list = $("#chat-list");
  list.innerHTML = "";
  for (const it of items) {
    const convId = it.kind === "dm" ? "dm:" + [it.user, App.me.username].sort().join("|") : "group:" + it.id;
    const msgs = await idbByIndex("messages", "byConv", convId);
    const visible = msgs.filter(m => !(m.deletedFor || []).includes(App.me.username));
    const last = visible[visible.length - 1];
    const row = el("div", "chat-row");
    const isOpen = App.openConv && convKeyOfOpen() === convId;
    if (isOpen) row.classList.add("on");
    const avatarObj = it.kind === "group" ? { username: it.label, photo: it.group.photo, role: "" } : (App.contacts.includes(it.user) || it.self ? await idbGet("users", it.user) || { username: it.user } : { username: it.user });
    row.innerHTML = `
      ${avatarHtml(avatarObj || { username: it.label })}
      <div class="chat-row-mid">
        <div class="chat-row-top"><b>${esc(it.label)}</b><span class="chat-row-time">${last ? fmtTime(last.ts) : ""}</span></div>
        <div class="chat-row-prev">${last ? esc(previewOf(last)) : "Sin mensajes todavía"}</div>
      </div>`;
    row.onclick = () => it.kind === "dm" ? openDm(it.user) : openGroup(it.id);
    list.appendChild(row);
  }
}
function previewOf(m) {
  if (m.type === "text") return (m.from === App.me.username ? "Tú: " : "") + m.content;
  const map = { image: "📷 Foto", video: "🎬 Video", audio: "🎤 Audio", sticker: "Sticker " + m.content };
  return (m.from === App.me.username ? "Tú: " : "") + (map[m.type] || "Mensaje");
}

/* ================= ABRIR CONVERSACIÓN ================= */
function openDm(username) {
  App.openConv = { kind: "dm", user: username };
  root().querySelector(".shell")?.classList.add("show-conv");
  renderConvHeader(); renderMessages();
  // reintenta enviar mensajes pendientes por si el contacto ya está en línea
  flushPending(username);
}
function openGroup(id) {
  App.openConv = { kind: "group", id };
  root().querySelector(".shell")?.classList.add("show-conv");
  renderConvHeader(); renderMessages();
}

async function renderConvHeader() {
  const pane = $("#conv-pane"); if (!pane) return;
  let title, sub, avatarObj, menuHtml = "";
  if (App.openConv.kind === "dm") {
    const other = App.openConv.user;
    const u = other === App.me.username ? App.me : (await idbGet("users", other)) || { username: other };
    title = other === App.me.username ? other + " (Tú)" : other;
    sub = other === App.me.username ? "Notas personales" : (Net.isOnline(other) ? "🟢 en línea" : "desconectado");
    avatarObj = u;
    if (other !== App.me.username) {
      menuHtml = `
        <button class="icon-btn" id="btn-block">${App.blocks.includes(other) ? "🔓" : "🚫"}</button>`;
    }
  } else {
    const g = App.groups.find(x => x.id === App.openConv.id);
    title = g ? g.name : "Grupo";
    sub = g ? g.members.length + " integrantes" : "";
    avatarObj = { username: title, photo: g?.photo, role: "" };
    menuHtml = `<button class="icon-btn" id="btn-group-info">ℹ️</button>`;
  }
  pane.innerHTML = `
    <div class="conv-header">
      <button class="icon-btn only-mobile" id="btn-back">←</button>
      ${avatarHtml(avatarObj, 38)}
      <div class="conv-header-mid"><b>${esc(title)}</b><small>${esc(sub)}</small></div>
      ${menuHtml}
    </div>
    <div class="messages" id="messages"></div>
    <div class="composer" id="composer"></div>`;
  $("#btn-back").onclick = () => { App.openConv = null; root().querySelector(".shell")?.classList.remove("show-conv"); if (App.view === "chats") renderChatList(); };
  if ($("#btn-block")) $("#btn-block").onclick = () => toggleBlock(App.openConv.user);
  if ($("#btn-group-info")) $("#btn-group-info").onclick = openGroupInfoModal;
  renderComposer();
}

async function renderMessages() {
  const box = $("#messages"); if (!box) return;
  const convId = convKeyOfOpen();
  const msgs = (await idbByIndex("messages", "byConv", convId)).filter(m => !(m.deletedFor || []).includes(App.me.username));
  msgs.sort((a, b) => a.ts - b.ts);
  box.innerHTML = "";
  for (const m of msgs) box.appendChild(renderBubble(m));
  box.scrollTop = box.scrollHeight;
}

function renderBubble(m) {
  const mine = m.from === App.me.username;
  const b = el("div", "bubble " + (mine ? "mine" : "theirs"));
  let body = "";
  if (m.type === "text") body = `<div class="b-text">${esc(m.content).replace(/\n/g, "<br>")}</div>`;
  else if (m.type === "sticker") body = `<div class="b-sticker">${m.content}</div>`;
  else if (m.type === "image") body = `<img class="b-media" src="${m.content}">`;
  else if (m.type === "video") body = `<video class="b-media" src="${m.content}" controls></video>`;
  else if (m.type === "audio") body = `<audio class="b-audio" src="${m.content}" controls></audio>`;
  const fromLabel = (App.openConv.kind === "group" && !mine) ? `<div class="b-from">${esc(m.from)}</div>` : "";
  b.innerHTML = `${fromLabel}${body}
    <div class="b-meta"><span>${fmtTime(m.ts)}</span>${mine ? `<span class="b-del" title="Eliminar">🗑️</span>` : ""}</div>`;
  if (mine) b.querySelector(".b-del").onclick = () => openDeleteMenu(m);
  return b;
}

function openDeleteMenu(m) {
  const choice = confirm("Aceptar = Eliminar para todos\nCancelar = Eliminar solo para mí");
  deleteMessage(m, choice);
}
async function deleteMessage(m, forEveryone) {
  if (forEveryone) {
    m.type = "text"; m.content = "🗑️ Mensaje eliminado";
  } else {
    m.deletedFor = Array.from(new Set([...(m.deletedFor || []), App.me.username]));
  }
  await idbPut("messages", m);
  if (forEveryone) {
    const targets = App.openConv.kind === "dm" ? [App.openConv.user] : App.groups.find(g => g.id === App.openConv.id).members.filter(x => x !== App.me.username);
    targets.forEach(t => { if (t !== App.me.username) Net.sendTo(t, { t: "delete", uid: m.uid, forEveryone: true }); });
  }
  renderMessages();
}

/* ================= COMPOSER (texto, media, emoji, stickers) ================= */
function renderComposer() {
  const c = $("#composer"); if (!c) return;
  c.innerHTML = `
    <button class="icon-btn" id="btn-emoji">😀</button>
    <button class="icon-btn" id="btn-sticker">🧩</button>
    <button class="icon-btn" id="btn-attach">📎</button>
    <button class="icon-btn" id="btn-mic">🎤</button>
    <input type="file" id="file-input" accept="image/*,video/*" style="display:none">
    <input id="msg-input" placeholder="Escribe un mensaje...">
    <button class="btn small" id="btn-send">➤</button>
    <div class="picker hidden" id="emoji-picker"></div>
    <div class="picker hidden" id="sticker-picker"></div>`;

  $("#msg-input").onkeydown = (e) => { if (e.key === "Enter") sendText(); };
  $("#btn-send").onclick = sendText;
  $("#btn-attach").onclick = () => $("#file-input").click();
  $("#file-input").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const dataUrl = await fileToDataUrl(f);
    const kind = f.type.startsWith("video") ? "video" : "image";
    sendMessage(kind, dataUrl);
    e.target.value = "";
  };
  $("#btn-mic").onclick = toggleVoiceRecording;

  const emojiBox = $("#emoji-picker");
  emojiBox.innerHTML = EMOJI_LIST.map(e2 => `<span class="emo">${e2}</span>`).join("");
  $("#btn-emoji").onclick = () => { emojiBox.classList.toggle("hidden"); $("#sticker-picker").classList.add("hidden"); };
  emojiBox.querySelectorAll(".emo").forEach(s => s.onclick = () => { $("#msg-input").value += s.textContent; });

  const stickerBox = $("#sticker-picker");
  stickerBox.innerHTML = STICKER_PACKS.map(p => `
    <div class="sticker-pack"><div class="sp-name">${p.name}</div>
      <div class="sp-grid">${p.items.map(it => `<span class="sti">${it}</span>`).join("")}</div></div>`).join("");
  $("#btn-sticker").onclick = () => { stickerBox.classList.toggle("hidden"); $("#emoji-picker").classList.add("hidden"); };
  stickerBox.querySelectorAll(".sti").forEach(s => s.onclick = () => { sendMessage("sticker", s.textContent); stickerBox.classList.add("hidden"); });
}

function sendText() {
  const inp = $("#msg-input");
  const txt = inp.value.trim();
  if (!txt) return;
  inp.value = "";
  sendMessage("text", txt);
}

async function sendMessage(type, content) {
  const m = { uid: uid(), from: App.me.username, type, content, ts: Date.now(), deletedFor: [] };
  if (App.openConv.kind === "dm") {
    const other = App.openConv.user;
    m.convId = "dm:" + [other, App.me.username].sort().join("|");
    m.to = other; m.kind = "dm";
    await idbPut("messages", m);
    renderMessages();
    if (other !== App.me.username) {
      const delivered = await Net.sendTo(other, { t: "dm", uid: m.uid, from: App.me.username, type, content, ts: m.ts });
      if (!delivered) queuePending(other, { t: "dm", uid: m.uid, from: App.me.username, type, content, ts: m.ts });
    }
  } else {
    const g = App.groups.find(x => x.id === App.openConv.id);
    m.convId = "group:" + g.id; m.to = g.id; m.kind = "group";
    await idbPut("messages", m);
    renderMessages();
    g.members.filter(x => x !== App.me.username).forEach(async (member) => {
      const delivered = await Net.sendTo(member, { t: "group-msg", uid: m.uid, groupId: g.id, from: App.me.username, type, content, ts: m.ts });
      if (!delivered) queuePending(member, { t: "group-msg", uid: m.uid, groupId: g.id, from: App.me.username, type, content, ts: m.ts });
    });
  }
  if (App.view === "chats") renderChatList();
}

/* mensajes pendientes por falta de conexión: se reintentan al abrir el chat de nuevo */
const _pending = new Map(); // username -> [payloads]
function queuePending(user, payload) {
  if (!_pending.has(user)) _pending.set(user, []);
  _pending.get(user).push(payload);
}
async function flushPending(user) {
  const list = _pending.get(user);
  if (!list || !list.length) return;
  for (const p of [...list]) {
    const ok = await Net.sendTo(user, p);
    if (ok) list.splice(list.indexOf(p), 1);
  }
}

/* ---------- grabar audio (nota de voz) ---------- */
let _rec = null, _recChunks = [];
async function toggleVoiceRecording() {
  const btn = $("#btn-mic");
  if (_rec && _rec.state === "recording") { _rec.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    _recChunks = [];
    _rec = new MediaRecorder(stream);
    _rec.ondataavailable = (e) => _recChunks.push(e.data);
    _rec.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      btn.classList.remove("recording");
      const blob = new Blob(_recChunks, { type: "audio/webm" });
      const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
      sendMessage("audio", dataUrl);
    };
    _rec.start();
    btn.classList.add("recording");
    toast("🎤 Grabando... pulsa de nuevo para enviar");
  } catch (e) { toast("No se pudo acceder al micrófono ❌"); }
}

/* ================= CONTACTOS Y GRUPOS ================= */
function openModal(html) {
  const mr = $("#modal-root");
  mr.innerHTML = `<div class="modal-overlay" id="mo">${html}</div>`;
  $("#mo").onclick = (e) => { if (e.target.id === "mo") closeModal(); };
}
function closeModal() { $("#modal-root").innerHTML = ""; }

function openAddContactModal() {
  openModal(`
    <div class="modal-card">
      <h2>➕ Agregar contacto</h2>
      <p class="hint">Escribe el nombre de usuario exacto de la persona (como en WhatsApp necesitas su número, aquí necesitas su usuario).</p>
      <div class="field"><input id="ac-user" placeholder="usuario"></div>
      <button class="btn" id="ac-go" style="width:100%">Agregar</button>
    </div>`);
  $("#ac-go").onclick = async () => {
    const u = $("#ac-user").value.trim();
    if (!u || u === App.me.username) return;
    if (App.contacts.includes(u)) { toast("Ya está en tus contactos"); closeModal(); return; }
    await idbPut("contacts", { id: App.me.username + "::" + u, owner: App.me.username, contact: u, addedAt: Date.now() });
    App.contacts.push(u);
    closeModal(); renderChatList();
  };
}

function openNewGroupModal() {
  openModal(`
    <div class="modal-card">
      <h2>👥 Nuevo grupo</h2>
      <div class="field"><label>Nombre del grupo</label><input id="ng-name" maxlength="30"></div>
      <div class="field"><label>Integrantes (de tus contactos)</label>
        <div class="check-list">${App.contacts.map(c => `<label><input type="checkbox" value="${esc(c)}"> ${esc(c)}</label>`).join("") || "<i>Agrega contactos primero</i>"}</div>
      </div>
      <button class="btn" id="ng-go" style="width:100%">Crear grupo</button>
    </div>`);
  $("#ng-go").onclick = async () => {
    const name = $("#ng-name").value.trim();
    if (!name) return toast("Ponle nombre al grupo");
    const chosen = [...document.querySelectorAll(".check-list input:checked")].map(i => i.value);
    const group = { id: "g-" + uid(), name, photo: null, owner: App.me.username, members: [App.me.username, ...chosen], createdAt: Date.now() };
    await idbPut("groups", group);
    App.groups.push(group);
    chosen.forEach(m => Net.sendTo(m, { t: "group-invite", group }));
    closeModal(); renderChatList(); openGroup(group.id);
  };
}

async function openGroupInfoModal() {
  const g = App.groups.find(x => x.id === App.openConv.id);
  const isOwner = g.owner === App.me.username;
  openModal(`
    <div class="modal-card">
      <h2>👥 ${esc(g.name)}</h2>
      <div class="hint">Integrantes:</div>
      <div class="check-list">${g.members.map(m => `<div>${esc(m)} ${m === g.owner ? "👑" : ""}</div>`).join("")}</div>
      ${isOwner ? `
      <div class="field"><label>Agregar integrante (de tus contactos)</label>
        <select id="gi-add"><option value="">-- elegir --</option>${App.contacts.filter(c => !g.members.includes(c)).map(c => `<option>${esc(c)}</option>`).join("")}</select></div>
      <button class="btn small" id="gi-add-go" style="width:100%">Agregar</button>` : ""}
      <button class="btn ghost" id="gi-close" style="width:100%;margin-top:8px">Cerrar</button>
    </div>`);
  $("#gi-close").onclick = closeModal;
  if (isOwner && $("#gi-add-go")) {
    $("#gi-add-go").onclick = async () => {
      const val = $("#gi-add").value; if (!val) return;
      g.members.push(val);
      await idbPut("groups", g);
      g.members.forEach(m => { if (m !== App.me.username) Net.sendTo(m, { t: "group-update", group: g }); });
      closeModal(); renderConvHeader();
    };
  }
}

async function toggleBlock(username) {
  const id = App.me.username + "::" + username;
  if (App.blocks.includes(username)) {
    await idbDelete("blocks", id);
    App.blocks = App.blocks.filter(b => b !== username);
    toast("Desbloqueaste a " + username);
  } else {
    await idbPut("blocks", { id, owner: App.me.username, blocked: username });
    App.blocks.push(username);
    Net.sendTo(username, { t: "block-you" });
    toast("Bloqueaste a " + username);
  }
  renderConvHeader();
}

/* ================= PERFIL ================= */
function openProfileModal() {
  openModal(`
    <div class="modal-card">
      <h2>Mi perfil</h2>
      <div style="text-align:center">${avatarHtml(App.me, 90)}</div>
      <button class="btn small secondary" id="pf-photo-btn" style="width:100%;margin-top:8px">📷 Cambiar foto</button>
      <input type="file" id="pf-photo-file" accept="image/*" style="display:none">
      <div class="field"><label>Usuario</label><input value="${esc(App.me.username)}" disabled></div>
      <div class="field"><label>Bio</label><input id="pf-bio" value="${esc(App.me.bio || "")}" maxlength="60"></div>
      <div class="field"><label>Tu código</label><input value="${esc(App.me.code)}" disabled></div>
      <button class="btn" id="pf-save" style="width:100%">Guardar</button>
      <button class="btn ghost" id="pf-close" style="width:100%;margin-top:8px">Cerrar</button>
    </div>`);
  $("#pf-close").onclick = closeModal;
  $("#pf-photo-btn").onclick = () => $("#pf-photo-file").click();
  $("#pf-photo-file").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    App.me.photo = await fileToSquareDataUrl(f, 160);
    await idbPut("users", App.me);
    closeModal(); openProfileModal(); renderShell();
  };
  $("#pf-save").onclick = async () => {
    App.me.bio = $("#pf-bio").value.trim();
    await idbPut("users", App.me);
    closeModal(); toast("Perfil actualizado");
  };
}

/* ================= ESTADOS ================= */
async function renderStatusTab() {
  const body = $("#side-body"); if (!body) return;
  const all = await idbAll("statuses");
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const mine = all.filter(s => s.username === App.me.username && s.ts > cutoff);
  const others = all.filter(s => s.username !== App.me.username && s.ts > cutoff &&
    (App.contacts.includes(s.username) || (App._userRoles && App._userRoles[s.username] === "admin")));

  const byUser = {};
  others.forEach(s => { (byUser[s.username] = byUser[s.username] || []).push(s); });

  body.innerHTML = `
    <div class="side-actions">
      <button class="btn small" id="btn-post-status">➕ Nuevo estado</button>
    </div>
    <div class="hint" style="padding:10px 14px">Tu estado</div>
    <div class="chat-row" id="my-status-row">
      ${avatarHtml(App.me)}
      <div class="chat-row-mid"><b>${esc(App.me.username)}</b>
        <div class="chat-row-prev">${mine.length ? mine.length + " actualización(es)" : "Toca para agregar una actualización"}</div></div>
    </div>
    <div class="hint" style="padding:10px 14px">Actualizaciones recientes</div>
    <div class="chat-list" id="status-list"></div>`;
  $("#btn-post-status").onclick = openPostStatusModal;
  $("#my-status-row").onclick = () => mine.length ? viewStatuses(App.me.username, mine) : openPostStatusModal();

  const list = $("#status-list");
  Object.keys(byUser).forEach(u => {
    const row = el("div", "chat-row");
    row.innerHTML = `${avatarHtml({ username: u })}<div class="chat-row-mid"><b>${esc(u)}</b><div class="chat-row-prev">${byUser[u].length} actualización(es)</div></div>`;
    row.onclick = () => viewStatuses(u, byUser[u]);
    list.appendChild(row);
  });
  if (!Object.keys(byUser).length) list.innerHTML = `<div class="hint" style="padding:10px 14px">Sin estados de tus contactos por ahora</div>`;
}

function openPostStatusModal() {
  openModal(`
    <div class="modal-card">
      <h2>➕ Nuevo estado</h2>
      <div class="field"><label>Texto (opcional si subes una foto)</label><input id="st-text" maxlength="120"></div>
      <div class="field"><label>Foto (opcional)</label><input type="file" id="st-file" accept="image/*"></div>
      <button class="btn" id="st-go" style="width:100%">Publicar</button>
    </div>`);
  $("#st-go").onclick = async () => {
    const text = $("#st-text").value.trim();
    const file = $("#st-file").files[0];
    let type = "text", content = text || "🎵";
    if (file) { content = await fileToDataUrl(file); type = "image"; }
    const s = { username: App.me.username, type, content, ts: Date.now(), uid: uid() };
    await idbPut("statuses", s);
    const audience = App.me.role === "admin" ? "all" : "contacts";
    const targets = audience === "all" ? await allKnownUsernames() : App.contacts;
    targets.forEach(t => { if (t !== App.me.username) Net.sendTo(t, { t: "status", uid: s.uid, from: App.me.username, type, content, ts: s.ts, audience }); });
    closeModal(); toast("Estado publicado"); renderStatusTab();
  };
}
async function allKnownUsernames() {
  const users = await idbAll("users");
  return users.map(u => u.username);
}
function viewStatuses(username, list) {
  list.sort((a, b) => a.ts - b.ts);
  openModal(`
    <div class="modal-card status-view">
      <h2>${esc(username)}</h2>
      <div>${list.map(s => s.type === "image" ? `<img class="status-img" src="${s.content}">` : `<div class="status-text">${esc(s.content)}</div>`).join("")}</div>
      <button class="btn ghost" id="sv-close" style="width:100%;margin-top:10px">Cerrar</button>
    </div>`);
  $("#sv-close").onclick = closeModal;
}

/* ================= PANEL DE ADMIN ================= */
async function renderAdminTab() {
  const body = $("#side-body"); if (!body) return;
  const users = await idbAll("users");
  App._userRoles = {}; users.forEach(u => App._userRoles[u.username] = u.role);
  body.innerHTML = `
    <div class="hint" style="padding:10px 14px">
      🛡️ Panel de administración — muestra solo cuentas registradas en <b>este dispositivo</b>
      (sin servidor central no existe una lista global de todos los usuarios de internet).
      Por seguridad, las contraseñas nunca se muestran, ni siquiera aquí.
    </div>
    <div class="chat-list" id="admin-list"></div>`;
  const list = $("#admin-list");
  users.forEach(u => {
    const row = el("div", "chat-row");
    row.innerHTML = `${avatarHtml(u)}
      <div class="chat-row-mid">
        <div class="chat-row-top"><b>${esc(u.username)}</b><span class="chat-row-time">${u.role}</span></div>
        <div class="chat-row-prev">Código: ${esc(u.code || "-")}${u.blockedGlobally ? " · 🚫 bloqueado" : ""}</div>
      </div>
      <div class="admin-actions">
        ${u.username !== App.me.username ? `
          <button class="icon-btn sm" data-a="role" title="Alternar admin">🛡️</button>
          <button class="icon-btn sm" data-a="ban" title="Bloquear/Desbloquear cuenta">${u.blockedGlobally ? "✅" : "🚫"}</button>` : "<i>tú</i>"}
      </div>`;
    const roleBtn = row.querySelector('[data-a="role"]');
    if (roleBtn) roleBtn.onclick = async () => { u.role = u.role === "admin" ? "user" : "admin"; await idbPut("users", u); renderAdminTab(); };
    const banBtn = row.querySelector('[data-a="ban"]');
    if (banBtn) banBtn.onclick = async () => { u.blockedGlobally = !u.blockedGlobally; await idbPut("users", u); renderAdminTab(); };
    list.appendChild(row);
  });
}
