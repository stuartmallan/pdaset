/* @ds-bundle: {"format":3,"namespace":"PegasusDesignSystem_8b8cad","components":[],"sourceHashes":{"preview/peg-datatable.js":"2dce3cc27271","preview/peg-select-lib.js":"7fdbad7e4981","ui_kits/contentmanager/ContentManagerApp.jsx":"64aea51153bc","ui_kits/coursefinder/CourseFinderApp.jsx":"a90f3af4a55c","ui_kits/myaccount/BookmarksScreen.jsx":"cc5c2fa49344","ui_kits/myaccount/DashboardScreen.jsx":"cc6a4ef268cc","ui_kits/myaccount/LoginScreen.jsx":"f3ec3f515869","ui_kits/myaccount/MyAccountPrimitives.jsx":"8287811459e8","ui_kits/myaccount/NotificationsScreen.jsx":"2f8f6eb45930","ui_kits/myaccount/PegShell.jsx":"94738452113a","ui_kits/myaccount/ProfileScreen.jsx":"55cd3f860ff7","ui_kits/shared/PegShellV2.jsx":"1eea738723ec","ui_kits/shared/Primitives.jsx":"8287811459e8","ui_kits/staffsearch/StaffSearchApp.jsx":"4820cce09498"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.PegasusDesignSystem_8b8cad = window.PegasusDesignSystem_8b8cad || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// preview/peg-datatable.js
try { (() => {
/* =========================================================================
   PegTable — minimal recreation of <peg-datatable> for the design-system
   preview page. Matches the API documented in skills/components/datatable.md
   so each storybook example can be expressed as a small config object.
   ========================================================================= */
