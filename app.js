/* 余额台账前端 — 动态账户列 + 双向同步 */
(() => {
  const ACCOUNT_META = {
    微信: { short: "微信", color: "var(--wx)" },
    支付宝: { short: "支付宝", color: "var(--ali)" },
    工商银行: { short: "工商", color: "var(--icbc)" },
    农村信用社: { short: "农信", color: "var(--rcu)" },
    中国农业银行: { short: "农行", color: "var(--abc)" },
    农业银行: { short: "农行", color: "var(--abc)" },
    现金: { short: "现金", color: "var(--cash)" },
  };

  const els = {
    syncLine: document.getElementById("syncLine"),
    latestDate: document.getElementById("latestDate"),
    totalValue: document.getElementById("totalValue"),
    weekSpend: document.getElementById("weekSpend"),
    filledCount: document.getElementById("filledCount"),
    accountGrid: document.getElementById("accountGrid"),
    ledgerBody: document.getElementById("ledgerBody"),
    ledgerHead: document.getElementById("ledgerHead"),
    dayList: document.getElementById("dayList"),
    emptyHint: document.getElementById("emptyHint"),
    searchInput: document.getElementById("searchInput"),
    editDrawer: document.getElementById("editDrawer"),
    infoDrawer: document.getElementById("infoDrawer"),
    editForm: document.getElementById("editForm"),
    editTitle: document.getElementById("editTitle"),
    accountFields: document.getElementById("accountFields"),
    btnSave: document.getElementById("btnSave"),
    btnAdd: document.getElementById("btnAdd"),
    btnRefresh: document.getElementById("btnRefresh"),
    btnSyncInfo: document.getElementById("btnSyncInfo"),
    urlList: document.getElementById("urlList"),
    toast: document.getElementById("toast"),
    loginRoot: document.getElementById("loginRoot"),
    loginForm: document.getElementById("loginForm"),
    btnLogin: document.getElementById("btnLogin"),
    loginHint: document.getElementById("loginHint"),
  };

  let state = null;
  let editingRow = null;
  let lastRenderKey = "";
  let pollTimer = null;
  let toastTimer = null;
  let accountKeys = [];

  function accountKeysOf() {
    if (state?.account_keys?.length) return state.account_keys;
    return accountKeys.length ? accountKeys : Object.keys(ACCOUNT_META);
  }

  function metaOf(key) {
    return (
      ACCOUNT_META[key] || {
        short: key.length > 4 ? key.slice(0, 4) : key,
        color: "var(--accent)",
      }
    );
  }

  function money(v) {
    if (v === null || v === undefined || v === "") return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    const abs = Math.abs(n).toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return n < 0 ? `-${abs}` : abs;
  }

  function showToast(msg, isError = false) {
    els.toast.hidden = false;
    els.toast.textContent = msg;
    els.toast.classList.toggle("error", isError);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2800);
  }

  function setSync(text, cls = "") {
    els.syncLine.textContent = text;
    els.syncLine.className = `brand-sub ${cls}`.trim();
  }

  const elsLogin = {
    root: els.loginRoot,
    form: els.loginForm,
    btn: els.btnLogin,
    hint: els.loginHint,
  };

  function getToken() {
    return localStorage.getItem("balance_token") || "";
  }
  function setToken(t) {
    if (t) localStorage.setItem("balance_token", t);
    else localStorage.removeItem("balance_token");
  }
  function showLogin(msg) {
    elsLogin.root.hidden = false;
    if (msg) elsLogin.hint.textContent = msg;
  }
  function hideLogin() {
    elsLogin.root.hidden = true;
  }

  async function api(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      "bypass-tunnel-reminder": "1",
      ...(options.headers || {}),
    };
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch((window.API_BASE || "") + path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 || data.need_auth) {
      setToken("");
      showLogin("请登录");
      throw new Error(data.error || "请先登录");
    }
    if (!res.ok || data.ok === false) {
      throw new Error(data.error || `请求失败 (${res.status})`);
    }
    return data.data !== undefined ? data.data : data;
  }

  function renderLedgerHead() {
    const keys = accountKeysOf();
    els.ledgerHead.innerHTML = [
      `<th class="col-date">日期</th>`,
      ...keys.map((k) => `<th>${metaOf(k).short}</th>`),
      `<th class="col-total">全部</th>`,
      `<th class="col-spend">消费</th>`,
    ].join("");
  }

  function renderAccounts(summary) {
    const keys = accountKeysOf();
    const accounts = (summary && summary.accounts) || {};
    els.accountGrid.innerHTML = keys
      .map((key) => {
        const meta = metaOf(key);
        return `
        <article class="account-chip" style="--dot:${meta.color}">
          <p class="name">${meta.short}</p>
          <p class="val">¥ ${money(accounts[key] ?? 0)}</p>
        </article>`;
      })
      .join("");
  }

  function renderSummary(summary) {
    els.latestDate.textContent = summary?.latest_date
      ? `· ${summary.latest_date}`
      : "";
    els.totalValue.textContent = `¥ ${money(summary?.total ?? 0)}`;
    els.weekSpend.textContent = `¥ ${money(summary?.week_spend ?? 0)}`;
    els.filledCount.textContent = `${summary?.filled_count ?? 0} 天`;
    renderAccounts(summary);
  }

  function parseDateKey(s) {
    const m = String(s || "").trim().match(/^(\d+)\.(\d+)$/);
    if (!m) return -1;
    return parseInt(m[1], 10) * 100 + parseInt(m[2], 10);
  }

  function visibleRows() {
    if (!state?.rows) return [];
    const q = els.searchInput.value.trim().toLowerCase();
    const list = state.rows.filter((r) => {
      const hasData = r.total !== null && r.total !== undefined;
      if (!hasData) return false;
      if (q && !(r.date || "").toLowerCase().includes(q)) return false;
      return true;
    });
    list.sort((a, b) => parseDateKey(b.date) - parseDateKey(a.date));
    return list;
  }

  function renderTable(flashRow) {
    const keys = accountKeysOf();
    const rows = visibleRows();
    const latestRow = state?.summary?.latest_row;
    els.emptyHint.hidden = rows.length > 0;

    els.ledgerBody.innerHTML = rows
      .map((r) => {
        const empty = r.total === null || r.total === undefined;
        const cells = keys
          .map((k) => {
            const v = r.accounts?.[k];
            return `<td class="${v === null || v === undefined ? "muted" : ""}">${money(v)}</td>`;
          })
          .join("");
        const spend =
          r.spend === null || r.spend === undefined
            ? `<td class="muted">—</td>`
            : `<td>${money(r.spend)}</td>`;
        const cls = [
          empty ? "is-empty" : "",
          r.row === latestRow ? "is-latest" : "",
          flashRow === r.row ? "flash" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<tr class="${cls}" data-row="${r.row}">
          <td class="col-date">${r.date || "—"}</td>
          ${cells}
          <td class="col-total">${empty ? "—" : money(r.total)}</td>
          ${spend}
        </tr>`;
      })
      .join("");

    els.dayList.innerHTML = rows
      .map((r) => {
        const empty = r.total === null || r.total === undefined;
        const accs = keys
          .map((k) => {
            const meta = metaOf(k);
            const v = r.accounts?.[k];
            return `<div class="day-acc has-dot" style="--dot:${meta.color}"><b>${meta.short}</b>${v === null || v === undefined ? "—" : money(v)}</div>`;
          })
          .join("");
        const cls = [
          "day-card",
          r.row === latestRow ? "is-latest" : "",
          flashRow === r.row ? "flash" : "",
        ]
          .filter(Boolean)
          .join(" ");
        const spendTxt =
          r.spend === null || r.spend === undefined
            ? ""
            : `<span class="day-spend">${money(r.spend)}</span>`;
        return `<article class="${cls}" data-row="${r.row}">
          <div class="day-card-top">
            <div class="day-date">${r.date || "—"}</div>
            <div><span class="day-total">${empty ? "—" : money(r.total)}</span>${spendTxt}</div>
          </div>
          <div class="day-accounts">${accs}</div>
        </article>`;
      })
      .join("");
  }

  function render(flashRow) {
    if (!state) return;
    const key = JSON.stringify({
      m: state.mtime,
      s: state.size,
      q: els.searchInput.value,
      k: (state.account_keys || []).join("|"),
    });
    renderLedgerHead();
    renderSummary(state.summary);
    if (key !== lastRenderKey || flashRow) {
      renderTable(flashRow);
      lastRenderKey = key;
    }
  }

  function buildAccountFields(values) {
    const keys = accountKeysOf();
    els.accountFields.innerHTML = keys
      .map((key) => {
        const meta = metaOf(key);
        const v = values?.[key];
        return `
        <label class="field">
          <span>${meta.short}</span>
          <input name="${key}" inputmode="decimal" placeholder="0.00"
                 value="${v === null || v === undefined ? "" : v}" />
        </label>`;
      })
      .join("");
  }

  function openEdit(rowData, isNew = false) {
    editingRow = isNew ? null : rowData?.row ?? null;
    els.editTitle.textContent =
      (isNew ? "记一笔" : `编辑 ${rowData?.date || ""}`) || "编辑";
    els.editForm.date.value = rowData?.date || suggestDate();
    buildAccountFields(rowData?.accounts || {});
    els.btnSave.disabled = false;
    els.btnSave.textContent = "保存到表格";
    els.editDrawer.hidden = false;
  }

  function closeDrawers() {
    els.editDrawer.hidden = true;
    els.infoDrawer.hidden = true;
    editingRow = null;
  }

  function suggestDate() {
    const filled = (state?.rows || []).filter(
      (r) => r.total !== null && r.total !== undefined
    );
    if (filled.length) return filled[filled.length - 1].date || "";
    return "";
  }

  function parseNum(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  async function saveEdit(evt) {
    evt.preventDefault();
    const form = els.editForm;
    const date = form.date.value.trim();
    if (!date) {
      showToast("请填写日期", true);
      return;
    }
    const fields = {};
    accountKeysOf().forEach((k) => {
      const el = form.elements.namedItem(k);
      fields[k] = parseNum(el && el.value);
    });

    els.btnSave.disabled = true;
    els.btnSave.textContent = "写入中…";
    try {
      let data;
      if (editingRow) {
        data = await api("/api/update", {
          method: "POST",
          body: JSON.stringify({
            row: editingRow,
            fields: { 日期: date, ...fields },
          }),
        });
        showToast(`已同步到 Excel · ${date}`);
        state = data;
        render(editingRow);
      } else {
        data = await api("/api/append", {
          method: "POST",
          body: JSON.stringify({ items: [{ date, ...fields }] }),
        });
        showToast(`已新增并写入 Excel · ${date}`);
        state = data;
        const target = (data.rows || []).find((r) => r.date === date);
        render(target?.row);
      }
      lastRenderKey = "";
      render();
      closeDrawers();
    } catch (err) {
      showToast(err.message || "保存失败", true);
    } finally {
      els.btnSave.disabled = false;
      els.btnSave.textContent = "保存到表格";
    }
  }

  async function pull({ silent = true } = {}) {
    try {
      const data = await api("/api/data");
      if (!data.ok) {
        setSync(data.error || "读取失败", "error");
        return;
      }
      const changed =
        !state || state.mtime !== data.mtime || state.size !== data.size;
      accountKeys = data.account_keys || accountKeys;
      state = data;
      if (changed || !silent) {
        setSync(
          `已同步 · ${new Date().toLocaleTimeString("zh-CN", { hour12: false })}`,
          "syncing"
        );
        lastRenderKey = "";
        render();
      } else {
        render();
      }
    } catch (err) {
      setSync(err.message || "连接失败", "error");
    }
  }

  async function loadUrls() {
    try {
      const ping = await api("/api/ping");
      const port = location.port || ping.port || "8787";
      const urls = new Set();
      if (ping.public_url) urls.add(ping.public_url);
      if (location.origin && location.origin !== "null")
        urls.add(location.origin);
      urls.add(`http://127.0.0.1:${port}`);
      (ping.ips || []).forEach((ip) => urls.add(`http://${ip}:${port}`));
      els.urlList.innerHTML = [...urls]
        .map(
          (u) => `
        <div class="url-item">
          <span>${u}</span>
          <button type="button" data-copy="${u}">复制</button>
        </div>`
        )
        .join("");
    } catch {
      els.urlList.innerHTML = `<div class="url-item"><span>无法获取地址</span></div>`;
    }
  }

  // events
  els.btnAdd.addEventListener("click", () => openEdit(null, true));
  els.btnRefresh.addEventListener("click", () => pull({ silent: false }));
  els.btnSyncInfo.addEventListener("click", async () => {
    await loadUrls();
    els.infoDrawer.hidden = false;
  });
  els.editForm.addEventListener("submit", saveEdit);
  els.searchInput.addEventListener("input", () => {
    lastRenderKey = "";
    render();
  });
  document.querySelectorAll("[data-close]").forEach((node) => {
    node.addEventListener("click", closeDrawers);
  });
  els.ledgerBody.addEventListener("click", (evt) => {
    const tr = evt.target.closest("tr[data-row]");
    if (!tr) return;
    const row = Number(tr.dataset.row);
    const rowData = (state?.rows || []).find((r) => r.row === row);
    if (rowData) openEdit(rowData, false);
  });
  els.dayList.addEventListener("click", (evt) => {
    const card = evt.target.closest("[data-row]");
    if (!card) return;
    const row = Number(card.dataset.row);
    const rowData = (state?.rows || []).find((r) => r.row === row);
    if (rowData) openEdit(rowData, false);
  });
  els.urlList.addEventListener("click", async (evt) => {
    const btn = evt.target.closest("[data-copy]");
    if (!btn) return;
    const text = btn.getAttribute("data-copy");
    try {
      await navigator.clipboard.writeText(text);
      showToast("地址已复制");
    } catch {
      showToast(text);
    }
  });

  // 登录
  elsLogin.form.addEventListener("submit", async (evt) => {
    evt.preventDefault();
    const fd = new FormData(elsLogin.form);
    const user = String(fd.get("user") || "")
      .replace(/　/g, " ")
      .trim();
    const password = String(fd.get("password") || "")
      .replace(/　/g, " ")
      .trim();
    if (!user || !password) {
      showLogin("请输入账号和密码");
      return;
    }
    elsLogin.btn.disabled = true;
    elsLogin.btn.textContent = "登录中…";
    try {
      const res = await fetch((window.API_BASE || "") + "/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "bypass-tunnel-reminder": "1",
        },
        body: JSON.stringify({ user, password }),
      });
      const raw = await res.text();
      let data = {};
      try {
        data = JSON.parse(raw);
      } catch (_) {
        data = {};
      }
      if (!res.ok || !data.ok) {
        let msg = data.error || "";
        if (res.status === 401) msg = msg || "账号或密码错误";
        else if (res.status === 429) msg = msg || "尝试过多，请稍后再试";
        else if (!msg && raw && raw.indexOf("{") === -1)
          msg = "服务异常：请用 http://127.0.0.1:8787 或最新公网地址打开";
        else if (!msg) msg = `登录失败 (${res.status})`;
        throw new Error(msg);
      }
      setToken(data.token);
      hideLogin();
      showToast("登录成功");
      await pull({ silent: false });
    } catch (err) {
      const msg =
        err && err.message
          ? err.message
          : "登录失败：请检查网络或改用 http://127.0.0.1:8787";
      showLogin(msg);
      showToast(msg, true);
    } finally {
      elsLogin.btn.disabled = false;
      elsLogin.btn.textContent = "登录";
    }
  });

  // start
  renderLedgerHead();
  buildAccountFields({});
  (async () => {
    if (!getToken()) {
      showLogin();
      return;
    }
    await pull({ silent: false });
    if (getToken()) {
      hideLogin();
      pollTimer = setInterval(() => pull({ silent: true }), 2000);
    }
  })();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && getToken()) pull({ silent: true });
  });
})();

