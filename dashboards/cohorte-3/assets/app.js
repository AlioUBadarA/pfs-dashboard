/* PFS Cohort 3 dashboard.
 * The page holds no data: every visit asks the Apps Script web app for aggregated figures
 * (country). The phase filter (before / after / both) is applied here.
 * Shareable links: ?phase=both&country=Senegal&lang=fr (lang = en or fr) */
(function () {
  'use strict';

  var COLORS = { blue: '#2A6AA3', green: '#5DB246', yellow: '#E3B23C', red: '#C22A3A', oo2Blue: '#3A6AB2',
    text: '#1F2A37', soft: '#5B6775', grid: '#E5EAF0' };
  var PHASES = [
    { id: 'both', en: 'Before vs after (comparison)', fr: 'Avant / après (comparaison)' },
    { id: 'pre', en: 'Before only', fr: 'Avant seulement' },
    { id: 'post', en: 'After only', fr: 'Après seulement' }
  ];
  var ALL_COUNTRIES = 'All countries';   // valeur technique envoyee a l'API, jamais traduite
  var CACHE_MS = 5 * 60 * 1000;

  var API_URL = (window.PFS_CONFIG && window.PFS_CONFIG.API_URL) || '';
  var app = document.getElementById('app');
  var els = {
    phase: document.getElementById('f-phase'),
    country: document.getElementById('f-country'),
    scope: document.getElementById('scope'),
    updated: document.getElementById('updated'),
    langEn: document.getElementById('lang-en'),
    langFr: document.getElementById('lang-fr')
  };
  var LANG = initLang();

  /** Two-language text: tr('English', 'Français'). */
  function tr(en, fr) { return LANG === 'fr' ? fr : en; }
  /** Label of an API item in the current language (field + 'Fr' holds the French text). */
  function L(item, field) { field = field || 'label'; return LANG === 'fr' && item[field + 'Fr'] ? item[field + 'Fr'] : item[field]; }
  function initLang() {
    var q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'fr' || q === 'en') return q;
    try { var saved = localStorage.getItem('pfs_lang'); if (saved === 'fr' || saved === 'en') return saved; } catch (e) { /* ignore */ }
    return 'en';
  }

  var state = readUrl();
  var cache = {};
  var charts = [];
  var pending = [];
  var requestId = 0;
  var data = null;

  if (window.Chart) {
    Chart.defaults.font.family = "'Poppins', 'Segoe UI', Arial, sans-serif";
    Chart.defaults.color = COLORS.text;
  }

  /* ---------------- helpers ---------------- */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'class') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function isNum(v) { return typeof v === 'number' && !isNaN(v); }
  function pct(v) { return isNum(v) ? Math.round(v * 100) + '%' : '-'; }
  function num(v) { return isNum(v) ? String(v) : '-'; }
  function dec(v) { return isNum(v) ? (LANG === 'fr' ? v.toFixed(1).replace('.', ',') : v.toFixed(1)) : '-'; }
  function signed(n) { return (n > 0 ? '+' : '') + n; }

  /** Change in points between two rates, with its colour class. */
  function change(a, b) {
    if (!isNum(a) || !isNum(b)) return { t: '', cls: 'flat' };
    var d = Math.round((b - a) * 100);
    return { t: signed(d) + (Math.abs(d) === 1 ? ' pt' : ' pts'), cls: d > 0 ? 'up' : (d < 0 ? 'down' : 'flat') };
  }

  function readUrl() {
    var p = new URLSearchParams(window.location.search);
    var phase = p.get('phase');
    return {
      phase: PHASES.some(function (x) { return x.id === phase; }) ? phase : 'both',
      country: p.get('country') || ALL_COUNTRIES
    };
  }

  function writeUrl() {
    var p = new URLSearchParams();
    if (state.phase !== 'both') p.set('phase', state.phase);
    if (state.country !== ALL_COUNTRIES) p.set('country', state.country);
    if (LANG === 'fr') p.set('lang', 'fr');
    var q = p.toString();
    try { history.replaceState(null, '', window.location.pathname + (q ? '?' + q : '')); } catch (e) { /* ignore */ }
  }

  function showBefore() { return state.phase !== 'post'; }
  function showAfter() { return state.phase !== 'pre'; }

  /* ---------------- data ---------------- */

  function load() {
    var key = state.country;
    var hit = cache[key];
    if (hit && Date.now() - hit.at < CACHE_MS) return Promise.resolve(hit.data);

    if (!API_URL || API_URL.indexOf('PASTE_') === 0) {
      return Promise.reject(new Error(tr('The data source is missing. Put the web app URL in assets/config.js.', 'La source de données manque. Collez l\'URL de l\'application web dans assets/config.js.')));
    }
    var sep = API_URL.indexOf('?') > -1 ? '&' : '?';
    var url = API_URL + sep + 'country=' + encodeURIComponent(state.country);
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error(tr('The data source sent an error (', 'La source de données a renvoyé une erreur (') + r.status + ').');
      return r.json();
    }).then(function (d) {
      if (!d || !d.ok) throw new Error((d && d.error) || tr('The data source sent no figures.', 'La source de données n\'a envoyé aucun chiffre.'));
      cache[key] = { at: Date.now(), data: d };
      return d;
    });
  }

  function refresh() {
    var id = ++requestId;
    writeUrl();
    syncSelects();
    if (!data) app.replaceChildren(el('p', { class: 'status', text: tr('Loading the figures… The first load takes a few seconds.', 'Chargement des chiffres… Le premier chargement prend quelques secondes.') }));
    load().then(function (d) {
      if (id !== requestId) return;
      data = d;
      buildFilterOptions(d);
      render();
    }).catch(function (err) {
      if (id !== requestId) return;
      destroyCharts();
      app.replaceChildren(el('div', { class: 'error' }, [
        el('strong', { text: tr('The figures did not load. ', 'Les chiffres ne se sont pas chargés. ') }),
        el('span', { text: err.message })
      ]));
      els.updated.textContent = '';
      els.scope.textContent = '';
    });
  }

  /* ---------------- filters ---------------- */

  function fillSelect(select, options, value) {
    select.replaceChildren();
    options.forEach(function (o) {
      var opt = el('option', { value: o.value, text: o.label });
      if (o.value === value) opt.selected = true;
      select.appendChild(opt);
    });
  }

  function buildFilterOptions(d) {
    fillSelect(els.phase, PHASES.map(function (p) { return { value: p.id, label: tr(p.en, p.fr) }; }), state.phase);
    fillSelect(els.country, [{ value: ALL_COUNTRIES, label: tr('All countries', 'Tous les pays') }].concat(
      d.filter.countries.map(function (c) { return { value: c, label: countryName(c) }; })), state.country);
  }

  function syncSelects() {
    if (els.phase.options.length) els.phase.value = state.phase;
    if (els.country.options.length) els.country.value = state.country;
  }

  els.phase.addEventListener('change', function () { state.phase = els.phase.value; writeUrl(); if (data) render(); });
  els.country.addEventListener('change', function () { state.country = els.country.value; refresh(); });

  // Phase list and static texts are available before the first load.
  fillSelect(els.phase, PHASES.map(function (p) { return { value: p.id, label: tr(p.en, p.fr) }; }), state.phase);
  applyStaticTexts();

  function countryName(c) {
    var fr = { 'Benin': 'Bénin', 'Senegal': 'Sénégal' };
    return LANG === 'fr' && fr[c] ? fr[c] : c;
  }

  /** Texts that live in index.html. */
  function applyStaticTexts() {
    document.documentElement.lang = LANG;
    document.title = tr('PFS Cohort 3 Impact Dashboard', 'PFS Cohorte 3 : tableau de bord d\'impact');
    document.getElementById('ttl').textContent = tr('PFS Sales Training · Cohort 3 Impact Dashboard', 'PFS Formation commerciale · Cohorte 3 : tableau de bord d\'impact');
    document.getElementById('sub').textContent = tr('Partners in Food Solutions × Oo2 Formations & Consulting', 'Partners in Food Solutions × Oo2 Formations & Consulting');
    document.getElementById('l-phase').firstChild.textContent = tr('Phase ', 'Phase ');
    document.getElementById('l-country').firstChild.textContent = tr('Country ', 'Pays ');
    document.getElementById('filters').setAttribute('aria-label', tr('Filters', 'Filtres'));
    els.langEn.setAttribute('aria-pressed', LANG === 'en');
    els.langFr.setAttribute('aria-pressed', LANG === 'fr');
    if (!data) els.updated.textContent = tr('Loading…', 'Chargement…');
  }

  function setLang(l) {
    if (l === LANG) return;
    LANG = l;
    try { localStorage.setItem('pfs_lang', l); } catch (e) { /* ignore */ }
    applyStaticTexts();
    writeUrl();
    if (data) { buildFilterOptions(data); render(); }
    else fillSelect(els.phase, PHASES.map(function (p) { return { value: p.id, label: tr(p.en, p.fr) }; }), state.phase);
  }
  els.langEn.addEventListener('click', function () { setLang('en'); });
  els.langFr.addEventListener('click', function () { setLang('fr'); });

  /* ---------------- building blocks ---------------- */

  function destroyCharts() {
    charts.forEach(function (c) { c.destroy(); });
    charts = [];
    pending = [];
  }

  function card(title, value, detail, accent) {
    var node = el('div', { class: 'card' }, [
      el('h2', { text: title }),
      el('div', { class: 'v', text: value }),
      el('div', { class: 'd', text: detail })
    ]);
    node.style.borderTopColor = accent;
    return node;
  }

  function section(title, intro, featured) {
    var node = el('section', { class: 'section' + (featured ? ' featured' : '') }, [el('h2', { text: title })]);
    if (intro) node.appendChild(el('p', { class: 'intro', text: 'ⓘ  ' + intro }));
    return node;
  }

  /** cols: header labels. rows: { cells: [text | {t, cls}], style }. */
  function table(label, cols, rows) {
    var thead = el('thead', {}, [el('tr', {}, cols.map(function (c) { return el('th', { scope: 'col', text: c }); }))]);
    var tbody = el('tbody', {}, rows.map(function (r) {
      var tr = el('tr', r.style ? { class: r.style } : {});
      r.cells.forEach(function (c, i) {
        var cell = typeof c === 'object' ? c : { t: c };
        var cls = cell.cls || (i > 0 && /^-$|^$/.test(cell.t) ? 'muted' : '');
        tr.appendChild(el('td', cls ? { class: cls, text: cell.t } : { text: cell.t }));
      });
      return tr;
    }));
    return el('div', { class: 'tablewrap' }, [el('table', { 'aria-label': label }, [thead, tbody])]);
  }

  /** Table on the left, chart on the right. spec describes the chart (see drawChart). */
  function block(heading, tableNode, spec, note) {
    var left = el('div', {}, [
      heading ? el('h3', { text: heading }) : null,
      tableNode,
      note ? el('p', { class: 'note', text: note }) : null
    ]);
    var children = [left];
    if (spec) {
      var canvas = el('canvas', { role: 'img', 'aria-label': spec.title });
      var box = el('div', { class: 'chartbox' }, [canvas]);
      if (spec.height) box.style.height = spec.height + 'px';
      children.push(box);
      pending.push({ canvas: canvas, spec: spec });
    }
    return el('div', { class: spec ? 'block' : 'block single' }, children);
  }

  /* ---------------- charts ---------------- */

  function formatValue(v, format) {
    if (!isNum(v)) return '';
    return format === 'pct' ? Math.round(v * 100) + '%' : String(Math.round(v));
  }

  /** Writes the value at the end of each bar. */
  var valueLabels = {
    id: 'valueLabels',
    afterDatasetsDraw: function (chart, args, opts) {
      if (!opts || !opts.enabled) return;
      var ctx = chart.ctx;
      chart.data.datasets.forEach(function (ds, i) {
        var meta = chart.getDatasetMeta(i);
        if (meta.hidden) return;
        meta.data.forEach(function (bar, j) {
          var v = ds.data[j];
          if (!isNum(v)) return;
          ctx.save();
          ctx.fillStyle = COLORS.text;
          ctx.font = 'bold 11px Arial, Helvetica, sans-serif';
          if (opts.horizontal) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(formatValue(v, opts.format), bar.x + 4, bar.y); }
          else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(formatValue(v, opts.format), bar.x, bar.y - 3); }
          ctx.restore();
        });
      });
    }
  };

  /** spec: { title, labels, datasets: [{label, data, color}], format: 'pct'|'int', horizontal, stacked } */
  function drawChart(canvas, spec) {
    if (!window.Chart) return;
    var pctAxis = spec.format === 'pct';
    var valueAxis = {
      min: 0,
      max: pctAxis ? 1 : undefined,
      stacked: !!spec.stacked,
      grid: { color: COLORS.grid },
      ticks: {
        color: COLORS.soft, font: { size: 10 }, maxTicksLimit: 6,
        precision: 0,
        callback: function (v) { return pctAxis ? Math.round(v * 100) + '%' : v; }
      }
    };
    var labelAxis = { stacked: !!spec.stacked, grid: { display: false }, ticks: { color: COLORS.text, font: { size: 10 } } };
    var chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: spec.labels,
        datasets: spec.datasets.map(function (d) {
          return { label: d.label, data: d.data, backgroundColor: d.color, borderWidth: 0,
            barPercentage: spec.stacked ? 0.45 : 0.8, categoryPercentage: 0.8 };
        })
      },
      options: {
        indexAxis: spec.horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        layout: { padding: { top: spec.horizontal ? 4 : 18, right: spec.horizontal ? 36 : 4 } },
        scales: spec.horizontal ? { x: valueAxis, y: labelAxis } : { x: labelAxis, y: valueAxis },
        plugins: {
          title: { display: true, text: spec.title, color: COLORS.blue, font: { size: 14, weight: 'bold' } },
          legend: { display: spec.datasets.length > 1, position: 'bottom', labels: { color: COLORS.soft, boxWidth: 12, font: { size: 10 } } },
          tooltip: { callbacks: { label: function (c) {
            return (c.dataset.label ? c.dataset.label + ': ' : '') + formatValue(c.raw, spec.format);
          } } },
          valueLabels: { enabled: !spec.stacked, horizontal: !!spec.horizontal, format: spec.format }
        }
      },
      plugins: [valueLabels]
    });
    charts.push(chart);
  }

  /** Before / after datasets according to the phase filter. */
  function phaseDatasets(before, after) {
    var out = [];
    if (showBefore()) out.push({ label: tr('Before', 'Avant'), data: before, color: COLORS.blue });
    if (showAfter()) out.push({ label: tr('After', 'Après'), data: after, color: COLORS.green });
    return out;
  }

  /* ---------------- page ---------------- */

  function render() {
    destroyCharts();
    var d = data;
    var frag = document.createDocumentFragment();

    els.updated.textContent = d.updated ? tr('Updated: ', 'Mis à jour : ') + formatDate(d.updated) : '';
    els.scope.textContent = tr('Showing: ', 'Affichage : ') + phaseLabel() + ' · ' +
      (state.country === ALL_COUNTRIES ? tr('All countries', 'Tous les pays') : countryName(state.country)) + ' · ' +
      d.people + tr(' people, ', ' personnes, ') + d.before.n + tr(' tests before, ', ' tests avant, ') + d.after.n +
      tr(' forms after (latest answer per person)', ' formulaires après (dernière réponse par personne)');

    frag.appendChild(cards(d));
    frag.appendChild(guide());

    var empty = (showBefore() && d.before.n === 0 && (!showAfter() || d.after.n === 0)) || (!showBefore() && d.after.n === 0);
    if (empty) {
      frag.appendChild(el('div', { class: 'notice', text: tr(
        'No answers yet for this selection. Change a filter. You can also come back after the answers.',
        'Aucune réponse pour cette sélection. Changez un filtre. Vous pouvez aussi revenir après les réponses.') }));
    }

    var n = 1;
    if (showAfter()) frag.appendChild(evaluationSection(d, n++));
    frag.appendChild(countrySection(d, n++));
    frag.appendChild(knowledgeSection(d, n++));
    frag.appendChild(questionSection(d, n++));
    frag.appendChild(el('footer', { class: 'src', text: tr(
      'Source: test before and form after the PFS Sales Training, Cohort 3 (4 online sessions of 2 hours). The page is computed from the response sheet. ' +
      'The page publishes aggregated figures only. It shows no name, phone number or free-text answer.',
      'Source : test avant et formulaire après la formation commerciale PFS, cohorte 3 (4 sessions en ligne de 2 heures). La page se calcule à partir de la feuille de réponses. ' +
      'La page publie seulement des chiffres agrégés. Elle ne montre aucun nom, numéro de téléphone ni réponse libre.') }));

    app.replaceChildren(frag);
    pending.forEach(function (p) { drawChart(p.canvas, p.spec); });
    pending = [];
  }

  /** "How to read" box: a title and one short line per idea. */
  function guide() {
    var items = [
      [tr('Before', 'Avant'), tr('A 12-question test. It is taken once, before the training starts.', 'Test de 12 questions. Rempli une fois, avant le début de la formation.')],
      [tr('After', 'Après'), tr('The same 12 questions plus the training evaluation. Taken once, at the end of the training.', 'Les mêmes 12 questions et l\'évaluation de la formation. Rempli une fois, à la fin de la formation.')],
      [tr('Counting', 'Comptage'), tr('Each person counts once per phase. The page keeps the latest answer.', 'Chaque personne compte une fois par phase. La page garde sa dernière réponse.')],
      [tr('Same people', 'Mêmes personnes'), tr('These people answered both before and after. This is the most reliable comparison.', 'Ces personnes ont répondu avant et après. C\'est la comparaison la plus fiable.')],
      [tr('Colours', 'Couleurs'), tr('Green = improvement. Red = decline.', 'Vert = progression. Rouge = recul.')],
      [tr('Filters', 'Filtres'), tr('The two filters, phase and country, recalculate the whole page.', 'Les deux filtres, phase et pays, recalculent toute la page.')]
    ];
    return el('div', { class: 'guide' }, [
      el('h2', { text: tr('HOW TO READ THIS DASHBOARD', 'COMMENT LIRE CE TABLEAU DE BORD') }),
      el('ul', {}, items.map(function (it) {
        return el('li', {}, [el('strong', { text: it[0] + tr(': ', ' : ') }), el('span', { text: it[1] })]);
      }))
    ]);
  }

  function phaseLabel() {
    var p = PHASES.filter(function (x) { return x.id === state.phase; })[0];
    return tr(p.en, p.fr);
  }

  function formatDate(iso) {
    var t = new Date(iso);
    if (isNaN(t.getTime())) return iso;
    return t.toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function cards(d) {
    var ev = d.evaluation;
    var list = [];
    if (state.phase === 'both') list.push(card(tr('Participants reached', 'Participants touchés'), num(d.people),
      d.before.people + tr(' answered before · ', ' ont répondu avant · ') + d.after.people + tr(' after', ' après'), COLORS.blue));
    else if (state.phase === 'pre') list.push(card(tr('Participants (before)', 'Participants (avant)'), num(d.before.people), d.before.n + tr(' tests taken', ' tests passés'), COLORS.blue));
    else list.push(card(tr('Participants (after)', 'Participants (après)'), num(d.after.people), d.after.n + tr(' forms answered', ' formulaires remplis'), COLORS.blue));

    if (showBefore()) list.push(card(tr('Success rate before', 'Taux de réussite avant'), pct(d.before.rate), tr('correct answers · ', 'bonnes réponses · ') + d.before.n + tr(' tests', ' tests'), COLORS.blue));
    if (showAfter()) {
      var c = change(d.same.before, d.same.after);
      var detail = state.phase === 'both' && d.same.n > 0
        ? c.t + tr(' vs before (same ', ' vs avant (mêmes ') + d.same.n + tr(' answers)', ' personnes)')
        : tr('correct answers · ', 'bonnes réponses · ') + d.after.n + tr(' forms', ' formulaires');
      list.push(card(tr('Success rate after', 'Taux de réussite après'), pct(d.after.rate), detail, COLORS.green));
      list.push(card(tr('Satisfaction (4 or 5 out of 5)', 'Satisfaction (4 ou 5 sur 5)'), pct(ev.satisfiedRate),
        ev.ratingAverage === null ? tr('no rating yet', 'aucune note pour l\'instant')
          : tr('average ', 'moyenne ') + dec(ev.ratingAverage) + ' / 5 · NPS ' + (ev.nps.index === null ? '-' : signed(ev.nps.index)), COLORS.yellow));
      if (state.phase === 'post') list.push(card(tr('Expectations met or exceeded', 'Attentes satisfaites ou dépassées'), pct(ev.expectationsMetRate), ev.expectationsN + tr(' answers', ' réponses'), COLORS.oo2Blue));
    }
    list.push(card(tr('Companies represented', 'Entreprises représentées'), d.companies.count + ' / ' + d.companies.target, tr('answered at least once', 'ont répondu au moins une fois'), COLORS.oo2Blue));
    return el('div', { class: 'cards' }, list);
  }

  /* 1. Training evaluation (green band, after only) */
  function evaluationSection(d, n) {
    var ev = d.evaluation;
    var HA = tr('After', 'Après');
    var sec = section(n + tr('. Training evaluation', '. Évaluation de la formation'),
      tr('This is what participants said at the end of the training. They rate satisfaction, expectations and what they learned. The page keeps the latest answer of each person in the selected country.',
         'Voici l\'avis des participants à la fin de la formation. Ils parlent de leur satisfaction, de leurs attentes et de ce qu\'ils ont appris. La page garde la dernière réponse de chaque personne dans le pays choisi.'), true);

    sec.appendChild(block(tr('Summary', 'Synthèse'), table(tr('Evaluation summary', 'Synthèse de l\'évaluation'),
      [tr('Indicator', 'Indicateur'), HA, tr('Count', 'Effectif')], [
      { cells: [tr('Average satisfaction rating out of 5', 'Note moyenne de satisfaction sur 5'), dec(ev.ratingAverage), num(ev.ratingsN)] },
      { cells: [tr('Share of ratings 4 or 5', 'Part des notes 4 ou 5'), pct(ev.satisfiedRate), num(ev.satisfiedCount)] },
      { cells: [tr('Expectations met or exceeded', 'Attentes satisfaites ou dépassées'), pct(ev.expectationsMetRate), num(ev.expectations[0].count + ev.expectations[1].count)] }
    ]), null));

    var tExp = tr('Did the training meet expectations?', 'La formation a-t-elle répondu aux attentes ?');
    sec.appendChild(block(tExp, distTable(tExp, ev.expectations),
      { title: tExp, labels: ev.expectations.map(lab), horizontal: true, format: 'pct',
        datasets: [{ label: HA, data: ev.expectations.map(rate), color: COLORS.green }] }));

    var tKn = tr('Self-reported knowledge improvement', 'Amélioration des connaissances déclarée');
    sec.appendChild(block(tKn, distTable(tKn, ev.knowledge),
      { title: tKn, labels: ev.knowledge.map(lab), horizontal: true, format: 'pct',
        datasets: [{ label: HA, data: ev.knowledge.map(rate), color: COLORS.green }] }));

    var nps = ev.nps;
    var D = tr('Detractors (1 to 3)', 'Détracteurs (1 à 3)'), P = tr('Passives (4)', 'Passifs (4)'), Pr = tr('Promoters (5)', 'Promoteurs (5)');
    sec.appendChild(block(tr('Satisfaction index (NPS style)', 'Indice de satisfaction (type NPS)'),
      table(tr('NPS style index', 'Indice de type NPS'), [tr('Indicator', 'Indicateur'), D, P, Pr, tr('NPS index', 'Indice NPS'), tr('Count', 'Effectif')], [{
        cells: [tr('Breakdown of ratings', 'Répartition des notes'), pct(nps.detractors), pct(nps.passives), pct(nps.promoters),
          { t: nps.index === null ? '-' : signed(nps.index), cls: nps.index === null || nps.index === 0 ? 'flat' : (nps.index > 0 ? 'up' : 'down') },
          num(nps.n)]
      }]),
      { title: tr('Satisfaction index: ', 'Indice de satisfaction : ') + (nps.index === null ? '-' : signed(nps.index)), labels: [tr('Ratings', 'Notes')], horizontal: true, format: 'pct', stacked: true,
        datasets: [
          { label: D, data: [nps.detractors], color: COLORS.red },
          { label: P, data: [nps.passives], color: COLORS.yellow },
          { label: Pr, data: [nps.promoters], color: COLORS.green }
        ] },
      tr('NPS index = % promoters (rating 5) minus % detractors (ratings 1 to 3). It ranges from -100 to +100. Above 0, promoters outnumber detractors.',
         'Indice NPS = % de promoteurs (note 5) moins % de détracteurs (notes 1 à 3). Il va de -100 à +100. Au-dessus de 0, les promoteurs sont plus nombreux que les détracteurs.')));

    var tRt = tr('Satisfaction rating (1 to 5)', 'Note de satisfaction (1 à 5)');
    sec.appendChild(block(tRt, distTable(tRt, ev.ratings),
      { title: tRt, labels: ev.ratings.map(function (r, i) { return String(i + 1); }), format: 'pct',
        datasets: [{ label: HA, data: ev.ratings.map(rate), color: COLORS.green }] }));
    return sec;
  }

  function lab(x) { return L(x); }
  function rate(x) { return x.rate; }
  function distTable(label, items) {
    return table(label, [tr('Indicator', 'Indicateur'), tr('After', 'Après'), tr('Count', 'Effectif')], items.map(function (x) {
      return { cells: [L(x), pct(x.rate), num(x.count)] };
    }));
  }

  /* 2. Knowledge results */
  function knowledgeSection(d, n) {
    var sec = section(n + tr('. Knowledge results', '. Résultats de connaissances'),
      tr('Overall success rate in the selected country.', 'Taux de réussite global dans le pays choisi.'));
    var cols = [tr('Indicator', 'Indicateur')];
    if (showBefore()) cols.push(tr('Before', 'Avant'));
    if (showAfter()) cols.push(tr('After', 'Après'));
    if (state.phase === 'both') cols.push(tr('Change', 'Évolution'));
    if (showBefore()) cols.push(tr('n before', 'n avant'));
    if (showAfter()) cols.push(tr('n after', 'n après'));

    function row(label, b, a, nb, na) {
      var cells = [label];
      if (showBefore()) cells.push(pct(b));
      if (showAfter()) cells.push(pct(a));
      if (state.phase === 'both') cells.push(change(b, a));
      if (showBefore()) cells.push(num(nb));
      if (showAfter()) cells.push(num(na));
      return { cells: cells };
    }
    var rows = [row(tr('Success rate (all answers)', 'Taux de réussite (toutes les réponses)'), d.before.rate, d.after.rate, d.before.n, d.after.n)];
    if (state.phase === 'both') rows.push(row(tr('Success rate (same people before and after)', 'Taux de réussite (mêmes personnes avant et après)'), d.same.before, d.same.after, d.same.n, d.same.n));

    var labels = [tr('All answers', 'Toutes les réponses')];
    var b = [d.before.rate], a = [d.after.rate];
    if (state.phase === 'both') { labels.push(tr('Same people', 'Mêmes personnes')); b.push(d.same.before); a.push(d.same.after); }
    sec.appendChild(block(null, table(tr('Knowledge results', 'Résultats de connaissances'), cols, rows), {
      title: tr('Success rate', 'Taux de réussite') + (state.phase === 'both' ? tr(': before vs after', ' : avant et après') : ''), labels: labels, format: 'pct', datasets: phaseDatasets(b, a)
    }, tr('Same people = answered both the test before and the form after. This is the most reliable measure of progress.',
          'Mêmes personnes = personnes qui ont répondu au test avant et au formulaire après. C\'est la mesure de progression la plus fiable.')));
    return sec;
  }

  /* 3. Success by question */
  function questionSection(d, n) {
    var sec = section(n + tr('. Success by question', '. Réussite par question'),
      tr('Share of people who chose the correct answer, for each question.', 'Part des personnes qui ont choisi la bonne réponse, pour chaque question.'));
    var cols = [tr('Question', 'Question')];
    if (showBefore()) cols.push(tr('Before', 'Avant'));
    if (showAfter()) cols.push(tr('After', 'Après'));
    if (state.phase === 'both') cols.push(tr('Change', 'Évolution'));
    if (showBefore()) cols.push(tr('n before', 'n avant'));
    if (showAfter()) cols.push(tr('n after', 'n après'));

    var rows = d.questions.map(function (q) {
      var cells = [L(q)];
      if (showBefore()) cells.push(pct(q.before.rate));
      if (showAfter()) cells.push(pct(q.after.rate));
      if (state.phase === 'both') cells.push(change(q.before.rate, q.after.rate));
      if (showBefore()) cells.push(num(q.before.n));
      if (showAfter()) cells.push(num(q.after.n));
      return { cells: cells };
    });
    var box = block(null, table(tr('Success by question', 'Réussite par question'), cols, rows), {
      title: tr('Success by question', 'Réussite par question') + (state.phase === 'both' ? tr(': before vs after', ' : avant et après') : ''),
      labels: d.questions.map(function (q) { return q.id; }), horizontal: true, format: 'pct',
      height: Math.max(300, d.questions.length * (showBefore() && showAfter() ? 44 : 28) + 90),
      datasets: phaseDatasets(d.questions.map(function (q) { return q.before.rate; }), d.questions.map(function (q) { return q.after.rate; }))
    });
    sec.appendChild(box);
    return sec;
  }

  /* 4. Country representation */
  function countrySection(d, n) {
    var sec = section(n + tr('. Country representation', '. Représentation par pays'),
      tr('The calculation covers all countries. Companies are counted from the name typed in the form.',
         'Le calcul porte sur tous les pays. Les entreprises sont comptées d\'après le nom saisi dans le formulaire.'));
    var cols = [tr('Country', 'Pays'), tr('Companies', 'Entreprises')];
    if (showBefore()) cols.push(tr('Tests before', 'Tests avant'));
    if (showAfter()) cols.push(tr('Forms after', 'Formulaires après'));
    if (showBefore()) cols.push(tr('Success before', 'Réussite avant'));
    if (showAfter()) cols.push(tr('Success after', 'Réussite après'));
    if (showAfter()) cols.push(tr('Satisfaction', 'Satisfaction'));

    var totals = { companies: d.byCountry.reduce(function (s, c) { return s + c.companies; }, 0), b: 0, a: 0 };
    var rows = d.byCountry.map(function (c) {
      totals.b += c.before.n; totals.a += c.after.n;
      var cells = [countryName(c.country), num(c.companies)];
      if (showBefore()) cells.push(num(c.before.n));
      if (showAfter()) cells.push(num(c.after.n));
      if (showBefore()) cells.push(pct(c.before.rate));
      if (showAfter()) cells.push(pct(c.after.rate));
      if (showAfter()) cells.push(pct(c.satisfaction));
      return { cells: cells, style: c.country === state.country ? 'selection' : '' };
    });
    var totalCells = ['Total', num(totals.companies)];
    if (showBefore()) totalCells.push(num(totals.b));
    if (showAfter()) totalCells.push(num(totals.a));
    if (showBefore()) totalCells.push('');
    if (showAfter()) totalCells.push('');
    if (showAfter()) totalCells.push('');
    rows.push({ cells: totalCells, style: 'total' });

    sec.appendChild(block(null, table(tr('Country representation', 'Représentation par pays'), cols, rows), {
      title: tr('Answers by country', 'Réponses par pays'), labels: d.byCountry.map(function (c) { return countryName(c.country); }), format: 'int',
      datasets: [].concat(
        showBefore() ? [{ label: tr('Tests before', 'Tests avant'), data: d.byCountry.map(function (c) { return c.before.n; }), color: COLORS.blue }] : [],
        showAfter() ? [{ label: tr('Forms after', 'Formulaires après'), data: d.byCountry.map(function (c) { return c.after.n; }), color: COLORS.green }] : [])
    }, tr('Satisfaction = share of ratings 4 or 5 out of 5. A company typed with different spellings can be counted twice.',
          'Satisfaction = part des notes 4 ou 5 sur 5. Une entreprise saisie avec des orthographes différentes peut être comptée deux fois.')));
    return sec;
  }

  refresh();
})();