(function () {
  "use strict";

  const ESCAPE = str => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const fa = name => `<i class="fa fa-${name}" aria-hidden="true"></i>`;
  const resolveFn = (val, ...args) => typeof val === "function" ? val(...args) : val;

  // --- peg-alert renderer (replaces toast) -------------------------------
  function pegShowAlert(slot, opts) {
    if (!slot) return;
    const type = opts.type || "info";
    const icon = opts.icon || (type === "success" ? "check-circle" : type === "danger" ? "warning" : "info-circle");
    slot.innerHTML = `
      <div class="peg-alert alert-${type}" role="alert">
        <span class="peg-alert-icon">${fa(icon)}</span>
        <div class="peg-alert-body">${opts.html ? opts.text : ESCAPE(opts.text)}</div>
        ${opts.dismissible === false ? "" : `<button type="button" class="peg-alert-close" aria-label="Dismiss">&times;</button>`}
      </div>`;
    const close = slot.querySelector(".peg-alert-close");
    if (close) close.addEventListener("click", () => {
      slot.innerHTML = "";
    });
    if (opts.autoDismiss !== false) {
      clearTimeout(slot._dtTimer);
      slot._dtTimer = setTimeout(() => {
        slot.innerHTML = "";
      }, opts.autoDismiss || 4500);
    }
  }
  window.pegShowAlert = pegShowAlert;

  // legacy toast shim — unused now, kept as no-op for safety
  window.pegToast = function () {};

  // --- Event log helper ----------------------------------------------------
  function logEvent(logEl, name, payload) {
    if (!logEl) return;
    if (logEl.querySelector(".empty")) logEl.innerHTML = "";
    const row = document.createElement("div");
    row.className = "ev";
    const safe = JSON.stringify(payload, (_k, v) => typeof v === "function" ? "[fn]" : v);
    row.innerHTML = `<span class="k">${ESCAPE(name)}</span> <span class="v">${ESCAPE(safe)}</span>`;
    logEl.prepend(row);
    while (logEl.children.length > 8) logEl.removeChild(logEl.lastChild);
  }

  // --- Build the final column list given data columns + auto-inserts -------
  // Each auto-spec: { kind: "accordion"|"selectable"|"fn", column: <data idx>, ... }
  // The skill says: column indices in filter/order/exports/auto-cols all refer
  // to data-column positions; the component resolves them automatically.
  function buildColumnLayout(dataColumns, autos) {
    // Final position == requested column index, but if multiple autos request
    // the same index we insert in spec order. We then re-map data columns into
    // whatever positions remain.
    const total = dataColumns.length + autos.length;
    const layout = new Array(total);
    // place autos first (they have explicit positions). Resolve clashes by
    // bumping later autos right one slot at a time.
    const sortedAutos = autos.map((a, i) => ({
      ...a,
      _i: i
    })).sort((a, b) => a.column - b.column || a._i - b._i);
    const used = new Set();
    sortedAutos.forEach(spec => {
      let pos = spec.column;
      while (used.has(pos)) pos++;
      if (pos >= total) pos = total - 1;
      while (used.has(pos)) pos--;
      used.add(pos);
      layout[pos] = {
        type: spec.kind,
        spec
      };
    });
    // fill remaining slots with data columns in order
    let dIdx = 0;
    for (let i = 0; i < total; i++) {
      if (!layout[i]) {
        layout[i] = {
          type: "data",
          spec: dataColumns[dIdx],
          dataIndex: dIdx
        };
        dIdx++;
      }
    }
    return layout;
  }
  function dataIdxToFinal(layout, dataIdx) {
    for (let i = 0; i < layout.length; i++) {
      if (layout[i].type === "data" && layout[i].dataIndex === dataIdx) return i;
    }
    return dataIdx;
  }

  // --- The PegTable controller --------------------------------------------
  class PegTable {
    constructor(host, opts) {
      this.host = host;
      this.id = opts.id || "peg-table";
      this.data = opts.tableData || [];
      this.columns = opts.columns || [];
      this.headings = opts.columnHeadings || [];
      this.order = opts.order || null;
      this.filters = Array.isArray(opts.filter) ? opts.filter : opts.filter ? [opts.filter] : [];
      this.exports = opts.exports || null;
      this.boxShadow = !!opts.boxShadow;
      this.fixedLayout = !!opts.fixedLayout;
      this.emptyTable = opts.emptyTable || "No data available in table";
      this.pageLength = opts.pageLength || 10;
      this.showEntries = opts.showEntries || null;
      this.accordion = opts.accordion || null;
      this.selectable = opts.selectable || null;
      this.functionButtons = !opts.functionButtons ? [] : Array.isArray(opts.functionButtons) ? opts.functionButtons : [opts.functionButtons];
      this.onSelectableRowsChanged = opts.onSelectableRowsChanged || (() => {});
      this.onSelectableBatchAction = opts.onSelectableBatchAction || (() => {});
      this.onFunctionButtonsAction = opts.onFunctionButtonsAction || (() => {});
      this.alertSlot = opts.alertSlot || null;

      // state
      this.search = "";
      this.colFilters = {};
      this.sortBy = null; // { col, dir } — col is FINAL idx (only data cols sortable)
      this.page = 0;
      this.expanded = new Set();
      this.selected = new Set();
      this.filtersOpen = false;

      // build auto cols
      const autos = [];
      if (this.selectable) autos.push({
        kind: "selectable",
        column: this.selectable.column
      });
      if (this.accordion) autos.push({
        kind: "accordion",
        column: this.accordion.column
      });
      this.functionButtons.forEach(g => autos.push({
        kind: "fn",
        column: g.column,
        group: g
      }));
      this.layout = buildColumnLayout(this.columns, autos);

      // initial sort
      if (this.order && this.order.length) {
        const [dataIdx, dir] = this.order[0];
        this.sortBy = {
          col: dataIdxToFinal(this.layout, dataIdx),
          dir
        };
      }

      // pre-selected
      if (this.selectable && typeof this.selectable.preSelected === "function") {
        let count = 0;
        this.data.forEach((row, i) => {
          const isPre = this.selectable.preSelected(row);
          const isDis = typeof this.selectable.disabled === "function" && this.selectable.disabled(row);
          if (isPre && isDis) {
            console.warn("[peg-datatable] Row matches both preSelected and disabled — skipped:", row);
            return;
          }
          if (isPre) {
            if (this.selectable.mode === "single" && count > 0) return;
            this.selected.add(i);
            count++;
          }
        });
      }
      this.render();
      // emit initial selection
      if (this.selectable) this.fireSelection();
    }

    // ---- Data view (search + col filters + sort) -------------------------
    rowsView() {
      let view = this.data.map((row, originalIndex) => ({
        row,
        originalIndex
      }));

      // column filters
      Object.entries(this.colFilters).forEach(([dataIdx, val]) => {
        if (!val) return;
        const colSpec = this.columns[dataIdx];
        view = view.filter(({
          row
        }) => {
          const cellVal = String(this.cellValue(colSpec, row));
          return cellVal === val;
        });
      });

      // search (across all visible data cells)
      if (this.search.trim()) {
        const q = this.search.trim().toLowerCase();
        view = view.filter(({
          row
        }) => this.columns.some(c => {
          return String(this.cellValue(c, row)).toLowerCase().includes(q);
        }));
      }

      // sort
      if (this.sortBy) {
        const item = this.layout[this.sortBy.col];
        if (item && item.type === "data") {
          const colSpec = item.spec;
          const dir = this.sortBy.dir === "desc" ? -1 : 1;
          view.sort((a, b) => {
            const av = this.cellValue(colSpec, a.row);
            const bv = this.cellValue(colSpec, b.row);
            if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
            return String(av).localeCompare(String(bv), undefined, {
              numeric: true
            }) * dir;
          });
        }
      }
      return view;
    }
    cellValue(col, row) {
      if (col.render && typeof col.render === "function") {
        // if render exists it's already string; we try to use raw data instead for sort/search/filter values
      }
      if (typeof col.data === "function") return col.data(row);
      if (typeof col.data === "string") return row[col.data];
      return "";
    }
    cellRender(col, row) {
      if (typeof col.render === "function") {
        const raw = typeof col.data === "string" ? row[col.data] : typeof col.data === "function" ? col.data(row) : null;
        return String(col.render(raw, "display", row));
      }
      const v = this.cellValue(col, row);
      return v == null ? "" : String(v);
    }

    // ---- Render ----------------------------------------------------------
    render() {
      this.host.innerHTML = "";
      const wrap = document.createElement("div");
      wrap.className = "pegasus-table" + (this.boxShadow ? " with-shadow" : "") + (this.fixedLayout ? " fixed-layout" : "");
      this.host.appendChild(wrap);
      const inner = document.createElement("div");
      inner.className = "dt-wrapper";
      wrap.appendChild(inner);
      this.renderExportsBar(wrap, inner);
      this.renderBatchToolbar(inner);
      this.renderControls(inner);
      this.renderFilterPanel(inner);
      this.renderTable(inner);
      this.renderFoot(inner);

      // toggle batch-active class
      if (this.selectable && this.selectable.mode === "multi" && this.selected.size > 0) {
        wrap.classList.add("batch-active");
      } else {
        wrap.classList.remove("batch-active");
      }
    }
    renderBatchToolbar(parent) {
      if (!(this.selectable && this.selectable.mode === "multi")) return;
      const bar = document.createElement("div");
      bar.className = "dt-batch-toolbar" + (this.selected.size > 0 ? " is-active" : "");
      const actions = (this.selectable.batchActions || []).slice(0, 4);
      bar.innerHTML = `
        <span class="dt-batch-count">
          <span class="badge">${this.selected.size}</span>
          ${this.selected.size === 1 ? "row selected" : "rows selected"}
        </span>
        <div class="dt-batch-actions">
          ${actions.map(a => `
            <button type="button" data-action="${ESCAPE(a.action)}">
              ${a.icon ? fa(a.icon) : ""} ${ESCAPE(a.text)}
            </button>`).join("")}
        </div>
        <button type="button" class="dt-batch-cancel">Cancel</button>
      `;
      bar.querySelectorAll(".dt-batch-actions button").forEach(b => {
        b.addEventListener("click", () => {
          const action = b.getAttribute("data-action");
          const selectedRows = [...this.selected].map(i => this.data[i]);
          this.onSelectableBatchAction({
            action,
            selectedRows
          });
        });
      });
      bar.querySelector(".dt-batch-cancel").addEventListener("click", () => {
        this.selected.clear();
        this.fireSelection();
        this.render();
      });
      parent.appendChild(bar);
    }
    renderControls(parent) {
      const ctl = document.createElement("div");
      ctl.className = "dt-controls";
      // length menu
      const baseLengths = [10, 25, 50, 100];
      const lengths = this.showEntries ? [Number(this.showEntries), ...baseLengths.filter(n => n !== Number(this.showEntries))] : baseLengths;
      const lengthHtml = `
        <div class="dt-length">
          <label>Show
            <select aria-label="Entries per page">
              ${lengths.map(n => `<option value="${n}" ${n === this.pageLength ? "selected" : ""}>${n}</option>`).join("")}
            </select>
            entries
          </label>
        </div>`;

      // single column-filter (renders inline if there's just one)
      let colFilterHtml = "";
      if (this.filters.length === 1) {
        const f = this.filters[0];
        colFilterHtml = this.renderInlineFilter(f);
      }
      // multi-filter toggle (text-link, rendered on the right)
      let multiToggleHtml = "";
      if (this.filters.length > 1) {
        const activeCount = this.filters.filter(f => f.type !== "sort" && this.colFilters[f.column]).length;
        const sortAny = this.filters.some(f => f.type === "sort");
        const chevIcon = this.filtersOpen ? "chevron-up" : "chevron-down";
        multiToggleHtml = `
          <button type="button" class="dt-filter-toggle ${this.filtersOpen ? "is-open" : ""}">
            ${fa(chevIcon)} ${sortAny ? "Sort & filter" : "Filters"}
            ${activeCount > 0 ? `<span class="badge">${activeCount}</span>` : ""}
          </button>`;
      }
      // search (magnifier icon now lives inside the input background)
      const searchHtml = `
        <div class="dt-search">
          <label>
            <span class="sr-only">Search</span>
            <input type="search" value="${ESCAPE(this.search)}" placeholder="Search" aria-label="Search table" />
          </label>
        </div>`;
      ctl.innerHTML = `
        <div class="dt-controls-left">${lengthHtml}${colFilterHtml}</div>
        <div class="dt-controls-right">${searchHtml}${multiToggleHtml}</div>
      `;
      parent.appendChild(ctl);

      // wire
      ctl.querySelector(".dt-length select").addEventListener("change", e => {
        this.pageLength = Number(e.target.value);
        this.page = 0;
        this.clearSelectionOnDraw();
        this.render();
      });
      const search = ctl.querySelector(".dt-search input");
      search.addEventListener("input", e => {
        this.search = e.target.value;
        this.page = 0;
        this.clearSelectionOnDraw();
        this.render();
        // keep focus
        const newSearch = this.host.querySelector(".dt-search input");
        if (newSearch) {
          newSearch.focus();
          newSearch.setSelectionRange(this.search.length, this.search.length);
        }
      });
      const tog = ctl.querySelector(".dt-filter-toggle");
      if (tog) tog.addEventListener("click", () => {
        this.filtersOpen = !this.filtersOpen;
        this.render();
      });
      // exports are wired in renderExportsBar
      // single inline filter wiring
      const inlineSel = ctl.querySelector(".dt-col-filter select");
      if (inlineSel && this.filters.length === 1) {
        const f = this.filters[0];
        inlineSel.addEventListener("change", e => {
          if (f.type === "sort") {
            this.sortBy = e.target.value ? {
              col: dataIdxToFinal(this.layout, f.column),
              dir: e.target.value
            } : null;
          } else {
            if (e.target.value) this.colFilters[f.column] = e.target.value;else delete this.colFilters[f.column];
          }
          this.page = 0;
          this.clearSelectionOnDraw();
          this.render();
        });
      }
    }
    renderExportsBar(wrap, inner) {
      if (!this.exports) return;
      const bar = document.createElement("div");
      bar.className = "dt-exports-bar";
      bar.innerHTML = `
        <button type="button" data-fmt="excel">${fa("file-excel-o")} Excel</button>
        <button type="button" data-fmt="csv">${fa("file-text-o")} CSV</button>
      `;
      // insert above the wrapper so exports float free of the bordered table block
      wrap.insertBefore(bar, inner);
      bar.querySelectorAll("button").forEach(b => {
        b.addEventListener("click", () => this.doExport(b.getAttribute("data-fmt")));
      });
    }
    renderInlineFilter(f) {
      if (f.type === "sort") {
        const cur = this.sortBy && this.sortBy.col === dataIdxToFinal(this.layout, f.column) ? this.sortBy.dir : "";
        return `
          <div class="dt-col-filter">
            <label>${ESCAPE(f.label || "Sort")}:
              <select aria-label="${ESCAPE(f.title || f.label)}">
                <option value="">—</option>
                <option value="asc"${cur === "asc" ? " selected" : ""}>A → Z</option>
                <option value="desc"${cur === "desc" ? " selected" : ""}>Z → A</option>
              </select>
            </label>
          </div>`;
      }
      const opts = this.uniqueColValues(f.column);
      const cur = this.colFilters[f.column] || "";
      return `
        <div class="dt-col-filter">
          <label>${ESCAPE(f.label || "Filter")}:
            <select aria-label="${ESCAPE(f.title || f.label)}">
              <option value="">All</option>
              ${opts.map(o => `<option value="${ESCAPE(o)}"${cur === o ? " selected" : ""}>${ESCAPE(o)}</option>`).join("")}
            </select>
          </label>
        </div>`;
    }
    uniqueColValues(dataIdx) {
      const col = this.columns[dataIdx];
      const seen = new Set();
      this.data.forEach(row => seen.add(String(this.cellValue(col, row))));
      return [...seen].sort();
    }
    renderFilterPanel(parent) {
      if (this.filters.length <= 1) return;
      const panel = document.createElement("div");
      panel.className = "dt-filter-panel" + (this.filtersOpen ? " is-open" : "");
      const fieldsHtml = this.filters.map(f => {
        if (f.type === "sort") {
          const cur = this.sortBy && this.sortBy.col === dataIdxToFinal(this.layout, f.column) ? this.sortBy.dir : "";
          return `
            <div class="dt-filter-field">
              <label>${ESCAPE(f.label)}</label>
              <select data-kind="sort" data-col="${f.column}">
                <option value="">—</option>
                <option value="asc"${cur === "asc" ? " selected" : ""}>A → Z</option>
                <option value="desc"${cur === "desc" ? " selected" : ""}>Z → A</option>
              </select>
            </div>`;
        }
        const opts = this.uniqueColValues(f.column);
        const cur = this.colFilters[f.column] || "";
        return `
          <div class="dt-filter-field">
            <label>${ESCAPE(f.label)}</label>
            <select data-kind="search" data-col="${f.column}">
              <option value="">All</option>
              ${opts.map(o => `<option value="${ESCAPE(o)}"${cur === o ? " selected" : ""}>${ESCAPE(o)}</option>`).join("")}
            </select>
          </div>`;
      }).join("");
      panel.innerHTML = `
        <div class="dt-filter-fields">${fieldsHtml}</div>
        <button type="button" class="dt-filter-reset">Reset filters</button>
      `;
      parent.appendChild(panel);
      panel.querySelectorAll("select").forEach(sel => {
        sel.addEventListener("change", () => {
          const col = Number(sel.dataset.col);
          if (sel.dataset.kind === "sort") {
            this.sortBy = sel.value ? {
              col: dataIdxToFinal(this.layout, col),
              dir: sel.value
            } : null;
          } else {
            if (sel.value) this.colFilters[col] = sel.value;else delete this.colFilters[col];
          }
          this.page = 0;
          this.clearSelectionOnDraw();
          this.render();
        });
      });
      panel.querySelector(".dt-filter-reset").addEventListener("click", () => {
        this.colFilters = {};
        this.sortBy = null;
        this.search = "";
        this.page = 0;
        this.clearSelectionOnDraw();
        this.render();
      });
    }
    renderTable(parent) {
      const tbl = document.createElement("table");
      tbl.id = this.id;
      // ---- thead ----
      const thead = document.createElement("thead");
      const trh = document.createElement("tr");
      this.layout.forEach((item, finalIdx) => {
        const th = document.createElement("th");
        let label = "";
        let cls = "";
        if (item.type === "data") {
          const h = this.headings[item.dataIndex];
          label = h ? h.text : "";
          if (h && h.align) cls = `text-${h.align}`;
        } else if (item.type === "selectable") {
          if (this.selectable.mode === "multi") {
            const visible = this.rowsView().slice(this.page * this.pageLength, this.page * this.pageLength + this.pageLength);
            const selectableRows = visible.filter(({
              row
            }) => !(typeof this.selectable.disabled === "function" && this.selectable.disabled(row)));
            const allSelected = selectableRows.length > 0 && selectableRows.every(({
              originalIndex
            }) => this.selected.has(originalIndex));
            const someSelected = selectableRows.some(({
              originalIndex
            }) => this.selected.has(originalIndex));
            label = `<input type="checkbox" class="peg-checkbox dt-select-all" ${allSelected ? "checked" : ""} aria-label="Select all rows" />`;
          } else {
            label = `<span class="sr-only">${ESCAPE(this.selectable.columnTitle || "")}</span>`;
          }
          th.setAttribute("data-no-sort", "");
        } else if (item.type === "accordion") {
          label = ESCAPE(this.accordion.columnTitle || "");
          th.setAttribute("data-no-sort", "");
        } else if (item.type === "fn") {
          label = ESCAPE(item.spec.group.columnTitle || "");
          th.setAttribute("data-no-sort", "");
        }
        if (cls) th.className = cls;
        if (item.type === "data") {
          th.classList.add("sorting");
          th.setAttribute("data-final-idx", finalIdx);
          if (this.sortBy && this.sortBy.col === finalIdx) {
            th.classList.add("sorting_" + this.sortBy.dir);
          }
          th.innerHTML = `${label}<span class="sort-arrows" aria-hidden="true"></span>`;
          th.addEventListener("click", () => this.toggleSort(finalIdx));
        } else {
          th.innerHTML = label;
        }
        trh.appendChild(th);
      });
      thead.appendChild(trh);
      tbl.appendChild(thead);

      // wire select-all
      const selAll = thead.querySelector(".dt-select-all");
      if (selAll) {
        if (selAll.checked) selAll.indeterminate = false;else {
          const visible = this.rowsView().slice(this.page * this.pageLength, this.page * this.pageLength + this.pageLength);
          const someSelected = visible.some(({
            originalIndex
          }) => this.selected.has(originalIndex));
          selAll.indeterminate = someSelected && !selAll.checked;
        }
        selAll.addEventListener("change", () => {
          const visible = this.rowsView().slice(this.page * this.pageLength, this.page * this.pageLength + this.pageLength);
          if (selAll.checked) {
            visible.forEach(({
              row,
              originalIndex
            }) => {
              if (!(typeof this.selectable.disabled === "function" && this.selectable.disabled(row))) {
                this.selected.add(originalIndex);
              }
            });
          } else {
            visible.forEach(({
              originalIndex
            }) => this.selected.delete(originalIndex));
          }
          this.fireSelection();
          this.render();
        });
      }

      // ---- tbody ----
      const tbody = document.createElement("tbody");
      const view = this.rowsView();
      const start = this.page * this.pageLength;
      const visible = view.slice(start, start + this.pageLength);
      if (visible.length === 0) {
        const tr = document.createElement("tr");
        tr.className = "empty";
        const td = document.createElement("td");
        td.colSpan = this.layout.length;
        td.textContent = this.emptyTable;
        tr.appendChild(td);
        tbody.appendChild(tr);
      } else {
        visible.forEach(({
          row,
          originalIndex
        }, displayIdx) => {
          const tr = document.createElement("tr");
          tr.dataset.originalIndex = originalIndex;
          if (this.expanded.has(originalIndex)) tr.classList.add("shown");
          this.layout.forEach(item => {
            const td = document.createElement("td");
            if (item.type === "data") {
              const h = this.headings[item.dataIndex];
              if (h && h.align) td.className = `text-${h.align}`;
              td.innerHTML = this.cellRender(item.spec, row);
            } else if (item.type === "selectable") {
              const dis = typeof this.selectable.disabled === "function" && this.selectable.disabled(row);
              const checked = this.selected.has(originalIndex);
              td.innerHTML = `<input type="checkbox" class="peg-checkbox" ${checked ? "checked" : ""} ${dis ? "disabled" : ""}
                aria-label="${ESCAPE(this.selectable.checkboxAriaLabel(row))}" />`;
              td.querySelector("input").addEventListener("change", e => {
                if (this.selectable.mode === "single") this.selected.clear();
                if (e.target.checked) this.selected.add(originalIndex);else this.selected.delete(originalIndex);
                this.fireSelection();
                this.render();
              });
            } else if (item.type === "accordion") {
              td.innerHTML = this.renderAccordionCell(row, originalIndex, displayIdx);
              const btn = td.querySelector(".toggle-details");
              if (btn && !btn.disabled) btn.addEventListener("click", () => this.toggleExpand(originalIndex));
            } else if (item.type === "fn") {
              td.innerHTML = this.renderFnCell(item.spec.group, row, displayIdx);
              this.wireFnCell(td, item.spec.group, row);
            }
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
          if (this.expanded.has(originalIndex) && this.accordion) {
            const childTr = document.createElement("tr");
            childTr.className = "dt-child";
            const childTd = document.createElement("td");
            childTd.colSpan = this.layout.length;
            // Mirror the real component: jQuery injects
            // <div class="peg-accordion-content">{ accordion.format(row) }</div>
            const block = document.createElement("div");
            block.className = "peg-accordion-content";
            block.innerHTML = this.accordion.format(row);
            childTd.appendChild(block);
            childTr.appendChild(childTd);
            tbody.appendChild(childTr);
          }
        });
      }
      tbl.appendChild(tbody);
      parent.appendChild(tbl);
    }
    renderAccordionCell(row, originalIndex, displayIdx) {
      const meta = {
        row: displayIdx
      };
      const hidden = resolveFn(this.accordion.hidden, row, meta);
      if (hidden) return "";
      const disabled = resolveFn(this.accordion.disabled, row, meta);
      const isOpen = this.expanded.has(originalIndex);
      const txt = resolveFn(this.accordion.buttonText, row, meta);
      const align = this.accordion.buttonAlign === "right" ? "justify-content-end" : "justify-content-start";
      const iconLeft = this.accordion.buttonIconPosition === "left";
      const icon = `<span class="fa fa-sm-font-size fa-chevron-down"></span>`;
      const label = txt ? `<span class="d-inline-block align-middle ${iconLeft ? "ml-1" : "mr-1"}">${ESCAPE(txt)}</span>` : "";
      const ariaLabel = txt ? "" : ` aria-label="${ESCAPE(resolveFn(this.accordion.buttonAriaLabel, row, meta) || "Toggle details")}"`;
      const inner = iconLeft ? icon + label : label + icon;
      const cls = "toggle-details" + (isOpen ? " open" : "");
      return `<div class="dt-accordion-cell"><div class="d-flex ${align}">
        <button type="button" class="${cls}"${disabled ? " disabled" : ""}${ariaLabel} aria-expanded="${isOpen}">
          ${inner}
        </button>
      </div></div>`;
    }
    renderFnCell(group, row, displayIdx) {
      const meta = {
        row: displayIdx
      };
      const html = group.buttons.map(btn => {
        const hidden = resolveFn(btn.hidden, row, meta);
        if (hidden) return "";
        const disabled = resolveFn(btn.disabled, row, meta);
        const text = ESCAPE(resolveFn(btn.text, row, meta) || "");
        const cls = btn.class ? ` ${ESCAPE(btn.class)}` : "";
        if (btn.type === "link") {
          const href = disabled ? "" : resolveFn(btn.href, row, meta) || "";
          const target = btn.openInNewTab ? ` target="_blank" rel="noopener"` : "";
          const ariaTitle = ` title="${text}" aria-label="${text}"`;
          return `<a${href ? ` href="${ESCAPE(href)}"` : ""}${target} class="dt-fn-link${cls}${disabled ? " is-disabled" : ""}"${ariaTitle}>
            ${fa(btn.icon)}
          </a>`;
        }
        return `<button type="button" class="dt-fn-btn${cls}" ${disabled ? "disabled" : ""}
          data-action="${ESCAPE(btn.action)}" title="${text}" aria-label="${text}">
          ${fa(btn.icon)}
        </button>`;
      }).join("");
      return `<div class="dt-fn-buttons">${html}</div>`;
    }
    wireFnCell(td, group, row) {
      td.querySelectorAll(".dt-fn-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const def = group.buttons.find(b => b.action === btn.dataset.action);
          if (!def) return;
          const params = def.params != null ? resolveFn(def.params, row, {}) : row;
          this.onFunctionButtonsAction({
            action: def.action,
            params
          });
        });
      });
    }
    renderFoot(parent) {
      const view = this.rowsView();
      const total = view.length;
      const totalPages = Math.max(1, Math.ceil(total / this.pageLength));
      if (this.page >= totalPages) this.page = totalPages - 1;
      const start = total === 0 ? 0 : this.page * this.pageLength + 1;
      const end = Math.min(total, (this.page + 1) * this.pageLength);
      const foot = document.createElement("div");
      foot.className = "dt-foot";
      foot.innerHTML = `
        <div class="dt-info">Showing ${start} to ${end} of ${total} entries${total !== this.data.length ? ` (filtered from ${this.data.length} total)` : ""}</div>
        <div class="dt-paginate">
          <button type="button" class="dt-prev" ${this.page === 0 ? "disabled" : ""}>‹ Previous</button>
          ${this.pageButtons(totalPages).map(p => `
            <button type="button" class="${p === this.page ? "is-active" : ""}" ${p === "…" ? "disabled" : ""} data-page="${p}">${p === "…" ? "…" : p + 1}</button>
          `).join("")}
          <button type="button" class="dt-next" ${this.page >= totalPages - 1 ? "disabled" : ""}>Next ›</button>
        </div>
      `;
      parent.appendChild(foot);
      foot.querySelector(".dt-prev").addEventListener("click", () => this.gotoPage(this.page - 1));
      foot.querySelector(".dt-next").addEventListener("click", () => this.gotoPage(this.page + 1));
      foot.querySelectorAll(".dt-paginate button[data-page]").forEach(b => {
        b.addEventListener("click", () => this.gotoPage(Number(b.dataset.page)));
      });
    }
    pageButtons(total) {
      // simple: show up to 7
      if (total <= 7) return Array.from({
        length: total
      }, (_, i) => i);
      const cur = this.page;
      const pages = new Set([0, 1, total - 1, total - 2, cur, cur - 1, cur + 1]);
      const sorted = [...pages].filter(p => p >= 0 && p < total).sort((a, b) => a - b);
      const out = [];
      for (let i = 0; i < sorted.length; i++) {
        if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("…");
        out.push(sorted[i]);
      }
      return out;
    }

    // ---- Actions ---------------------------------------------------------
    toggleSort(finalIdx) {
      if (!this.sortBy || this.sortBy.col !== finalIdx) {
        this.sortBy = {
          col: finalIdx,
          dir: "asc"
        };
      } else if (this.sortBy.dir === "asc") {
        this.sortBy = {
          col: finalIdx,
          dir: "desc"
        };
      } else {
        this.sortBy = null;
      }
      this.clearSelectionOnDraw();
      this.render();
    }
    toggleExpand(originalIndex) {
      if (this.expanded.has(originalIndex)) {
        this.expanded.delete(originalIndex);
      } else {
        if (!this.accordion.multipleExpanded) this.expanded.clear();
        this.expanded.add(originalIndex);
      }
      this.render();
    }
    gotoPage(p) {
      const total = Math.max(1, Math.ceil(this.rowsView().length / this.pageLength));
      this.page = Math.max(0, Math.min(p, total - 1));
      this.clearSelectionOnDraw();
      this.render();
    }
    clearSelectionOnDraw() {
      // skill says: selection clears on any draw (sort, search, filter, page, length change)
      if (this.selectable && this.selected.size > 0) {
        this.selected.clear();
        // fire empty selection
        this.onSelectableRowsChanged([]);
      }
    }
    fireSelection() {
      const rows = [...this.selected].map(i => this.data[i]);
      this.onSelectableRowsChanged(rows);
    }
    doExport(fmt) {
      const cols = this.exports && this.exports.options && this.exports.options.columns || null;
      const dataIndices = cols || this.columns.map((_, i) => i);
      const headers = dataIndices.map(i => this.headings[i] && this.headings[i].text).join(",");
      const rows = this.rowsView().map(({
        row
      }) => dataIndices.map(i => `"${String(this.cellValue(this.columns[i], row)).replace(/"/g, '""')}"`).join(",")).join("\n");
      const csv = headers + "\n" + rows;
      let msg = "";
      let type = "success";
      if (fmt === "copy") {
        navigator.clipboard?.writeText(csv);
        msg = `Copied <strong>${dataIndices.length}</strong> column${dataIndices.length === 1 ? "" : "s"} (${this.rowsView().length} rows) to the clipboard.`;
      } else if (fmt === "csv" || fmt === "excel") {
        const blob = new Blob([csv], {
          type: "text/csv;charset=utf-8"
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${this.id}.csv`;
        a.click();
        msg = `Downloaded <strong>${this.id}.csv</strong> with ${dataIndices.length} column${dataIndices.length === 1 ? "" : "s"} (${this.rowsView().length} rows).`;
      } else {
        type = "info";
        msg = `Print preview would render <strong>${dataIndices.length}</strong> column${dataIndices.length === 1 ? "" : "s"}.`;
      }
      if (this.alertSlot) pegShowAlert(this.alertSlot, {
        type,
        text: msg,
        html: true
      });
    }
  }
  window.PegTable = PegTable;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "preview/peg-datatable.js", error: String((e && e.message) || e) }); }

// preview/peg-select-lib.js
try { (() => {
/* ============================================================================
   PegSelect — minimal recreation of <peg-select> for the design-system preview.
   Faithful to peg-ui/src/components/forms/select.vue + _select.scss:
     · same DOM (.combobox > .peg-combobox-group > input + button + listbox)
     · same class names for hover/active/selected/grouped/no-results
     · same prop API (items, modelValue, multiple, grouped, exclude, placeholder,
       required, disabled, helpText)
     · same events (update:modelValue + select-setup)
   ========================================================================== */
(function () {
  "use strict";

  let _uid = 0;
  const uid = () => ++_uid;
  const escapeHtml = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const normaliseItems = (raw, grouped) => {
    if (!raw) return [];
    if (grouped) {
      return raw.map(g => ({
        name: g.name,
        items: (g.items || []).map(i => ({
          value: String(i.value),
          text: i.text ?? i.label ?? ""
        }))
      }));
    }
    return raw.map(i => ({
      value: String(i.value),
      text: i.text ?? i.label ?? ""
    }));
  };
  const findItem = (items, grouped, value) => {
    if (!value) return null;
    if (grouped) {
      for (const g of items) {
        const hit = g.items.find(it => it.value === value);
        if (hit) return hit;
      }
      return null;
    }
    return items.find(it => it.value === value) || null;
  };
  class PegSelect {
    constructor(host, opts) {
      this.host = host;
      this.opts = Object.assign({
        id: `peg-${uid()}`,
        name: "select",
        label: "",
        placeholder: "",
        items: [],
        grouped: false,
        multiple: false,
        required: false,
        disabled: false,
        helpText: "",
        exclude: [],
        modelValue: undefined
      }, opts || {});
      this.items = normaliseItems(this.opts.items, this.opts.grouped);
      this.exclude = Array.isArray(this.opts.exclude) ? this.opts.exclude.map(String) : this.opts.exclude ? String(this.opts.exclude).split(",").map(s => s.trim()) : [];
      this.value = this.opts.multiple ? [] : "";
      this.inputText = "";
      this.open = false;
      this.activeKey = null;
      this.focused = false;
      this._listeners = {
        "update:modelValue": [],
        "select-setup": []
      };
      this._mount();
      if (this.opts.modelValue !== undefined && this.opts.modelValue !== "") {
        this.setValue(this.opts.modelValue, true);
      }
      this.emit("select-setup", {
        name: this.opts.name,
        options: this.items
      });
    }
    on(evt, fn) {
      (this._listeners[evt] ||= []).push(fn);
      return this;
    }
    emit(evt, payload) {
      (this._listeners[evt] || []).forEach(fn => fn(payload));
    }
    setValue(value, silent = false) {
      if (this.opts.multiple) {
        const arr = Array.isArray(value) ? value.map(String) : value ? [String(value)] : [];
        this.value = arr;
        const items = arr.map(v => findItem(this.items, this.opts.grouped, v)).filter(Boolean);
        this.inputText = items.map(i => i.text).join(", ");
      } else {
        this.value = value ? String(value) : "";
        const item = findItem(this.items, this.opts.grouped, this.value);
        this.inputText = item ? item.text : "";
      }
      this._render();
      if (!silent) this.emit("update:modelValue", this.value);
    }
    setItems(rawItems) {
      this.items = normaliseItems(rawItems, this.opts.grouped);
      this.value = this.opts.multiple ? [] : "";
      this.inputText = "";
      this._render();
      this.emit("update:modelValue", this.value);
      this.emit("select-setup", {
        name: this.opts.name,
        options: this.items
      });
    }
    setDisabled(disabled) {
      this.opts.disabled = !!disabled;
      this._render();
    }
    setLoading(text) {
      this.opts.disabled = !!text;
      this.inputText = typeof text === "string" ? text : text ? "Loading…" : "";
      this._render();
    }
    _mount() {
      this.root = document.createElement("div");
      this.root.className = "combobox form-group";
      this.host.replaceChildren(this.root);
      this._render();
      this._bindGlobal();
    }
    _filteredItems() {
      const q = (this.inputText || "").trim().toLowerCase();
      const excludeSet = new Set(this.exclude);
      if (this._hasExactValue()) {
        if (this.opts.grouped) {
          return this.items.map(g => ({
            name: g.name,
            items: g.items.filter(i => !excludeSet.has(i.value))
          })).filter(g => g.items.length);
        }
        return this.items.filter(i => !excludeSet.has(i.value));
      }
      if (this.opts.grouped) {
        return this.items.map(g => ({
          name: g.name,
          items: g.items.filter(i => !excludeSet.has(i.value) && (q === "" || i.text.toLowerCase().includes(q)))
        })).filter(g => g.items.length);
      }
      return this.items.filter(i => !excludeSet.has(i.value) && (q === "" || i.text.toLowerCase().includes(q)));
    }
    _hasExactValue() {
      if (this.opts.multiple) {
        const segs = (this.inputText || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
        if (!segs.length) return false;
        const allItems = this.opts.grouped ? this.items.flatMap(g => g.items) : this.items;
        return segs.every(seg => allItems.some(it => it.text.toLowerCase() === seg));
      }
      const allItems = this.opts.grouped ? this.items.flatMap(g => g.items) : this.items;
      return !!allItems.find(it => it.text.toLowerCase() === (this.inputText || "").toLowerCase());
    }
    _flatFilteredKeys() {
      const f = this._filteredItems();
      if (this.opts.grouped) return f.flatMap(g => g.items.map(i => i.value));
      return f.map(i => i.value);
    }
    _render() {
      const {
        name,
        label,
        placeholder,
        required,
        disabled,
        helpText,
        grouped,
        multiple
      } = this.opts;
      const filtered = this._filteredItems();
      const isClearable = !disabled && !!this.inputText && (multiple ? this.value.length : this.value);
      this.root.className = "combobox form-group" + (disabled ? " disabled" : "") + (this.open ? " is-open" : "") + (isClearable ? " pr-4 clear-btn-visible" : "");
      const labelHtml = label ? `
        <div class="peg-label-wrapper">
          <div class="peg-label">
            <label for="peg-combobox-${escapeHtml(name)}">
              <span>${escapeHtml(label)}</span>${required ? `<span class="peg-required">*</span>` : ""}
            </label>
          </div>
        </div>
      ` : "";
      const groupHtml = `
        <div class="peg-combobox-group${this.focused ? " peg-combobox-focus" : ""}" role="presentation">
          <input
            id="peg-combobox-${escapeHtml(name)}"
            class="peg-combobox-input"
            name="${escapeHtml(name)}"
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="${this.open}"
            aria-controls="cb-listbox-${escapeHtml(name)}"
            autocomplete="off"
            placeholder="${escapeHtml(placeholder)}"
            value="${escapeHtml(this.inputText)}"
            ${required ? "required" : ""}
            ${disabled ? "disabled" : ""}
          />
          ${isClearable ? `
            <button type="button" class="peg-combobox-clear-button" aria-label="${escapeHtml(label)} clear selection" title="Clear selection">
              <i class="fa fa-times" aria-hidden="true"></i>
            </button>
          ` : ""}
          ${disabled ? "" : `
            <button type="button" class="peg-combobox-button" tabindex="-1"
              aria-expanded="${this.open}" aria-controls="cb-listbox-${escapeHtml(name)}"
              aria-label="${escapeHtml(label)}">
              <span aria-hidden="true"></span>
            </button>
          `}
        </div>
      `;
      const helpHtml = helpText ? `<small class="peg-help-text">${escapeHtml(helpText)}</small>` : "";
      let listboxHtml = `<ul class="peg-combobox-list-box" id="cb-listbox-${escapeHtml(name)}" role="listbox" aria-label="${escapeHtml(label)}" style="display:${this.open ? "block" : "none"};">`;
      if (grouped) {
        if (filtered.length === 0) {
          listboxHtml += `<li role="option" aria-disabled="true" class="peg-combobox-no-search-results">No data available</li>`;
        } else {
          filtered.forEach(g => {
            listboxHtml += `<li class="peg-combobox-group-section"><strong class="peg-combobox-group-name">${escapeHtml(g.name)}</strong><ul role="group">`;
            g.items.forEach(item => {
              const isSelected = multiple ? this.value.includes(item.value) : this.value === item.value;
              const isActive = this.activeKey === item.value;
              const cls = "peg-combobox-grouped-list-item" + (isActive ? " peg-combobox-active-list-item" : "") + (isSelected ? " peg-combobox-selected-list-item" : "");
              listboxHtml += `<li id="lb-${escapeHtml(name)}-${escapeHtml(item.value)}" role="option" class="${cls}" aria-selected="${isSelected}" data-value="${escapeHtml(item.value)}">${escapeHtml(item.text)}</li>`;
            });
            listboxHtml += `</ul></li>`;
          });
        }
      } else {
        if (filtered.length === 0) {
          listboxHtml += `<li role="option" aria-disabled="true" class="peg-combobox-no-search-results">No data available</li>`;
        } else {
          filtered.forEach(item => {
            const isSelected = multiple ? this.value.includes(item.value) : this.value === item.value;
            const isActive = this.activeKey === item.value;
            const cls = "peg-combobox-list-item" + (isActive ? " peg-combobox-active-list-item" : "") + (isSelected ? " peg-combobox-selected-list-item" : "");
            listboxHtml += `<li id="lb-${escapeHtml(name)}-${escapeHtml(item.value)}" role="option" class="${cls}" aria-selected="${isSelected}" data-value="${escapeHtml(item.value)}">${escapeHtml(item.text)}</li>`;
          });
        }
      }
      listboxHtml += `</ul>`;
      this.root.innerHTML = `${labelHtml}${groupHtml}${listboxHtml}${helpHtml}`;
      this._wire();
      this._syncListboxWidth();
    }
    _syncListboxWidth() {
      const group = this.root.querySelector(".peg-combobox-group");
      const list = this.root.querySelector(".peg-combobox-list-box");
      if (!group || !list) return;
      list.style.width = group.offsetWidth + "px";
    }
    _wire() {
      const input = this.root.querySelector(".peg-combobox-input");
      const btn = this.root.querySelector(".peg-combobox-button");
      const list = this.root.querySelector(".peg-combobox-list-box");
      const clear = this.root.querySelector(".peg-combobox-clear-button");
      input.addEventListener("input", e => {
        this.inputText = e.target.value;
        if (this.opts.multiple) this.value = [];else this.value = "";
        this.activeKey = null;
        this.open = true;
        this.emit("update:modelValue", this.value);
        this._render();
        const inp = this.root.querySelector(".peg-combobox-input");
        if (inp) {
          inp.focus();
          inp.selectionStart = inp.selectionEnd = this.inputText.length;
        }
      });
      input.addEventListener("focus", () => {
        this.focused = true;
        this._renderFocus();
      });
      input.addEventListener("blur", () => {
        setTimeout(() => {
          this.focused = false;
          this._renderFocus();
        }, 120);
      });
      input.addEventListener("click", e => {
        e.preventDefault();
        this.open = !this.open;
        this.activeKey = null;
        this._render();
      });
      input.addEventListener("keydown", e => this._onKey(e));
      if (btn) btn.addEventListener("click", () => {
        this.open = !this.open;
        this.activeKey = null;
        this._render();
        const inp = this.root.querySelector(".peg-combobox-input");
        if (inp) inp.focus();
      });
      list.querySelectorAll("[data-value]").forEach(li => {
        li.addEventListener("mousedown", e => e.preventDefault());
        li.addEventListener("click", () => this._pick(li.getAttribute("data-value")));
      });
      if (clear) clear.addEventListener("click", () => {
        this.inputText = "";
        this.value = this.opts.multiple ? [] : "";
        this.activeKey = null;
        this.emit("update:modelValue", this.value);
        this._render();
      });
    }
    _renderFocus() {
      const group = this.root.querySelector(".peg-combobox-group");
      if (!group) return;
      group.classList.toggle("peg-combobox-focus", this.focused);
    }
    _pick(value) {
      const item = findItem(this.items, this.opts.grouped, value);
      if (!item) return;
      if (this.opts.multiple) {
        const idx = this.value.indexOf(item.value);
        if (idx >= 0) this.value.splice(idx, 1);else this.value = [...this.value, item.value];
        const selectedItems = this.value.map(v => findItem(this.items, this.opts.grouped, v)).filter(Boolean);
        this.inputText = selectedItems.map(i => i.text).join(", ");
        this.emit("update:modelValue", this.value);
        this.activeKey = item.value;
        this._render();
        const inp = this.root.querySelector(".peg-combobox-input");
        if (inp) inp.focus();
      } else {
        this.value = item.value;
        this.inputText = item.text;
        this.open = false;
        this.activeKey = null;
        this.emit("update:modelValue", this.value);
        this._render();
      }
    }
    _onKey(e) {
      const keys = this._flatFilteredKeys();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!this.open) this.open = true;
        const idx = keys.indexOf(this.activeKey);
        this.activeKey = keys[idx < keys.length - 1 ? idx + 1 : 0] || null;
        this._render();
        this._scrollIntoView();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!this.open) this.open = true;
        const idx = keys.indexOf(this.activeKey);
        this.activeKey = keys[idx > 0 ? idx - 1 : keys.length - 1] || null;
        this._render();
        this._scrollIntoView();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (this.activeKey) this._pick(this.activeKey);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.open = false;
        this.activeKey = null;
        this._render();
      } else if (e.key === "Home") {
        if (this.open) {
          e.preventDefault();
          this.activeKey = keys[0] || null;
          this._render();
          this._scrollIntoView();
        }
      } else if (e.key === "End") {
        if (this.open) {
          e.preventDefault();
          this.activeKey = keys[keys.length - 1] || null;
          this._render();
          this._scrollIntoView();
        }
      } else if (e.key === "Tab") {
        this.open = false;
        this._render();
      }
    }
    _scrollIntoView() {
      if (!this.activeKey) return;
      const list = this.root.querySelector(".peg-combobox-list-box");
      const li = list?.querySelector(`[data-value="${this.activeKey}"]`);
      if (!li || !list) return;
      const liTop = li.offsetTop,
        liBottom = liTop + li.offsetHeight;
      const viewTop = list.scrollTop,
        viewBottom = viewTop + list.clientHeight;
      if (liTop < viewTop) list.scrollTop = liTop;else if (liBottom > viewBottom) list.scrollTop = liBottom - list.clientHeight;
    }
    _bindGlobal() {
      document.addEventListener("mousedown", e => {
        if (!this.root.contains(e.target) && this.open) {
          this.open = false;
          this.activeKey = null;
          if (!this._hasExactValue()) {
            if (this.opts.multiple) {
              const items = this.value.map(v => findItem(this.items, this.opts.grouped, v)).filter(Boolean);
              this.inputText = items.map(i => i.text).join(", ");
            } else if (this.value) {
              const item = findItem(this.items, this.opts.grouped, this.value);
              this.inputText = item ? item.text : "";
            } else {
              this.inputText = "";
            }
          }
          this._render();
        }
      });
    }
  }
  window.PegSelect = PegSelect;
})();

/* ============================================================================
   Domain fixture data — drives the PegArea / PegCountry / PegEthnicity /
   PegDisability / PegGender / PegHesrefDropdown / PegLovDropdown previews.
   ========================================================================== */
window.PegSelectFixtures = {
  // UCAS LEA (UK areas), grouped by region
  ucas_lea: [{
    name: "Scotland",
    items: [{
      value: "GLG",
      text: "Glasgow City"
    }, {
      value: "EDH",
      text: "City of Edinburgh"
    }, {
      value: "ABD",
      text: "Aberdeen City"
    }, {
      value: "HLD",
      text: "Highland"
    }, {
      value: "FIF",
      text: "Fife"
    }, {
      value: "STG",
      text: "Stirling"
    }]
  }, {
    name: "England",
    items: [{
      value: "LON",
      text: "Greater London"
    }, {
      value: "MAN",
      text: "Greater Manchester"
    }, {
      value: "WMD",
      text: "West Midlands"
    }, {
      value: "YOR",
      text: "Yorkshire and the Humber"
    }, {
      value: "MER",
      text: "Merseyside"
    }, {
      value: "BRI",
      text: "Bristol, City of"
    }]
  }, {
    name: "Wales",
    items: [{
      value: "CDF",
      text: "Cardiff"
    }, {
      value: "SWA",
      text: "Swansea"
    }, {
      value: "NPT",
      text: "Newport"
    }]
  }, {
    name: "Northern Ireland",
    items: [{
      value: "BEL",
      text: "Belfast"
    }, {
      value: "DRY",
      text: "Derry City and Strabane"
    }]
  }],
  // postal_country (HESREF) — alphabetical, UK pinned to top
  postal_country: [{
    value: "GB",
    text: "United Kingdom"
  }, {
    value: "AF",
    text: "Afghanistan"
  }, {
    value: "AL",
    text: "Albania"
  }, {
    value: "DZ",
    text: "Algeria"
  }, {
    value: "AR",
    text: "Argentina"
  }, {
    value: "AU",
    text: "Australia"
  }, {
    value: "AT",
    text: "Austria"
  }, {
    value: "BD",
    text: "Bangladesh"
  }, {
    value: "BE",
    text: "Belgium"
  }, {
    value: "BR",
    text: "Brazil"
  }, {
    value: "CA",
    text: "Canada"
  }, {
    value: "CN",
    text: "China"
  }, {
    value: "CO",
    text: "Colombia"
  }, {
    value: "DK",
    text: "Denmark"
  }, {
    value: "EG",
    text: "Egypt"
  }, {
    value: "FR",
    text: "France"
  }, {
    value: "DE",
    text: "Germany"
  }, {
    value: "GH",
    text: "Ghana"
  }, {
    value: "GR",
    text: "Greece"
  }, {
    value: "IN",
    text: "India"
  }, {
    value: "ID",
    text: "Indonesia"
  }, {
    value: "IE",
    text: "Ireland"
  }, {
    value: "IT",
    text: "Italy"
  }, {
    value: "JP",
    text: "Japan"
  }, {
    value: "KE",
    text: "Kenya"
  }, {
    value: "MY",
    text: "Malaysia"
  }, {
    value: "MX",
    text: "Mexico"
  }, {
    value: "NL",
    text: "Netherlands"
  }, {
    value: "NZ",
    text: "New Zealand"
  }, {
    value: "NG",
    text: "Nigeria"
  }, {
    value: "NO",
    text: "Norway"
  }, {
    value: "PK",
    text: "Pakistan"
  }, {
    value: "PH",
    text: "Philippines"
  }, {
    value: "PL",
    text: "Poland"
  }, {
    value: "PT",
    text: "Portugal"
  }, {
    value: "RU",
    text: "Russian Federation"
  }, {
    value: "SA",
    text: "Saudi Arabia"
  }, {
    value: "SG",
    text: "Singapore"
  }, {
    value: "ZA",
    text: "South Africa"
  }, {
    value: "KR",
    text: "South Korea"
  }, {
    value: "ES",
    text: "Spain"
  }, {
    value: "SE",
    text: "Sweden"
  }, {
    value: "CH",
    text: "Switzerland"
  }, {
    value: "TH",
    text: "Thailand"
  }, {
    value: "TR",
    text: "Turkey"
  }, {
    value: "AE",
    text: "United Arab Emirates"
  }, {
    value: "US",
    text: "United States"
  }, {
    value: "VN",
    text: "Vietnam"
  }, {
    value: "UNK",
    text: "Not known"
  }],
  // disability_type (HESREF) — HESA categories
  disability_type: [{
    value: "00",
    text: "No known disability"
  }, {
    value: "08",
    text: "Two or more impairments and/or disabling medical conditions"
  }, {
    value: "51",
    text: "Specific learning difficulty (e.g. dyslexia, dyspraxia)"
  }, {
    value: "53",
    text: "Social/communication impairment (e.g. autism, Asperger's syndrome)"
  }, {
    value: "54",
    text: "Long-standing illness or health condition"
  }, {
    value: "55",
    text: "Mental health condition"
  }, {
    value: "56",
    text: "Physical impairment or mobility issues"
  }, {
    value: "57",
    text: "Deaf or serious hearing impairment"
  }, {
    value: "58",
    text: "Blind or serious visual impairment"
  }, {
    value: "59",
    text: "A disability, impairment or medical condition not listed above"
  }, {
    value: "97",
    text: "Prefer not to say"
  }],
  // ethnicity (Pegasus API: /coredata/api/public/student/getregethnicity)
  ethnicity: [{
    value: "10",
    text: "White - British"
  }, {
    value: "11",
    text: "White - Irish"
  }, {
    value: "12",
    text: "White - Gypsy or Irish Traveller"
  }, {
    value: "19",
    text: "Other White background"
  }, {
    value: "31",
    text: "Mixed - White and Black Caribbean"
  }, {
    value: "32",
    text: "Mixed - White and Black African"
  }, {
    value: "33",
    text: "Mixed - White and Asian"
  }, {
    value: "34",
    text: "Other Mixed background"
  }, {
    value: "21",
    text: "Asian or Asian British - Indian"
  }, {
    value: "22",
    text: "Asian or Asian British - Pakistani"
  }, {
    value: "23",
    text: "Asian or Asian British - Bangladeshi"
  }, {
    value: "24",
    text: "Chinese"
  }, {
    value: "29",
    text: "Other Asian background"
  }, {
    value: "41",
    text: "Black or Black British - Caribbean"
  }, {
    value: "42",
    text: "Black or Black British - African"
  }, {
    value: "49",
    text: "Other Black background"
  }, {
    value: "50",
    text: "Arab"
  }, {
    value: "80",
    text: "Other ethnic background"
  }, {
    value: "90",
    text: "Not known"
  }, {
    value: "98",
    text: "Information refused"
  }],
  // sex (HESREF)
  sex: [{
    value: "1",
    text: "Male"
  }, {
    value: "2",
    text: "Female"
  }, {
    value: "3",
    text: "Other"
  }, {
    value: "4",
    text: "Prefer not to say"
  }],
  // title (HESREF)
  title: [{
    value: "MR",
    text: "Mr"
  }, {
    value: "MS",
    text: "Ms"
  }, {
    value: "MRS",
    text: "Mrs"
  }, {
    value: "MISS",
    text: "Miss"
  }, {
    value: "DR",
    text: "Dr"
  }, {
    value: "PROF",
    text: "Prof"
  }, {
    value: "MX",
    text: "Mx"
  }, {
    value: "REV",
    text: "Rev"
  }],
  // marital_status (HESREF)
  marital_status: [{
    value: "1",
    text: "Single"
  }, {
    value: "2",
    text: "Married"
  }, {
    value: "3",
    text: "Civil partnership"
  }, {
    value: "4",
    text: "Separated"
  }, {
    value: "5",
    text: "Divorced"
  }, {
    value: "6",
    text: "Widowed"
  }, {
    value: "9",
    text: "Prefer not to say"
  }],
  // qualification_type (HESREF) — UG path
  qualification_type_UG: [{
    value: "AL",
    text: "GCE A Level"
  }, {
    value: "AH",
    text: "SQA Advanced Higher"
  }, {
    value: "HG",
    text: "SQA Higher"
  }, {
    value: "IB",
    text: "International Baccalaureate"
  }, {
    value: "BTC",
    text: "BTEC Level 3"
  }, {
    value: "ACC",
    text: "Access course"
  }, {
    value: "FD",
    text: "Foundation degree"
  }, {
    value: "FY",
    text: "Foundation Year"
  }],
  // LOV: ALLDEPARTMENTS
  ALLDEPARTMENTS: [{
    value: "CIS",
    text: "Computer & Information Sciences"
  }, {
    value: "MATH",
    text: "Mathematics & Statistics"
  }, {
    value: "PHYS",
    text: "Physics"
  }, {
    value: "CHEM",
    text: "Pure & Applied Chemistry"
  }, {
    value: "ARCH",
    text: "Architecture"
  }, {
    value: "MECH",
    text: "Mechanical & Aerospace Engineering"
  }, {
    value: "DMEM",
    text: "Design, Manufacturing & Engineering Management"
  }, {
    value: "EEE",
    text: "Electronic & Electrical Engineering"
  }, {
    value: "MARK",
    text: "Marketing"
  }, {
    value: "MGT",
    text: "Strathclyde Business School (general)"
  }, {
    value: "LAW",
    text: "Law"
  }, {
    value: "EDU",
    text: "Education"
  }],
  // LOV: COURSES (UG)
  COURSES_UG: [{
    value: "CS101",
    text: "BSc Computer Science"
  }, {
    value: "CS102",
    text: "BSc Software Engineering"
  }, {
    value: "CS103",
    text: "BSc Computer & Electronic Systems"
  }, {
    value: "MATH",
    text: "BSc Mathematics"
  }, {
    value: "PHYS",
    text: "BSc Physics"
  }, {
    value: "MECH",
    text: "MEng Mechanical Engineering"
  }, {
    value: "AERO",
    text: "MEng Aero-Mechanical Engineering"
  }, {
    value: "EEE",
    text: "MEng Electronic & Electrical Engineering"
  }, {
    value: "MARK",
    text: "BA Business Enterprise"
  }, {
    value: "LAW",
    text: "LLB Law"
  }, {
    value: "ARCH",
    text: "MArch Architecture"
  }],
  // LOV: COURSES (PG)
  COURSES_PG: [{
    value: "MSC-DS",
    text: "MSc Data Analytics"
  }, {
    value: "MSC-CYB",
    text: "MSc Cyber Security"
  }, {
    value: "MSC-AI",
    text: "MSc Artificial Intelligence"
  }, {
    value: "MSC-MGT",
    text: "MSc International Management"
  }, {
    value: "MSC-FIN",
    text: "MSc Finance"
  }, {
    value: "PHD-CIS",
    text: "PhD Computer & Information Sciences"
  }]
};

/* ============================================================================
   Tiny helper to wire a PegSelect to a <pre data-model-for="…"> readout.
   ========================================================================== */
window.bindModelReadout = function (sel, id) {
  const pre = document.querySelector(`pre[data-model-for="${id}"]`);
  if (!pre) return;
  sel.on("update:modelValue", v => {
    pre.textContent = JSON.stringify(v, null, 2);
  });
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "preview/peg-select-lib.js", error: String((e && e.message) || e) }); }

// ui_kits/contentmanager/ContentManagerApp.jsx
try { (() => {
/* global React */
/* ContentManagerApp — Pegasus CMS for editable content blocks. */
const {
  useState,
  useMemo
} = React;
const BLOCKS = [{
  code: "LOGIN_WELCOME",
  app: "PEGASUS",
  type: "html",
  label: "Login welcome banner",
  updated: "2026-04-12",
  updatedBy: "mst",
  status: "published"
}, {
  code: "FOOTER_LINKS",
  app: "PEGASUS",
  type: "html",
  label: "Footer links",
  updated: "2026-03-01",
  updatedBy: "iom",
  status: "published"
}, {
  code: "SERVICE_MSG_2026Q2",
  app: "PEGASUS",
  type: "markdown",
  label: "Service message — Q2 outage",
  updated: "2026-04-18",
  updatedBy: "hjw",
  status: "draft"
}, {
  code: "COURSE_INTRO_UG",
  app: "COURSEFIND",
  type: "html",
  label: "Undergraduate intro (Course Finder)",
  updated: "2026-02-18",
  updatedBy: "ajr",
  status: "published"
}, {
  code: "STAFF_HELP_TEXT",
  app: "STAFF",
  type: "markdown",
  label: "Staff search help text",
  updated: "2026-01-22",
  updatedBy: "mst",
  status: "published"
}, {
  code: "HELPDESK_HOURS",
  app: "PEGASUS",
  type: "text",
  label: "Helpdesk opening hours",
  updated: "2026-04-02",
  updatedBy: "dgh",
  status: "published"
}, {
  code: "EXPIRED_PW_MSG",
  app: "PEGASUS",
  type: "html",
  label: "Password expired message",
  updated: "2025-11-10",
  updatedBy: "mst",
  status: "archived"
}, {
  code: "OPEN_DAY_BANNER",
  app: "COURSEFIND",
  type: "html",
  label: "Open day banner",
  updated: "2026-04-15",
  updatedBy: "eme",
  status: "draft"
}];
const ALL_SERVICES = [{
  code: "myaccount",
  name: "My Account"
}, {
  code: "coursefind",
  name: "Course Finder"
}, {
  code: "staff",
  name: "Staff Search"
}, {
  code: "content",
  name: "Content Manager"
}, {
  code: "bookmarks",
  name: "My Bookmarks"
}];
const STATUS_STYLE = {
  published: {
    color: "success",
    icon: "check-circle"
  },
  draft: {
    color: "warning",
    icon: "pencil"
  },
  archived: {
    color: "muted",
    icon: "archive"
  }
};
const COLS = [{
  key: "code",
  label: "Code"
}, {
  key: "label",
  label: "Label"
}, {
  key: "app",
  label: "App"
}, {
  key: "type",
  label: "Type"
}, {
  key: "updated",
  label: "Updated"
}, {
  key: "status",
  label: "Status"
}];
window.ContentManagerApp = function ContentManagerApp({
  onNav = () => {}
}) {
  const [q, setQ] = useState("");
  const [app, setApp] = useState("all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState(null);
  const [panel, setPanel] = useState(null);
  const [view, setView] = useState("blocks");
  const [sort, setSort] = useState({
    key: "updated",
    dir: "desc"
  });
  const [pageLength, setPageLength] = useState(5);
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const NEW_BLOCK = {
    code: "",
    app: "PEGASUS",
    type: "html",
    label: "",
    updated: "—",
    updatedBy: "you",
    status: "draft"
  };
  const NAV = [{
    key: "blocks",
    icon: "file-text-o",
    label: "Content blocks"
  }, {
    key: "recent",
    icon: "clock-o",
    label: "Recent changes",
    badge: "3"
  }, {
    key: "queue",
    icon: "history",
    label: "Publish queue"
  }, {
    key: "archived",
    icon: "archive",
    label: "Archived"
  }, {
    key: "help",
    icon: "question-circle",
    label: "Help"
  }];
  const filtered = useMemo(() => {
    const list = BLOCKS.filter(b => {
      if (view === "archived" && b.status !== "archived") return false;
      if (view !== "archived" && b.status === "archived") return false;
      if (view === "recent" && b.updated < "2026-04-01") return false;
      if (view === "queue" && b.status !== "draft") return false;
      if (q) {
        const hay = `${b.code} ${b.label} ${b.app}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (app !== "all" && b.app !== app) return false;
      if (status !== "all" && b.status !== status) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => String(a[sort.key]).localeCompare(String(b[sort.key])) * dir);
  }, [q, app, status, view, sort]);
  const filterCount = (app !== "all" ? 1 : 0) + (status !== "all" ? 1 : 0);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageLength));
  const curPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(curPage * pageLength, curPage * pageLength + pageLength);
  const rangeStart = total === 0 ? 0 : curPage * pageLength + 1;
  const rangeEnd = Math.min(total, curPage * pageLength + pageLength);
  const toggleSort = key => {
    setPage(0);
    setSort(s => s.key === key ? {
      key,
      dir: s.dir === "asc" ? "desc" : "asc"
    } : {
      key,
      dir: "asc"
    });
  };
  const goView = key => {
    setSelected(null);
    setView(key);
    setPage(0);
  };
  const sidebar = /*#__PURE__*/React.createElement("nav", {
    className: "peg-sb"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-sb-title"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      goView("blocks");
    }
  }, "Content Manager")), /*#__PURE__*/React.createElement("ul", {
    className: "peg-sb-list"
  }, NAV.map(n => /*#__PURE__*/React.createElement("li", {
    key: n.key,
    className: `peg-sb-item${view === n.key ? " is-active" : ""}`
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      goView(n.key);
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${n.icon}`
  }), /*#__PURE__*/React.createElement("span", null, n.label), n.badge ? /*#__PURE__*/React.createElement("span", {
    className: "peg-sb-badge"
  }, n.badge) : null)))));
  const VIEW_META = {
    blocks: {
      title: "Content blocks",
      lead: "Edit text and markup blocks served into Pegasus apps via the peg-content component. Changes go through the publish queue."
    },
    recent: {
      title: "Recent changes",
      lead: "Blocks edited since 1 April 2026."
    },
    queue: {
      title: "Publish queue",
      lead: "Drafts awaiting reviewer approval before they go live."
    },
    archived: {
      title: "Archived",
      lead: "Retired blocks no longer served to any application."
    },
    help: {
      title: "Help",
      lead: ""
    }
  };
  const crumbs = [{
    label: "Content Manager"
  }, {
    label: selected || creating ? creating ? "New block" : "Edit block" : VIEW_META[view].title
  }];
  const selectedBlock = selected ? BLOCKS.find(b => b.code === selected) : null;
  return /*#__PURE__*/React.createElement(PegShellV2, {
    userName: "Mr Hakan Juma-Walker",
    crumbs: crumbs,
    sidebar: sidebar,
    onNav: onNav,
    bookmarkCount: 2,
    notificationCount: 4,
    activePanel: panel,
    onTogglePanel: setPanel,
    services: ALL_SERVICES,
    onLogout: () => onNav("home")
  }, creating ? /*#__PURE__*/React.createElement(EditBlock, {
    block: NEW_BLOCK,
    isNew: true,
    onBack: () => setCreating(false)
  }) : selectedBlock ? /*#__PURE__*/React.createElement(EditBlock, {
    block: selectedBlock,
    onBack: () => setSelected(null)
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "peg-page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h1"
  }, VIEW_META[view].title), /*#__PURE__*/React.createElement("hr", {
    className: "peg-blue-hr"
  }), VIEW_META[view].lead ? /*#__PURE__*/React.createElement("p", {
    className: "peg-lead"
  }, VIEW_META[view].lead) : null), view !== "help" ? /*#__PURE__*/React.createElement(PegButton, {
    variant: "primary",
    icon: "plus",
    onClick: () => setCreating(true)
  }, "New block") : null), view === "help" ? /*#__PURE__*/React.createElement(PegCard, {
    title: "Using the Content Manager"
  }, /*#__PURE__*/React.createElement("p", {
    className: "peg-lead",
    style: {
      marginTop: 0
    }
  }, "Content blocks are keyed by an ", /*#__PURE__*/React.createElement("strong", null, "app"), " + ", /*#__PURE__*/React.createElement("strong", null, "code"), " and pulled into pages with ", /*#__PURE__*/React.createElement("code", null, "<peg-content application-name=\"PEGASUS\" code=\"LOGIN_WELCOME\" />"), "."), /*#__PURE__*/React.createElement("ul", {
    className: "cm-usage"
  }, /*#__PURE__*/React.createElement("li", null, "Edit a block, then ", /*#__PURE__*/React.createElement("strong", null, "Submit for review"), " \u2014 it enters the publish queue."), /*#__PURE__*/React.createElement("li", null, "A second editor approves it before it serves to live apps."), /*#__PURE__*/React.createElement("li", null, "Drafts are visible only in test environments."), /*#__PURE__*/React.createElement("li", null, "Archived blocks are retained for audit but served to no app."))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "pegasus-table"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-exports-bar"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-files-o"
  }), " Copy"), /*#__PURE__*/React.createElement("button", {
    type: "button"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-file-excel-o"
  }), " Excel"), /*#__PURE__*/React.createElement("button", {
    type: "button"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-file-text-o"
  }), " CSV")), /*#__PURE__*/React.createElement("div", {
    className: "dt-wrapper"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-controls"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-controls-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-length"
  }, /*#__PURE__*/React.createElement("label", null, "Show", /*#__PURE__*/React.createElement("select", {
    value: pageLength,
    onChange: e => {
      setPageLength(+e.target.value);
      setPage(0);
    }
  }, /*#__PURE__*/React.createElement("option", null, "5"), /*#__PURE__*/React.createElement("option", null, "10"), /*#__PURE__*/React.createElement("option", null, "25")), "entries")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "dt-filter-toggle",
    onClick: () => setFiltersOpen(o => !o)
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-filter"
  }), " Sort & filter", filterCount ? /*#__PURE__*/React.createElement("span", {
    className: "badge"
  }, filterCount) : null)), /*#__PURE__*/React.createElement("div", {
    className: "dt-controls-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-search"
  }, /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("input", {
    type: "search",
    placeholder: "Search\u2026",
    value: q,
    onChange: e => {
      setQ(e.target.value);
      setPage(0);
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    className: `dt-filter-panel${filtersOpen ? " is-open" : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-filter-fields"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-filter-field"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "cm-app"
  }, "Application"), /*#__PURE__*/React.createElement("select", {
    id: "cm-app",
    value: app,
    onChange: e => {
      setApp(e.target.value);
      setPage(0);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "All"), /*#__PURE__*/React.createElement("option", {
    value: "PEGASUS"
  }, "PEGASUS"), /*#__PURE__*/React.createElement("option", {
    value: "COURSEFIND"
  }, "Course Finder"), /*#__PURE__*/React.createElement("option", {
    value: "STAFF"
  }, "Staff Search"))), /*#__PURE__*/React.createElement("div", {
    className: "dt-filter-field"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "cm-status"
  }, "Status"), /*#__PURE__*/React.createElement("select", {
    id: "cm-status",
    value: status,
    onChange: e => {
      setStatus(e.target.value);
      setPage(0);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Any status"), /*#__PURE__*/React.createElement("option", {
    value: "published"
  }, "Published"), /*#__PURE__*/React.createElement("option", {
    value: "draft"
  }, "Draft"), /*#__PURE__*/React.createElement("option", {
    value: "archived"
  }, "Archived")))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "dt-filter-reset",
    onClick: () => {
      setApp("all");
      setStatus("all");
      setPage(0);
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-times"
  }), " Reset filters")), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, COLS.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    className: sort.key === c.key ? sort.dir === "asc" ? "sorting_asc" : "sorting_desc" : "",
    onClick: () => toggleSort(c.key)
  }, c.label, /*#__PURE__*/React.createElement("span", {
    className: "sort-arrows"
  }))), /*#__PURE__*/React.createElement("th", {
    "data-no-sort": true,
    className: "text-right"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", null, pageRows.map(b => {
    const s = STATUS_STYLE[b.status];
    return /*#__PURE__*/React.createElement("tr", {
      key: b.code
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("code", {
      className: "cm-code"
    }, b.code)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("a", {
      href: "#",
      onClick: e => {
        e.preventDefault();
        setSelected(b.code);
      }
    }, b.label)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: "cm-app-pill"
    }, b.app)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: "cm-type"
    }, b.type)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", null, b.updated), /*#__PURE__*/React.createElement("div", {
      className: "peg-small peg-muted"
    }, "by ", b.updatedBy)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("span", {
      className: `cm-status cm-status-${b.status}`
    }, /*#__PURE__*/React.createElement("i", {
      className: `fa fa-${s.icon}`
    }), " ", b.status)), /*#__PURE__*/React.createElement("td", {
      className: "cm-actions-cell text-right"
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "cm-icon-btn",
      title: "Edit",
      onClick: () => setSelected(b.code)
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa fa-pencil"
    })), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "cm-icon-btn",
      title: "Preview",
      onClick: () => setSelected(b.code)
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa fa-eye"
    })), /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "cm-icon-btn",
      title: "History"
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa fa-history"
    }))));
  }), !total ? /*#__PURE__*/React.createElement("tr", {
    className: "empty"
  }, /*#__PURE__*/React.createElement("td", {
    colSpan: COLS.length + 1
  }, "No matching content blocks")) : null)), /*#__PURE__*/React.createElement("div", {
    className: "dt-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-info"
  }, "Showing ", rangeStart, " to ", rangeEnd, " of ", total, " entries"), /*#__PURE__*/React.createElement("div", {
    className: "dt-paginate"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: curPage === 0,
    onClick: () => setPage(curPage - 1)
  }, "Previous"), Array.from({
    length: totalPages
  }, (_, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    type: "button",
    className: i === curPage ? "is-active" : "",
    onClick: () => setPage(i)
  }, i + 1)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: curPage >= totalPages - 1,
    onClick: () => setPage(curPage + 1)
  }, "Next"))))))));
};
function renderBlockHtml(type, src) {
  if (type === "markdown") {
    return src.replace(/^## (.*)$/gm, "<h3>$1</h3>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n\n/g, "</p><p>").replace(/^(?!<h3>)(.+)/, "<p>$1") + "</p>";
  }
  if (type === "text") return `<p>${src.replace(/</g, "&lt;")}</p>`;
  return src;
}
function EditBlock({
  block,
  onBack,
  isNew
}) {
  const [tab, setTab] = useState("source");
  const [meta, setMeta] = useState({
    code: block.code,
    label: block.label,
    app: block.app,
    type: block.type
  });
  const [saved, setSaved] = useState(false);
  const [value, setValue] = useState(isNew ? "" : block.type === "html" ? `<div class="alert alert-info">\n  <strong>Welcome to PEGASUS.</strong>\n  Please use your DS credentials to sign in.\n</div>` : block.type === "markdown" ? `## Scheduled outage\n\nOn **Sunday 4 May 2026** between 09:00–13:00 Pegasus will be unavailable while we\napply platform updates. Sorry for the inconvenience.` : `Monday to Friday, 08:30–17:30.`);
  const effType = isNew ? meta.type : block.type;
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    size: "sm",
    icon: "angle-left",
    onClick: onBack
  }, "Back to blocks")), /*#__PURE__*/React.createElement("div", {
    className: "cm-edit-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "peg-small peg-muted"
  }, isNew ? "New content block" : `${block.app} · ${block.type.toUpperCase()}`), /*#__PURE__*/React.createElement(PegHeading, {
    size: "h1"
  }, isNew ? meta.label || "Untitled block" : block.label), !isNew ? /*#__PURE__*/React.createElement("code", {
    className: "cm-code"
  }, block.code) : null, /*#__PURE__*/React.createElement("hr", {
    className: "peg-blue-hr"
  })), /*#__PURE__*/React.createElement("span", {
    className: `cm-status cm-status-${block.status}`
  }, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${STATUS_STYLE[block.status].icon}`
  }), " ", block.status)), saved ? /*#__PURE__*/React.createElement(PegAlert, {
    type: "success"
  }, isNew ? "Block created as a draft and submitted to the publish queue." : "Submitted for review — a reviewer will approve before it goes live.") : /*#__PURE__*/React.createElement(PegAlert, {
    type: "info"
  }, "Changes are stored as drafts and pushed to production through the publish queue. A reviewer must approve before content is served to live apps."), isNew ? /*#__PURE__*/React.createElement(PegCard, {
    title: "Block details",
    className: "cm-newmeta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cm-newmeta-grid"
  }, /*#__PURE__*/React.createElement(PegInput, {
    label: "Code",
    name: "new-code",
    value: meta.code,
    onChange: v => setMeta(m => ({
      ...m,
      code: (v || "").toUpperCase().replace(/[^A-Z0-9_]/g, "_")
    })),
    helpText: "UPPER_SNAKE_CASE"
  }), /*#__PURE__*/React.createElement(PegInput, {
    label: "Label",
    name: "new-label",
    value: meta.label,
    onChange: v => setMeta(m => ({
      ...m,
      label: v
    }))
  }), /*#__PURE__*/React.createElement("div", {
    className: "peg-form-group"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "new-app"
  }, "Application"), /*#__PURE__*/React.createElement("select", {
    id: "new-app",
    className: "peg-form-control",
    value: meta.app,
    onChange: e => setMeta(m => ({
      ...m,
      app: e.target.value
    }))
  }, /*#__PURE__*/React.createElement("option", {
    value: "PEGASUS"
  }, "PEGASUS"), /*#__PURE__*/React.createElement("option", {
    value: "COURSEFIND"
  }, "Course Finder"), /*#__PURE__*/React.createElement("option", {
    value: "STAFF"
  }, "Staff Search"))), /*#__PURE__*/React.createElement("div", {
    className: "peg-form-group"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "new-type"
  }, "Type"), /*#__PURE__*/React.createElement("select", {
    id: "new-type",
    className: "peg-form-control",
    value: meta.type,
    onChange: e => setMeta(m => ({
      ...m,
      type: e.target.value
    }))
  }, /*#__PURE__*/React.createElement("option", {
    value: "html"
  }, "html"), /*#__PURE__*/React.createElement("option", {
    value: "markdown"
  }, "markdown"), /*#__PURE__*/React.createElement("option", {
    value: "text"
  }, "text"))))) : null, /*#__PURE__*/React.createElement("div", {
    className: "cm-edit-grid"
  }, /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement("div", {
    className: "tabs-container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tablist"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tabs",
    role: "tablist"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "tab",
    className: `btn tab-button${tab === "source" ? " btn-primary active" : ""}`,
    "aria-selected": tab === "source",
    onClick: () => setTab("source")
  }, "Source"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "tab",
    className: `btn tab-button${tab === "preview" ? " btn-primary active" : ""}`,
    "aria-selected": tab === "preview",
    onClick: () => setTab("preview")
  }, "Preview"), !isNew ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "tab",
    className: `btn tab-button${tab === "diff" ? " btn-primary active" : ""}`,
    "aria-selected": tab === "diff",
    onClick: () => setTab("diff")
  }, "Diff vs live") : null))), tab === "source" ? /*#__PURE__*/React.createElement("div", {
    className: "vue-editor"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ck-editor"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ck-toolbar",
    role: "toolbar",
    "aria-label": "Editor toolbar"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ck-button",
    title: "Bold"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-bold"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ck-button",
    title: "Italic"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-italic"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ck-button",
    title: "Link"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-link"
  })), /*#__PURE__*/React.createElement("span", {
    className: "ck-toolbar__separator"
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ck-button",
    title: "Bulleted list"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-list-ul"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ck-button",
    title: "Numbered list"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-list-ol"
  })), /*#__PURE__*/React.createElement("span", {
    className: "ck-toolbar__separator"
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ck-button",
    title: "Insert token"
  }, "#")), /*#__PURE__*/React.createElement("textarea", {
    className: "ck-source",
    value: value,
    onChange: e => {
      setValue(e.target.value);
      setSaved(false);
    },
    placeholder: isNew ? `Enter the ${effType} content for this block…` : undefined,
    spellCheck: false
  }))) : tab === "preview" ? /*#__PURE__*/React.createElement("div", {
    className: "peg-content-wrapper cm-preview",
    dangerouslySetInnerHTML: {
      __html: value.trim() ? renderBlockHtml(effType, value) : '<p class="peg-muted">Nothing to preview yet.</p>'
    }
  }) : /*#__PURE__*/React.createElement("div", {
    className: "cm-diff"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cm-diff-old"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cm-diff-tag"
  }, "live"), /*#__PURE__*/React.createElement("pre", null, block.type === "text" ? "Monday to Friday, 09:00\u201317:00." : "(previously published version)")), /*#__PURE__*/React.createElement("div", {
    className: "cm-diff-new"
  }, /*#__PURE__*/React.createElement("span", {
    className: "cm-diff-tag"
  }, "draft"), /*#__PURE__*/React.createElement("pre", null, value))), /*#__PURE__*/React.createElement("div", {
    className: "cm-editor-footer"
  }, /*#__PURE__*/React.createElement("span", {
    className: "peg-small peg-muted"
  }, value.length, " characters", isNew ? "" : " · last saved 2m ago"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    size: "sm",
    icon: "rotate-left",
    onClick: () => {
      setValue("");
      setSaved(false);
    }
  }, isNew ? "Clear" : "Revert"), /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    size: "sm",
    icon: "save",
    onClick: () => setSaved(true)
  }, "Save draft"), /*#__PURE__*/React.createElement(PegButton, {
    variant: "primary",
    size: "sm",
    icon: "paper-plane",
    disabled: isNew && (!meta.code || !meta.label || !value.trim()),
    onClick: () => setSaved(true)
  }, isNew ? "Create block" : "Submit for review")))), /*#__PURE__*/React.createElement("aside", {
    className: "cm-edit-aside"
  }, /*#__PURE__*/React.createElement(PegCard, {
    title: "Usage"
  }, /*#__PURE__*/React.createElement("p", {
    className: "peg-small peg-muted"
  }, "Pull this block into a page:"), /*#__PURE__*/React.createElement("pre", {
    className: "cm-snippet"
  }, "<peg-content", "\n", "  application-name=\"", isNew ? meta.app || "APP" : block.app, "\"", "\n", "  code=\"", isNew ? meta.code || "CODE" : block.code, "\" />"), !isNew ? /*#__PURE__*/React.createElement("ul", {
    className: "cm-usage"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "login.vue"), " (PEGASUS)"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("code", null, "mobile-login.vue"), " (PEGASUS)")) : null), !isNew ? /*#__PURE__*/React.createElement(PegCard, {
    title: "Metadata"
  }, /*#__PURE__*/React.createElement("dl", {
    className: "cm-meta"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Code"), /*#__PURE__*/React.createElement("dd", null, block.code)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Application"), /*#__PURE__*/React.createElement("dd", null, block.app)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Type"), /*#__PURE__*/React.createElement("dd", null, block.type)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Updated"), /*#__PURE__*/React.createElement("dd", null, block.updated)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "By"), /*#__PURE__*/React.createElement("dd", null, block.updatedBy)))) : null, !isNew ? /*#__PURE__*/React.createElement(PegCard, {
    title: "History"
  }, /*#__PURE__*/React.createElement("ul", {
    className: "cm-history"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("div", null, "2026-04-12"), /*#__PURE__*/React.createElement("div", null, "mst \xB7 published")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("div", null, "2026-04-02"), /*#__PURE__*/React.createElement("div", null, "dgh \xB7 draft")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("div", null, "2026-03-11"), /*#__PURE__*/React.createElement("div", null, "iom \xB7 published")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("div", null, "2026-01-22"), /*#__PURE__*/React.createElement("div", null, "mst \xB7 published")))) : null)));
}
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/contentmanager/ContentManagerApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/coursefinder/CourseFinderApp.jsx
try { (() => {
/* global React */
/* CourseFinderApp — Pegasus sub-app for finding courses.
   Uses PegShellV2 from shared/. Data is mocked. */
const {
  useState,
  useMemo
} = React;
const FACULTIES = [{
  code: "ENG",
  label: "Engineering"
}, {
  code: "HASS",
  label: "Humanities & Social Sciences"
}, {
  code: "SCI",
  label: "Science"
}, {
  code: "SBS",
  label: "Strathclyde Business School"
}];
const LEVELS = ["Undergraduate", "Postgraduate taught", "Postgraduate research", "Short courses"];
const MODES = ["Full-time", "Part-time", "Online"];
const COURSES = [{
  code: "AEROSPG-001",
  title: "Aero-Mechanical Engineering BEng",
  faculty: "ENG",
  level: "Undergraduate",
  mode: "Full-time",
  credits: 480,
  duration: "4 years",
  uk: "£9,535",
  intl: "£28,800",
  starts: "Sep 2026",
  places: 120
}, {
  code: "MECH-MENG-002",
  title: "Mechanical Engineering MEng",
  faculty: "ENG",
  level: "Undergraduate",
  mode: "Full-time",
  credits: 600,
  duration: "5 years",
  uk: "£9,535",
  intl: "£30,400",
  starts: "Sep 2026",
  places: 95
}, {
  code: "ELEC-UG-034",
  title: "Electronic & Electrical Engineering BEng",
  faculty: "ENG",
  level: "Undergraduate",
  mode: "Full-time",
  credits: 480,
  duration: "4 years",
  uk: "£9,535",
  intl: "£28,800",
  starts: "Sep 2026",
  places: 80
}, {
  code: "MATH-UG-110",
  title: "Mathematics & Statistics BSc",
  faculty: "SCI",
  level: "Undergraduate",
  mode: "Full-time",
  credits: 480,
  duration: "4 years",
  uk: "£9,535",
  intl: "£24,600",
  starts: "Sep 2026",
  places: 60
}, {
  code: "COMP-UG-041",
  title: "Computer Science BSc",
  faculty: "SCI",
  level: "Undergraduate",
  mode: "Full-time",
  credits: 480,
  duration: "4 years",
  uk: "£9,535",
  intl: "£28,800",
  starts: "Sep 2026",
  places: 140
}, {
  code: "MBA-PT-001",
  title: "MBA",
  faculty: "SBS",
  level: "Postgraduate taught",
  mode: "Part-time",
  credits: 180,
  duration: "2 years",
  uk: "£25,500",
  intl: "£34,900",
  starts: "Jan 2027",
  places: 50
}, {
  code: "BUSA-MSC-99",
  title: "Business Analysis & Consulting MSc",
  faculty: "SBS",
  level: "Postgraduate taught",
  mode: "Full-time",
  credits: 180,
  duration: "12 months",
  uk: "£14,400",
  intl: "£22,350",
  starts: "Sep 2026",
  places: 70
}, {
  code: "PSYC-UG-055",
  title: "Psychology BA",
  faculty: "HASS",
  level: "Undergraduate",
  mode: "Full-time",
  credits: 480,
  duration: "4 years",
  uk: "£9,535",
  intl: "£22,400",
  starts: "Sep 2026",
  places: 110
}, {
  code: "LAW-UG-008",
  title: "Law LLB",
  faculty: "HASS",
  level: "Undergraduate",
  mode: "Full-time",
  credits: 480,
  duration: "4 years",
  uk: "£9,535",
  intl: "£19,900",
  starts: "Sep 2026",
  places: 180
}, {
  code: "DS-PGT-211",
  title: "Data Analytics MSc",
  faculty: "SCI",
  level: "Postgraduate taught",
  mode: "Online",
  credits: 180,
  duration: "24 months",
  uk: "£12,900",
  intl: "£17,800",
  starts: "Sep 2026",
  places: 60
}, {
  code: "PHD-AERO-89",
  title: "Aerospace Engineering PhD",
  faculty: "ENG",
  level: "Postgraduate research",
  mode: "Full-time",
  credits: 540,
  duration: "3 years",
  uk: "£5,200",
  intl: "£25,450",
  starts: "Rolling",
  places: 12
}, {
  code: "SHORT-WEL-01",
  title: "Resilience & Wellbeing (short course)",
  faculty: "HASS",
  level: "Short courses",
  mode: "Online",
  credits: 20,
  duration: "6 weeks",
  uk: "£650",
  intl: "£650",
  starts: "6 Jul 2026",
  places: 250
}];
const ALL_SERVICES = [{
  code: "myaccount",
  name: "My Account"
}, {
  code: "coursefind",
  name: "Course Finder"
}, {
  code: "staff",
  name: "Staff Search"
}, {
  code: "addr",
  name: "Address Finder"
}, {
  code: "content",
  name: "Content Manager"
}, {
  code: "svc",
  name: "Service Finder"
}, {
  code: "bookmarks",
  name: "My Bookmarks"
}, {
  code: "annc",
  name: "Announcements"
}];
window.CourseFinderApp = function CourseFinderApp({
  onNav = () => {}
}) {
  const [q, setQ] = useState("");
  const [faculty, setFaculty] = useState("all");
  const [level, setLevel] = useState("all");
  const [mode, setMode] = useState("all");
  const [selected, setSelected] = useState(null);
  const [saved, setSaved] = useState([]);
  const [panel, setPanel] = useState(null);
  const [sort, setSort] = useState({
    key: "title",
    dir: "asc"
  });
  const [pageLength, setPageLength] = useState(5);
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState("find");
  const NAV = [{
    key: "find",
    icon: "search",
    label: "Find a course"
  }, {
    key: "faculty",
    icon: "graduation-cap",
    label: "By faculty"
  }, {
    key: "opendays",
    icon: "calendar",
    label: "Open days"
  }, {
    key: "saved",
    icon: "bookmark",
    label: "Saved courses"
  }, {
    key: "apply",
    icon: "file-text-o",
    label: "How to apply"
  }, {
    key: "help",
    icon: "question-circle",
    label: "Help"
  }];
  const LEVEL_TABS = [{
    key: "all",
    name: "All levels"
  }, ...LEVELS.map(l => ({
    key: l,
    name: l
  }))];
  const filtered = useMemo(() => {
    const list = COURSES.filter(c => {
      if (q && !c.title.toLowerCase().includes(q.toLowerCase()) && !c.code.toLowerCase().includes(q.toLowerCase())) return false;
      if (faculty !== "all" && c.faculty !== faculty) return false;
      if (level !== "all" && c.level !== level) return false;
      if (mode !== "all" && c.mode !== mode) return false;
      if (view === "saved" && !saved.includes(c.code)) return false;
      return true;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      const av = sort.key === "faculty" ? FACULTIES.find(f => f.code === a.faculty).label : a[sort.key];
      const bv = sort.key === "faculty" ? FACULTIES.find(f => f.code === b.faculty).label : b[sort.key];
      return String(av).localeCompare(String(bv), undefined, {
        numeric: true
      }) * dir;
    });
  }, [q, faculty, level, mode, sort]);
  const filterCount = (faculty !== "all" ? 1 : 0) + (mode !== "all" ? 1 : 0);
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageLength));
  const curPage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(curPage * pageLength, curPage * pageLength + pageLength);
  const rangeStart = total === 0 ? 0 : curPage * pageLength + 1;
  const rangeEnd = Math.min(total, curPage * pageLength + pageLength);
  const toggleSort = key => {
    setPage(0);
    setSort(s => s.key === key ? {
      key,
      dir: s.dir === "asc" ? "desc" : "asc"
    } : {
      key,
      dir: "asc"
    });
  };
  const toggleSaved = code => setSaved(s => s.includes(code) ? s.filter(x => x !== code) : [...s, code]);
  const sidebar = /*#__PURE__*/React.createElement("nav", {
    className: "peg-sb",
    "aria-label": "Course Finder"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-sb-title"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      setView("find");
      setSelected(null);
    }
  }, "Course Finder")), /*#__PURE__*/React.createElement("ul", {
    className: "peg-sb-list"
  }, NAV.map(n => /*#__PURE__*/React.createElement("li", {
    key: n.key,
    className: `peg-sb-item${view === n.key ? " is-active" : ""}`
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      setView(n.key);
      setSelected(null);
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${n.icon}`
  }), /*#__PURE__*/React.createElement("span", null, n.label), n.key === "saved" && saved.length ? /*#__PURE__*/React.createElement("span", {
    className: "peg-sb-badge"
  }, saved.length) : null)))));
  const crumbs = [{
    label: "Course Finder"
  }, {
    label: selected ? "Course details" : "Search results"
  }];
  return /*#__PURE__*/React.createElement(PegShellV2, {
    userName: "Dr Martin Stewart",
    crumbs: crumbs,
    sidebar: sidebar,
    onNav: onNav,
    bookmarkCount: saved.length,
    notificationCount: 2,
    activePanel: panel,
    onTogglePanel: setPanel,
    services: ALL_SERVICES,
    onLogout: () => onNav("home")
  }, selected ? /*#__PURE__*/React.createElement(CourseDetails, {
    course: COURSES.find(c => c.code === selected),
    onBack: () => setSelected(null),
    saved: saved.includes(selected),
    onToggleSaved: () => toggleSaved(selected)
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "peg-page-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h1"
  }, {
    find: "Course Finder",
    faculty: "Browse by faculty",
    opendays: "Open days",
    saved: "Saved courses",
    apply: "How to apply",
    help: "Help"
  }[view]), /*#__PURE__*/React.createElement("hr", {
    className: "peg-blue-hr"
  }), /*#__PURE__*/React.createElement("p", {
    className: "peg-lead"
  }, {
    find: "Browse and compare the 500+ undergraduate and postgraduate programmes on offer. Filter by faculty, level and study mode.",
    faculty: "Explore programmes grouped by academic faculty.",
    opendays: "Register for an upcoming campus or virtual open day.",
    saved: "Courses you've bookmarked. They also appear in your Pegasus bookmarks.",
    apply: "How to apply for 2026 entry via UCAS and direct application.",
    help: "Guidance on using Course Finder."
  }[view]))), view === "faculty" ? /*#__PURE__*/React.createElement("div", {
    className: "cf-faculty-grid"
  }, FACULTIES.map(f => /*#__PURE__*/React.createElement(PegCard, {
    key: f.code,
    title: f.label,
    onClick: () => {
      setFaculty(f.code);
      setView("find");
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "peg-muted",
    style: {
      margin: 0
    }
  }, COURSES.filter(c => c.faculty === f.code).length, " programmes")))) : view === "opendays" ? /*#__PURE__*/React.createElement(PegCard, {
    title: "Next open day"
  }, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-calendar"
  }), " Saturday 9 May 2026 \xB7 ", /*#__PURE__*/React.createElement("i", {
    className: "fa fa-map-marker"
  }), " John Anderson Campus, Glasgow"), /*#__PURE__*/React.createElement(PegButton, {
    variant: "primary",
    size: "sm",
    icon: "angle-right",
    iconAlignRight: true
  }, "Register interest")) : view === "apply" ? /*#__PURE__*/React.createElement(PegCard, {
    title: "Applying for 2026 entry"
  }, /*#__PURE__*/React.createElement("ol", {
    className: "cf-list"
  }, /*#__PURE__*/React.createElement("li", null, "Choose your programme and check entry requirements."), /*#__PURE__*/React.createElement("li", null, "Apply via UCAS (undergraduate) or directly (postgraduate)."), /*#__PURE__*/React.createElement("li", null, "Track your application in Pegasus \u2192 My Account."))) : view === "help" ? /*#__PURE__*/React.createElement(PegAlert, {
    type: "info"
  }, "Use the level tabs and the Sort & filter panel to narrow results. Click a course title for full details, and the bookmark star to save it.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "peg-horizontal-menu"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hm-scroll"
  }, /*#__PURE__*/React.createElement("ul", {
    className: "nav nav-nowrap nav-pills",
    role: "tablist"
  }, LEVEL_TABS.map(t => /*#__PURE__*/React.createElement("li", {
    key: t.key
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    role: "tab",
    className: `nav-link${level === t.key ? " active" : ""}`,
    "aria-selected": level === t.key,
    onClick: e => {
      e.preventDefault();
      setLevel(t.key);
      setPage(0);
    }
  }, t.name)))))), /*#__PURE__*/React.createElement("div", {
    className: "pegasus-table"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-wrapper"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-controls"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-controls-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-length"
  }, /*#__PURE__*/React.createElement("label", null, "Show", /*#__PURE__*/React.createElement("select", {
    value: pageLength,
    onChange: e => {
      setPageLength(+e.target.value);
      setPage(0);
    }
  }, /*#__PURE__*/React.createElement("option", null, "5"), /*#__PURE__*/React.createElement("option", null, "10"), /*#__PURE__*/React.createElement("option", null, "25")), "entries")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "dt-filter-toggle",
    onClick: () => setFiltersOpen(o => !o)
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-filter"
  }), " Sort & filter", filterCount ? /*#__PURE__*/React.createElement("span", {
    className: "badge"
  }, filterCount) : null)), /*#__PURE__*/React.createElement("div", {
    className: "dt-controls-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-search"
  }, /*#__PURE__*/React.createElement("label", null, /*#__PURE__*/React.createElement("input", {
    type: "search",
    placeholder: "Search courses\u2026",
    value: q,
    onChange: e => {
      setQ(e.target.value);
      setPage(0);
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    className: `dt-filter-panel${filtersOpen ? " is-open" : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-filter-fields"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-filter-field"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "cf-faculty"
  }, "Faculty"), /*#__PURE__*/React.createElement("select", {
    id: "cf-faculty",
    value: faculty,
    onChange: e => {
      setFaculty(e.target.value);
      setPage(0);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "All faculties"), FACULTIES.map(f => /*#__PURE__*/React.createElement("option", {
    key: f.code,
    value: f.code
  }, f.label)))), /*#__PURE__*/React.createElement("div", {
    className: "dt-filter-field"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "cf-mode"
  }, "Mode"), /*#__PURE__*/React.createElement("select", {
    id: "cf-mode",
    value: mode,
    onChange: e => {
      setMode(e.target.value);
      setPage(0);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "Any mode"), MODES.map(m => /*#__PURE__*/React.createElement("option", {
    key: m,
    value: m
  }, m))))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "dt-filter-reset",
    onClick: () => {
      setFaculty("all");
      setMode("all");
      setQ("");
      setPage(0);
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-times"
  }), " Reset filters")), /*#__PURE__*/React.createElement("table", null, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    onClick: () => toggleSort("title"),
    className: sort.key === "title" ? `sorting_${sort.dir}` : ""
  }, "Course", /*#__PURE__*/React.createElement("span", {
    className: "sort-arrows"
  })), /*#__PURE__*/React.createElement("th", {
    onClick: () => toggleSort("level"),
    className: sort.key === "level" ? `sorting_${sort.dir}` : ""
  }, "Level", /*#__PURE__*/React.createElement("span", {
    className: "sort-arrows"
  })), /*#__PURE__*/React.createElement("th", {
    onClick: () => toggleSort("mode"),
    className: sort.key === "mode" ? `sorting_${sort.dir}` : ""
  }, "Mode", /*#__PURE__*/React.createElement("span", {
    className: "sort-arrows"
  })), /*#__PURE__*/React.createElement("th", {
    onClick: () => toggleSort("duration"),
    className: sort.key === "duration" ? `sorting_${sort.dir}` : ""
  }, "Duration", /*#__PURE__*/React.createElement("span", {
    className: "sort-arrows"
  })), /*#__PURE__*/React.createElement("th", {
    onClick: () => toggleSort("starts"),
    className: sort.key === "starts" ? `sorting_${sort.dir}` : ""
  }, "Starts", /*#__PURE__*/React.createElement("span", {
    className: "sort-arrows"
  })), /*#__PURE__*/React.createElement("th", {
    "data-no-sort": true,
    className: "text-right"
  }, "Actions"))), /*#__PURE__*/React.createElement("tbody", null, pageRows.map(c => /*#__PURE__*/React.createElement("tr", {
    key: c.code
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "cf-title",
    onClick: e => {
      e.preventDefault();
      setSelected(c.code);
    }
  }, c.title), /*#__PURE__*/React.createElement("div", {
    className: "cf-code"
  }, c.code, " \xB7 ", FACULTIES.find(f => f.code === c.faculty).label)), /*#__PURE__*/React.createElement("td", null, c.level), /*#__PURE__*/React.createElement("td", null, c.mode), /*#__PURE__*/React.createElement("td", null, c.duration), /*#__PURE__*/React.createElement("td", null, c.starts), /*#__PURE__*/React.createElement("td", {
    className: "cf-row-actions text-right"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cf-star" + (saved.includes(c.code) ? " is-saved" : ""),
    onClick: () => toggleSaved(c.code),
    title: saved.includes(c.code) ? "Remove bookmark" : "Add bookmark",
    "aria-label": saved.includes(c.code) ? "Remove bookmark" : "Add bookmark"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa " + (saved.includes(c.code) ? "fa-bookmark" : "fa-bookmark-o")
  })), /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    size: "sm",
    icon: "info-circle",
    onClick: () => setSelected(c.code)
  }, "Details")))), !total ? /*#__PURE__*/React.createElement("tr", {
    className: "empty"
  }, /*#__PURE__*/React.createElement("td", {
    colSpan: 6
  }, "No courses match those filters")) : null)), /*#__PURE__*/React.createElement("div", {
    className: "dt-foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dt-info"
  }, "Showing ", rangeStart, " to ", rangeEnd, " of ", total, " courses"), /*#__PURE__*/React.createElement("div", {
    className: "dt-paginate"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: curPage === 0,
    onClick: () => setPage(curPage - 1)
  }, "Previous"), Array.from({
    length: totalPages
  }, (_, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    type: "button",
    className: i === curPage ? "is-active" : "",
    onClick: () => setPage(i)
  }, i + 1)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: curPage >= totalPages - 1,
    onClick: () => setPage(curPage + 1)
  }, "Next"))))))));
};
function YearModules() {
  const YEARS = {
    "Year 1": [["EM101", "Engineering Mechanics I"], ["MA110", "Mathematics for Engineers"], ["EM112", "Engineering Design & Practice"], ["PH104", "Physics for Engineers"]],
    "Year 2": [["EM201", "Engineering Mechanics II"], ["MA210", "Engineering Mathematics 2"], ["EM215", "Thermofluids"], ["EM220", "Materials & Manufacturing"]],
    "Year 3": [["EM301", "Dynamics & Control"], ["EM320", "Design for Manufacture"], ["EM330", "Heat Transfer"], ["EM340", "Group Design Project"]],
    "Year 4": [["EM401", "Individual Project"], ["EM410", "Advanced Aerodynamics"], ["EM420", "Management for Engineers"]]
  };
  const tabs = Object.keys(YEARS);
  const [year, setYear] = React.useState(tabs[0]);
  return /*#__PURE__*/React.createElement("div", {
    className: "tabs-container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tablist"
  }, /*#__PURE__*/React.createElement("div", {
    className: "tabs",
    role: "tablist"
  }, tabs.map(y => /*#__PURE__*/React.createElement("button", {
    key: y,
    type: "button",
    role: "tab",
    "aria-selected": year === y,
    className: `btn tab-button${year === y ? " btn-primary active" : ""}`,
    onClick: () => setYear(y)
  }, y)))), /*#__PURE__*/React.createElement("ul", {
    className: "cf-modules"
  }, YEARS[year].map(([code, name]) => /*#__PURE__*/React.createElement("li", {
    key: code
  }, /*#__PURE__*/React.createElement("strong", null, code), "\xA0 ", name, " ", /*#__PURE__*/React.createElement("span", null, "20 credits")))));
}
function CourseDetails({
  course,
  onBack,
  saved,
  onToggleSaved
}) {
  const f = FACULTIES.find(x => x.code === course.faculty);
  return /*#__PURE__*/React.createElement("div", {
    className: "cf-details"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    size: "sm",
    icon: "angle-left",
    onClick: onBack
  }, "Back to results")), /*#__PURE__*/React.createElement("div", {
    className: "cf-detail-head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "cf-code"
  }, course.code, " \xB7 ", f.label), /*#__PURE__*/React.createElement(PegHeading, {
    size: "h1"
  }, course.title), /*#__PURE__*/React.createElement("hr", {
    className: "peg-blue-hr"
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "cf-star cf-star-lg" + (saved ? " is-saved" : ""),
    onClick: onToggleSaved,
    "aria-label": saved ? "Remove bookmark" : "Save course"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa " + (saved ? "fa-bookmark" : "fa-bookmark-o")
  }), /*#__PURE__*/React.createElement("span", null, saved ? "Saved" : "Save course"))), /*#__PURE__*/React.createElement("div", {
    className: "cf-detail-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h3",
    icon: "file-text-o"
  }, "About this programme"), /*#__PURE__*/React.createElement("p", null, "This programme combines rigorous theoretical grounding with direct industry exposure. Students take a mix of core and optional modules, and carry out a supervised project in their final year. Assessment is blended: coursework, lab reports, problem-solving examinations, and a project report."), /*#__PURE__*/React.createElement("p", null, "Teaching is delivered in-person at the John Anderson campus. All modules are underpinned by Strathclyde's research strengths and are regularly reviewed by external examiners and industrial advisory boards."), /*#__PURE__*/React.createElement(PegHeading, {
    size: "h3",
    icon: "list-alt"
  }, "Entry requirements"), /*#__PURE__*/React.createElement(PegAlert, {
    type: "info"
  }, "These are indicative guidelines; applications are considered holistically. If you're unsure whether you meet the requirements, please contact the Faculty Office."), /*#__PURE__*/React.createElement("ul", {
    className: "cf-list"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "SQA Highers:"), " AABB including Maths and Physics"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "GCE A-Level:"), " AAB including Maths and Physics"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "IB:"), " 36 points overall, HL Maths and Physics at 6"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "English:"), " IELTS 6.0 (no element below 5.5)")), /*#__PURE__*/React.createElement(PegHeading, {
    size: "h3",
    icon: "th-list"
  }, "Structure"), /*#__PURE__*/React.createElement("p", {
    className: "peg-muted"
  }, "Select a year below to see the module list."), /*#__PURE__*/React.createElement(YearModules, null)), /*#__PURE__*/React.createElement("aside", {
    className: "cf-aside"
  }, /*#__PURE__*/React.createElement("div", {
    className: "cf-kv"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Level"), /*#__PURE__*/React.createElement("dd", null, course.level)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Mode"), /*#__PURE__*/React.createElement("dd", null, course.mode)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Duration"), /*#__PURE__*/React.createElement("dd", null, course.duration)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Credits"), /*#__PURE__*/React.createElement("dd", null, course.credits)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Starts"), /*#__PURE__*/React.createElement("dd", null, course.starts)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Faculty"), /*#__PURE__*/React.createElement("dd", null, f.label)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "Places"), /*#__PURE__*/React.createElement("dd", null, "~", course.places))), /*#__PURE__*/React.createElement(PegCard, {
    title: "Fees"
  }, /*#__PURE__*/React.createElement("dl", {
    className: "cf-fees"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "UK / Home"), /*#__PURE__*/React.createElement("dd", null, course.uk, /*#__PURE__*/React.createElement("small", null, " / year"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, "International"), /*#__PURE__*/React.createElement("dd", null, course.intl, /*#__PURE__*/React.createElement("small", null, " / year"))))), /*#__PURE__*/React.createElement(PegCard, {
    title: "Next open day"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-calendar"
  }), " Saturday 9 May 2026"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-map-marker"
  }), " John Anderson Campus, Glasgow"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    size: "sm",
    icon: "angle-right",
    iconAlignRight: true
  }, "Register interest"))), /*#__PURE__*/React.createElement("div", {
    className: "cf-apply-cta"
  }, /*#__PURE__*/React.createElement(PegButton, {
    variant: "primary",
    size: "lg",
    icon: "external-link",
    iconAlignRight: true
  }, "Apply now"), /*#__PURE__*/React.createElement("div", {
    className: "peg-help peg-muted",
    style: {
      marginTop: 8
    }
  }, "Applications open via UCAS for 2026 entry.")))));
}
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/coursefinder/CourseFinderApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/myaccount/BookmarksScreen.jsx
try { (() => {
/* global React, PegShell, PegSidebar, PegHeading, PegButton, PegAlert */
const {
  useState
} = React;
const SIDEBAR_ITEMS = [{
  key: "dashboard",
  icon: "home",
  text: "Dashboard"
}, {
  key: "profile",
  icon: "user",
  text: "Profile"
}, {
  key: "bookmarks",
  icon: "bookmark",
  text: "Bookmarks",
  badge: 12
}, {
  key: "notifications",
  icon: "bell",
  text: "Notifications"
}, {
  key: "preferences",
  icon: "cog",
  text: "Preferences"
}];
const INITIAL_BOOKMARKS = [{
  id: 1,
  title: "Course Finder",
  desc: "Search undergraduate & postgraduate courses.",
  icon: "book"
}, {
  id: 2,
  title: "Examination Timetable",
  desc: "Upcoming exams — date, time and venue.",
  icon: "calendar"
}, {
  id: 3,
  title: "Library Account",
  desc: "Check out, renew and reserve items.",
  icon: "bookmark"
}, {
  id: 4,
  title: "IT Helpdesk",
  desc: "Log an incident or request a service.",
  icon: "question-circle"
}, {
  id: 5,
  title: "Student Business",
  desc: "Fees, finance and enrolment.",
  icon: "envelope"
}, {
  id: 6,
  title: "My Timetable",
  desc: "Your class schedule for this semester.",
  icon: "calendar"
}];
window.BookmarksScreen = function BookmarksScreen({
  username,
  onLogout,
  onNavigate
}) {
  const [bookmarks, setBookmarks] = useState(INITIAL_BOOKMARKS);
  const [removedToast, setRemovedToast] = useState(null);
  const remove = id => {
    const removed = bookmarks.find(b => b.id === id);
    setBookmarks(bookmarks.filter(b => b.id !== id));
    setRemovedToast(removed);
    setTimeout(() => setRemovedToast(null), 3000);
  };
  const restore = () => {
    if (removedToast) {
      setBookmarks([removedToast, ...bookmarks]);
      setRemovedToast(null);
    }
  };
  return /*#__PURE__*/React.createElement(PegShell, {
    username: username,
    alerts: 3,
    crumbs: [{
      label: "My Account",
      onClick: () => onNavigate && onNavigate("dashboard")
    }, {
      label: "Bookmarks"
    }],
    onLogout: onLogout,
    onNav: t => onNavigate && onNavigate(t === "alerts" ? "notifications" : t === "bookmarks" ? "bookmarks" : t),
    activeTool: "bookmarks",
    sidebar: /*#__PURE__*/React.createElement(PegSidebar, {
      title: "My Account",
      items: SIDEBAR_ITEMS,
      activeKey: "bookmarks",
      onSelect: k => onNavigate && onNavigate(k)
    })
  }, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h1"
  }, "Bookmarks"), /*#__PURE__*/React.createElement("p", {
    className: "peg-lead"
  }, "Quick access to the services you use most. Remove a bookmark by clicking the", /*#__PURE__*/React.createElement("i", {
    className: "fa fa-times peg-inline-icon"
  }), " on any card."), removedToast ? /*#__PURE__*/React.createElement(PegAlert, {
    type: "info",
    className: "peg-mb-4"
  }, "Removed ", /*#__PURE__*/React.createElement("strong", null, removedToast.title), ". ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      restore();
    }
  }, "Undo"), ".") : null, /*#__PURE__*/React.createElement("div", {
    className: "peg-bookmark-grid"
  }, bookmarks.map(b => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    className: "peg-bookmark-card"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "peg-bookmark-close",
    "aria-label": `Remove ${b.title}`,
    onClick: () => remove(b.id)
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-times"
  })), /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${b.icon} peg-bookmark-icon`
  }), /*#__PURE__*/React.createElement("div", {
    className: "peg-bookmark-title"
  }, b.title), /*#__PURE__*/React.createElement("div", {
    className: "peg-bookmark-desc"
  }, b.desc), /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "peg-bookmark-open",
    onClick: e => e.preventDefault()
  }, "Open ", /*#__PURE__*/React.createElement("i", {
    className: "fa fa-angle-right"
  })))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "peg-bookmark-card peg-bookmark-add",
    onClick: () => setBookmarks([{
      id: Date.now(),
      title: "New service",
      desc: "Recently added service.",
      icon: "star"
    }, ...bookmarks])
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-plus"
  }), /*#__PURE__*/React.createElement("span", null, "Add bookmark"))));
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/myaccount/BookmarksScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/myaccount/DashboardScreen.jsx
try { (() => {
/* global React, PegShell, PegSidebar, PegHeading, PegTile, PegCard, PegAlert, PegButton */
const {
  useState
} = React;
const SIDEBAR_ITEMS = [{
  key: "dashboard",
  icon: "home",
  text: "Dashboard"
}, {
  key: "profile",
  icon: "user",
  text: "Profile"
}, {
  key: "bookmarks",
  icon: "bookmark",
  text: "Bookmarks",
  badge: 12
}, {
  key: "notifications",
  icon: "bell",
  text: "Notifications"
}, {
  key: "courses",
  icon: "book",
  text: "Courses"
}, {
  key: "calendar",
  icon: "calendar",
  text: "Timetable"
}, {
  key: "preferences",
  icon: "cog",
  text: "Preferences"
}];
const DASHBOARD_TILES = [{
  icon: "user",
  text: "Profile",
  key: "profile"
}, {
  icon: "book",
  text: "Courses",
  key: "courses",
  badge: {
    icon: "check-circle",
    color: "success",
    tooltip: "Up to date"
  }
}, {
  icon: "bookmark",
  text: "Bookmarks",
  key: "bookmarks"
}, {
  icon: "calendar",
  text: "Timetable",
  key: "calendar"
}, {
  icon: "envelope",
  text: "Inbox",
  key: "inbox"
}, {
  icon: "cogs",
  text: "Settings",
  key: "preferences"
}, {
  icon: "info-circle",
  text: "Service&nbsp;status",
  key: "status"
}, {
  icon: "question-circle",
  text: "Help",
  key: "help"
}];

/**
 * DashboardScreen — a typical "My Account" landing:
 *   Sidebar + service banner + dashboard tiles + "your bookmarks" list + "recent activity".
 */
window.DashboardScreen = function DashboardScreen({
  username,
  onLogout,
  onNavigate
}) {
  const [active, setActive] = useState("dashboard");
  const select = k => {
    setActive(k);
    if (onNavigate) onNavigate(k);
  };
  return /*#__PURE__*/React.createElement(PegShell, {
    username: username,
    alerts: 3,
    crumbs: [{
      label: "My Account"
    }, {
      label: "Dashboard"
    }],
    onLogout: onLogout,
    onNav: target => {
      if (target === "bookmarks") select("bookmarks");else if (target === "alerts") select("notifications");
    },
    sidebar: /*#__PURE__*/React.createElement(PegSidebar, {
      title: "My Account",
      items: SIDEBAR_ITEMS,
      activeKey: active,
      onSelect: select
    })
  }, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h1"
  }, "Welcome back, ", username), /*#__PURE__*/React.createElement(PegAlert, {
    type: "info",
    className: "peg-mb-4"
  }, /*#__PURE__*/React.createElement("strong", null, "Service message:"), " Pegasus will be upgrading on", /*#__PURE__*/React.createElement("strong", null, " Friday 25 April, 21:00\u201322:00"), ". Some services may be unavailable. ", /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Read more"), "."), /*#__PURE__*/React.createElement(PegHeading, {
    size: "h3"
  }, "Quick links"), /*#__PURE__*/React.createElement("div", {
    className: "peg-tile-grid"
  }, DASHBOARD_TILES.map(t => /*#__PURE__*/React.createElement(PegTile, {
    key: t.key,
    icon: t.icon,
    text: t.text,
    badge: t.badge,
    onClick: () => select(t.key)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "peg-row peg-mt-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-col-2"
  }, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h3"
  }, "Your bookmarks"), /*#__PURE__*/React.createElement(PegCard, {
    title: "Course Finder"
  }, "Search undergraduate & postgraduate course listings."), /*#__PURE__*/React.createElement(PegCard, {
    title: "Examination Timetable"
  }, "View the date, time and venue of your upcoming exams."), /*#__PURE__*/React.createElement(PegCard, {
    title: "Library Account"
  }, "Check out, renew and reserve items at Strathclyde Library.")), /*#__PURE__*/React.createElement("div", {
    className: "peg-col-1"
  }, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h3"
  }, "Recent activity"), /*#__PURE__*/React.createElement("ul", {
    className: "peg-activity"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-check-circle text-success"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "You updated your emergency contact."), /*#__PURE__*/React.createElement("span", null, "Today at 09:14"))), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-bookmark text-info"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "You bookmarked \"Library Account\"."), /*#__PURE__*/React.createElement("span", null, "Yesterday, 16:47"))), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-envelope text-info"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "New message from Student Business."), /*#__PURE__*/React.createElement("span", null, "Tuesday, 11:02"))), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-warning text-warning"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Password expires in 14 days."), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Change now"))))))));
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/myaccount/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/myaccount/LoginScreen.jsx
try { (() => {
/* global React, PegInput, PegButton, PegAlert, PegLoginPanel */
const {
  useState
} = React;

/**
 * LoginScreen — recreates the full flow from components/user/login.vue:
 *   username → (if stratch email, SSO) → password → "Logging in as <user>" → bookmarks dash.
 */
window.LoginScreen = function LoginScreen({
  onLogin
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const handleNext = () => {
    if (!username) return;
    setError("");
    // simple heuristic: strath.ac.uk emails go SSO
    if (/@strath\.ac\.uk/i.test(username)) {
      setSubmitting(true);
      setTimeout(() => {
        onLogin(username.split("@")[0]);
      }, 900);
    } else {
      setShowPassword(true);
    }
  };
  const handleLogin = () => {
    if (!password) return;
    setSubmitting(true);
    setTimeout(() => {
      if (password === "fail") {
        setSubmitting(false);
        setError("Invalid credentials. Please check your username and password.");
      } else {
        onLogin(username);
      }
    }, 700);
  };
  const goBack = () => {
    setShowPassword(false);
    setError("");
  };
  return /*#__PURE__*/React.createElement(PegLoginPanel, null, /*#__PURE__*/React.createElement("div", {
    className: "text-center mt-3 mb-5"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/pegasus-mark.svg",
    alt: "PEGASUS logo",
    style: {
      width: 200,
      maxWidth: "100%"
    }
  })), /*#__PURE__*/React.createElement("p", {
    className: "peg-login-text"
  }, "Sign in with your DS username and password, or your ", /*#__PURE__*/React.createElement("strong", null, "strath.ac.uk"), " email for single sign\u2011on."), !showPassword ? /*#__PURE__*/React.createElement(PegInput, {
    label: "Username",
    name: "username",
    value: username,
    onChange: setUsername,
    autoFocus: true,
    required: true,
    helpText: "Your DS username, or your strath.ac.uk email."
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-logging-in"
  }, "Logging in as ", /*#__PURE__*/React.createElement("strong", null, username)), /*#__PURE__*/React.createElement(PegInput, {
    label: "Password",
    name: "password",
    type: "password",
    value: password,
    onChange: setPassword,
    autoFocus: true,
    required: true
  })), error ? /*#__PURE__*/React.createElement(PegAlert, {
    type: "danger",
    className: "mt-4"
  }, error) : null, /*#__PURE__*/React.createElement("div", {
    className: "peg-login-buttons"
  }, !showPassword ? /*#__PURE__*/React.createElement(PegButton, {
    variant: "primary",
    size: "lg",
    icon: submitting ? "loading" : "angle-right",
    iconAlignRight: !submitting,
    disabled: !username || submitting,
    onClick: handleNext
  }, submitting ? "Please wait…" : "Next") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    icon: "angle-left",
    onClick: goBack,
    disabled: submitting
  }, "Back"), /*#__PURE__*/React.createElement(PegButton, {
    variant: "primary",
    size: "lg",
    icon: submitting ? "loading" : "angle-right",
    iconAlignRight: !submitting,
    disabled: !password || submitting,
    onClick: handleLogin
  }, submitting ? "Logging in…" : "Login"))), /*#__PURE__*/React.createElement("div", {
    className: "text-center",
    style: {
      paddingTop: 40
    }
  }, /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    size: "sm"
  }, "Forgotten password/username?")));
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/myaccount/LoginScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/myaccount/MyAccountPrimitives.jsx
try { (() => {
/* global React */
const {
  useRef,
  useEffect
} = React;

/** PegInput — tab-top input with strath-blue label, optional help pill. */
window.PegInput = function PegInput({
  label,
  name,
  value,
  onChange,
  type = "text",
  helpText,
  required,
  autoFocus
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);
  return /*#__PURE__*/React.createElement("div", {
    className: "peg-form-group"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: name
  }, label, required ? /*#__PURE__*/React.createElement("span", {
    className: "peg-req"
  }, " *") : null), /*#__PURE__*/React.createElement("input", {
    ref: ref,
    id: name,
    name: name,
    type: type,
    value: value,
    onChange: e => onChange(e.target.value),
    className: "peg-form-control",
    autoComplete: "off"
  }), helpText ? /*#__PURE__*/React.createElement("div", {
    className: "peg-help-text"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-question-circle"
  }), helpText) : null);
};

/** PegButton — pill-shaped button. Matches .btn in _buttons.scss. */
window.PegButton = function PegButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  icon,
  iconAlignRight,
  disabled,
  type = "button",
  className = ""
}) {
  const classes = ["peg-btn", `peg-btn-${variant}`, size === "lg" ? "peg-btn-lg" : "", size === "sm" ? "peg-btn-sm" : "", className].filter(Boolean).join(" ");
  const iconEl = icon ? /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${icon === "loading" ? "spinner fa-spin" : icon}`,
    "aria-hidden": "true"
  }) : null;
  return /*#__PURE__*/React.createElement("button", {
    className: classes,
    onClick: onClick,
    disabled: disabled,
    type: type
  }, icon && !iconAlignRight ? iconEl : null, children ? /*#__PURE__*/React.createElement("span", null, children) : null, icon && iconAlignRight ? iconEl : null);
};

/** PegAlert — contextual alert with leading icon. */
window.PegAlert = function PegAlert({
  type = "info",
  children,
  className = ""
}) {
  const iconMap = {
    success: "check-circle",
    info: "info-circle",
    warning: "exclamation-triangle",
    danger: "warning"
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `peg-alert peg-alert-${type} ${className}`,
    role: "alert"
  }, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${iconMap[type]}`,
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", null, children));
};

