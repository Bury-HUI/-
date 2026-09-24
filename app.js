/* 免登录静态余额台账 — 读取 data.json */
(() => {
  const ACCOUNT_META = {
    微信: { short: "微信", color: "var(--wx)" },
    支付宝: { short: "支付宝", color: "var(--ali)" },
    工商银行: { short: "工商", color: "var(--icbc)" },
    农村信用社: { short: "农信", color: "var(--rcu)" },
    中国农业银行: { short: "农行", color: "var(--abc)" },
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
    btnRefresh: document.getElementById("btnRefresh"),
    toast: document.getElementById("toast"),
  };

  let state = null;
  let lastKey = "";
  let toastTimer = null;

  function metaOf(key) {
    return ACCOUNT_META[key] || { short: key, color: "var(--accent)" };
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

  function showToast(msg) {
    els.toast.hidden = false;
    els.toast.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2500);
  }

  function accountKeys() {
    return state?.account_keys || Object.keys(ACCOUNT_META);
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
      if (r.total === null || r.total === undefined) return false;
      if (q && !(r.date || "").toLowerCase().includes(q)) return false;
      return true;
    });
    list.sort((a, b) => parseDateKey(b.date) - parseDateKey(a.date));
    return list;
  }

  function renderHead() {
    els.ledgerHead.innerHTML = [
      `<th class="col-date">日期</th>`,
      ...accountKeys().map((k) => `<th>${metaOf(k).short}</th>`),
      `<th class="col-total">全部</th>`,
      `<th class="col-spend">消费</th>`,
    ].join("");
  }

  function renderSummary() {
    const s = state.summary || {};
    els.latestDate.textContent = s.latest_date ? `· ${s.latest_date}` : "";
    els.totalValue.textContent = `¥ ${money(s.total ?? 0)}`;
    els.weekSpend.textContent = `¥ ${money(s.week_spend ?? 0)}`;
    els.filledCount.textContent = `${s.filled_count ?? 0} 天`;
    const accounts = s.accounts || {};
    els.accountGrid.innerHTML = accountKeys()
      .map((k) => {
        const meta = metaOf(k);
        return `<article class="account-chip" style="--dot:${meta.color}">
          <p class="name">${meta.short}</p>
          <p class="val">¥ ${money(accounts[k] ?? 0)}</p>
        </article>`;
      })
      .join("");
  }

  function renderRows() {
    const rows = visibleRows();
    const latestRow = state?.summary?.latest_row;
    els.emptyHint.hidden = rows.length > 0;

    els.ledgerBody.innerHTML = rows
      .map((r) => {
        const cells = accountKeys()
          .map((k) => {
            const v = r.accounts?.[k];
            return `<td class="${v === null || v === undefined ? "muted" : ""}">${money(v)}</td>`;
          })
          .join("");
        const spend =
          r.spend === null || r.spend === undefined
            ? `<td class="muted">—</td>`
            : `<td>${money(r.spend)}</td>`;
        const cls = [r.row === latestRow ? "is-latest" : ""].filter(Boolean).join(" ");
        return `<tr class="${cls}">
          <td class="col-date">${r.date || "—"}</td>
          ${cells}
          <td class="col-total">${money(r.total)}</td>
          ${spend}
        </tr>`;
      })
      .join("");

    els.dayList.innerHTML = rows
      .map((r) => {
        const accs = accountKeys()
          .map((k) => {
            const meta = metaOf(k);
            const v = r.accounts?.[k];
            return `<div class="day-acc has-dot" style="--dot:${meta.color}"><b>${meta.short}</b>${money(v)}</div>`;
          })
          .join("");
        const cls = ["day-card", r.row === latestRow ? "is-latest" : ""].filter(Boolean).join(" ");
        const spendTxt =
          r.spend === null || r.spend === undefined
            ? ""
            : `<span class="day-spend">${money(r.spend)}</span>`;
        return `<article class="${cls}">
          <div class="day-card-top">
            <div class="day-date">${r.date || "—"}</div>
            <div><span class="day-total">${money(r.total)}</span>${spendTxt}</div>
          </div>
          <div class="day-accounts">${accs}</div>
        </article>`;
      })
      .join("");
  }

  function render() {
    if (!state) return;
    const key = JSON.stringify({ m: state.summary, q: els.searchInput.value });
    renderHead();
    renderSummary();
    if (key !== lastKey) {
      renderRows();
      lastKey = key;
    }
  }

  async function load() {
    try {
      els.syncLine.textContent = "同步中…";
      const res = await fetch("./data.json?t=" + Date.now());
      const data = await res.json();
      state = data;
      render();
      els.syncLine.textContent =
        "来自表格 · " +
        new Date().toLocaleTimeString("zh-CN", { hour12: false });
    } catch (e) {
      els.syncLine.textContent = "加载失败，请刷新";
      showToast("无法读取 data.json");
    }
  }

  els.searchInput.addEventListener("input", () => {
    lastKey = "";
    render();
  });
  els.btnRefresh.addEventListener("click", load);

  load();
})();
