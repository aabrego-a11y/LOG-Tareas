/* ╔══════════════════════════════════════════════════════════════════╗
   ║  LOG Consultoría — Auth (versión backend)                        ║
   ║  Login contra API Node.js + Supabase                             ║
   ╚══════════════════════════════════════════════════════════════════╝ */

// ⚠️ URL del backend en Render
const API_BASE = "https://log-tareas.onrender.com";

const KEY_TOKEN = "log_session_token";

const ROLES = {
  superadmin: { label: "Superadmin", color: "#C0392B", icon: "🔴" },
  admin:      { label: "Admin",      color: "#E67E22", icon: "🟡" },
  usuario:    { label: "Usuario",    color: "#2E8B57", icon: "🟢" },
};

// ═══════════════════════════════════════════════════════════════════
//  Cliente HTTP
// ═══════════════════════════════════════════════════════════════════
async function apiCall(path, opts = {}) {
  const token = Auth.getToken();
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers["Authorization"] = "Bearer " + token;

  let resp;
  try {
    resp = await fetch(API_BASE + path, {
      method: opts.method || "GET",
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (e) {
    throw new Error("No se puede conectar al servidor.");
  }
  const ct = resp.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await resp.json() : {};
  if (!resp.ok) {
    const err = new Error(data.error || `Error ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  return data;
}

// ═══════════════════════════════════════════════════════════════════
//  Auth
// ═══════════════════════════════════════════════════════════════════
const Auth = {
  _user: null,

  getToken() {
    return sessionStorage.getItem(KEY_TOKEN) || localStorage.getItem(KEY_TOKEN) || null;
  },
  setToken(t, persist) {
    if (persist) { localStorage.setItem(KEY_TOKEN, t); sessionStorage.removeItem(KEY_TOKEN); }
    else { sessionStorage.setItem(KEY_TOKEN, t); localStorage.removeItem(KEY_TOKEN); }
  },
  clearToken() {
    sessionStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_TOKEN);
  },
  session() { return this._user; },

  async checkSession() {
    if (!this.getToken()) return null;
    try {
      const { user } = await apiCall("/api/me");
      this._user = user;
      return user;
    } catch {
      this.clearToken();
      return null;
    }
  },

  async login(username, password, remember = false) {
    try {
      const { token, user } = await apiCall("/api/login", {
        method: "POST", body: { username, password }
      });
      this.setToken(token, remember);
      this._user = user;
      return { ok: true, user };
    } catch (e) { return { ok: false, msg: e.message }; }
  },

  async logout() {
    try { await apiCall("/api/logout", { method: "POST" }); } catch {}
    this.clearToken();
    this._user = null;
    location.reload();
  },

  async changeOwnPassword(newPwd) {
    try {
      await apiCall("/api/change-password", { method: "POST", body: { new_password: newPwd } });
      const { user } = await apiCall("/api/me");
      this._user = user;
      return { ok: true };
    } catch (e) { return { ok: false, msg: e.message }; }
  },

  async listUsers() {
    const { users } = await apiCall("/api/users");
    return users;
  },
  async createUser(payload) {
    try { await apiCall("/api/users", { method: "POST", body: payload }); return { ok: true }; }
    catch (e) { return { ok: false, msg: e.message }; }
  },
  async changePassword(userId, newPwd) {
    try { await apiCall(`/api/users/${userId}/pwd`, { method: "PATCH", body: { new_password: newPwd } }); return { ok: true }; }
    catch (e) { return { ok: false, msg: e.message }; }
  },
  async deleteUser(userId) {
    try { await apiCall(`/api/users/${userId}`, { method: "DELETE" }); return { ok: true }; }
    catch (e) { return { ok: false, msg: e.message }; }
  },

  can(action) {
    if (!this._user) return false;
    const r = this._user.rol;
    switch (action) {
      case "manage_users":      return r === "superadmin" || r === "admin";
      case "create_superadmin": return r === "superadmin";
      case "create_admin":      return r === "superadmin";
      case "create_usuario":    return r === "superadmin" || r === "admin";
      case "delete_user":       return r === "superadmin";
      default: return false;
    }
  },
};

window.apiCall = apiCall;

// ═══════════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════════
function escapeHtmlAuth(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeJsAuth(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}
function togglePwd(id, btn) {
  const inp = document.getElementById(id);
  if (!inp) return;
  if (inp.type === "password") { inp.type = "text"; btn.textContent = "🙈"; }
  else { inp.type = "password"; btn.textContent = "👁"; }
}

// ═══════════════════════════════════════════════════════════════════
//  UI: Login
// ═══════════════════════════════════════════════════════════════════
const LoginUI = {
  render() {
    document.body.innerHTML = `
      <div class="login-bg">
        <div class="login-card">
          <div class="login-logo">📋</div>
          <h1>LOG Consultoría</h1>
          <p class="login-sub">Plan de Acción</p>
          <form id="login-form">
            <label>Usuario</label>
            <input type="text" id="login-user" autocomplete="username" required autofocus />
            <label>Contraseña</label>
            <div class="pwd-wrap">
              <input type="password" id="login-pwd" autocomplete="current-password" required />
              <button type="button" class="pwd-toggle" onclick="togglePwd('login-pwd', this)" tabindex="-1">👁</button>
            </div>
            <div class="login-row">
              <label class="login-remember">
                <input type="checkbox" id="login-remember" />
                <span>Mantener sesión</span>
              </label>
            </div>
            <button type="submit" class="login-btn" id="login-btn">Iniciar sesión</button>
            <div class="login-error" id="login-error"></div>
          </form>
          <div class="login-hint">
            💡 <b>Primer ingreso:</b> usá <code>admin</code> / <code>admin</code>. Se te pedirá cambiar la contraseña.
          </div>
          <div class="login-foot">v1.0 · uso interno LOG Consultoría</div>
        </div>
      </div>
    `;
    document.getElementById("login-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const u = document.getElementById("login-user").value.trim();
      const p = document.getElementById("login-pwd").value;
      const r = document.getElementById("login-remember").checked;
      const err = document.getElementById("login-error");
      const btn = document.getElementById("login-btn");
      err.textContent = "";
      btn.disabled = true; btn.textContent = "Conectando...";
      const res = await Auth.login(u, p, r);
      btn.disabled = false; btn.textContent = "Iniciar sesión";
      if (!res.ok) { err.textContent = "❌ " + res.msg; return; }
      if (res.user.must_change) { ForceChangeUI.render(); return; }
      location.reload();
    });
  }
};

// ═══════════════════════════════════════════════════════════════════
//  UI: Cambio forzado
// ═══════════════════════════════════════════════════════════════════
const ForceChangeUI = {
  render() {
    const sess = Auth.session();
    document.body.innerHTML = `
      <div class="login-bg">
        <div class="login-card">
          <div class="login-logo">🔐</div>
          <h1>Cambiar contraseña</h1>
          <p class="login-sub">Primer ingreso de <b>${escapeHtmlAuth(sess.username)}</b>. Definí una nueva.</p>
          <form id="chg-form">
            <label>Nueva contraseña</label>
            <div class="pwd-wrap">
              <input type="password" id="chg-pwd1" required minlength="4" />
              <button type="button" class="pwd-toggle" onclick="togglePwd('chg-pwd1', this)" tabindex="-1">👁</button>
            </div>
            <label>Repetir contraseña</label>
            <div class="pwd-wrap">
              <input type="password" id="chg-pwd2" required minlength="4" />
              <button type="button" class="pwd-toggle" onclick="togglePwd('chg-pwd2', this)" tabindex="-1">👁</button>
            </div>
            <button type="submit" class="login-btn" id="chg-btn">Guardar y continuar</button>
            <div class="login-error" id="chg-error"></div>
          </form>
        </div>
      </div>
    `;
    document.getElementById("chg-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const p1 = document.getElementById("chg-pwd1").value;
      const p2 = document.getElementById("chg-pwd2").value;
      const err = document.getElementById("chg-error");
      const btn = document.getElementById("chg-btn");
      err.textContent = "";
      if (p1 !== p2) { err.textContent = "❌ Las contraseñas no coinciden."; return; }
      btn.disabled = true; btn.textContent = "Guardando...";
      const res = await Auth.changeOwnPassword(p1);
      btn.disabled = false; btn.textContent = "Guardar y continuar";
      if (!res.ok) { err.textContent = "❌ " + res.msg; return; }
      location.reload();
    });
  }
};

// ═══════════════════════════════════════════════════════════════════
//  UI: Gestión de Usuarios
// ═══════════════════════════════════════════════════════════════════
const UsersUI = {
  async open() {
    const prev = document.getElementById("users-overlay");
    if (prev) prev.remove();
    if (!Auth.can("manage_users")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <div class="users-overlay" id="users-overlay">
        <div class="users-modal">
          <div class="users-head">
            <h2>👥 Gestión de Usuarios</h2>
            <button class="users-close" onclick="UsersUI.close()">✕</button>
          </div>
          <div class="users-body" id="users-body">
            <div style="padding:30px;text-align:center;color:#777">Cargando...</div>
          </div>
        </div>
      </div>
    `);
    await this.render();
  },
  close() { const ov = document.getElementById("users-overlay"); if (ov) ov.remove(); },

  async render() {
    let users;
    try { users = await Auth.listUsers(); }
    catch (e) {
      document.getElementById("users-body").innerHTML =
        `<div style="padding:20px;color:#C0392B">Error: ${escapeHtmlAuth(e.message)}</div>`;
      return;
    }
    const session = Auth.session();
    const canSuper = Auth.can("create_superadmin");
    const canAdmin = Auth.can("create_admin");
    const canDel = Auth.can("delete_user");

    const rolOptions = Object.entries(ROLES).map(([k, v]) => {
      const enabled = (k === "superadmin" && canSuper) || (k === "admin" && canAdmin) || (k === "usuario");
      return `<option value="${k}" ${enabled ? "" : "disabled"}>${v.icon} ${v.label}</option>`;
    }).join("");

    const userRows = users.map(u => {
      const r = ROLES[u.rol] || ROLES.usuario;
      const isMe = u.username === session.username;
      const fecha = u.creado_en ? new Date(u.creado_en).toLocaleDateString("es-PA") : "";
      return `
        <div class="user-row">
          <div class="user-cell user-role" style="color:${r.color}">${r.icon} ${r.label}</div>
          <div class="user-cell"><b>${escapeHtmlAuth(u.username)}</b>${isMe ? ' <span class="me-tag">(vos)</span>' : ''}</div>
          <div class="user-cell">${escapeHtmlAuth(u.nombre)}</div>
          <div class="user-cell user-date">${fecha}</div>
          <div class="user-cell user-actions">
            <button class="user-btn" onclick="UsersUI.changePwd(${u.id}, '${escapeJsAuth(u.username)}')">🔑 Pass</button>
            ${canDel && !isMe ? `<button class="user-btn danger" onclick="UsersUI.deleteUser(${u.id}, '${escapeJsAuth(u.username)}')">🗑</button>` : ''}
          </div>
        </div>
      `;
    }).join("");

    document.getElementById("users-body").innerHTML = `
      <div class="users-create">
        <h3>＋ Crear nuevo usuario</h3>
        <div class="users-form">
          <input type="text" id="new-username" placeholder="Usuario (ej: jperez)" />
          <input type="text" id="new-nombre" placeholder="Nombre completo" />
          <input type="password" id="new-pwd" placeholder="Contraseña inicial" />
          <select id="new-rol">${rolOptions}</select>
          <button class="btn-primary-auth" onclick="UsersUI.create()">＋ Crear</button>
        </div>
        <div class="users-create-err" id="users-create-err"></div>
        <div class="users-note">
          ${canSuper ? '🔴 Como Superadmin podés crear cualquier rol.' : '🟡 Como Admin solo podés crear usuarios normales.'}
        </div>
      </div>
      <div class="users-list">
        <h3>📋 Usuarios existentes (${users.length})</h3>
        <div class="user-row user-head">
          <div class="user-cell">Rol</div>
          <div class="user-cell">Usuario</div>
          <div class="user-cell">Nombre</div>
          <div class="user-cell">Creado</div>
          <div class="user-cell">Acciones</div>
        </div>
        ${userRows}
      </div>
    `;
  },

  async create() {
    const username = document.getElementById("new-username").value.trim();
    const nombre = document.getElementById("new-nombre").value.trim();
    const password = document.getElementById("new-pwd").value;
    const rol = document.getElementById("new-rol").value;
    const err = document.getElementById("users-create-err");
    err.textContent = "";
    const res = await Auth.createUser({ username, nombre, password, rol });
    if (!res.ok) { err.textContent = "❌ " + res.msg; return; }
    document.getElementById("new-username").value = "";
    document.getElementById("new-nombre").value = "";
    document.getElementById("new-pwd").value = "";
    await this.render();
    if (window.Toast) Toast.ok(`Usuario "${username}" creado.`);
  },

  async changePwd(userId, username) {
    const nueva = await ModalAuth.prompt("Cambiar contraseña", `Nueva contraseña para "${username}":`, "", "password");
    if (nueva === null) return;
    const res = await Auth.changePassword(userId, nueva);
    if (!res.ok) { if (window.Toast) Toast.error(res.msg); else alert(res.msg); return; }
    if (window.Toast) Toast.ok("Contraseña actualizada.");
  },

  async deleteUser(userId, username) {
    const ok = await ModalAuth.confirm("Eliminar usuario", `¿Eliminar el usuario "${username}"?\n\nNo se puede deshacer.`);
    if (!ok) return;
    const res = await Auth.deleteUser(userId);
    if (!res.ok) { if (window.Toast) Toast.error(res.msg); else alert(res.msg); return; }
    if (window.Toast) Toast.ok(`Usuario "${username}" eliminado.`);
    await this.render();
  },
};

const ModalAuth = {
  prompt(title, msg, def = "", inputType = "text") {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "auth-modal-bg";
      wrap.innerHTML = `
        <div class="auth-modal">
          <h3>${escapeHtmlAuth(title)}</h3>
          <p>${escapeHtmlAuth(msg)}</p>
          <input type="${inputType}" class="auth-modal-input" value="${escapeHtmlAuth(def)}" />
          <div class="auth-modal-acts">
            <button class="btn-cancel-auth">Cancelar</button>
            <button class="btn-ok-auth">Aceptar</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const input = wrap.querySelector("input");
      setTimeout(() => input.focus(), 60);
      const close = (v) => { wrap.remove(); resolve(v); };
      wrap.querySelector(".btn-cancel-auth").onclick = () => close(null);
      wrap.querySelector(".btn-ok-auth").onclick = () => close(input.value);
      input.onkeydown = (e) => {
        if (e.key === "Enter") close(input.value);
        if (e.key === "Escape") close(null);
      };
    });
  },
  confirm(title, msg) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "auth-modal-bg";
      wrap.innerHTML = `
        <div class="auth-modal">
          <h3>${escapeHtmlAuth(title)}</h3>
          <p style="white-space:pre-wrap">${escapeHtmlAuth(msg)}</p>
          <div class="auth-modal-acts">
            <button class="btn-cancel-auth">Cancelar</button>
            <button class="btn-danger-auth">Sí, eliminar</button>
          </div>
        </div>`;
      document.body.appendChild(wrap);
      const close = (v) => { wrap.remove(); resolve(v); };
      wrap.querySelector(".btn-cancel-auth").onclick = () => close(false);
      wrap.querySelector(".btn-danger-auth").onclick = () => close(true);
    });
  }
};

// ═══════════════════════════════════════════════════════════════════
//  Bootstrap: decide qué mostrar
// ═══════════════════════════════════════════════════════════════════
window.__SKIP_APP_INIT__ = true;  // Por defecto bloqueamos la app hasta verificar sesión

async function bootstrapAuth() {
  // Reemplazar el body con loader mientras verificamos
  const originalBody = document.body.innerHTML;
  document.body.innerHTML = `
    <div class="login-bg">
      <div class="login-card" style="text-align:center;padding:60px 32px">
        <div style="font-size:36px;margin-bottom:12px">📋</div>
        <p style="color:#1F3864;font-weight:bold;font-size:14px">Conectando con el servidor...</p>
        <p style="color:#888;font-size:12px;margin-top:6px">(la primera carga puede tardar 30-60s)</p>
      </div>
    </div>
  `;

  const user = await Auth.checkSession();

  if (!user) {
    LoginUI.render();
    return;
  }
  if (user.must_change) {
    ForceChangeUI.render();
    return;
  }
  // Hay sesión válida → restaurar el HTML original y arrancar la app
  document.body.innerHTML = originalBody;
  window.__SKIP_APP_INIT__ = false;
  window.__SESSION__ = user;
  if (window.__APP_INIT_FN__) window.__APP_INIT_FN__();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapAuth);
} else {
  bootstrapAuth();
}
