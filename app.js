/* ╔══════════════════════════════════════════════════════════════════╗
   ║  LOG Consultoría — Plan de Acción (versión backend)              ║
   ║  Datos: API REST en Render + Supabase                            ║
   ║  PDFs: jsPDF + autotable (igual que antes)                       ║
   ╚══════════════════════════════════════════════════════════════════╝ */

// ── Constantes visuales (espejo del PDF original Python) ────────────
const C_AZUL   = [ 31,  73, 125];
const C_GRIS   = [ 89,  89,  89];
const C_CLARO  = [189, 215, 238];
const C_BLANCO = [255, 255, 255];
const C_NEGRO  = [  0,   0,   0];
const C_BORDE  = [180, 205, 230];
const C_HDR_BG = [214, 228, 240];
const C_COL    = [ 91, 155, 213];
const C_ROW_A  = [235, 244, 250];

const MESES_ES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre"
];

function fechaEs(d) {
  if (!(d instanceof Date)) d = new Date(d);
  return `${d.getDate()} de ${MESES_ES[d.getMonth()]} de ${d.getFullYear()}`;
}
function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function nowStamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function safeFile(t) {
  return String(t || "").replace(/[\\/:*?"<>|]/g, "").trim().replace(/\s+/g, "_").slice(0, 30);
}
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(s) { return escapeHtml(s); }
function escapeJs(s) { return String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'"); }

// ── Toast ─────────────────────────────────────────────────────────────
const Toast = {
  show(msg, type = "success", ms = 3500) {
    const c = document.getElementById("toast-container");
    if (!c) { console.log(msg); return; }
    const t = document.createElement("div");
    t.className = "toast" + (type !== "success" ? " " + type : "");
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, ms);
  },
  ok(m) { this.show(m, "success"); },
  error(m) { this.show(m, "error"); },
  warn(m) { this.show(m, "warn"); },
};

// ── Modal genérico de app ─────────────────────────────────────────────
const Modal = {
  prompt(title, msg, def = "") {
    return new Promise((resolve) => {
      const overlay = document.getElementById("modal-overlay");
      document.getElementById("modal-title").textContent = title;
      document.getElementById("modal-body").textContent = msg;
      const input = document.getElementById("modal-input");
      input.style.display = "block";
      input.value = def;
      const acts = document.getElementById("modal-actions");
      acts.innerHTML = "";
      const cancel = document.createElement("button");
      cancel.className = "btn-secondary";
      cancel.textContent = "Cancelar";
      cancel.onclick = () => { overlay.classList.remove("active"); resolve(null); };
      const accept = document.createElement("button");
      accept.className = "btn-primary";
      accept.textContent = "Aceptar";
      accept.onclick = () => {
        const v = input.value.trim();
        overlay.classList.remove("active");
        resolve(v || null);
      };
      acts.appendChild(cancel);
      acts.appendChild(accept);
      overlay.classList.add("active");
      setTimeout(() => input.focus(), 60);
      input.onkeydown = (e) => {
        if (e.key === "Enter") accept.click();
        if (e.key === "Escape") cancel.click();
      };
    });
  },
  confirm(title, msg) {
    return new Promise((resolve) => {
      const overlay = document.getElementById("modal-overlay");
      document.getElementById("modal-title").textContent = title;
      document.getElementById("modal-body").innerText = msg;
      document.getElementById("modal-input").style.display = "none";
      const acts = document.getElementById("modal-actions");
      acts.innerHTML = "";
      const cancel = document.createElement("button");
      cancel.className = "btn-secondary";
      cancel.textContent = "Cancelar";
      cancel.onclick = () => { overlay.classList.remove("active"); resolve(false); };
      const accept = document.createElement("button");
      accept.className = "btn-danger";
      accept.textContent = "Sí, eliminar";
      accept.onclick = () => { overlay.classList.remove("active"); resolve(true); };
      acts.appendChild(cancel);
      acts.appendChild(accept);
      overlay.classList.add("active");
    });
  }
};

// ═══════════════════════════════════════════════════════════════════
//  CALENDARIO POPUP
// ═══════════════════════════════════════════════════════════════════
const Calendario = {
  targetId: null, year: 0, month: 0, selected: null,
  MESES_LARGOS: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],

  abrir(targetId) {
    this.targetId = targetId;
    const input = document.getElementById(targetId);
    let d = new Date();
    if (input && input.value) {
      const p = input.value.split("-");
      if (p.length === 3) {
        const cand = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
        if (!isNaN(cand.getTime())) d = cand;
      }
    }
    this.year = d.getFullYear(); this.month = d.getMonth();
    this.selected = new Date(d);
    this.render();
    document.getElementById("cal-overlay").classList.add("active");
  },
  cerrar() { document.getElementById("cal-overlay").classList.remove("active"); },

  render() {
    document.getElementById("cal-title").textContent = `${this.MESES_LARGOS[this.month]} ${this.year}`;
    const cont = document.getElementById("cal-days");
    cont.innerHTML = "";
    const first = new Date(this.year, this.month, 1);
    let startDay = first.getDay() - 1;
    if (startDay < 0) startDay = 6;
    const daysPrev = new Date(this.year, this.month, 0).getDate();
    const daysThis = new Date(this.year, this.month + 1, 0).getDate();
    let html = "", dayCount = 0, week = '<div class="cal-week">';
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    for (let i = startDay; i > 0; i--) {
      week += `<div class="other-month">${daysPrev - i + 1}</div>`; dayCount++;
    }
    for (let d = 1; d <= daysThis; d++) {
      const date = new Date(this.year, this.month, d);
      let cls = "";
      if (date.getTime() === hoy.getTime()) cls += " today";
      if (this.selected &&
          date.getFullYear() === this.selected.getFullYear() &&
          date.getMonth() === this.selected.getMonth() &&
          date.getDate() === this.selected.getDate()) cls += " selected";
      week += `<div class="${cls.trim()}" onclick="Calendario.seleccionar(${this.year},${this.month},${d})">${d}</div>`;
      dayCount++;
      if (dayCount % 7 === 0) { week += "</div>"; html += week; week = '<div class="cal-week">'; }
    }
    let next = 1;
    while (dayCount % 7 !== 0) { week += `<div class="other-month">${next++}</div>`; dayCount++; }
    week += "</div>"; html += week;
    cont.innerHTML = html;
  },
  prevMonth() { this.month--; if (this.month < 0) { this.month = 11; this.year--; } this.render(); },
  nextMonth() { this.month++; if (this.month > 11) { this.month = 0; this.year++; } this.render(); },
  seleccionar(y, m, d) {
    const iso = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const t = document.getElementById(this.targetId);
    if (t) t.value = iso;
    this.cerrar();
  },
  hoy() { const d = new Date(); this.seleccionar(d.getFullYear(), d.getMonth(), d.getDate()); }
};
function abrirCalendario(id) { Calendario.abrir(id); }
function cerrarCalendario() { Calendario.cerrar(); }

// ═══════════════════════════════════════════════════════════════════
//  NAVEGACIÓN ENTRE MÓDULOS
// ═══════════════════════════════════════════════════════════════════
function activarModulo(mod) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.module === mod));
  document.querySelectorAll(".modulo").forEach(s => s.classList.toggle("active", s.dataset.module === mod));
  if (mod === "vault") Vault.refrescar();
  if (mod === "tareas") Tareas.refresh();
  if (mod === "plan") Plan.refresh();
}

