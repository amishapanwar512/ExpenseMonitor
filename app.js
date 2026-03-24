/* ═══════════════════════════════════════════
   ExpenseMonitor — App Logic
   ═══════════════════════════════════════════ */

(() => {
  'use strict';

  // ── Constants ──────────────────────────
  const STORAGE_KEY = 'expensemonitor_expenses';
  const BUDGET_KEY = 'expensemonitor_budget';
  const CUSTOM_CATS_KEY = 'expensemonitor_custom_categories';
  const SAVINGS_KEY = 'expensemonitor_savings';

  const CATEGORIES = {
    food: { emoji: '🍕', color: '#f87171' },
    transport: { emoji: '🚗', color: '#fbbf24' },
    shopping: { emoji: '🛍️', color: '#a78bfa' },
    entertainment: { emoji: '🎮', color: '#38bdf8' },
    bills: { emoji: '📄', color: '#fb923c' },
    health: { emoji: '💊', color: '#34d399' },
    other: { emoji: '📦', color: '#94a3b8' }
  };

  // Random colors pool for custom categories
  const CUSTOM_COLORS = ['#e879f9', '#2dd4bf', '#f472b6', '#facc15', '#22d3ee', '#c084fc', '#fb7185', '#4ade80', '#818cf8', '#fca5a5'];

  // ── State ──────────────────────────────
  let expenses = [];
  let savings = [];
  let budget = 0;
  let activeFilter = 'all';
  let selectedCategory = null;
  let categoryChart = null;
  let trendChart = null;
  let savingsChart = null;
  let savingsRange = 6; // months to show
  let trendRange = 7; // days to show in trend chart

  // ── DOM refs ───────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    monthLabel: $('#current-month-label'),
    budgetDisplay: $('#budget-display'),
    totalSpent: $('#total-spent'),
    totalRemaining: $('#total-remaining'),
    remainingCard: $('#card-remaining'),
    remainingBadge: $('#remaining-badge'),
    spentBar: $('#spent-bar'),
    topCategory: $('#top-category'),
    topCatAmount: $('#top-category-amount'),
    doughnutTotal: $('#doughnut-total'),
    categoryCanvas: $('#category-chart'),
    trendCanvas: $('#trend-chart'),
    filterChips: $('#filter-chips'),
    expenseList: $('#expense-list'),
    emptyState: $('#empty-state'),
    fab: $('#fab'),
    modalOverlay: $('#modal-overlay'),
    modalClose: $('#modal-close'),
    expenseForm: $('#expense-form'),
    amountInput: $('#expense-amount'),
    noteInput: $('#expense-note'),
    dateInput: $('#expense-date'),
    categoryGrid: $('#category-grid'),
    budgetBtn: $('#budget-btn'),
    budgetOverlay: $('#budget-modal-overlay'),
    budgetClose: $('#budget-modal-close'),
    budgetForm: $('#budget-form'),
    budgetInput: $('#budget-input'),
    exportBtn: $('#export-btn'),
    toast: $('#toast'),
    // Category Breakdown
    categoryBreakdown: $('#category-breakdown'),
    breakdownFooter: $('#breakdown-footer'),
    dailyAvg: $('#daily-avg'),
    catCount: $('#cat-count'),
    // Savings
    totalSaved: $('#total-saved'),
    addSavingBtn: $('#add-saving-btn'),
    savingsCanvas: $('#savings-chart'),
    savingsOverlay: $('#savings-modal-overlay'),
    savingsClose: $('#savings-modal-close'),
    savingsForm: $('#savings-form'),
    savingsAmountInput: $('#savings-amount'),
    savingsMonthInput: $('#savings-month'),
    rangeBtns: $$('.range-btn'),
    resetZoomBtn: $('#reset-zoom-btn'),
    trendRangeBtns: $('#trend-range-btns'),
    resetTrendZoomBtn: $('#reset-trend-zoom-btn')
  };

  // ── Helpers ────────────────────────────
  const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');

  function getMonthLabel(date = new Date()) {
    return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function isCurrentMonth(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }

  function friendlyDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((today - target) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return d.toLocaleDateString('en-IN', { weekday: 'long' });
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  // ── Storage ────────────────────────────
  function loadData() {
    try {
      expenses = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      budget = Number(localStorage.getItem(BUDGET_KEY)) || 0;
      savings = JSON.parse(localStorage.getItem(SAVINGS_KEY)) || [];
      const saved = JSON.parse(localStorage.getItem(CUSTOM_CATS_KEY));
      if (saved && typeof saved === 'object') {
        Object.assign(CATEGORIES, saved);
      }
    } catch {
      expenses = [];
      budget = 0;
      savings = [];
    }
  }

  function saveExpenses() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  }

  function saveBudget() {
    localStorage.setItem(BUDGET_KEY, String(budget));
  }

  function saveSavings() {
    localStorage.setItem(SAVINGS_KEY, JSON.stringify(savings));
  }

  // ── Savings CRUD ──────────────────────
  function addSaving(amount, monthStr) {
    // monthStr is 'YYYY-MM'
    const [year, month] = monthStr.split('-').map(Number);
    // Check if entry for this month already exists — update it
    const existing = savings.find(s => s.month === month && s.year === year);
    if (existing) {
      existing.amount = Number(amount);
      existing.id = Date.now();
    } else {
      savings.push({ id: Date.now(), amount: Number(amount), month, year });
    }
    saveSavings();
    render();
    showToast('Savings logged ✓');
  }

  function getCurrentMonthSavings() {
    const now = new Date();
    const entry = savings.find(s => s.month === now.getMonth() + 1 && s.year === now.getFullYear());
    return entry ? entry.amount : 0;
  }

  function currentMonthStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function saveCustomCategories() {
    // Save only custom (non-default) categories
    const defaults = ['food', 'transport', 'shopping', 'entertainment', 'bills', 'health', 'other'];
    const custom = {};
    for (const [key, val] of Object.entries(CATEGORIES)) {
      if (!defaults.includes(key)) custom[key] = val;
    }
    localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(custom));
  }

  function addCustomCategory(name, emoji) {
    const key = name.toLowerCase().trim().replace(/\s+/g, '_');
    if (CATEGORIES[key]) return false; // already exists
    const colorIdx = Object.keys(CATEGORIES).length % CUSTOM_COLORS.length;
    CATEGORIES[key] = { emoji, color: CUSTOM_COLORS[colorIdx] };
    saveCustomCategories();
    renderCustomCatButtons();
    return key;
  }

  // ── Core Data ──────────────────────────
  function addExpense(amount, category, note, date) {
    const expense = {
      id: Date.now(),
      amount: Number(amount),
      category,
      note,
      date
    };
    expenses.push(expense);
    saveExpenses();
    render();
    showToast('Expense added ✓');
  }

  function deleteExpense(id) {
    expenses = expenses.filter(e => e.id !== id);
    saveExpenses();
    render();
    showToast('Expense deleted');
  }

  function getCurrentMonthExpenses() {
    return expenses.filter(e => isCurrentMonth(e.date));
  }

  function getFilteredExpenses() {
    let list = getCurrentMonthExpenses();
    if (activeFilter !== 'all') {
      list = list.filter(e => e.category === activeFilter);
    }
    return list.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  }

  function getCategoryTotals() {
    const totals = {};
    getCurrentMonthExpenses().forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return totals;
  }

  function getTotal() {
    return getCurrentMonthExpenses().reduce((s, e) => s + e.amount, 0);
  }

  // ── Render: Summary Cards ──────────────
  function renderSummary() {
    const total = getTotal();
    const remaining = budget - total;
    const isOver = budget > 0 && total > budget;

    animateValue(dom.totalSpent, total);
    dom.budgetDisplay.textContent = fmt(budget);

    if (budget > 0) {
      animateValue(dom.totalRemaining, Math.abs(remaining));
      dom.remainingCard.classList.toggle('over', isOver);
      dom.remainingBadge.textContent = isOver ? 'over budget!' : 'on track';
      const pct = Math.min((total / budget) * 100, 100);
      dom.spentBar.style.width = pct + '%';
    } else {
      dom.totalRemaining.textContent = '—';
      dom.remainingBadge.textContent = 'set budget';
      dom.spentBar.style.width = '0%';
      dom.remainingCard.classList.remove('over');
    }

    // Top category
    const catTotals = getCategoryTotals();
    const entries = Object.entries(catTotals);
    if (entries.length > 0) {
      entries.sort((a, b) => b[1] - a[1]);
      const [cat, amt] = entries[0];
      dom.topCategory.textContent = CATEGORIES[cat].emoji + ' ' + cat;
      dom.topCatAmount.textContent = fmt(amt);
    } else {
      dom.topCategory.textContent = '—';
      dom.topCatAmount.textContent = '';
    }
  }

  function animateValue(el, target) {
    const start = parseInt(el.textContent.replace(/[^\d]/g, '')) || 0;
    if (start === target) { el.textContent = fmt(target); return; }
    const duration = 500;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = fmt(Math.round(start + (target - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ── Render: Charts ─────────────────────
  function renderCharts() {
    renderCategoryChart();
    renderCategoryBreakdown();
    renderTrendChart();
    renderSavingsChart();
  }

  function renderCategoryChart() {
    const catTotals = getCategoryTotals();
    const cats = Object.keys(catTotals);
    const values = cats.map(c => catTotals[c]);
    const colors = cats.map(c => CATEGORIES[c]?.color || '#94a3b8');
    const total = getTotal();

    dom.doughnutTotal.textContent = fmt(total);

    const data = {
      labels: cats.map(c => c.charAt(0).toUpperCase() + c.slice(1)),
      datasets: [{
        data: values.length ? values : [1],
        backgroundColor: values.length ? colors : ['rgba(255,255,255,0.06)'],
        borderWidth: 0,
        hoverOffset: 6
      }]
    };

    if (categoryChart) {
      categoryChart.data = data;
      categoryChart.update('active');
    } else {
      categoryChart = new Chart(dom.categoryCanvas, {
        type: 'doughnut',
        data,
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '72%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15,15,26,0.9)',
              titleFont: { family: 'Inter', size: 12 },
              bodyFont: { family: 'Inter', size: 12 },
              borderColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: (ctx) => ' ₹' + ctx.parsed.toLocaleString('en-IN')
              }
            }
          },
          animation: {
            animateRotate: true,
            duration: 800,
            easing: 'easeOutQuart'
          }
        }
      });
    }
  }
  function renderCategoryBreakdown() {
    const catTotals = getCategoryTotals();
    const entries = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const total = getTotal();

    if (entries.length === 0) {
      dom.categoryBreakdown.innerHTML = `
        <div class="breakdown-empty">
          <span class="empty-icon">📊</span>
          <p>Add expenses to see breakdown</p>
        </div>`;
      dom.breakdownFooter.style.display = 'none';
      return;
    }

    const max = entries[0][1];
    let html = '';
    entries.forEach(([cat, amt]) => {
      const info = CATEGORIES[cat] || { emoji: '📦', color: '#94a3b8' };
      const pct = max > 0 ? (amt / max) * 100 : 0;
      const share = total > 0 ? Math.round((amt / total) * 100) : 0;
      html += `
        <div class="breakdown-item">
          <span class="breakdown-color" style="background:${info.color}"></span>
          <span class="breakdown-label">${info.emoji} ${cat}</span>
          <div class="breakdown-bar-wrap">
            <div class="breakdown-bar-fill" style="width:${pct}%;background:${info.color}"></div>
          </div>
          <span class="breakdown-amount">${fmt(amt)} <small style="color:var(--text-muted);font-weight:400">${share}%</small></span>
        </div>`;
    });
    dom.categoryBreakdown.innerHTML = html;

    // Footer stats
    const now = new Date();
    const daysInMonth = now.getDate();
    const dailyAvg = daysInMonth > 0 ? Math.round(total / daysInMonth) : 0;
    dom.dailyAvg.textContent = fmt(dailyAvg);
    dom.catCount.textContent = entries.length;
    dom.breakdownFooter.style.display = 'flex';
  }

  function renderTrendChart() {
    const days = [];
    const totals = [];
    const now = new Date();
    const range = trendRange === 0 ? 365 * 5 : trendRange; // 0 = All → show 5 years max

    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayTotal = expenses
        .filter(e => e.date === ds)
        .reduce((s, e) => s + e.amount, 0);
      // Only include days that have spending, or always include for small ranges
      if (range <= 31 || dayTotal > 0 || i === 0 || i === range - 1) {
        // Smart label formatting based on range
        let label;
        if (range <= 7) {
          label = d.toLocaleDateString('en-IN', { weekday: 'short' });
        } else if (range <= 31) {
          label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        } else {
          label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
        }
        days.push(label);
        totals.push(dayTotal);
      }
    }

    // For large ranges with no data, ensure at least some labels
    if (days.length === 0) {
      days.push('No data');
      totals.push(0);
    }

    const ctx = dom.trendCanvas.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, 0, 220);
    grd.addColorStop(0, 'rgba(167, 139, 250, 0.25)');
    grd.addColorStop(1, 'rgba(167, 139, 250, 0.0)');

    const data = {
      labels: days,
      datasets: [{
        label: 'Spending',
        data: totals,
        borderColor: '#a78bfa',
        backgroundColor: grd,
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: range <= 31 ? 4 : 3,
        pointBackgroundColor: '#a78bfa',
        pointBorderColor: '#0a0a14',
        pointBorderWidth: 2,
        pointHoverRadius: 6
      }]
    };

    if (trendChart) {
      trendChart.data = data;
      trendChart.update('active');
    } else {
      trendChart = new Chart(dom.trendCanvas, {
        type: 'line',
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: {
                color: '#55556e',
                font: { family: 'Inter', size: 11 },
                maxRotation: 45,
                maxTicksLimit: range <= 31 ? 15 : 20
              }
            },
            y: {
              beginAtZero: true,
              grid: { color: 'rgba(255,255,255,0.04)' },
              ticks: {
                color: '#55556e',
                font: { family: 'Inter', size: 11 },
                callback: (v) => '₹' + v.toLocaleString('en-IN')
              }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15,15,26,0.9)',
              titleFont: { family: 'Inter', size: 12 },
              bodyFont: { family: 'Inter', size: 12 },
              borderColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: (ctx) => ' ₹' + ctx.parsed.y.toLocaleString('en-IN')
              }
            },
            zoom: {
              pan: {
                enabled: true,
                mode: 'x',
                modifierKey: null
              },
              zoom: {
                wheel: { enabled: true },
                pinch: { enabled: true },
                mode: 'x'
              }
            }
          },
          animation: {
            duration: 800,
            easing: 'easeOutQuart'
          }
        }
      });
    }
  }

  // ── Render: Savings Chart ──────────────
  function renderSavingsChart() {
    // Sort savings by date
    const sorted = [...savings].sort((a, b) => (a.year - b.year) || (a.month - b.month));
    if (sorted.length === 0) {
      // Show empty placeholder data
      const emptyData = { labels: ['No data yet'], datasets: [{ data: [0], borderColor: '#2dd4bf', backgroundColor: 'rgba(45,212,191,0)', borderWidth: 2, pointRadius: 0 }] };
      if (savingsChart) { savingsChart.data = emptyData; savingsChart.update(); }
      else { createSavingsChart(emptyData); }
      return;
    }

    // Filter by range
    let filtered = sorted;
    if (savingsRange > 0) {
      const now = new Date();
      const cutoff = new Date(now.getFullYear(), now.getMonth() - savingsRange + 1, 1);
      filtered = sorted.filter(s => {
        const d = new Date(s.year, s.month - 1, 1);
        return d >= cutoff;
      });
      // If no data in range, show all
      if (filtered.length === 0) filtered = sorted;
    }

    const labels = filtered.map(s => {
      const d = new Date(s.year, s.month - 1);
      return d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
    });
    const values = filtered.map(s => s.amount);

    const ctx = dom.savingsCanvas.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, 0, 220);
    grd.addColorStop(0, 'rgba(45, 212, 191, 0.25)');
    grd.addColorStop(1, 'rgba(45, 212, 191, 0.0)');

    const data = {
      labels,
      datasets: [{
        label: 'Savings',
        data: values,
        borderColor: '#2dd4bf',
        backgroundColor: grd,
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 5,
        pointBackgroundColor: '#2dd4bf',
        pointBorderColor: '#0a0a14',
        pointBorderWidth: 2,
        pointHoverRadius: 7
      }]
    };

    if (savingsChart) {
      savingsChart.data = data;
      savingsChart.update('active');
    } else {
      createSavingsChart(data);
    }
  }

  function createSavingsChart(data) {
    savingsChart = new Chart(dom.savingsCanvas, {
      type: 'line',
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#55556e', font: { family: 'Inter', size: 11 } }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: {
              color: '#55556e',
              font: { family: 'Inter', size: 11 },
              callback: (v) => '₹' + v.toLocaleString('en-IN')
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,15,26,0.9)',
            titleFont: { family: 'Inter', size: 12 },
            bodyFont: { family: 'Inter', size: 12 },
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ' ₹' + ctx.parsed.y.toLocaleString('en-IN')
            }
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
              modifierKey: null
            },
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: 'x'
            }
          }
        },
        animation: { duration: 800, easing: 'easeOutQuart' }
      }
    });
  }

  // ── Render: Savings Summary ────────────
  function renderSavingsSummary() {
    const total = getCurrentMonthSavings();
    animateValue(dom.totalSaved, total);
  }

  // ── Render: Filter Chips ───────────────
  function renderFilterChips() {
    const usedCats = [...new Set(getCurrentMonthExpenses().map(e => e.category))];
    let html = '<button class="chip ' + (activeFilter === 'all' ? 'active' : '') + '" data-cat="all">All</button>';
    usedCats.forEach(cat => {
      const info = CATEGORIES[cat] || { emoji: '📦', color: '#94a3b8' };
      html += `<button class="chip ${activeFilter === cat ? 'active' : ''}" data-cat="${cat}">${info.emoji} ${cat.charAt(0).toUpperCase() + cat.slice(1)}</button>`;
    });
    dom.filterChips.innerHTML = html;
  }

  // ── Render: Expense List ───────────────
  function renderExpenseList() {
    const list = getFilteredExpenses();

    if (list.length === 0) {
      dom.emptyState.style.display = 'block';
      // Remove all items but keep empty state
      const items = dom.expenseList.querySelectorAll('.date-group-label, .expense-item');
      items.forEach(el => el.remove());
      return;
    }

    dom.emptyState.style.display = 'none';

    let html = '';
    let lastDate = '';
    list.forEach(e => {
      if (e.date !== lastDate) {
        lastDate = e.date;
        html += `<div class="date-group-label">${friendlyDate(e.date)}</div>`;
      }
      const cat = CATEGORIES[e.category] || CATEGORIES.other;
      html += `
        <div class="expense-item" data-id="${e.id}">
          <div class="expense-emoji">${cat.emoji}</div>
          <div class="expense-info">
            <div class="expense-cat">${e.category}</div>
            ${e.note ? `<div class="expense-note">${escapeHtml(e.note)}</div>` : ''}
          </div>
          <div class="expense-amount">${fmt(e.amount)}</div>
          <button class="expense-delete" title="Delete">&times;</button>
        </div>
      `;
    });

    // Replace content except empty state
    const frag = document.createElement('div');
    frag.innerHTML = html;
    // Remove old items
    const old = dom.expenseList.querySelectorAll('.date-group-label, .expense-item');
    old.forEach(el => el.remove());
    // Append new
    while (frag.firstChild) {
      dom.expenseList.appendChild(frag.firstChild);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Render: Custom Category Buttons ────
  function renderCustomCatButtons() {
    // Remove previously injected custom buttons (but keep the Add button)
    dom.categoryGrid.querySelectorAll('.cat-btn.custom-cat').forEach(b => b.remove());
    const defaults = ['food', 'transport', 'shopping', 'entertainment', 'bills', 'health', 'other'];
    const addBtn = $('#add-cat-btn');
    for (const [key, val] of Object.entries(CATEGORIES)) {
      if (defaults.includes(key)) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-btn custom-cat';
      btn.dataset.cat = key;
      btn.innerHTML = `<span>${val.emoji}</span>${key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}`;
      dom.categoryGrid.insertBefore(btn, addBtn);
    }
  }

  // ── Full Render ────────────────────────
  function render() {
    dom.monthLabel.textContent = getMonthLabel();
    renderSummary();
    renderSavingsSummary();
    renderCharts();
    renderFilterChips();
    renderExpenseList();
    renderCustomCatButtons();
  }

  // ── CRUD ───────────────────────────────
  function addExpense(amount, category, note, date) {
    expenses.push({
      id: Date.now(),
      amount: Number(amount),
      category,
      note: note.trim(),
      date
    });
    saveExpenses();
    render();
    showToast('Expense added ✓');
  }

  function deleteExpense(id) {
    expenses = expenses.filter(e => e.id !== id);
    saveExpenses();
    render();
    showToast('Expense deleted');
  }

  // ── Modal Logic ────────────────────────
  function openModal(overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function resetForm() {
    dom.expenseForm.reset();
    dom.dateInput.value = todayStr();
    selectedCategory = null;
    $$('.cat-btn').forEach(b => b.classList.remove('selected'));
  }

  // ── Toast ──────────────────────────────
  function showToast(msg) {
    dom.toast.textContent = msg;
    dom.toast.classList.add('show');
    setTimeout(() => dom.toast.classList.remove('show'), 2200);
  }

  // ── CSV Export ─────────────────────────
  function exportCSV() {
    const data = getCurrentMonthExpenses();
    if (data.length === 0) { showToast('No expenses to export'); return; }
    let csv = 'Date,Category,Amount,Note\n';
    data.sort((a, b) => a.date.localeCompare(b.date)).forEach(e => {
      csv += `${e.date},${e.category},${e.amount},"${e.note.replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${getMonthLabel().replace(' ', '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded ✓');
  }

  // ── Event Listeners ────────────────────
  function bindEvents() {
    // FAB → open add modal
    dom.fab.addEventListener('click', () => {
      resetForm();
      openModal(dom.modalOverlay);
      setTimeout(() => dom.amountInput.focus(), 350);
    });

    // Close modals
    dom.modalClose.addEventListener('click', () => closeModal(dom.modalOverlay));
    dom.modalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.modalOverlay) closeModal(dom.modalOverlay);
    });

    dom.budgetClose.addEventListener('click', () => closeModal(dom.budgetOverlay));
    dom.budgetOverlay.addEventListener('click', (e) => {
      if (e.target === dom.budgetOverlay) closeModal(dom.budgetOverlay);
    });

    // ESC to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal(dom.modalOverlay);
        closeModal(dom.budgetOverlay);
      }
    });

    // Category selection
    dom.categoryGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.cat-btn');
      if (!btn) return;
      // Ignore clicks on the Add button
      if (btn.id === 'add-cat-btn') return;
      $$('.cat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedCategory = btn.dataset.cat;
    });

    // Add Category button
    const addCatBtn = $('#add-cat-btn');
    const addCatForm = $('#add-cat-form');
    const newCatEmoji = $('#new-cat-emoji');
    const newCatName = $('#new-cat-name');
    const saveCatBtn = $('#save-cat-btn');
    const cancelCatBtn = $('#cancel-cat-btn');

    addCatBtn.addEventListener('click', () => {
      addCatForm.style.display = 'flex';
      newCatEmoji.value = '';
      newCatName.value = '';
      newCatEmoji.focus();
    });

    cancelCatBtn.addEventListener('click', () => {
      addCatForm.style.display = 'none';
    });

    saveCatBtn.addEventListener('click', () => {
      const emoji = newCatEmoji.value.trim() || '🏷️';
      const name = newCatName.value.trim();
      if (!name) { showToast('Enter a category name'); return; }
      const key = addCustomCategory(name, emoji);
      if (!key) { showToast('Category already exists'); return; }
      addCatForm.style.display = 'none';
      showToast('Category added ✓');
      // Auto-select the new category
      $$('.cat-btn').forEach(b => b.classList.remove('selected'));
      const newBtn = dom.categoryGrid.querySelector(`[data-cat="${key}"]`);
      if (newBtn) { newBtn.classList.add('selected'); selectedCategory = key; }
    });

    // Submit expense
    dom.expenseForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = dom.amountInput.value;
      const note = dom.noteInput.value;
      const date = dom.dateInput.value;

      if (!selectedCategory) {
        showToast('Please select a category');
        return;
      }
      if (!amount || Number(amount) <= 0) {
        showToast('Enter a valid amount');
        return;
      }

      addExpense(amount, selectedCategory, note, date);
      closeModal(dom.modalOverlay);
    });

    // Budget modal
    dom.budgetBtn.addEventListener('click', () => {
      dom.budgetInput.value = budget || '';
      openModal(dom.budgetOverlay);
      setTimeout(() => dom.budgetInput.focus(), 350);
    });

    dom.budgetForm.addEventListener('submit', (e) => {
      e.preventDefault();
      budget = Number(dom.budgetInput.value) || 0;
      saveBudget();
      closeModal(dom.budgetOverlay);
      render();
      showToast('Budget updated ✓');
    });

    // Filter chips
    dom.filterChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      activeFilter = chip.dataset.cat;
      renderFilterChips();
      renderExpenseList();
    });

    // Delete expense
    dom.expenseList.addEventListener('click', (e) => {
      const btn = e.target.closest('.expense-delete');
      if (!btn) return;
      const item = btn.closest('.expense-item');
      const id = Number(item.dataset.id);
      // Animate out
      item.style.opacity = '0';
      item.style.transform = 'translateX(30px)';
      item.style.transition = '0.25s ease';
      setTimeout(() => deleteExpense(id), 250);
    });

    // Export
    dom.exportBtn.addEventListener('click', exportCSV);

    // ── Savings Modal ────────────────────
    dom.addSavingBtn.addEventListener('click', () => {
      dom.savingsAmountInput.value = '';
      dom.savingsMonthInput.value = currentMonthStr();
      openModal(dom.savingsOverlay);
      setTimeout(() => dom.savingsAmountInput.focus(), 350);
    });

    dom.savingsClose.addEventListener('click', () => closeModal(dom.savingsOverlay));
    dom.savingsOverlay.addEventListener('click', (e) => {
      if (e.target === dom.savingsOverlay) closeModal(dom.savingsOverlay);
    });

    dom.savingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = dom.savingsAmountInput.value;
      const monthVal = dom.savingsMonthInput.value;
      if (!amount || Number(amount) < 0) { showToast('Enter a valid amount'); return; }
      if (!monthVal) { showToast('Select a month'); return; }
      addSaving(amount, monthVal);
      closeModal(dom.savingsOverlay);
    });

    // ESC also closes savings modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal(dom.savingsOverlay);
    });

    // ── Savings Chart Range Buttons ──────
    document.querySelector('.range-btns').addEventListener('click', (e) => {
      const btn = e.target.closest('.range-btn');
      if (!btn) return;
      dom.rangeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      savingsRange = Number(btn.dataset.range);
      // Destroy and recreate to reset zoom state
      if (savingsChart) { savingsChart.destroy(); savingsChart = null; }
      renderSavingsChart();
    });

    // Reset Zoom (Savings)
    dom.resetZoomBtn.addEventListener('click', () => {
      if (savingsChart) savingsChart.resetZoom();
    });

    // ── Trend Chart Range Buttons ────────
    dom.trendRangeBtns.addEventListener('click', (e) => {
      const btn = e.target.closest('.range-btn');
      if (!btn) return;
      dom.trendRangeBtns.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      trendRange = Number(btn.dataset.range);
      if (trendChart) { trendChart.destroy(); trendChart = null; }
      renderTrendChart();
    });

    // Reset Zoom (Trend)
    dom.resetTrendZoomBtn.addEventListener('click', () => {
      if (trendChart) trendChart.resetZoom();
    });
  }

  // ── Init ───────────────────────────────
  function init() {
    loadData();
    dom.dateInput.value = todayStr();
    bindEvents();
    render();
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