/** PegCard — bootstrap-style card, corpblue header on hover. */
window.PegCard = function PegCard({
  title,
  children,
  footer,
  onClick,
  href,
  className = ""
}) {
  const Tag = href || onClick ? "a" : "div";
  const props = {
    className: "peg-card " + className,
    onClick: onClick ? e => {
      e.preventDefault();
      onClick();
    } : undefined,
    href: href || (onClick ? "#" : undefined)
  };
  return /*#__PURE__*/React.createElement(Tag, props, title ? /*#__PURE__*/React.createElement("div", {
    className: "peg-card-header"
  }, title) : null, /*#__PURE__*/React.createElement("div", {
    className: "peg-card-body"
  }, children), footer ? /*#__PURE__*/React.createElement("div", {
    className: "peg-card-footer"
  }, footer) : null);
};

/** PegHeading — Alegreya Sans, bold, correct scale. */
window.PegHeading = function PegHeading({
  size = "h2",
  children,
  icon
}) {
  const Tag = size;
  return /*#__PURE__*/React.createElement(Tag, {
    className: `peg-heading peg-${size}`
  }, icon ? /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${icon}`,
    "aria-hidden": "true"
  }) : null, children);
};

/** PegTile — icon dashboard tile, strath-blue glyph, optional success badge. */
window.PegTile = function PegTile({
  icon,
  text,
  badge,
  onClick
}) {
  return /*#__PURE__*/React.createElement("a", {
    className: "peg-tile",
    href: "#",
    onClick: e => {
      e.preventDefault();
      onClick && onClick();
    }
  }, badge ? /*#__PURE__*/React.createElement("span", {
    className: "peg-tile-badge",
    title: badge.tooltip
  }, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${badge.icon} text-${badge.color || "success"}`
  })) : null, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${icon}`,
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    dangerouslySetInnerHTML: {
      __html: text
    }
  }));
};

/** PegSidebar — list-group sidebar navigation matching sidebar.vue. */
window.PegSidebar = function PegSidebar({
  title,
  items,
  activeKey,
  onSelect
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "peg-sb",
    "aria-label": "Main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-sb-title"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault()
  }, title)), /*#__PURE__*/React.createElement("ul", {
    className: "peg-sb-list"
  }, items.map(it => /*#__PURE__*/React.createElement("li", {
    key: it.key,
    className: "peg-sb-item" + (activeKey === it.key ? " is-active" : "")
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onSelect(it.key);
    }
  }, it.icon ? /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${it.icon}`,
    "aria-hidden": "true"
  }) : null, /*#__PURE__*/React.createElement("span", null, it.text), it.badge ? /*#__PURE__*/React.createElement("span", {
    className: "peg-sb-badge"
  }, it.badge) : null)))));
};

