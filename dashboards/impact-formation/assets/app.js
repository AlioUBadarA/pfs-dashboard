/* PFS Sales Training dashboard: fetches the model computed by the Apps Script web app
 * (Api.gs) and renders it. All text from the data is inserted with textContent. */
(function () {
  'use strict';

  var cfg = window.PFS_CONFIG || {};
  var ALL_COUNTRIES = 'All countries';
  var ALL_FORMATS = 'All formats';

  // Brand colours sent by the API, mapped to chart fills that pass contrast and colour-blind checks.
  var CHART_COLOURS = {
    '#2A6AA3': '#2A6AA3',
    '#5DB246': '#4F9A3A',
    '#E3B23C': '#C9961F',
    '#C22A3A': '#C22A3A',
    '#3A6AB2': '#3A6AB2'
  };
  var INK = '#1F2A37', INK_SOFT = '#5B6775', GRID = '#E5EAF0';

  var el = {
    country: document.getElementById('f-country'),
    format: document.getElementById('f-format'),
    scope: document.getElementById('scope'),
    kpis: document.getElementById('kpis'),
    guide: document.getElementById('guide'),
    content: document.getElementById('content'),
    state: document.getElementById('state'),
    updated: document.getElementById('updated'),
    title: document.getElementById('title'),
    subtitle: document.getElementById('subtitle')
  };
  var I18N = window.PFS_I18N;
  var tr = I18N.tr, tx = I18N.t;
  var charts = [];
  var requestId = 0;
  var lastData = null;

  /* ---------------- Helpers ---------------- */

  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  /** Formats a value with the Google Sheets number format the API attached to it. */
  function fmt(v, f) {
    if (v === '' || v === null || v === undefined) return '';
    if (!isNum(v)) return String(v);
    f = f || '0';
    var sign = function (x) { return x > 0 ? '+' : (x < 0 ? '-' : ''); };
    if (f.indexOf('pts') > -1) {
      var p = Math.round(v);
      return sign(p) + Math.abs(p) + (Math.abs(p) > 1 ? ' pts' : ' pt');
    }
    if (f.indexOf('+0.0') === 0) { var s = Math.round(v * 10) / 10; return sign(s) + Math.abs(s).toFixed(1) + ' pt'; }
    if (f.indexOf('+0') === 0) { var i = Math.round(v); return sign(i) + Math.abs(i); }
    if (f === '0%') return Math.round(v * 100) + '%';
    if (f === '0.0') return v.toFixed(1);
    if (f === '0') return String(Math.round(v));
    return String(v);
  }

  function setState(text, isError) {
    el.state.textContent = text || '';
    el.state.className = 'state' + (isError ? ' error' : '');
  }

  function fillSelect(select, options, current) {
    select.textContent = '';
    options.forEach(function (o) {
      var opt = make('option', null, tr(o));
      opt.value = o;
      if (o === current) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function readUrl() {
    var q = new URLSearchParams(location.search);
    return { country: q.get('country') || ALL_COUNTRIES, format: q.get('format') || ALL_FORMATS };
  }

  function writeUrl(country, format) {
    var q = new URLSearchParams();
    if (/[?&]demo=1/.test(location.search)) q.set('demo', '1');
    if (country !== ALL_COUNTRIES) q.set('country', country);
    if (format !== ALL_FORMATS) q.set('format', format);
    if (I18N.lang === 'fr') q.set('lang', 'fr');
    var s = q.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : ''));
  }

  function cacheGet(key) {
    try { var x = sessionStorage.getItem(key); return x ? JSON.parse(x) : null; } catch (e) { return null; }
  }
  function cachePut(key, data) {
    try { sessionStorage.setItem(key, JSON.stringify(data)); } catch (e) { /* storage unavailable: ignore */ }
  }

  /* ---------------- Data ---------------- */

  function load(country, format) {
    var id = ++requestId;
    var key = 'pfs|' + country + '|' + format;
    var cached = cacheGet(key);
    if (cached) { render(cached); }
    else { setState(tx('Loading the latest figures…', 'Chargement des derniers chiffres…')); el.content.style.opacity = '0.4'; }
    el.country.disabled = true; el.format.disabled = true;

    var url;
    if (/[?&]demo=1/.test(location.search)) {
      url = 'demo.json';
    } else {
      if (!cfg.API_URL || cfg.API_URL.indexOf('http') !== 0) {
        setState(tx('The data address is not set yet: paste the Apps Script web app URL in assets/config.js.', 'L\'adresse des données n\'est pas encore définie : collez l\'URL de l\'application web Apps Script dans assets/config.js.'), true);
        return;
      }
      url = cfg.API_URL + (cfg.API_URL.indexOf('?') > -1 ? '&' : '?') +
        'country=' + encodeURIComponent(country) + '&format=' + encodeURIComponent(format);
    }

    fetch(url, { redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (data) {
        if (url === 'demo.json') data = data[country + '|' + format] || data[ALL_COUNTRIES + '|' + ALL_FORMATS];
        if (!data || !data.ok) throw new Error((data && data.error) || 'Unexpected answer');
        if (id !== requestId) return;
        cachePut(key, data);
        render(data);
        setState('');
      })
      .catch(function (err) {
        if (id !== requestId) return;
        if (!cached) setState(tx('The figures could not be loaded (' + err.message + '). Please refresh the page in a minute.', 'Les chiffres n\'ont pas pu être chargés (' + err.message + '). Rechargez la page dans une minute.'), true);
      })
      .then(function () {
        if (id !== requestId) return;
        el.country.disabled = false; el.format.disabled = false;
        el.content.style.opacity = '';
      });
  }

  /* ---------------- Rendering ---------------- */

  function render(d) {
    lastData = d;
    var f = d.filter || {};
    if (d.title) { el.title.textContent = tr(d.title); document.title = tr(d.title); }
    if (d.subtitle) el.subtitle.textContent = tr(d.subtitle);
    fillSelect(el.country, f.options || [ALL_COUNTRIES], f.choix);
    fillSelect(el.format, f.optionsFormat || [ALL_FORMATS], f.format);
    el.scope.textContent = tr(f.perimetre || '');
    el.updated.textContent = d.updated ? tx('Computed on ', 'Calculé le ') + new Date(d.updated).toLocaleString(tx('en-GB', 'fr-FR'),
      { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    renderKpis(d.kpis || []);
    if (d.guide) {
      el.guide.textContent = d.guide.replace(/^HOW TO READ\s+/, '').split(/\s{3,}/).map(tr).join('  ·  ');
      el.guide.insertBefore(make('strong', null, tx('How to read  ', 'Comment lire  ')), el.guide.firstChild);
      el.guide.hidden = false;
    }
    renderBlocks(d.blocks || []);
  }

  function renderKpis(kpis) {
    el.kpis.textContent = '';
    kpis.forEach(function (k) {
      var card = make('article', 'kpi');
      card.style.borderTopColor = k.accent || '';
      card.appendChild(make('h2', null, tr(k.titre)));
      card.appendChild(make('p', 'value', String(k.valeur || '').trim()));
      var det = make('p', 'detail', tr(String(k.detail || '').trim()));
      if (k.couleurDetail && k.couleurDetail !== INK_SOFT) det.style.color = k.couleurDetail;
      card.appendChild(det);
      el.kpis.appendChild(card);
    });
  }

  function renderBlocks(blocks) {
    charts.forEach(function (c) { c.destroy(); });
    charts = [];
    el.content.textContent = '';
    var section = null;
    blocks.forEach(function (b) {
      if (b.type === 'section') {
        section = make('section', 'section' + (b.vedette ? ' featured' : ''));
        var head = make('div', 'section-head');
        head.appendChild(make('h2', null, tr(b.titre)));
        section.appendChild(head);
        if (b.intro) section.appendChild(make('p', 'intro', tr(b.intro)));
        el.content.appendChild(section);
      } else if (b.type === 'tableau') {
        (section || el.content).appendChild(renderTable(b));
      }
    });
  }

  /** Index of the columns that hold something (empty headers and empty cells are dropped). */
  function usedColumns(t) {
    var cols = [];
    for (var c = 0; c < t.entetes.length; c++) {
      var used = c === 0 || String(t.entetes[c]).trim() !== '' ||
        t.lignes.some(function (l) { return l.v[c] !== '' && l.v[c] !== null && l.v[c] !== undefined; });
      if (used) cols.push(c);
    }
    return cols;
  }

  function renderTable(t) {
    var block = make('div', 'block' + (t.graphique ? ' with-chart' : ''));
    var left = make('div');
    if (t.soustitre) left.appendChild(make('h3', null, tr(t.soustitre)));

    var cols = usedColumns(t);
    var wrap = make('div', 'table-wrap');
    var table = make('table');
    var thead = make('thead'), trh = make('tr');
    cols.forEach(function (c) { var th = make('th', null, tr(t.entetes[c])); th.scope = 'col'; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);

    var tbody = make('tbody');
    var isComparison = t.entetes[3] === 'Change';
    t.lignes.forEach(function (l) {
      var row = make('tr', l.style === 'total' ? 'total' : (l.style === 'selection' ? 'selection' : (l.style === 'attenue' ? 'muted' : '')));
      cols.forEach(function (c) {
        var text = fmt(l.v[c], l.f && l.f[c]);
        var td = make('td', null, c === 0 ? tr(text) : text);
        if (c === 0) { td.scope = 'row'; }
        if (l.couleursValeurs && l.couleursValeurs[c]) td.style.color = l.couleursValeurs[c];
        else if (isComparison && c === 3 && isNum(l.evo) && l.evo !== 0 && !l.neutre) td.className = l.evo > 0 ? 'up' : 'down';
        else if (isComparison && (c === 4 || c === 5)) td.className = 'soft';
        else if (!l.couleursValeurs && t.entetes[1] === 'After' && c === 2) td.className = 'soft';
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    left.appendChild(wrap);
    if (t.note) left.appendChild(make('p', 'note', tr(t.note)));
    block.appendChild(left);

    if (t.graphique && t.graphique.nb) block.appendChild(renderChart(t, t.graphique));
    return block;
  }

  /** Draws each bar's value at its end (selective labels: one value per bar, no clutter). */
  var valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.show) return;
      var ctx = chart.ctx;
      ctx.save();
      ctx.font = '600 11px "Open Sans", Arial, sans-serif';
      ctx.fillStyle = INK;
      var horizontal = chart.options.indexAxis === 'y';
      chart.data.datasets.forEach(function (ds, i) {
        var meta = chart.getDatasetMeta(i);
        if (meta.hidden) return;
        meta.data.forEach(function (bar, j) {
          var v = ds.data[j];
          if (!isNum(v) || v === 0) return;
          var txt = opts.format(v);
          if (opts.stacked) {
            var w = Math.abs(bar.x - bar.base);
            if (w < 34) return;
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(txt, (bar.x + bar.base) / 2, bar.y);
            ctx.fillStyle = INK;
          } else if (horizontal) {
            ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(txt, bar.x + 4, bar.y);
          } else {
            ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText(txt, bar.x, bar.y - 3);
          }
        });
      });
      ctx.restore();
    }
  };

  function renderChart(t, g) {
    var card = make('figure', 'chart-card');
    card.style.margin = '0';
    card.appendChild(make('h4', null, tr(g.titre)));
    var box = make('div', 'chart-box' + (g.empile ? ' short' : ''));
    var canvas = make('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', tr(g.titre) + tx('. The same figures are in the table.', '. Les mêmes chiffres figurent dans le tableau.'));
    box.appendChild(canvas);
    card.appendChild(box);

    var rows = t.lignes.slice(0, g.nb);
    var pct = g.format === 'pct';
    var labels = rows.map(function (l) { return tr(String(l.v[0])); });
    var datasets = g.series.map(function (s, i) {
      var colour = CHART_COLOURS[(g.couleurs[i] || '').toUpperCase()] || g.couleurs[i] || '#2A6AA3';
      return {
        label: tr(t.entetes[s] || ''),
        data: rows.map(function (l) { var v = l.v[s]; return isNum(v) ? (pct ? v * 100 : v) : 0; }),
        backgroundColor: colour,
        borderRadius: 4,
        borderSkipped: 'start',
        maxBarThickness: g.empile ? 46 : 34,
        categoryPercentage: 0.72,
        barPercentage: 0.9
      };
    });
    var horizontal = g.type === 'barres';
    var formatValue = function (v) {
      if (pct) return Math.round(v) + '%';
      if (g.format === 'score9') return (Math.round(v * 10) / 10).toFixed(1);
      return String(Math.round(v));
    };
    var valueAxis = {
      beginAtZero: true,
      min: 0,
      max: pct ? 100 : (g.format === 'score9' ? 9 : undefined),
      grid: { color: GRID },
      border: { display: false },
      ticks: { color: INK_SOFT, font: { size: 11 }, callback: function (v) { return pct ? v + '%' : v; } },
      stacked: !!g.empile
    };
    var catAxis = {
      grid: { display: false },
      ticks: { color: INK, font: { size: 11 }, autoSkip: false,
        callback: function (v) { var s = this.getLabelForValue(v); return s.length > 28 ? s.slice(0, 27) + '…' : s; } },
      stacked: !!g.empile
    };
    if (g.empile) labels = [''];

    var chart = new Chart(canvas, {
      type: 'bar',
      data: { labels: labels, datasets: datasets },
      plugins: [valueLabels],
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        layout: { padding: { top: horizontal ? 0 : 16, right: horizontal && !g.empile ? 36 : 8 } },
        scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
        plugins: {
          legend: { display: datasets.length > 1, position: 'bottom',
            labels: { color: INK_SOFT, boxWidth: 12, boxHeight: 12, font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: function (c) { return ' ' + c.dataset.label + ': ' + formatValue(c.raw); }
            }
          },
          valueLabels: { show: true, stacked: !!g.empile, format: formatValue }
        }
      }
    });
    charts.push(chart);
    return card;
  }

  /* ---------------- Language ---------------- */

  /** Texts that live in index.html. */
  function applyStaticTexts() {
    document.documentElement.lang = I18N.lang;
    document.getElementById('l-country').textContent = tx('Country', 'Pays');
    document.getElementById('l-format').textContent = tx('Session format', 'Format de session');
    document.getElementById('filters').setAttribute('aria-label', tx('Filters', 'Filtres'));
    el.kpis.setAttribute('aria-label', tx('Key figures', 'Chiffres clés'));
    document.getElementById('source').textContent = tx(
      'Source: Google Forms answers and attendance sheets of the PFS sales training. Figures are computed automatically from the live Google Sheet.',
      'Source : réponses aux Google Forms et feuilles de présence de la formation commerciale PFS. Les chiffres sont calculés automatiquement à partir du Google Sheet en direct.');
    if (!lastData) {
      el.title.textContent = tr(el.title.textContent);
      document.title = el.title.textContent;
      el.scope.textContent = tx('Loading…', 'Chargement…');
      fillSelect(el.country, [ALL_COUNTRIES], ALL_COUNTRIES);
      fillSelect(el.format, [ALL_FORMATS], ALL_FORMATS);
    }
    document.getElementById('lang-en').setAttribute('aria-pressed', I18N.lang === 'en');
    document.getElementById('lang-fr').setAttribute('aria-pressed', I18N.lang === 'fr');
  }

  function setLang(l) {
    if (l === I18N.lang) return;
    I18N.set(l);
    applyStaticTexts();
    writeUrl(el.country.value || ALL_COUNTRIES, el.format.value || ALL_FORMATS);
    if (lastData) render(lastData);
  }
  document.getElementById('lang-en').addEventListener('click', function () { setLang('en'); });
  document.getElementById('lang-fr').addEventListener('click', function () { setLang('fr'); });

  /* ---------------- Start ---------------- */

  function onChange() {
    writeUrl(el.country.value, el.format.value);
    load(el.country.value, el.format.value);
  }
  el.country.addEventListener('change', onChange);
  el.format.addEventListener('change', onChange);

  if (window.Chart) {
    Chart.defaults.font.family = '"Open Sans", Arial, sans-serif';
    Chart.defaults.color = INK_SOFT;
  }
  applyStaticTexts();
  var start = readUrl();
  load(start.country, start.format);
})();