// ═══════════════════════════════════════════════════════════════════
//  MÓDULO TAREAS
// ═══════════════════════════════════════════════════════════════════
const Tareas = {
  items: [],     // [{id, nombre, ...}, ...] desde el server
  activoId: null,
  activoNombre: "",

  async refresh() {
    try {
      const { profesionales } = await apiCall("/api/profesionales");
      this.items = profesionales || [];
      this.rebuildRadios();
      if (this.items.length && !this.activoId) {
        this.cargar(this.items[0].id);
      } else if (this.activoId) {
        const found = this.items.find(p => p.id === this.activoId);
        if (found) this.cargar(found.id);
        else this.limpiarFormulario();
      }
    } catch (e) {
      Toast.error("Error cargando profesionales: " + e.message);
    }
  },

  rebuildRadios() {
    const cont = document.getElementById("tareas-radios");
    if (!cont) return;
    if (!this.items.length) {
      cont.innerHTML = '<span class="empty">No hay profesionales. Hacé click en "＋ Nuevo profesional".</span>';
      return;
    }
    const session = window.__SESSION__ || {};
    cont.innerHTML = this.items.map(p => {
      const dueno = p.usuarios && p.usuarios.username !== session.username
        ? ` <span style="color:#888;font-size:11px">(${escapeHtml(p.usuarios.username)})</span>` : '';
      return `
        <label>
          <input type="radio" name="tareas-sel" ${p.id === this.activoId ? "checked" : ""}
                 onchange="Tareas.cargar(${p.id})" />
          ${escapeHtml(p.nombre)}${dueno}
        </label>`;
    }).join("");
  },

  async nuevo() {
    const nombre = await Modal.prompt("Nuevo Profesional", "Nombre completo:");
    if (!nombre) return;
    if (this.items.find(p => p.nombre.toLowerCase() === nombre.toLowerCase())) {
      Toast.warn(`${nombre} ya está en la lista.`);
      return;
    }
    try {
      const { profesional } = await apiCall("/api/profesionales", {
        method: "POST",
        body: {
          nombre, semana: "", actualizacion: fechaEs(new Date()),
          alcances: ["", "", "", "", ""],
          prioridades: [["",""],["",""],["",""],["",""],["",""]],
        }
      });
      this.activoId = profesional.id;
      this.activoNombre = profesional.nombre;
      await this.refresh();
    } catch (e) {
      Toast.error("Error: " + e.message);
    }
  },

  async eliminar() {
    if (!this.activoId) {
      Toast.warn(this.items.length ? "Seleccioná primero un profesional." : "No hay profesionales para eliminar.");
      return;
    }
    const ok = await Modal.confirm("Eliminar profesional",
      `¿Eliminar a "${this.activoNombre}"?\n\nSe borrarán todas sus tareas. NO se puede deshacer.`);
    if (!ok) return;
    try {
      await apiCall(`/api/profesionales/${this.activoId}`, { method: "DELETE" });
      const id = this.activoId, name = this.activoNombre;
      this.activoId = null; this.activoNombre = "";
      this.limpiarFormulario();
      await this.refresh();
      Toast.ok(`Profesional "${name}" eliminado.`);
    } catch (e) {
      Toast.error("Error: " + e.message);
    }
  },

  cargar(id) {
    const p = this.items.find(x => x.id === id);
    if (!p) return;
    this.activoId = p.id;
    this.activoNombre = p.nombre;
    document.getElementById("tareas-nombre").value = p.nombre || "";
    document.getElementById("tareas-semana").value = p.semana || "";
    document.getElementById("tareas-actualizacion").value = p.actualizacion || "";
    const alcances = (p.alcances || []).slice();
    while (alcances.length < 5) alcances.push("");
    this.rebuildAlcances(alcances);
    const prio = (p.prioridades || []).slice();
    while (prio.length < 5) prio.push(["", ""]);
    this.rebuildPrioridades(prio);
    this.rebuildRadios();
  },

  limpiarFormulario() {
    document.getElementById("tareas-nombre").value = "";
    document.getElementById("tareas-semana").value = "";
    document.getElementById("tareas-actualizacion").value = "";
    this.rebuildAlcances(["", "", "", "", ""]);
    this.rebuildPrioridades([["",""],["",""],["",""],["",""],["",""]]);
  },

  rebuildAlcances(vals) {
    const cont = document.getElementById("tareas-alcances");
    cont.innerHTML = "";
    vals.forEach(v => this.addAlcance(v, false));
  },
  addAlcance(valor = "", focus = true) {
    const cont = document.getElementById("tareas-alcances");
    const i = cont.children.length + 1;
    const row = document.createElement("div");
    row.className = "data-row" + (i % 2 === 0 ? " alt" : "");
    row.innerHTML = `<div class="num-cell">${i}.</div><div><input type="text" value="${escapeAttr(valor)}" /></div>`;
    cont.appendChild(row);
    if (focus) row.querySelector("input").focus();
  },
  delAlcance() {
    const c = document.getElementById("tareas-alcances");
    if (c.lastElementChild) c.removeChild(c.lastElementChild);
  },

  rebuildPrioridades(items) {
    const cont = document.getElementById("tareas-prioridades");
    cont.innerHTML = "";
    items.forEach(it => this.addPrio(it[0] || "", it[1] || "", false));
  },
  addPrio(tarea = "", obs = "", focus = true) {
    const cont = document.getElementById("tareas-prioridades");
    const i = cont.children.length + 1;
    const row = document.createElement("div");
    row.className = "data-row" + (i % 2 === 0 ? " alt" : "");
    row.innerHTML = `
      <div class="num-cell">${i}.</div>
      <div><textarea>${escapeHtml(tarea)}</textarea></div>
      <div><input type="text" value="${escapeAttr(obs)}" /></div>`;
    cont.appendChild(row);
    if (focus) row.querySelector("textarea").focus();
  },
  delPrio() {
    const c = document.getElementById("tareas-prioridades");
    if (c.lastElementChild) c.removeChild(c.lastElementChild);
  },

  recolectar() {
    const alcs = Array.from(document.querySelectorAll("#tareas-alcances .data-row"))
      .map(r => r.querySelector("input").value.trim());
    const prio = Array.from(document.querySelectorAll("#tareas-prioridades .data-row"))
      .map(r => [r.querySelector("textarea").value.trim(), r.querySelector("input").value.trim()]);
    return {
      nombre: document.getElementById("tareas-nombre").value.trim(),
      semana: document.getElementById("tareas-semana").value.trim() || "—",
      actualizacion: document.getElementById("tareas-actualizacion").value.trim() || fechaEs(new Date()),
      alcances: alcs,
      prioridades: prio,
    };
  },

  async guardarSinPDF() {
    const data = this.recolectar();
    if (!data.nombre) { Toast.warn("Ingresá el nombre del profesional."); return; }
    try {
      const payload = { ...data };
      if (this.activoId) payload.id = this.activoId;
      const { profesional } = await apiCall("/api/profesionales", { method: "POST", body: payload });
      this.activoId = profesional.id;
      this.activoNombre = profesional.nombre;
      await this.refresh();
      Toast.ok(`Datos de ${data.nombre} guardados.`);
    } catch (e) {
      Toast.error("Error: " + e.message);
    }
  },

  limpiar() { this.limpiarFormulario(); this.activoId = null; this.activoNombre = ""; this.rebuildRadios(); },

  async generar() {
    const data = this.recolectar();
    if (!data.nombre) { Toast.warn("Ingresá el nombre del profesional."); return; }
    const alcances = data.alcances.filter(x => x);
    const prioridades = data.prioridades.filter(p => p[0]);
    if (!alcances.length) { Toast.warn("Agregá al menos un ítem en Objetivo."); return; }
    data.alcances = alcances;
    data.prioridades = prioridades;

    // Guardar primero
    try {
      const payload = { ...data };
      if (this.activoId) payload.id = this.activoId;
      const { profesional } = await apiCall("/api/profesionales", { method: "POST", body: payload });
      this.activoId = profesional.id;
      this.activoNombre = profesional.nombre;
    } catch (e) {
      Toast.error("Error guardando: " + e.message);
      return;
    }

    // Generar PDF
    try {
      const partes = data.nombre.replace(/[\/\\]/g, "_").split(/\s+/).slice(0, 3);
      const nombrePdf = `Tareas_${partes.join("_")}_${nowStamp()}.pdf`;
      pdfTareas(data, nombrePdf);
      // Registrar en vault
      try {
        await apiCall("/api/vault", {
          method: "POST",
          body: {
            modulo: "Tareas",
            referencia: data.nombre,
            nombre_archivo: nombrePdf,
            data_snapshot: { tipo: "tareas", data },
          }
        });
      } catch (e) {
        console.warn("No se pudo registrar en Vault:", e.message);
      }
      Toast.ok(`PDF generado: ${nombrePdf}`);
      await this.refresh();
    } catch (e) {
      Toast.error("Error generando PDF: " + e.message);
    }
  },
};