/** PegLoginPanel — rounded gray form-bg login card. */
window.PegLoginPanel = function PegLoginPanel({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "peg-login-wrapper"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-login-card"
  }, children));
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/myaccount/MyAccountPrimitives.jsx", error: String((e && e.message) || e) }); }

// ui_kits/myaccount/NotificationsScreen.jsx
try { (() => {
/* global React, PegShell, PegSidebar, PegHeading, PegAlert, PegButton */
const {
  useState
} = React;
const SIDEBAR_ITEMS = [{
  key: "dashboard",
  icon: "home",
  text: "Dashboard"
}, {
  key: "profile",
  icon: "user",
  text: "Profile"
}, {
  key: "bookmarks",
  icon: "bookmark",
  text: "Bookmarks",
  badge: 12
}, {
  key: "notifications",
  icon: "bell",
  text: "Notifications"
}, {
  key: "preferences",
  icon: "cog",
  text: "Preferences"
}];
const INITIAL = [{
  id: 1,
  type: "info",
  icon: "info-circle",
  unread: true,
  when: "Today, 09:14",
  title: "System maintenance",
  body: "Pegasus will be upgraded on Friday 25 April, 21:00–22:00."
}, {
  id: 2,
  type: "success",
  icon: "check-circle",
  unread: true,
  when: "Today, 08:33",
  title: "Registration complete",
  body: "You are successfully registered for 2024/25."
}, {
  id: 3,
  type: "warning",
  icon: "exclamation-triangle",
  unread: true,
  when: "Yesterday, 17:21",
  title: "Password expires soon",
  body: "Your password expires in 14 days. Change it now to avoid interruption."
}, {
  id: 4,
  type: "info",
  icon: "envelope",
  unread: false,
  when: "Tuesday, 11:02",
  title: "Message from Student Business",
  body: "Your tuition statement is now available online."
}, {
  id: 5,
  type: "danger",
  icon: "warning",
  unread: false,
  when: "Mon 14 Apr",
  title: "Library fine outstanding",
  body: "You have an outstanding fine of £3.50. Pay before 30 April."
}];
window.NotificationsScreen = function NotificationsScreen({
  username,
  onLogout,
  onNavigate
}) {
  const [items, setItems] = useState(INITIAL);
  const [filter, setFilter] = useState("all");
  const markRead = id => setItems(items.map(n => n.id === id ? {
    ...n,
    unread: false
  } : n));
  const markAll = () => setItems(items.map(n => ({
    ...n,
    unread: false
  })));
  const visible = items.filter(n => filter === "all" ? true : n.unread);
  const unreadCount = items.filter(n => n.unread).length;
  return /*#__PURE__*/React.createElement(PegShell, {
    username: username,
    alerts: unreadCount,
    activeTool: "alerts",
    crumbs: [{
      label: "My Account",
      onClick: () => onNavigate && onNavigate("dashboard")
    }, {
      label: "Notifications"
    }],
    onLogout: onLogout,
    onNav: t => onNavigate && onNavigate(t === "alerts" ? "notifications" : t === "bookmarks" ? "bookmarks" : t),
    sidebar: /*#__PURE__*/React.createElement(PegSidebar, {
      title: "My Account",
      items: SIDEBAR_ITEMS.map(i => i.key === "notifications" ? {
        ...i,
        badge: unreadCount || null
      } : i),
      activeKey: "notifications",
      onSelect: k => onNavigate && onNavigate(k)
    })
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-page-head"
  }, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h1"
  }, "Notifications"), /*#__PURE__*/React.createElement("div", {
    className: "peg-page-head-actions"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-tabs",
    role: "tablist"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "tab",
    "aria-selected": filter === "all",
    className: "peg-tab" + (filter === "all" ? " is-active" : ""),
    onClick: () => setFilter("all")
  }, "All ", /*#__PURE__*/React.createElement("span", {
    className: "peg-tab-count"
  }, items.length)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    role: "tab",
    "aria-selected": filter === "unread",
    className: "peg-tab" + (filter === "unread" ? " is-active" : ""),
    onClick: () => setFilter("unread")
  }, "Unread ", /*#__PURE__*/React.createElement("span", {
    className: "peg-tab-count"
  }, unreadCount))), /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    icon: "check-circle",
    disabled: !unreadCount,
    onClick: markAll
  }, "Mark all as read"))), /*#__PURE__*/React.createElement("ul", {
    className: "peg-notif-list"
  }, visible.map(n => /*#__PURE__*/React.createElement("li", {
    key: n.id,
    className: "peg-notif peg-notif-" + n.type + (n.unread ? " is-unread" : "")
  }, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${n.icon} peg-notif-icon`
  }), /*#__PURE__*/React.createElement("div", {
    className: "peg-notif-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-notif-head"
  }, /*#__PURE__*/React.createElement("strong", null, n.title), /*#__PURE__*/React.createElement("span", {
    className: "peg-notif-when"
  }, n.when)), /*#__PURE__*/React.createElement("div", null, n.body)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "peg-notif-dismiss",
    onClick: () => markRead(n.id),
    "aria-label": "Mark as read",
    title: n.unread ? "Mark as read" : "Read"
  }, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${n.unread ? "circle" : "check"}`
  })))), visible.length === 0 ? /*#__PURE__*/React.createElement("li", {
    className: "peg-notif-empty"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-check-circle"
  }), /*#__PURE__*/React.createElement("span", null, "You're all caught up.")) : null));
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/myaccount/NotificationsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/myaccount/PegShell.jsx
try { (() => {
/* global React */
const {
  useState
} = React;

/**
 * PegShell — corpblue top bar with logo, breadcrumbs band, and main content slot.
 * Replicates the layout we see in <peg-app> + remote-header + page-layout.
 */
window.PegShell = function PegShell({
  sidebar = null,
  crumbs = [],
  alerts = 3,
  username = null,
  onLogout = () => {},
  onNav = () => {},
  activeTool = null,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "peg-shell"
  }, /*#__PURE__*/React.createElement("header", {
    className: "peg-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-header-inner"
  }, /*#__PURE__*/React.createElement("a", {
    className: "peg-logo",
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNav("home");
    },
    "aria-label": "PEGASUS home"
  }, /*#__PURE__*/React.createElement("img", {
    className: "peg-logo-strath",
    src: "../../assets/logo-landscape.svg",
    alt: "University of Strathclyde"
  }), /*#__PURE__*/React.createElement("span", {
    className: "peg-logo-sep"
  }), /*#__PURE__*/React.createElement("img", {
    className: "peg-logo-name",
    src: "../../assets/pegasus-name.svg",
    alt: "Pegasus"
  })), /*#__PURE__*/React.createElement("div", {
    className: "peg-header-spacer"
  }), /*#__PURE__*/React.createElement(HeaderIcon, {
    icon: "bookmark",
    label: "Bookmarks",
    active: activeTool === "bookmarks",
    onClick: () => onNav("bookmarks")
  }), /*#__PURE__*/React.createElement(HeaderIcon, {
    icon: "bell",
    label: "Alerts",
    badge: alerts,
    active: activeTool === "alerts",
    onClick: () => onNav("alerts")
  }), username ? /*#__PURE__*/React.createElement(HeaderIcon, {
    icon: "user-circle",
    label: username,
    active: activeTool === "user",
    onClick: onLogout
  }) : null)), crumbs.length ? /*#__PURE__*/React.createElement("nav", {
    className: "peg-breadcrumbs",
    "aria-label": "breadcrumb"
  }, /*#__PURE__*/React.createElement("ol", null, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNav("home");
    },
    "aria-label": "Home"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-home"
  }))), crumbs.map((c, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: i === crumbs.length - 1 ? "active" : ""
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-angle-right sep"
  }), i === crumbs.length - 1 || !c.onClick ? /*#__PURE__*/React.createElement("span", null, c.label) : /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      c.onClick();
    }
  }, c.label))))) : null, /*#__PURE__*/React.createElement("div", {
    className: "peg-body"
  }, sidebar ? /*#__PURE__*/React.createElement("aside", {
    className: "peg-sidebar"
  }, sidebar) : null, /*#__PURE__*/React.createElement("main", {
    className: "peg-main"
  }, children)), /*#__PURE__*/React.createElement("footer", {
    className: "peg-footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-footer-inner"
  }, /*#__PURE__*/React.createElement("div", null, "University of Strathclyde \xB7 Glasgow \xB7 Scotland"), /*#__PURE__*/React.createElement("div", {
    className: "peg-footer-links"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Privacy"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Accessibility"), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Contact us")))));
};
function HeaderIcon({
  icon,
  label,
  badge,
  active,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    className: "peg-header-icon" + (active ? " is-active" : ""),
    onClick: onClick,
    type: "button"
  }, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${icon}`,
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", null, label), badge ? /*#__PURE__*/React.createElement("span", {
    className: "peg-header-badge"
  }, badge) : null);
}
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/myaccount/PegShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/myaccount/ProfileScreen.jsx
try { (() => {
/* global React, PegShell, PegSidebar, PegHeading, PegCard, PegInput, PegButton, PegAlert */
const {
  useState
} = React;
const SIDEBAR_ITEMS = [{
  key: "dashboard",
  icon: "home",
  text: "Dashboard"
}, {
  key: "profile",
  icon: "user",
  text: "Profile"
}, {
  key: "bookmarks",
  icon: "bookmark",
  text: "Bookmarks",
  badge: 12
}, {
  key: "notifications",
  icon: "bell",
  text: "Notifications"
}, {
  key: "preferences",
  icon: "cog",
  text: "Preferences"
}];
window.ProfileScreen = function ProfileScreen({
  username,
  onLogout,
  onNavigate
}) {
  const [first, setFirst] = useState("Jo");
  const [last, setLast] = useState("Bloggs");
  const [email, setEmail] = useState(`${username}@strath.ac.uk`);
  const [phone, setPhone] = useState("+44 141 548 2000");
  const [saved, setSaved] = useState(false);
  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  return /*#__PURE__*/React.createElement(PegShell, {
    username: username,
    alerts: 3,
    crumbs: [{
      label: "My Account",
      onClick: () => onNavigate && onNavigate("dashboard")
    }, {
      label: "Profile"
    }],
    onLogout: onLogout,
    onNav: t => onNavigate && onNavigate(t === "alerts" ? "notifications" : t === "bookmarks" ? "bookmarks" : t),
    sidebar: /*#__PURE__*/React.createElement(PegSidebar, {
      title: "My Account",
      items: SIDEBAR_ITEMS,
      activeKey: "profile",
      onSelect: k => onNavigate && onNavigate(k)
    })
  }, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h1"
  }, "Profile"), /*#__PURE__*/React.createElement("p", {
    className: "peg-lead"
  }, "Review and update your personal details. Changes are reflected across Pegasus services within a few minutes."), saved ? /*#__PURE__*/React.createElement(PegAlert, {
    type: "success",
    className: "peg-mb-4"
  }, "Your profile has been updated.") : null, /*#__PURE__*/React.createElement("div", {
    className: "peg-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-col-1"
  }, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h3"
  }, "Personal details"), /*#__PURE__*/React.createElement("div", {
    className: "peg-form-grid"
  }, /*#__PURE__*/React.createElement(PegInput, {
    label: "First name",
    name: "first",
    value: first,
    onChange: setFirst,
    required: true
  }), /*#__PURE__*/React.createElement(PegInput, {
    label: "Last name",
    name: "last",
    value: last,
    onChange: setLast,
    required: true
  }), /*#__PURE__*/React.createElement(PegInput, {
    label: "Email address",
    name: "email",
    value: email,
    onChange: setEmail,
    helpText: "Pegasus notifications go to this address."
  }), /*#__PURE__*/React.createElement(PegInput, {
    label: "Phone",
    name: "phone",
    value: phone,
    onChange: setPhone
  })), /*#__PURE__*/React.createElement("div", {
    className: "peg-form-actions"
  }, /*#__PURE__*/React.createElement(PegButton, {
    variant: "light"
  }, "Cancel"), /*#__PURE__*/React.createElement(PegButton, {
    variant: "primary",
    icon: "check-circle",
    onClick: save
  }, "Save changes"))), /*#__PURE__*/React.createElement("div", {
    className: "peg-col-2"
  }, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h3"
  }, "Your account"), /*#__PURE__*/React.createElement(PegCard, {
    title: "DS Username"
  }, /*#__PURE__*/React.createElement("strong", null, username), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    className: "peg-muted"
  }, "Used for DS network, email, wi\u2011fi and legacy services.")), /*#__PURE__*/React.createElement(PegCard, {
    title: "Registration"
  }, /*#__PURE__*/React.createElement("strong", null, "2024/25 \xB7 Year 3"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    className: "peg-muted"
  }, "MSc Design Innovation & Citizenship")), /*#__PURE__*/React.createElement(PegCard, {
    title: "Photo ID"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-avatar-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-avatar"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-user"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "No photo on file"), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "Upload photo")))))));
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/myaccount/ProfileScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/shared/PegShellV2.jsx
try { (() => {
/* global React */
/* Pegasus shared shell — header + footer, built from peg-assests/src/components.
   Replicates the real `header.vue`, `header-logo.vue`, `header-menu.vue`,
   `find-service.vue` and `footer.vue` layouts cosmetically. */
const {
  useState,
  useRef,
  useEffect
} = React;

/* ------------------------------------------------------------------ */
/*  PegHeader                                                          */
/* ------------------------------------------------------------------ */
window.PegHeader = function PegHeader({
  onNav = () => {},
  onSearch = null,
  activePanel = null,
  onTogglePanel = () => {},
  userName = null,
  bookmarkCount = 0,
  notificationCount = 0,
  disabled = false,
  logoSrc = "../shared/logo-landscape.svg",
  nameSrc = "../shared/pegasus-name.svg",
  services = []
}) {
  const [query, setQuery] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const results = query ? services.filter(s => s.name.toLowerCase().includes(query.toLowerCase())) : [];
  return /*#__PURE__*/React.createElement("header", {
    className: "pegh"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pegh-inner"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    className: "pegh-logo",
    onClick: e => {
      e.preventDefault();
      onNav("home");
    },
    "aria-label": "Pegasus home"
  }, /*#__PURE__*/React.createElement("img", {
    src: logoSrc,
    alt: "University of Strathclyde",
    className: "pegh-logo-strath"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pegh-logo-sep"
  }), /*#__PURE__*/React.createElement("img", {
    src: nameSrc,
    alt: "Pegasus",
    className: "pegh-logo-name"
  })), !disabled && onSearch !== false ? /*#__PURE__*/React.createElement("div", {
    className: "pegh-search" + (searchFocus ? " is-active" : "")
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "pegh-search-input",
    className: "pegh-search-icon"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-search",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "sr-only"
  }, "Search Pegasus")), /*#__PURE__*/React.createElement("input", {
    id: "pegh-search-input",
    type: "search",
    autoComplete: "off",
    placeholder: "Search Pegasus",
    value: query,
    onChange: e => setQuery(e.target.value),
    onFocus: () => setSearchFocus(true),
    onBlur: () => setTimeout(() => setSearchFocus(false), 150)
  }), searchFocus && (query || services.length) ? /*#__PURE__*/React.createElement("div", {
    className: "pegh-search-results"
  }, query ? results.length ? /*#__PURE__*/React.createElement("ul", null, results.map(s => /*#__PURE__*/React.createElement("li", {
    key: s.code
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNav && onNav(s.code);
      setQuery("");
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "pegh-sr-name"
  }, s.name), s.granted === false ? /*#__PURE__*/React.createElement("i", {
    className: "fa fa-ban",
    title: "No access"
  }) : /*#__PURE__*/React.createElement("i", {
    className: "fa fa-bookmark-o",
    title: "Bookmark"
  }))))) : /*#__PURE__*/React.createElement("div", {
    className: "pegh-sr-empty"
  }, "Sorry, no results were found") : /*#__PURE__*/React.createElement("div", {
    className: "pegh-sr-section"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pegh-sr-title"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-clock-o"
  }), " Recent activity"), /*#__PURE__*/React.createElement("ul", null, services.slice(0, 4).map(s => /*#__PURE__*/React.createElement("li", {
    key: s.code
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNav(s.code);
    }
  }, s.name)))))) : null) : /*#__PURE__*/React.createElement("div", {
    className: "pegh-spacer"
  }), !disabled && userName ? /*#__PURE__*/React.createElement("div", {
    className: "pegh-icons"
  }, /*#__PURE__*/React.createElement(HeaderIcon, {
    icon: "bookmark",
    label: "My bookmarks",
    active: activePanel === "bookmarks",
    count: bookmarkCount,
    onClick: () => onTogglePanel("bookmarks")
  }), /*#__PURE__*/React.createElement(HeaderIcon, {
    icon: "bell",
    label: "Notifications",
    active: activePanel === "notifications",
    count: notificationCount,
    countStyle: "danger",
    onClick: () => onTogglePanel("notifications")
  }), /*#__PURE__*/React.createElement(HeaderIcon, {
    icon: "user-circle-o",
    label: "My account",
    active: activePanel === "account",
    onClick: () => onTogglePanel("account")
  })) : null));
};
function HeaderIcon({
  icon,
  label,
  active,
  count,
  countStyle = "info",
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "pegh-icon" + (active ? " is-active" : ""),
    onClick: onClick,
    "aria-label": label,
    title: label
  }, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${icon}`,
    "aria-hidden": "true"
  }), count ? /*#__PURE__*/React.createElement("span", {
    className: `pegh-icon-badge pegh-icon-badge-${countStyle}`
  }, count) : null);
}

