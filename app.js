'use strict';

/* =========================================================
   Expense & Budget Visualizer — app logic
   Vanilla JS only. All state is persisted to localStorage.
   MVP: form + validation, transaction list + delete, total
   balance, doughnut chart.
   Challenges included: custom categories, monthly summary
   filter, sort by amount/category, highlight over-limit
   spending, dark/light mode saved in localStorage.
   ========================================================= */
(function () {
  /* ---------- Storage keys ---------- */
  var KEYS = {
    transactions: 'ebv_transactions',
    categories: 'ebv_categories',
    theme: 'ebv_theme',
    limit: 'ebv_limit'
  };

  var DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];
  var BASE_COLORS = { 'Food': '#f97316', 'Transport': '#3b82f6', 'Fun': '#a855f7' };
  var PALETTE = [
    '#ef4444', '#10b981', '#f59e0b', '#06b6d4', '#ec4899',
    '#8b5cf6', '#14b8a6', '#eab308', '#6366f1', '#84cc16',
    '#f43f5e', '#0ea5e9', '#d946ef', '#22c55e', '#facc15'
  ];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- State ---------- */
  var state = { transactions: [], categories: [], theme: 'light', limit: 0 };
  var chart = null;
  var el = {};

  /* ---------- Persistence ---------- */
  function load() {
    try { state.transactions = JSON.parse(localStorage.getItem(KEYS.transactions)) || []; }
    catch (e) { state.transactions = []; }

    var cats = [];
    try { cats = JSON.parse(localStorage.getItem(KEYS.categories)) || []; } catch (e2) {}
    state.categories = mergeCategories(cats);

    state.theme = localStorage.getItem(KEYS.theme) || 'light';
    state.limit = parseFloat(localStorage.getItem(KEYS.limit)) || 0;
  }

  function mergeCategories(cats) {
    var out = DEFAULT_CATEGORIES.slice();
    (cats || []).forEach(function (c) {
      if (c && out.indexOf(c) === -1) out.push(c);
    });
    return out;
  }

  function saveTransactions() { localStorage.setItem(KEYS.transactions, JSON.stringify(state.transactions)); }
  function saveCategories() {
    var custom = state.categories.filter(function (c) { return DEFAULT_CATEGORIES.indexOf(c) === -1; });
    localStorage.setItem(KEYS.categories, JSON.stringify(custom));
  }
  function saveTheme() {
    localStorage.setItem(KEYS.theme, state.theme);
    document.documentElement.setAttribute('data-theme', state.theme);
  }
  function saveLimit() { localStorage.setItem(KEYS.limit, String(state.limit)); }

  /* ---------- Helpers ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function unique(a) { var seen = {}; var out = []; a.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } }); return out; }

  function fmtMoney(n) {
    var neg = n < 0;
    var v = Math.abs(n);
    return (neg ? '-' : '') + '$' + v.toFixed(2);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function categoryColor(cat) {
    if (BASE_COLORS[cat]) return BASE_COLORS[cat];
    var idx = state.categories.indexOf(cat);
    if (idx < 0) idx = 0;
    var off = idx - DEFAULT_CATEGORIES.length;
    if (off < 0) off = idx;
    return PALETTE[off % PALETTE.length];
  }

  function monthKey(d) {
    var x = new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0');
  }
  function monthLabel(k) { var p = k.split('-'); return MONTHS[parseInt(p[1], 10) - 1] + ' ' + p[0]; }
  function formatDate(d) { return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }

  function totalSpending(list) { return (list || state.transactions).reduce(function (s, t) { return s + t.amount; }, 0); }

  /* ---------- Rendering ---------- */
  function renderBalance() {
    var total = totalSpending();
    el.totalBalance.textContent = fmtMoney(total);

    var over = state.limit > 0 && total > state.limit;
    el.totalBalance.classList.toggle('over-limit', over);
    el.summaryCard.classList.toggle('limit-exceeded', over);

    el.limitBarFill.classList.remove('lvl-ok', 'lvl-near', 'over');

    if (state.limit > 0) {
      el.limitBarWrap.classList.remove('hidden');
      var pct = (total / state.limit) * 100;
      el.limitBarFill.style.width = Math.min(100, pct) + '%';
      if (over) el.limitBarFill.classList.add('over');
      else if (pct >= 80) el.limitBarFill.classList.add('lvl-near');
      else el.limitBarFill.classList.add('lvl-ok');

      var remaining = state.limit - total;
      if (over) {
        el.limitStatus.textContent = 'Over limit by ' + fmtMoney(Math.abs(remaining)) + ' · ' + Math.round(pct) + '% used';
        el.limitStatus.className = 'limit-status warn';
      } else {
        el.limitStatus.textContent = fmtMoney(remaining) + ' left of ' + fmtMoney(state.limit) + ' · ' + Math.round(pct) + '% used';
        el.limitStatus.className = remaining < state.limit * 0.2 ? 'limit-status near' : 'limit-status ok';
      }
    } else {
      el.limitBarWrap.classList.add('hidden');
      el.limitStatus.textContent = 'Set a limit to track your budget';
      el.limitStatus.className = 'limit-status';
    }
  }

  function renderCategoryOptions() {
    var sel = el.itemCategory;
    var prev = sel.value;
    sel.innerHTML = '<option value="">Select…</option>' +
      state.categories.map(function (c) {
        return '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + '</option>';
      }).join('');
    if (state.categories.indexOf(prev) !== -1) sel.value = prev;
  }

  function renderMonthFilter() {
    var sel = el.monthFilter;
    var prev = sel.value;
    var keys = unique(state.transactions.map(function (t) { return monthKey(t.date); })).sort().reverse();
    sel.innerHTML = '<option value="all">All months</option>' +
      keys.map(function (k) { return '<option value="' + k + '">' + monthLabel(k) + '</option>'; }).join('');
    if (prev && (prev === 'all' || keys.indexOf(prev) !== -1)) sel.value = prev;
    else sel.value = 'all';
  }

  function visibleTransactions() {
    var month = el.monthFilter.value;
    var list = state.transactions.slice();
    if (month && month !== 'all') list = list.filter(function (t) { return monthKey(t.date) === month; });

    var sort = el.sortSelect.value;
    list.sort(function (a, b) {
      switch (sort) {
        case 'date-asc': return new Date(a.date) - new Date(b.date);
        case 'amount-asc': return a.amount - b.amount;
        case 'amount-desc': return b.amount - a.amount;
        case 'category-asc': return a.category.localeCompare(b.category);
        case 'category-desc': return b.category.localeCompare(a.category);
        case 'date-desc': default: return new Date(b.date) - new Date(a.date);
      }
    });
    return list;
  }

  function renderMonthSummary(list) {
    var month = el.monthFilter.value;
    if (!month || month === 'all') {
      el.monthSummary.classList.add('hidden');
      el.monthSummary.innerHTML = '';
      return;
    }
    var total = list.reduce(function (s, t) { return s + t.amount; }, 0);
    var byCat = {};
    list.forEach(function (t) { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    var overMonth = state.limit > 0 && total > state.limit;

    var rows = Object.keys(byCat).sort().map(function (c) {
      return '<div class="ms-row"><span class="ms-cat"><i class="dot" style="background:' + categoryColor(c) + '"></i>' +
        escapeHtml(c) + '</span><span class="ms-amt">' + fmtMoney(byCat[c]) + '</span></div>';
    }).join('');

    el.monthSummary.innerHTML =
      '<div class="ms-title">' + escapeHtml(monthLabel(month)) + ' Summary</div>' +
      '<div class="ms-total' + (overMonth ? ' over' : '') + '">Total: <strong>' + fmtMoney(total) + '</strong> · ' +
      list.length + (list.length === 1 ? ' item' : ' items') + (overMonth ? ' · over limit' : '') + '</div>' +
      '<div class="ms-breakdown">' + rows + '</div>';
    el.monthSummary.classList.remove('hidden');
  }

  function renderList() {
    var list = visibleTransactions();
    renderMonthSummary(list);

    if (list.length === 0) {
      el.transactionList.innerHTML = '';
      el.emptyListHint.classList.remove('hidden');
      el.emptyListHint.textContent = state.transactions.length === 0
        ? 'No transactions yet. Add one above.'
        : 'No transactions for this month.';
      return;
    }

    el.emptyListHint.classList.add('hidden');
    el.transactionList.innerHTML = list.map(function (t) {
      var color = categoryColor(t.category);
      return '<li class="tx-item" data-id="' + t.id + '">' +
        '<span class="tx-dot" style="background:' + color + '"></span>' +
        '<div class="tx-main">' +
          '<div class="tx-name">' + escapeHtml(t.name) + '</div>' +
          '<div class="tx-sub">' +
            '<span class="tx-badge" style="color:' + color + ';border-color:' + color + '">' + escapeHtml(t.category) + '</span>' +
            '<span class="tx-date">' + formatDate(t.date) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="tx-amount">' + fmtMoney(t.amount) + '</div>' +
        '<button class="del-btn" type="button" data-del="' + t.id + '" aria-label="Delete ' + escapeHtml(t.name) + '">×</button>' +
      '</li>';
    }).join('');
  }

  function renderChart() {
    if (!window.Chart) {
      el.emptyChartHint.textContent = 'Chart library unavailable (offline?).';
      el.emptyChartHint.classList.remove('hidden');
      return;
    }

    var byCat = {};
    state.transactions.forEach(function (t) { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    var labels = Object.keys(byCat);
    var data = labels.map(function (l) { return byCat[l]; });
    var colors = labels.map(function (l) { return categoryColor(l); });

    if (labels.length === 0) {
      el.emptyChartHint.textContent = 'No data yet — add an expense to see the chart.';
      el.emptyChartHint.classList.remove('hidden');
      if (chart) { chart.destroy(); chart = null; }
      return;
    }
    el.emptyChartHint.classList.add('hidden');

    var borderColor = getCssVar('--card-bg');
    var muted = getCssVar('--text-muted');

    if (!chart) {
      var ctx = el.chartCanvas.getContext('2d');
      chart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderColor: borderColor, borderWidth: 2, hoverOffset: 8 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { color: muted, boxWidth: 12, padding: 12, font: { size: 12 } } },
            tooltip: {
              callbacks: {
                label: function (c) {
                  var tot = c.dataset.data.reduce(function (a, b) { return a + b; }, 0);
                  var p = tot ? Math.round((c.parsed / tot) * 100) : 0;
                  return c.label + ': ' + fmtMoney(c.parsed) + ' (' + p + '%)';
                }
              }
            }
          }
        }
      });
    } else {
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.data.datasets[0].backgroundColor = colors;
      chart.data.datasets[0].borderColor = borderColor;
      chart.options.plugins.legend.labels.color = muted;
      chart.update();
    }
  }

  function renderAll() {
    renderBalance();
    renderCategoryOptions();
    renderMonthFilter();
    renderList();
    renderChart();
  }

  /* ---------- Actions ---------- */
  function showError(m) { el.formError.textContent = m; el.formError.classList.remove('hidden'); }
  function hideError() { el.formError.classList.add('hidden'); el.formError.textContent = ''; }

  function addExpense(e) {
    e.preventDefault();
    var name = el.itemName.value.trim();
    var amount = parseFloat(el.itemAmount.value);
    var category = el.itemCategory.value;

    if (!name) return showError('Please enter an item name.');
    if (isNaN(amount) || amount <= 0) return showError('Please enter a valid amount greater than 0.');
    if (!category) return showError('Please choose a category.');

    hideError();
    state.transactions.push({
      id: uid(),
      name: name,
      amount: amount,
      category: category,
      date: new Date().toISOString()
    });
    saveTransactions();
    el.expenseForm.reset();
    el.newCategoryWrap.classList.add('hidden');
    renderAll();
    el.itemName.focus();
  }

  function deleteExpense(id) {
    state.transactions = state.transactions.filter(function (t) { return t.id !== id; });
    saveTransactions();
    renderAll();
  }

  function addCustomCategory() {
    var name = el.newCategory.value.trim();
    if (!name) return showError('Enter a category name.');
    if (state.categories.indexOf(name) !== -1) return showError('That category already exists.');
    hideError();
    state.categories.push(name);
    saveCategories();
    el.newCategory.value = '';
    el.newCategoryWrap.classList.add('hidden');
    renderCategoryOptions();
    el.itemCategory.value = name;
    el.itemName.focus();
  }

  function setLimit() {
    var v = parseFloat(el.limitInput.value);
    if (isNaN(v) || v < 0) v = 0;
    state.limit = v;
    saveLimit();
    renderBalance();
    renderList(); // month summary "over limit" highlight depends on the limit
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    saveTheme();
    updateThemeIcon();
    renderChart(); // refresh chart colours for the new theme
  }

  function updateThemeIcon() {
    el.themeToggle.querySelector('.theme-icon').textContent = state.theme === 'dark' ? '☀️' : '🌙';
    el.themeToggle.setAttribute('aria-label', state.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }

  /* ---------- Events ---------- */
  function attachEvents() {
    el.expenseForm.addEventListener('submit', addExpense);

    el.transactionList.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-del]');
      if (btn) deleteExpense(btn.getAttribute('data-del'));
    });

    el.addCategoryBtn.addEventListener('click', function () {
      el.newCategoryWrap.classList.toggle('hidden');
      if (!el.newCategoryWrap.classList.contains('hidden')) el.newCategory.focus();
    });
    el.saveCategoryBtn.addEventListener('click', addCustomCategory);
    el.newCategory.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addCustomCategory(); }
    });

    el.limitSave.addEventListener('click', setLimit);
    el.limitInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); setLimit(); }
    });

    el.monthFilter.addEventListener('change', renderList);
    el.sortSelect.addEventListener('change', renderList);
    el.themeToggle.addEventListener('click', toggleTheme);
  }

  /* ---------- Init ---------- */
  function init() {
    el = {
      themeToggle: document.getElementById('themeToggle'),
      totalBalance: document.getElementById('totalBalance'),
      summaryCard: document.querySelector('.summary-card'),
      limitInput: document.getElementById('limitInput'),
      limitSave: document.getElementById('limitSave'),
      limitStatus: document.getElementById('limitStatus'),
      limitBarWrap: document.getElementById('limitBarWrap'),
      limitBarFill: document.getElementById('limitBarFill'),
      chartCanvas: document.getElementById('expenseChart'),
      emptyChartHint: document.getElementById('emptyChartHint'),
      expenseForm: document.getElementById('expenseForm'),
      itemName: document.getElementById('itemName'),
      itemAmount: document.getElementById('itemAmount'),
      itemCategory: document.getElementById('itemCategory'),
      addCategoryBtn: document.getElementById('addCategoryBtn'),
      newCategoryWrap: document.getElementById('newCategoryWrap'),
      newCategory: document.getElementById('newCategory'),
      saveCategoryBtn: document.getElementById('saveCategoryBtn'),
      formError: document.getElementById('formError'),
      monthFilter: document.getElementById('monthFilter'),
      sortSelect: document.getElementById('sortSelect'),
      monthSummary: document.getElementById('monthSummary'),
      transactionList: document.getElementById('transactionList'),
      emptyListHint: document.getElementById('emptyListHint')
    };

    load();

    // If no theme was explicitly saved, adopt whatever the inline
    // head script set from prefers-color-scheme.
    if (!localStorage.getItem(KEYS.theme)) {
      state.theme = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'dark' : 'light';
    }
    saveTheme();
    updateThemeIcon();

    el.limitInput.value = state.limit > 0 ? state.limit : '';

    attachEvents();
    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