// ═══════════════════════════════════════════════════════════════════
//  MÓDULO PLAN DE ACCIÓN
// ═══════════════════════════════════════════════════════════════════
const Plan = {
  items: [],
  activoId: null,
  activoNombre: "",

  async refresh() {
    try {
      const { planes } = await apiCall("/api/planes");
      this.items = planes || [];
      this.rebuildRadios();
      if (this.items.length && !this.activoId) {
        this.cargar(this.items[0].id);
      } else if (this.activoId) {
        const found = this.items.find(p => p.id === this.activoId);
        if (found) this.cargar(found.id);
        else this.limpiarFormulario();
      }
    } catch (e) {
      Toast.error("Error cargando planes: " + e.message);
    }
  },

  rebuildRadios() {
    const cont = document.getElementById("plan-radios");
    if (!cont) return;
    if (!this.items.length) {
      cont.innerHTML = '<span class="empty">No hay proyectos. Hacé click en "＋ Nuevo proyecto".</span>';
      return;
    }
    const session = window.__SESSION__ || {};
    cont.innerHTML = this.items.map(p => {
      const dueno = p.usuarios && p.usuarios.username !== session.username
        ? ` <span style="color:#888;font-size:11px">(${escapeHtml(p.usuarios.username)})</span>` : '';
      return `
        <label>
          <input type="radio" name="plan-sel" ${p.id === this.activoId ? "checked" : ""}
                 onchange="Plan.cargar(${p.id})" />
          ${escapeHtml(p.proyecto)}${dueno}
        </label>`;
    }).join("");
  },

  async nuevo() {
    const nombre = await Modal.prompt("Nuevo Proyecto", "Nombre del proyecto:");
    if (!nombre) return;
    if (this.items.find(p => p.proyecto.toLowerCase() === nombre.toLowerCase())) {
      Toast.warn(`"${nombre}" ya está en la lista.`);
      return;
    }
    try {
      const { plan } = await apiCall("/api/planes", {
        method: "POST",
        body: { proyecto: nombre, proceso: "", fecha: hoyISO(), items: [] }
      });
      this.activoId = plan.id;
      this.activoNombre = plan.proyecto;
      await this.refresh();
    } catch (e) {
      Toast.error("Error: " + e.message);
    }
  },

  async eliminar() {
    if (!this.activoId) {
      Toast.warn(this.items.length ? "Seleccioná primero un proyecto." : "No hay proyectos para eliminar.");
      return;
    }
    const ok = await Modal.confirm("Eliminar proyecto",
      `¿Eliminar el proyecto "${this.activoNombre}"?\n\nSe borrarán todos sus pasos. NO se puede deshacer.`);
    if (!ok) return;
    try {
      await apiCall(`/api/planes/${this.activoId}`, { method: "DELETE" });
      const name = this.activoNombre;
      this.activoId = null; this.activoNombre = "";
      this.limpiarFormulario();
      await this.refresh();
      Toast.ok(`Proyecto "${name}" eliminado.`);
    } catch (e) {
      Toast.error("Error: " + e.message);
    }
  },

  cargar(id) {
    const p = this.items.find(x => x.id === id);
    if (!p) return;
    this.activoId = p.id;
    this.activoNombre = p.proyecto;
    document.getElementById("plan-proyecto").value = p.proyecto || "";
    document.getElementById("plan-proceso").value = p.proceso || "";
    document.getElementById("plan-fecha").value = p.fecha || hoyISO();
    const its = (p.items && p.items.length) ? p.items : [{}, {}, {}];
    this.rebuildItems(its);
    this.rebuildRadios();
  },

  limpiarFormulario() {
    document.getElementById("plan-proyecto").value = "";
    document.getElementById("plan-proceso").value = "";
    document.getElementById("plan-fecha").value = hoyISO();
    this.rebuildItems([{}, {}, {}]);
  },

  rebuildItems(items) {
    const cont = document.getElementById("plan-items");
    cont.innerHTML = "";
    items.forEach(it => this.addItem(it, false));
  },
  addItem(item = {}, focus = true) {
    const cont = document.getElementById("plan-items");
    const i = cont.children.length + 1;
    const row = document.createElement("div");
    row.className = "data-row" + (i % 2 === 0 ? " alt" : "");
    const fechaId = `plan-item-fecha-${Date.now()}-${i}`;
    row.innerHTML = `
      <div class="num-cell">${i}.</div>
      <div><textarea data-field="tema">${escapeHtml(item.tema || "")}</textarea></div>
      <div><textarea data-field="accion">${escapeHtml(item.accion || "")}</textarea></div>
      <div class="cell-input">
        <input type="text" id="${fechaId}" data-field="fecha" value="${escapeAttr(item.fecha || "")}" placeholder="YYYY-MM-DD" />
        <button onclick="abrirCalendario('${fechaId}')">📅</button>
      </div>
      <div><input type="text" data-field="responsable" value="${escapeAttr(item.responsable || "")}" /></div>`;
    cont.appendChild(row);
    if (focus) row.querySelector("textarea").focus();
  },
  delItem() {
    const c = document.getElementById("plan-items");
    if (c.lastElementChild) c.removeChild(c.lastElementChild);
  },

  recolectar() {
    const rows = document.querySelectorAll("#plan-items .data-row");
    const items = Array.from(rows).map(r => ({
      tema:        r.querySelector("[data-field='tema']").value.trim(),
      accion:      r.querySelector("[data-field='accion']").value.trim(),
      fecha:       r.querySelector("[data-field='fecha']").value.trim(),
      responsable: r.querySelector("[data-field='responsable']").value.trim(),
    }));
    return {
      proyecto: document.getElementById("plan-proyecto").value.trim(),
      proceso:  document.getElementById("plan-proceso").value.trim(),
      fecha:    document.getElementById("plan-fecha").value.trim(),
      items,
    };
  },

  async guardarSinPDF() {
    if (!this.activoId) { Toast.warn("Seleccioná o creá un proyecto primero."); return; }
    const data = this.recolectar();
    if (!data.proyecto) { Toast.warn("Ingresá el nombre del proyecto."); return; }
    try {
      await apiCall("/api/planes", { method: "POST", body: { id: this.activoId, ...data } });
      await this.refresh();
      Toast.ok(`Datos de «${this.activoNombre}» guardados.`);
    } catch (e) {
      Toast.error("Error: " + e.message);
    }
  },

  limpiar() { this.limpiarFormulario(); this.activoId = null; this.activoNombre = ""; this.rebuildRadios(); },

  async generar() {
    const data = this.recolectar();
    if (!data.proyecto) { Toast.warn("Ingresá el nombre del proyecto."); return; }
    if (!data.proceso) { Toast.warn("Ingresá el objetivo."); return; }
    const items = data.items.filter(it => it.tema);
    if (!items.length) { Toast.warn("Agregá al menos un paso al plan."); return; }

    let fechaFmt = data.fecha;
    try {
      const parts = data.fecha.split("-");
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
        if (!isNaN(d.getTime())) fechaFmt = `${d.getDate()} de ${MESES_ES[d.getMonth()]} de ${d.getFullYear()}`;
      }
    } catch {}
    data.fecha_fmt = fechaFmt;
    data.items = items;

    // Guardar primero
    if (this.activoId) {
      try {
        await apiCall("/api/planes", { method: "POST", body: { id: this.activoId, ...data } });
      } catch (e) {
        Toast.error("Error guardando: " + e.message);
        return;
      }
    } else {
      try {
        const { plan } = await apiCall("/api/planes", { method: "POST", body: data });
        this.activoId = plan.id;
        this.activoNombre = plan.proyecto;
      } catch (e) {
        Toast.error("Error guardando: " + e.message);
        return;
      }
    }

    try {
      const nombrePdf = `Plan_${safeFile(data.proyecto)}_${safeFile(data.proceso)}_${nowStamp()}.pdf`;
      pdfPlanAccion(data, nombrePdf);
      try {
        await apiCall("/api/vault", {
          method: "POST",
          body: {
            modulo: "Plan de Acción",
            referencia: data.proyecto,
            nombre_archivo: nombrePdf,
            data_snapshot: { tipo: "plan", data },
          }
        });
      } catch (e) { console.warn("Vault:", e.message); }
      Toast.ok(`PDF generado: ${nombrePdf}`);
      await this.refresh();
    } catch (e) {
      Toast.error("Error al generar PDF: " + e.message);
    }
  },
};