/* ------------------------------------------------------------------ */
/*  PegFooter                                                          */
/* ------------------------------------------------------------------ */
window.PegFooter = function PegFooter({
  nameSrc = "../shared/pegasus-name.svg",
  links = [{
    text: "Privacy notice",
    href: "#"
  }, {
    text: "Accessibility",
    href: "#"
  }, {
    text: "Cookies",
    href: "#"
  }, {
    text: "Helpdesk",
    href: "#"
  }, {
    text: "Change cookie settings",
    href: "#"
  }]
}) {
  return /*#__PURE__*/React.createElement("footer", {
    className: "pegf"
  }, /*#__PURE__*/React.createElement("div", {
    className: "pegf-col pegf-brand"
  }, /*#__PURE__*/React.createElement("img", {
    src: nameSrc,
    alt: "Pegasus"
  })), /*#__PURE__*/React.createElement("div", {
    className: "pegf-col pegf-links"
  }, links.map((l, i) => /*#__PURE__*/React.createElement("a", {
    key: i,
    href: l.href
  }, l.text))), /*#__PURE__*/React.createElement("div", {
    className: "pegf-col pegf-copy"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#"
  }, "\xA9 University of Strathclyde")));
};

/* ------------------------------------------------------------------ */
/*  PegBreadcrumbs                                                     */
/* ------------------------------------------------------------------ */
window.PegBreadcrumbs = function PegBreadcrumbs({
  crumbs = [],
  onNav = () => {}
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "pegbc",
    "aria-label": "breadcrumb"
  }, /*#__PURE__*/React.createElement("ol", null, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onNav("home");
    },
    "aria-label": "Home"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-home"
  }))), crumbs.map((c, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: i === crumbs.length - 1 ? "active" : ""
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-angle-right pegbc-sep"
  }), i === crumbs.length - 1 || !c.onClick ? /*#__PURE__*/React.createElement("span", null, c.label) : /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      c.onClick();
    }
  }, c.label)))));
};