// ═══════════════════════════════════════════════════════════════════
//  MÓDULO VAULT
// ═══════════════════════════════════════════════════════════════════
const Vault = {
  lista: [],
  selId: null,

  async refrescar() {
    try {
      const { vault } = await apiCall("/api/vault");
      this.lista = vault || [];
      this.render();
    } catch (e) {
      Toast.error("Error cargando vault: " + e.message);
    }
  },

  render() {
    const cont = document.getElementById("vault-rows");
    cont.innerHTML = "";
    this.selId = null;
    if (!this.lista.length) {
      cont.innerHTML = '<div class="empty-msg">No hay informes registrados. Generá un PDF desde Tareas o Plan de Acción.</div>';
      return;
    }
    const session = window.__SESSION__ || {};
    this.lista.forEach((reg, i) => {
      const fecha = reg.creado_en
        ? new Date(reg.creado_en).toLocaleString("es-PA", { dateStyle: "short", timeStyle: "short" })
        : "";
      const dueno = reg.usuarios && reg.usuarios.username !== session.username
        ? ` <span style="color:#888;font-size:11px">(${escapeHtml(reg.usuarios.username)})</span>` : '';
      const row = document.createElement("div");
      row.className = "data-row" + (i % 2 === 1 ? " alt" : "");
      row.innerHTML = `
        <div class="num-cell">${i+1}</div>
        <div>${escapeHtml(fecha)}</div>
        <div>${escapeHtml(reg.modulo || "")}</div>
        <div>${escapeHtml(reg.referencia || "")}${dueno}</div>
        <div style="color: var(--sec-bg)">${escapeHtml(reg.nombre_archivo || "")}</div>`;
      row.onclick = () => this.seleccionar(reg.id);
      cont.appendChild(row);
    });
  },

  seleccionar(id) {
    this.selId = id;
    const rows = document.querySelectorAll("#vault-rows .data-row");
    rows.forEach((r, i) => r.classList.toggle("selected", this.lista[i] && this.lista[i].id === id));
  },

  registroSeleccionado() {
    if (this.selId === null) {
      Toast.warn("Hacé click sobre un registro de la lista primero.");
      return null;
    }
    return this.lista.find(r => r.id === this.selId);
  },

  descargarSel() {
    const reg = this.registroSeleccionado();
    if (!reg) return;
    if (!reg.data_snapshot) { Toast.error("Este registro no tiene datos para regenerar."); return; }
    try {
      if (reg.data_snapshot.tipo === "tareas") pdfTareas(reg.data_snapshot.data, reg.nombre_archivo);
      else if (reg.data_snapshot.tipo === "plan") pdfPlanAccion(reg.data_snapshot.data, reg.nombre_archivo);
      else { Toast.error("Tipo desconocido."); return; }
      Toast.ok(`PDF descargado: ${reg.nombre_archivo}`);
    } catch (e) { Toast.error("Error: " + e.message); }
  },

  async eliminarSel() {
    const reg = this.registroSeleccionado();
    if (!reg) return;
    const ok = await Modal.confirm("Eliminar registro",
      `¿Eliminar este registro del Vault?\n\nArchivo: ${reg.nombre_archivo}\nReferencia: ${reg.referencia}`);
    if (!ok) return;
    try {
      await apiCall(`/api/vault/${reg.id}`, { method: "DELETE" });
      await this.refrescar();
      Toast.ok("Registro eliminado.");
    } catch (e) { Toast.error("Error: " + e.message); }
  },
};

// ═══════════════════════════════════════════════════════════════════
//  GENERACIÓN DE PDFs (sin cambios respecto a la versión anterior)
// ═══════════════════════════════════════════════════════════════════
function pdfTareas(data, nombrePdf) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "letter" });
  const MARGIN = 18;
  const W = doc.internal.pageSize.getWidth() - 2 * MARGIN;

  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...C_AZUL);
  doc.text(`Tareas Diarias — ${data.nombre}`, MARGIN, MARGIN + 4);
  doc.setTextColor(...C_NEGRO);
  let y = MARGIN + 10;
  const enc = [["Profesional:", data.nombre], ["Fecha / Semana:", data.semana], ["Última Actualización:", data.actualizacion]];
  const LBL_W = 46;
  enc.forEach(([lbl, val]) => {
    doc.setFillColor(...C_HDR_BG).setDrawColor(...C_BORDE);
    doc.rect(MARGIN, y, LBL_W, 7, "FD");
    doc.setFillColor(...C_BLANCO);
    doc.rect(MARGIN + LBL_W, y, W - LBL_W, 7, "FD");
    doc.setFont("helvetica", "bold").setFontSize(10).text(" " + lbl, MARGIN + 1.5, y + 5);
    doc.setFont("helvetica", "normal").text(" " + (val || ""), MARGIN + LBL_W + 1.5, y + 5);
    y += 7;
  });
  y += 4;

  function seccion(txt) {
    doc.setFillColor(...C_AZUL).setTextColor(...C_BLANCO).setFont("helvetica", "bold").setFontSize(11);
    doc.rect(MARGIN, y, W, 7, "F");
    doc.text("  " + txt, MARGIN, y + 5);
    y += 8;
    doc.setTextColor(...C_NEGRO);
  }

  seccion("I. Objetivo Actual del Programa");
  doc.autoTable({
    startY: y,
    head: [["#", "Descripción del Objetivo"]],
    body: data.alcances.map((d, i) => [String(i+1), d]),
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: "helvetica", fontSize: 10, lineColor: C_BORDE, lineWidth: 0.2, cellPadding: 2 },
    headStyles: { fillColor: C_COL, textColor: C_BLANCO, fontStyle: "bold", lineColor: C_BORDE },
    columnStyles: { 0: { cellWidth: 14, halign: "center", fontStyle: "bold" }, 1: { cellWidth: W - 14 } },
    alternateRowStyles: { fillColor: C_ROW_A },
    theme: "grid",
  });
  y = doc.lastAutoTable.finalY + 6;

  if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = MARGIN; }
  seccion("II. Tareas por Prioridades");
  doc.autoTable({
    startY: y,
    head: [["#", "Tarea", "Observaciones"]],
    body: data.prioridades.map((p, i) => [String(i+1), p[0] || "", p[1] || ""]),
    margin: { left: MARGIN, right: MARGIN },
    styles: { font: "helvetica", fontSize: 10, lineColor: C_BORDE, lineWidth: 0.2, cellPadding: 2, valign: "top" },
    headStyles: { fillColor: C_COL, textColor: C_BLANCO, fontStyle: "bold", lineColor: C_BORDE },
    columnStyles: { 0: { cellWidth: 14, halign: "center", fontStyle: "bold" }, 1: { cellWidth: W - 14 - 46 }, 2: { cellWidth: 46 } },
    alternateRowStyles: { fillColor: C_ROW_A },
    theme: "grid",
  });
  doc.save(nombrePdf);
}