/* ------------------------------------------------------------------ */
/*  PegShell — wraps header + breadcrumbs + body (sidebar+main) + footer */
/* ------------------------------------------------------------------ */
window.PegShellV2 = function PegShellV2({
  sidebar = null,
  crumbs = [],
  userName = null,
  onLogout = () => {},
  onNav = () => {},
  activePanel: externalActive,
  onTogglePanel,
  bookmarkCount = 0,
  notificationCount = 0,
  services = [],
  children,
  noBreadcrumbs = false,
  panelContent = null
}) {
  const [activePanelLocal, setActivePanelLocal] = useState(null);
  const activePanel = externalActive !== undefined ? externalActive : activePanelLocal;
  const togglePanel = p => {
    const next = activePanel === p ? null : p;
    if (onTogglePanel) onTogglePanel(next);else setActivePanelLocal(next);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "peg-shell-v2"
  }, /*#__PURE__*/React.createElement(PegHeader, {
    onNav: onNav,
    userName: userName,
    bookmarkCount: bookmarkCount,
    notificationCount: notificationCount,
    activePanel: activePanel,
    onTogglePanel: togglePanel,
    services: services
  }), !noBreadcrumbs && crumbs.length ? /*#__PURE__*/React.createElement(PegBreadcrumbs, {
    crumbs: crumbs,
    onNav: onNav
  }) : null, /*#__PURE__*/React.createElement("div", {
    className: "peg-shell-body"
  }, sidebar ? /*#__PURE__*/React.createElement("aside", {
    className: "peg-shell-sidebar"
  }, sidebar) : null, /*#__PURE__*/React.createElement("main", {
    className: "peg-shell-main"
  }, children)), activePanel ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "peg-offcanvas-overlay",
    onClick: () => togglePanel(null)
  }), /*#__PURE__*/React.createElement("aside", {
    className: "peg-offcanvas"
  }, panelContent && panelContent[activePanel] ? panelContent[activePanel] : /*#__PURE__*/React.createElement(DefaultPanel, {
    panel: activePanel,
    userName: userName,
    onLogout: onLogout
  }))) : null, /*#__PURE__*/React.createElement(PegFooter, null));
};
function DefaultPanel({
  panel,
  userName,
  onLogout
}) {
  if (panel === "bookmarks") {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
      className: "peg-offcanvas-title"
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa fa-bookmark"
    }), " My bookmarks"), /*#__PURE__*/React.createElement("div", {
      className: "peg-offcanvas-body"
    }, /*#__PURE__*/React.createElement("p", {
      className: "peg-muted"
    }, "No bookmarks yet.")));
  }
  if (panel === "notifications") {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
      className: "peg-offcanvas-title"
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa fa-bell"
    }), " Notifications"), /*#__PURE__*/React.createElement("div", {
      className: "peg-offcanvas-body"
    }, /*#__PURE__*/React.createElement("p", {
      className: "peg-muted"
    }, "You're all caught up with your notifications")));
  }
  if (panel === "account") {
    return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h3", {
      className: "peg-offcanvas-title"
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa fa-user-circle-o"
    }), " My account"), /*#__PURE__*/React.createElement("div", {
      className: "peg-offcanvas-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "peg-offcanvas-user"
    }, userName), /*#__PURE__*/React.createElement("div", {
      className: "peg-offcanvas-menu"
    }, /*#__PURE__*/React.createElement("a", {
      href: "#"
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa fa-lock"
    }), " Change password"), /*#__PURE__*/React.createElement("a", {
      href: "#"
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa fa-user"
    }), " Switch account"), /*#__PURE__*/React.createElement("a", {
      href: "#",
      onClick: e => {
        e.preventDefault();
        onLogout();
      }
    }, /*#__PURE__*/React.createElement("i", {
      className: "fa fa-sign-out"
    }), " Logout"))));
  }
  return null;
}
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/shared/PegShellV2.jsx", error: String((e && e.message) || e) }); }