function pdfPlanAccion(data, nombrePdf) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth() - 28;
  const ML = 14;

  doc.setFillColor(...C_AZUL);
  doc.rect(ML, ML, W, 16, "F");
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...C_BLANCO);
  doc.text((data.proyecto || "").toUpperCase(), ML + W/2, ML + 6, { align: "center" });
  doc.setFontSize(11);
  doc.text(`PLAN DE ACCION — ${(data.proceso || "").toUpperCase()}`, ML + W/2, ML + 13, { align: "center" });

  let y = ML + 20;
  if (data.fecha_fmt) {
    doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(80, 80, 80);
    doc.text(data.fecha_fmt, ML + W/2, y, { align: "center" });
    y += 6;
  }
  const items = data.items.slice();
  while (items.length < 8) items.push({});
  doc.autoTable({
    startY: y,
    head: [["Item", "Tema", "Accion", "Fecha", "Responsable"]],
    body: items.map((it, i) => [String(i+1), it.tema || "", it.accion || "", it.fecha || "", it.responsable || ""]),
    margin: { left: ML, right: ML },
    styles: { font: "helvetica", fontSize: 8, lineColor: C_BORDE, lineWidth: 0.2, cellPadding: 2, valign: "middle" },
    headStyles: { fillColor: C_AZUL, textColor: C_BLANCO, fontStyle: "bold", fontSize: 8, lineColor: C_BORDE },
    columnStyles: {
      0: { cellWidth: W * 0.06, halign: "center", fontStyle: "bold", textColor: C_AZUL },
      1: { cellWidth: W * 0.29, valign: "top" },
      2: { cellWidth: W * 0.37, valign: "top" },
      3: { cellWidth: W * 0.14, halign: "center" },
      4: { cellWidth: W * 0.14, halign: "center", fontStyle: "bold", textColor: C_AZUL },
    },
    alternateRowStyles: { fillColor: C_CLARO },
    theme: "grid",
  });
  doc.save(nombrePdf);
}

// ═══════════════════════════════════════════════════════════════════
//  INICIALIZACIÓN — esperar a que auth.js dé el OK
// ═══════════════════════════════════════════════════════════════════
function pintarSesion() {
  const session = window.__SESSION__;
  if (!session) return;
  const cont = document.getElementById("session-info");
  if (!cont) return;
  const rol = ROLES[session.rol] || { icon: "", label: session.rol };
  const canManage = Auth.can("manage_users");
  cont.innerHTML = `
    <span class="role-badge">${rol.icon} ${rol.label}</span>
    <span>👤 ${escapeHtml(session.nombre)}</span>
    ${canManage ? '<button onclick="UsersUI.open()">👥 Usuarios</button>' : ''}
    <button onclick="Auth.logout()">🚪 Salir</button>
  `;
}

window.__APP_INIT_FN__ = function appInit() {
  // Conectar listeners de navegación
  document.querySelectorAll(".nav-btn").forEach(b => {
    b.addEventListener("click", () => activarModulo(b.dataset.module));
  });
  pintarSesion();
  Tareas.refresh();
  Plan.refresh();
  const f = document.getElementById("plan-fecha");
  if (f && !f.value) f.value = hoyISO();
};

// Escape global para cerrar calendario
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const cal = document.getElementById("cal-overlay");
    if (cal) cal.classList.remove("active");
  }
});