// ui_kits/shared/Primitives.jsx
try { (() => {
/* global React */
const {
  useRef,
  useEffect
} = React;

/** PegInput — tab-top input with strath-blue label, optional help pill. */
window.PegInput = function PegInput({
  label,
  name,
  value,
  onChange,
  type = "text",
  helpText,
  required,
  autoFocus
}) {
  const ref = useRef(null);
  useEffect(() => {
    if (autoFocus && ref.current) ref.current.focus();
  }, [autoFocus]);
  return /*#__PURE__*/React.createElement("div", {
    className: "peg-form-group"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: name
  }, label, required ? /*#__PURE__*/React.createElement("span", {
    className: "peg-req"
  }, " *") : null), /*#__PURE__*/React.createElement("input", {
    ref: ref,
    id: name,
    name: name,
    type: type,
    value: value,
    onChange: e => onChange(e.target.value),
    className: "peg-form-control",
    autoComplete: "off"
  }), helpText ? /*#__PURE__*/React.createElement("div", {
    className: "peg-help-text"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-question-circle"
  }), helpText) : null);
};

/** PegButton — pill-shaped button. Matches .btn in _buttons.scss. */
window.PegButton = function PegButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  icon,
  iconAlignRight,
  disabled,
  type = "button",
  className = ""
}) {
  const classes = ["peg-btn", `peg-btn-${variant}`, size === "lg" ? "peg-btn-lg" : "", size === "sm" ? "peg-btn-sm" : "", className].filter(Boolean).join(" ");
  const iconEl = icon ? /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${icon === "loading" ? "spinner fa-spin" : icon}`,
    "aria-hidden": "true"
  }) : null;
  return /*#__PURE__*/React.createElement("button", {
    className: classes,
    onClick: onClick,
    disabled: disabled,
    type: type
  }, icon && !iconAlignRight ? iconEl : null, children ? /*#__PURE__*/React.createElement("span", null, children) : null, icon && iconAlignRight ? iconEl : null);
};

/** PegAlert — contextual alert with leading icon. */
window.PegAlert = function PegAlert({
  type = "info",
  children,
  className = ""
}) {
  const iconMap = {
    success: "check-circle",
    info: "info-circle",
    warning: "exclamation-triangle",
    danger: "warning"
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `peg-alert peg-alert-${type} ${className}`,
    role: "alert"
  }, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${iconMap[type]}`,
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", null, children));
};

/** PegCard — bootstrap-style card, corpblue header on hover. */
window.PegCard = function PegCard({
  title,
  children,
  footer,
  onClick,
  href,
  className = ""
}) {
  const Tag = href || onClick ? "a" : "div";
  const props = {
    className: "peg-card " + className,
    onClick: onClick ? e => {
      e.preventDefault();
      onClick();
    } : undefined,
    href: href || (onClick ? "#" : undefined)
  };
  return /*#__PURE__*/React.createElement(Tag, props, title ? /*#__PURE__*/React.createElement("div", {
    className: "peg-card-header"
  }, title) : null, /*#__PURE__*/React.createElement("div", {
    className: "peg-card-body"
  }, children), footer ? /*#__PURE__*/React.createElement("div", {
    className: "peg-card-footer"
  }, footer) : null);
};

/** PegHeading — Alegreya Sans, bold, correct scale. */
window.PegHeading = function PegHeading({
  size = "h2",
  children,
  icon
}) {
  const Tag = size;
  return /*#__PURE__*/React.createElement(Tag, {
    className: `peg-heading peg-${size}`
  }, icon ? /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${icon}`,
    "aria-hidden": "true"
  }) : null, children);
};

/** PegTile — icon dashboard tile, strath-blue glyph, optional success badge. */
window.PegTile = function PegTile({
  icon,
  text,
  badge,
  onClick
}) {
  return /*#__PURE__*/React.createElement("a", {
    className: "peg-tile",
    href: "#",
    onClick: e => {
      e.preventDefault();
      onClick && onClick();
    }
  }, badge ? /*#__PURE__*/React.createElement("span", {
    className: "peg-tile-badge",
    title: badge.tooltip
  }, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${badge.icon} text-${badge.color || "success"}`
  })) : null, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${icon}`,
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    dangerouslySetInnerHTML: {
      __html: text
    }
  }));
};

/** PegSidebar — list-group sidebar navigation matching sidebar.vue. */
window.PegSidebar = function PegSidebar({
  title,
  items,
  activeKey,
  onSelect
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "peg-sb",
    "aria-label": "Main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-sb-title"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => e.preventDefault()
  }, title)), /*#__PURE__*/React.createElement("ul", {
    className: "peg-sb-list"
  }, items.map(it => /*#__PURE__*/React.createElement("li", {
    key: it.key,
    className: "peg-sb-item" + (activeKey === it.key ? " is-active" : "")
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onSelect(it.key);
    }
  }, it.icon ? /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${it.icon}`,
    "aria-hidden": "true"
  }) : null, /*#__PURE__*/React.createElement("span", null, it.text), it.badge ? /*#__PURE__*/React.createElement("span", {
    className: "peg-sb-badge"
  }, it.badge) : null)))));
};

/** PegLoginPanel — rounded gray form-bg login card. */
window.PegLoginPanel = function PegLoginPanel({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "peg-login-wrapper"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-login-card"
  }, children));
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/shared/Primitives.jsx", error: String((e && e.message) || e) }); }

// ui_kits/staffsearch/StaffSearchApp.jsx
try { (() => {
/* global React */
/* StaffSearchApp — Pegasus directory for finding staff. */
const {
  useState,
  useMemo
} = React;
const STAFF = [{
  id: "mst",
  name: "Dr Martin Stewart",
  role: "Senior Lecturer",
  dept: "Computer & Information Sciences",
  email: "martin.stewart@strath.ac.uk",
  phone: "0141 548 3219",
  room: "LT 14.25",
  tags: ["Vue.js", "Front-end"],
  campus: "John Anderson"
}, {
  id: "ajr",
  name: "Professor Alice Johnson",
  role: "Head of Department",
  dept: "Mechanical & Aerospace Engineering",
  email: "a.johnson@strath.ac.uk",
  phone: "0141 548 2101",
  room: "JW 4.10",
  tags: ["Aerodynamics", "CFD"],
  campus: "John Anderson"
}, {
  id: "bkm",
  name: "Dr Barry Kim",
  role: "Lecturer",
  dept: "Pure & Applied Chemistry",
  email: "b.kim@strath.ac.uk",
  phone: "0141 548 2440",
  room: "TG 6.11",
  tags: ["Organic", "Catalysis"],
  campus: "John Anderson"
}, {
  id: "coa",
  name: "Dr Carmen Oliva",
  role: "Senior Research Fellow",
  dept: "Work, Employment & Organisation",
  email: "c.oliva@strath.ac.uk",
  phone: "0141 548 3800",
  room: "SBS 5.22",
  tags: ["Labour markets"],
  campus: "SBS"
}, {
  id: "dgh",
  name: "Mr David Hughes",
  role: "Academic Administrator",
  dept: "Student Experience",
  email: "david.hughes@strath.ac.uk",
  phone: "0141 548 2600",
  room: "McCance 2",
  tags: [],
  campus: "McCance"
}, {
  id: "eme",
  name: "Ms Elena Martinez-Enrique",
  role: "Careers Consultant",
  dept: "Careers Service",
  email: "elena.martinez-enrique@strath.ac.uk",
  phone: "0141 548 4900",
  room: "50 George 1.1",
  tags: ["Student careers"],
  campus: "Learning & Teaching"
}, {
  id: "fpb",
  name: "Dr Finn Padrona-Baxter",
  role: "Reader",
  dept: "Physics",
  email: "f.padrona-baxter@strath.ac.uk",
  phone: "0141 548 3324",
  room: "JA 7.81",
  tags: ["Quantum optics"],
  campus: "John Anderson"
}, {
  id: "gh",
  name: "Professor Gráinne Hughes",
  role: "Head of Faculty",
  dept: "Humanities & Social Sciences",
  email: "g.hughes@strath.ac.uk",
  phone: "0141 548 4050",
  room: "Lord Hope 3.4",
  tags: ["Sociology"],
  campus: "Lord Hope"
}, {
  id: "hjw",
  name: "Mr Hakan Juma-Walker",
  role: "Senior Developer",
  dept: "Information Services",
  email: "hakan.juma-walker@strath.ac.uk",
  phone: "0141 548 3019",
  room: "Livingstone 2",
  tags: ["Platform team"],
  campus: "Livingstone"
}, {
  id: "iom",
  name: "Ms Ingrid O'Meara",
  role: "Head of Student Recruitment",
  dept: "Strategy & Policy",
  email: "ingrid.omeara@strath.ac.uk",
  phone: "0141 548 2700",
  room: "McCance 4",
  tags: [],
  campus: "McCance"
}];
const ALL_SERVICES = [{
  code: "myaccount",
  name: "My Account"
}, {
  code: "coursefind",
  name: "Course Finder"
}, {
  code: "staff",
  name: "Staff Search"
}, {
  code: "addr",
  name: "Address Finder"
}, {
  code: "content",
  name: "Content Manager"
}, {
  code: "bookmarks",
  name: "My Bookmarks"
}];
window.StaffSearchApp = function StaffSearchApp({
  onNav = () => {}
}) {
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("all");
  const [campus, setCampus] = useState("all");
  const [selected, setSelected] = useState(null);
  const [panel, setPanel] = useState(null);
  const [view, setView] = useState("search");
  const NAV = [{
    key: "search",
    icon: "search",
    label: "Search staff"
  }, {
    key: "dept",
    icon: "building-o",
    label: "By department"
  }, {
    key: "campus",
    icon: "map-marker",
    label: "By campus"
  }, {
    key: "help",
    icon: "question-circle",
    label: "Help"
  }];
  const departments = useMemo(() => [...new Set(STAFF.map(s => s.dept))].sort(), []);
  const campuses = useMemo(() => [...new Set(STAFF.map(s => s.campus))].sort(), []);
  const filtered = useMemo(() => {
    return STAFF.filter(s => {
      if (q) {
        const needle = q.toLowerCase();
        const hay = `${s.name} ${s.role} ${s.dept} ${s.email} ${s.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (dept !== "all" && s.dept !== dept) return false;
      if (campus !== "all" && s.campus !== campus) return false;
      return true;
    });
  }, [q, dept, campus]);
  const sidebar = /*#__PURE__*/React.createElement("nav", {
    className: "peg-sb",
    "aria-label": "Staff search"
  }, /*#__PURE__*/React.createElement("div", {
    className: "peg-sb-title"
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      setView("search");
      setSelected(null);
    }
  }, "Staff Search")), /*#__PURE__*/React.createElement("ul", {
    className: "peg-sb-list"
  }, NAV.map(n => /*#__PURE__*/React.createElement("li", {
    key: n.key,
    className: `peg-sb-item${view === n.key ? " is-active" : ""}`
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      setView(n.key);
      setSelected(null);
    }
  }, /*#__PURE__*/React.createElement("i", {
    className: `fa fa-${n.icon}`
  }), /*#__PURE__*/React.createElement("span", null, n.label))))));
  const crumbs = [{
    label: "Staff Search"
  }, {
    label: selected ? "Staff profile" : "Directory"
  }];
  const selectedStaff = selected ? STAFF.find(s => s.id === selected) : null;
  return /*#__PURE__*/React.createElement(PegShellV2, {
    userName: "Dr Martin Stewart",
    crumbs: crumbs,
    sidebar: sidebar,
    onNav: onNav,
    bookmarkCount: 4,
    notificationCount: 2,
    activePanel: panel,
    onTogglePanel: setPanel,
    services: ALL_SERVICES,
    onLogout: () => onNav("home")
  }, selectedStaff ? /*#__PURE__*/React.createElement(StaffProfile, {
    staff: selectedStaff,
    onBack: () => setSelected(null)
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h1"
  }, {
    search: "Staff Search",
    dept: "Browse by department",
    campus: "Browse by campus",
    help: "Help"
  }[view]), /*#__PURE__*/React.createElement("hr", {
    className: "peg-blue-hr"
  }), /*#__PURE__*/React.createElement("p", {
    className: "peg-lead"
  }, {
    search: "Find a colleague by name, department, email or research area. Only members of staff with a live directory entry appear in results.",
    dept: "Pick a department to see its directory.",
    campus: "Pick a campus location to see who's based there.",
    help: "Guidance on using Staff Search."
  }[view])), view === "dept" ? /*#__PURE__*/React.createElement("div", {
    className: "ss-browse-grid"
  }, departments.map(d => /*#__PURE__*/React.createElement(PegCard, {
    key: d,
    title: d,
    onClick: () => {
      setDept(d);
      setView("search");
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "peg-muted",
    style: {
      margin: 0
    }
  }, STAFF.filter(s => s.dept === d).length, " staff")))) : view === "campus" ? /*#__PURE__*/React.createElement("div", {
    className: "ss-browse-grid"
  }, [...new Set(STAFF.map(s => s.campus))].sort().map(c => /*#__PURE__*/React.createElement(PegCard, {
    key: c,
    title: c,
    onClick: () => {
      setCampus(c);
      setView("search");
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "peg-muted",
    style: {
      margin: 0
    }
  }, STAFF.filter(s => s.campus === c).length, " staff")))) : view === "help" ? /*#__PURE__*/React.createElement(PegAlert, {
    type: "info"
  }, "Search by name, role, department, email or research tag. Click a person for their full profile, or use the By department / By campus shortcuts to browse.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    className: "ss-filters"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ss-q"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "ss-q"
  }, "Search"), /*#__PURE__*/React.createElement("div", {
    className: "ss-q-wrap"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-search"
  }), /*#__PURE__*/React.createElement("input", {
    id: "ss-q",
    type: "search",
    placeholder: "Name, role, department, email, tag\u2026",
    className: "peg-form-control",
    value: q,
    onChange: e => setQ(e.target.value)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "peg-form-group"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "ss-dept"
  }, "Department"), /*#__PURE__*/React.createElement("select", {
    id: "ss-dept",
    className: "peg-form-control",
    value: dept,
    onChange: e => setDept(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "All"), departments.map(d => /*#__PURE__*/React.createElement("option", {
    key: d,
    value: d
  }, d)))), /*#__PURE__*/React.createElement("div", {
    className: "peg-form-group"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "ss-campus"
  }, "Campus"), /*#__PURE__*/React.createElement("select", {
    id: "ss-campus",
    className: "peg-form-control",
    value: campus,
    onChange: e => setCampus(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "all"
  }, "All campuses"), campuses.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, c))))), /*#__PURE__*/React.createElement("div", {
    className: "cf-summary"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("strong", null, filtered.length), " ", filtered.length === 1 ? "person" : "people", " found"), q || dept !== "all" || campus !== "all" ? /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    size: "sm",
    icon: "times",
    onClick: () => {
      setQ("");
      setDept("all");
      setCampus("all");
    }
  }, "Clear filters") : null), filtered.length ? /*#__PURE__*/React.createElement("ul", {
    className: "ss-results"
  }, filtered.map(s => /*#__PURE__*/React.createElement("li", {
    key: s.id,
    className: "ss-card",
    onClick: () => setSelected(s.id)
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: s.name
  }), /*#__PURE__*/React.createElement("div", {
    className: "ss-card-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ss-name"
  }, s.name), /*#__PURE__*/React.createElement("div", {
    className: "ss-role"
  }, s.role), /*#__PURE__*/React.createElement("div", {
    className: "ss-dept"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-building-o"
  }), " ", s.dept), /*#__PURE__*/React.createElement("div", {
    className: "ss-contact"
  }, /*#__PURE__*/React.createElement("a", {
    href: `mailto:${s.email}`,
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-envelope-o"
  }), " ", s.email), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-phone"
  }), " ", s.phone)), s.tags.length ? /*#__PURE__*/React.createElement("div", {
    className: "ss-tags"
  }, s.tags.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    className: "ss-tag"
  }, t))) : null), /*#__PURE__*/React.createElement("div", {
    className: "ss-card-actions"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-angle-right"
  }))))) : /*#__PURE__*/React.createElement("div", {
    className: "cf-empty"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-user-times"
  }), /*#__PURE__*/React.createElement("h3", null, "No results found"), /*#__PURE__*/React.createElement("p", {
    className: "peg-muted"
  }, "Try a different spelling or loosen your filters.")))));
};
function Avatar({
  name
}) {
  const initials = name.replace(/(Dr|Prof(essor)?|Ms|Mr|Mrs|Miss|Mx)\.?\s*/g, "").split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const hues = ["#002b5c", "#0078ae", "#018489", "#495057"];
  const hue = hues[name.length % hues.length];
  return /*#__PURE__*/React.createElement("div", {
    className: "ss-avatar",
    style: {
      background: hue
    },
    "aria-hidden": "true"
  }, initials);
}
function StaffProfile({
  staff,
  onBack
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    size: "sm",
    icon: "angle-left",
    onClick: onBack
  }, "Back to directory")), /*#__PURE__*/React.createElement("div", {
    className: "ss-profile-head"
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: staff.name
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h1"
  }, staff.name), /*#__PURE__*/React.createElement("div", {
    className: "ss-role"
  }, staff.role), /*#__PURE__*/React.createElement("div", {
    className: "ss-dept"
  }, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-building-o"
  }), " ", staff.dept), /*#__PURE__*/React.createElement("hr", {
    className: "peg-blue-hr"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "ss-profile-grid"
  }, /*#__PURE__*/React.createElement("section", null, /*#__PURE__*/React.createElement(PegHeading, {
    size: "h3",
    icon: "address-card-o"
  }, "Contact"), /*#__PURE__*/React.createElement("ul", {
    className: "ss-contact-list"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-envelope-o"
  }), " ", /*#__PURE__*/React.createElement("a", {
    href: `mailto:${staff.email}`
  }, staff.email)), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-phone"
  }), " ", staff.phone), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-building-o"
  }), " Room ", staff.room, ", ", staff.campus, " Building"), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("i", {
    className: "fa fa-map-marker"
  }), " University of Strathclyde, Glasgow G1 1XQ")), /*#__PURE__*/React.createElement(PegHeading, {
    size: "h3",
    icon: "info-circle"
  }, "About"), /*#__PURE__*/React.createElement("p", null, staff.name.split(" ").slice(-1), " is an active researcher in the Department of ", staff.dept.toLowerCase(), ". Research interests include ", staff.tags.join(", ") || "broad areas within the discipline", ". Supervises PhDs and delivers undergraduate and postgraduate modules in their area."), /*#__PURE__*/React.createElement(PegHeading, {
    size: "h3",
    icon: "calendar"
  }, "Availability"), /*#__PURE__*/React.createElement("div", {
    className: "ss-availability"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Tuesdays"), " ", /*#__PURE__*/React.createElement("span", null, "10:00\u201312:00 (office hours)")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "Thursdays"), " ", /*#__PURE__*/React.createElement("span", null, "14:00\u201316:00 (by appointment)")))), /*#__PURE__*/React.createElement("aside", {
    className: "ss-profile-aside"
  }, /*#__PURE__*/React.createElement(PegCard, {
    title: "Actions"
  }, /*#__PURE__*/React.createElement("div", {
    className: "ss-actions-col"
  }, /*#__PURE__*/React.createElement(PegButton, {
    variant: "primary",
    size: "sm",
    icon: "envelope",
    className: "peg-btn"
  }, "Send email"), /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    size: "sm",
    icon: "calendar-plus-o"
  }, "Book appointment"), /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    size: "sm",
    icon: "star-o"
  }, "Add to favourites"), /*#__PURE__*/React.createElement(PegButton, {
    variant: "light",
    size: "sm",
    icon: "share"
  }, "Share profile"))), /*#__PURE__*/React.createElement(PegCard, {
    title: "Team"
  }, /*#__PURE__*/React.createElement("ul", {
    className: "ss-team"
  }, STAFF.filter(p => p.dept === staff.dept && p.id !== staff.id).slice(0, 3).map(p => /*#__PURE__*/React.createElement("li", {
    key: p.id
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: p.name
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", null, p.name), /*#__PURE__*/React.createElement("div", {
    className: "peg-small peg-muted"
  }, p.role)))))))));
}
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/staffsearch/StaffSearchApp.jsx", error: String((e && e.message) || e) }); }

})();
