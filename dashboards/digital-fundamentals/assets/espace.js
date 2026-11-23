/* Espace Digital Fundamentals : coordination (sessions, apprenants, formateurs) et page des formateurs.
 * Toutes les donnees viennent de l'application web Apps Script (doPost), apres connexion par code.
 * Le serveur verifie le role a chaque requete. Cette page n'affiche du texte qu'avec textContent. */
(function () {
  'use strict';

  var API_URL = (window.PFS_CONFIG && window.PFS_CONFIG.API_URL) || '';
  var TOKEN_KEY = 'pfs_espace_token';
  var DATA_KEY = 'pfs_espace_data';
  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var $ = function (id) { return document.getElementById(id); };
  var state = {
    token: load(), role: '', nom: '', tab: '', admin: null, trainer: null, relay: null,
    filter: 'avenir', q: '', open: {},                        // sessions
    lq: '', lsess: '', lstat: ''                              // apprenants
  };

  /* ---------- outils ---------- */
  function load() { try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function save(t) { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* stockage indisponible */ } }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'cls') n.className = v;
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  function fr(day) { return day ? day.slice(8, 10) + '/' + day.slice(5, 7) + '/' + day.slice(0, 4) : ''; }
  function when(dd) {
    if (dd === null || dd === undefined) return '';
    if (dd === 0) return "aujourd'hui";
    if (dd === 1) return 'demain';
    if (dd === -1) return 'hier';
    return dd > 0 ? 'dans ' + dd + ' jours' : 'il y a ' + (-dd) + ' jours';
  }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function plural(n, one, many) { return n + ' ' + (n > 1 ? many : one); }

  var toastTimer = null;
  function toast(msg, isErr) {
    var t = $('toast');
    t.textContent = msg; t.className = 'esp-toast' + (isErr ? ' err' : ''); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, isErr ? 6000 : 4000);
  }

  function api(action, payload) {
    if (!API_URL) return Promise.reject(new Error("L'adresse de l'API manque dans assets/config.js."));
    var body = Object.assign({ action: action, token: state.token }, payload || {});
    return fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('Le serveur ne répond pas. Réessayez.'); return r.json(); })
      .then(function (res) {
        if (res.ok) return res.data;
        if (res.code === 'AUTH') { logout(true); }
        throw new Error(res.error || 'Une erreur est survenue.');
      });
  }

  function busy(btn, on) { if (btn) { btn.disabled = on; } }

  /* ---------- connexion ---------- */
  $('f-email').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var btn = ev.submitter || this.querySelector('button');
    var email = $('email').value.trim();
    $('login-error').textContent = '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { $('login-error').textContent = 'Entrez une adresse e-mail valide.'; return; }
    busy(btn, true);
    api('requestCode', { email: email }).then(function (d) {
      $('code-msg').textContent = d.message;
      $('f-email').hidden = true; $('f-code').hidden = false; $('code').value = ''; $('code').focus();
    }).catch(function (e) { $('login-error').textContent = e.message; }).then(function () { busy(btn, false); });
  });

  $('code').addEventListener('input', function () { this.value = this.value.replace(/\D/g, '').slice(0, 6); });

  $('f-code').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var btn = ev.submitter || this.querySelector('button');
    $('login-error').textContent = '';
    busy(btn, true);
    api('verifyCode', { email: $('email').value.trim(), code: $('code').value.trim() }).then(function (d) {
      state.token = d.token; save(d.token); state.role = d.role; state.nom = d.nom;
      start();
    }).catch(function (e) { $('login-error').textContent = e.message; }).then(function () { busy(btn, false); });
  });

  $('back').addEventListener('click', function () { $('f-code').hidden = true; $('f-email').hidden = false; $('login-error').textContent = ''; });
  $('logout').addEventListener('click', function () { api('logout').catch(function () {}); logout(false); });
  $('refresh').addEventListener('click', function () { refresh(); });

  function logout(expired) {
    state.token = ''; save(''); state.role = ''; state.admin = null; state.trainer = null; state.relay = null;
    try { sessionStorage.removeItem(DATA_KEY); } catch (e) { /* rien */ }
    $('bar').hidden = true; $('top-actions').hidden = true; clear($('view')); $('login').hidden = false;
    $('f-code').hidden = true; $('f-email').hidden = false; $('who').textContent = 'Coordination et formateurs';
    if (expired) $('login-error').textContent = 'Votre session a expiré. Reconnectez-vous.';
  }

  function start() {
    $('login').hidden = true; $('top-actions').hidden = false;
    $('who').textContent = state.role === 'admin' ? 'Espace coordination' : 'Espace formateur' + (state.nom ? ' · ' + state.nom : '');
    if (state.role === 'admin') {
      state.tab = 'sessions';
      $('bar').hidden = false;
      drawTabs();
    } else {
      state.tab = 'mes';
      $('bar').hidden = true;
    }
    refresh();
  }

  function drawTabs() {
    var A = state.admin;
    var tabs = [['sessions', 'Sessions', A ? A.sessions.length : null], ['apprenants', 'Apprenants', A ? (A.learners || []).length : null],
                ['formateurs', 'Formateurs', A ? A.trainers.length : null]];
    var bar = clear($('tabs'));
    tabs.forEach(function (t) {
      var b = el('button', { type: 'button', role: 'tab', 'aria-selected': String(t[0] === state.tab),
        onclick: function () { state.tab = t[0]; drawTabs(); render(); window.scrollTo(0, 0); } }, [t[1]]);
      if (t[2] !== null) b.appendChild(el('span', { cls: 'count', text: String(t[2]) }));
      bar.appendChild(b);
    });
  }

  /* Affiche tout de suite les dernieres donnees connues, puis les met a jour en arriere-plan. */
  function loadData() { try { var s = JSON.parse(sessionStorage.getItem(DATA_KEY) || 'null'); return s && s.role === state.role ? s.data : null; } catch (e) { return null; } }
  function saveData(d) { try { sessionStorage.setItem(DATA_KEY, JSON.stringify({ role: state.role, data: d })); } catch (e) { /* stockage plein ou bloque */ } }

  function refresh() {
    var v = $('view');
    var cached = loadData();
    var hasData = state.role === 'admin' ? state.admin : state.trainer;
    if (!hasData && cached) { if (state.role === 'admin') state.admin = cached; else state.trainer = cached; }
    if (state.admin || state.trainer) { render(); busy($('refresh'), true); $('refresh').textContent = 'Mise à jour…'; }
    else { clear(v).appendChild(el('p', { cls: 'empty', text: 'Chargement…' })); }
    var action = state.role === 'admin' ? 'adminData' : 'trainerData';
    return api(action).then(function (d) {
      if (state.role === 'admin') { state.admin = d; drawTabs(); } else state.trainer = d;
      saveData(d);
      if (!state.relay && !document.querySelector('dialog[open]')) render();   // ne pas couper une action en cours
    }).catch(function (e) {
      if (state.admin || state.trainer) toast(e.message, true);
      else clear(v).appendChild(el('p', { cls: 'esp-error', text: e.message }));
    }).then(function () { busy($('refresh'), false); $('refresh').textContent = 'Actualiser'; });
  }

  function render() {
    var v = clear($('view'));
    if (state.role === 'admin' && state.admin) {
      if (state.tab === 'sessions') renderSessions(v);
      else if (state.tab === 'apprenants') renderLearners(v);
      else renderTrainers(v);
    } else if (state.trainer) {
      renderTrainer(v);
    }
  }

  /* ---------- petits elements ---------- */
  function chip(text, kind) { return el('span', { cls: 'chip' + (kind ? ' ' + kind : ''), text: text }); }
  function field(label, input) { return el('div', {}, [el('label', { for: input.id, text: label }), input]); }
  function input(id, value, attrs) { return el('input', Object.assign({ id: id, value: value || '' }, attrs || {})); }
  function select(id, values, current) {
    return el('select', { id: id }, values.map(function (x) {
      var val = Array.isArray(x) ? x[0] : x, txt = Array.isArray(x) ? x[1] : x;
      return el('option', { value: val, text: txt, selected: val === current });
    }));
  }
  function searchBox(id, value, placeholder, onInput) {
    var i = el('input', { id: id, type: 'search', value: value, placeholder: placeholder, 'aria-label': placeholder, autocomplete: 'off' });
    var t = null;
    i.addEventListener('input', function () { var me = this; clearTimeout(t); t = setTimeout(function () { onInput(me.value); }, 150); });
    return el('div', { cls: 'search' }, [i]);
  }
  function dayTile(s) {
    if (!s.day) return el('div', { cls: 'day none' }, [el('b', { text: '?' }), el('span', { text: 'date' })]);
    return el('div', { cls: 'day' + (s.dd < 0 ? ' past' : '') }, [el('b', { text: String(Number(s.day.slice(8, 10))) }),
      el('span', { text: MOIS[Number(s.day.slice(5, 7)) - 1] })]);
  }

  /* Fenetre modale. onSave renvoie un message (ou une promesse) ; une erreur s'affiche dans la fenetre. */
  function modal(title, body, onSave, opts) {
    opts = opts || {};
    var err = el('p', { cls: 'esp-error', role: 'alert' });
    var ok = el('button', { type: 'button', cls: 'btn' + (opts.danger ? ' danger' : ''), text: opts.saveLabel || 'Enregistrer' });
    var cancel = el('button', { type: 'button', cls: 'btn ghost', text: 'Annuler' });
    var d = el('dialog', { cls: 'modal', 'aria-label': title }, [el('div', { cls: 'modal-in' },
      [el('h2', { text: title })].concat(body).concat([err, el('div', { cls: 'row-actions' }, [cancel, ok])]))]);
    function close() { if (d.open) d.close(); d.remove(); }
    cancel.addEventListener('click', close);
    d.addEventListener('cancel', function () { setTimeout(close, 0); });
    ok.addEventListener('click', function () {
      err.textContent = ''; busy(ok, true); busy(cancel, true);
      Promise.resolve().then(onSave).then(function (msg) { close(); if (msg) toast(msg); return refresh(); })
        .catch(function (e) { err.textContent = e.message; busy(ok, false); busy(cancel, false); });
    });
    document.body.appendChild(d);
    d.showModal();
    var first = d.querySelector('input:not([readonly]), select, textarea');
    if (first && !opts.noFocus) first.focus(); else ok.focus();
  }

  /* ---------- coordination : donnees ---------- */
  function trainerName(code) {
    var t = (state.admin.trainers || []).filter(function (x) { return x.code === code; })[0];
    return t ? t.nom : '';
  }
  function sessionOf(code) { return state.admin.sessions.filter(function (s) { return s.code === code; })[0]; }
  function learnersOf(code) { return (state.admin.learners || []).filter(function (l) { return l.code === code; }); }
  function isActive(s) { return s.statut !== 'Annulée'; }

  function confState(l) {
    var c = l.conf || '';
    if (/^Oui/.test(c)) return ['Confirmé', 'ok'];
    if (/remplac/i.test(c)) return ['Remplacé', 'warn'];
    if (/^Non/.test(c)) return ['Absent annoncé', 'ko'];
    return ['Sans réponse', ''];
  }

  /* ---------- coordination : sessions ---------- */
  function renderSessions(v) {
    var A = state.admin;
    var active = A.sessions.filter(isActive);
    var avenir = active.filter(function (s) { return s.dd === null || s.dd >= 0; });
    var sans = active.filter(function (s) { return !s.formateur; });
    var manquants = active.filter(function (s) { return s.dd !== null && s.dd < 0 && s.formateur && !s.rapport; });
    var inscrits = avenir.reduce(function (n, s) { return n + s.inscrits; }, 0);

    v.appendChild(el('section', { cls: 'stats', 'aria-label': 'Chiffres clés' }, [
      stat(avenir.length, 'sessions à venir', 'good'),
      stat(sans.length, 'sans formateur', sans.length ? 'alert' : ''),
      stat(inscrits, 'apprenants inscrits à venir', ''),
      stat(manquants.length, 'rapports manquants', manquants.length ? 'alert' : '')
    ]));

    var filters = [['avenir', 'À venir', avenir.length], ['sans', 'Sans formateur', sans.length],
                   ['passees', 'Passées', active.length - avenir.length], ['toutes', 'Toutes', A.sessions.length]];
    var pills = el('div', { cls: 'pills', role: 'group', 'aria-label': 'Filtrer les sessions' }, filters.map(function (f) {
      return el('button', { type: 'button', cls: 'pill', 'aria-pressed': String(f[0] === state.filter),
        onclick: function () { state.filter = f[0]; render(); } }, [f[1], el('span', { cls: 'n', text: String(f[2]) })]);
    }));
    v.appendChild(el('section', { cls: 'toolbar' }, [
      el('div', { cls: 'toolbar-row' }, [
        searchBox('q-sess', state.q, 'Chercher une entreprise, une ville, un code ou un formateur', function (val) { state.q = val; drawList(); }),
        el('button', { type: 'button', cls: 'btn', text: 'Nouvelle session', onclick: function () { sessionForm(null); } })
      ]),
      el('div', { cls: 'toolbar-row' }, [pills])
    ]));
    var listBox = el('div', { id: 'sess-list' });
    v.appendChild(listBox);
    drawList();

    function drawList() {
      clear(listBox);
      var q = norm(state.q);
      var list = A.sessions.filter(function (s) {
        if (state.filter === 'avenir') return isActive(s) && (s.dd === null || s.dd >= 0);
        if (state.filter === 'passees') return isActive(s) && s.dd !== null && s.dd < 0;
        if (state.filter === 'sans') return isActive(s) && !s.formateur;
        return true;
      }).filter(function (s) {
        return !q || norm([s.entreprise, s.ville, s.pays, s.code, trainerName(s.formateur)].join(' ')).indexOf(q) !== -1;
      });
      if (state.filter === 'passees') list = list.slice().reverse();
      if (!list.length) { listBox.appendChild(el('p', { cls: 'empty', text: 'Aucune session.' })); return; }
      list.forEach(function (s) { listBox.appendChild(sessionCard(s)); });
    }
  }

  function stat(n, label, kind) { return el('div', { cls: 'stat' + (kind ? ' ' + kind : '') }, [el('b', { text: String(n) }), el('span', { text: label })]); }

  function sessionCard(s) {
    var A = state.admin;
    var sel = el('select', { id: 'tr-' + s.code },
      [el('option', { value: '', text: 'Non attribué', selected: !s.formateur })].concat(A.trainers.map(function (t) {
        return el('option', { value: t.code, text: t.nom + ' (' + t.code + ')', selected: t.code === s.formateur });
      })));
    sel.addEventListener('change', function () {
      var val = this.value, prev = s.formateur, me = this;
      me.disabled = true;
      api('assign', { code: s.code, trainer: val }).then(function () {
        s.formateur = val; s.prevenu = false;
        toast(val ? 'Session attribuée à ' + trainerName(val) + '. Le formateur sera prévenu dans l\'heure.' : 'Formateur retiré.');
        refresh();
      }).catch(function (e) { me.value = prev; toast(e.message, true); }).then(function () { me.disabled = false; });
    });

    var chips = [
      chip(plural(s.inscrits, 'inscrit', 'inscrits'), s.inscrits ? '' : 'warn'),
      chip(plural(s.confirmes, 'confirmé', 'confirmés')),
      chip('AVANT ' + s.avant + '/' + s.inscrits, s.inscrits && s.avant === s.inscrits ? 'ok' : ''),
      chip('APRÈS ' + s.apres + '/' + s.inscrits, s.inscrits && s.apres === s.inscrits ? 'ok' : '')
    ];
    if (s.dd !== null && s.dd < 0 && isActive(s)) chips.push(chip(s.rapport ? 'Rapport reçu' : 'Rapport manquant', s.rapport ? 'ok' : 'ko'));
    if (!isActive(s)) chips.push(chip('Annulée', 'ko'));
    if (s.formateur && !s.prevenu && (s.dd === null || s.dd >= 0) && isActive(s)) chips.push(chip('Formateur pas encore prévenu', 'warn'));

    var open = !!state.open[s.code];
    var tableBox = el('div', { cls: 'lt-wrap', hidden: !open });
    var toggle = el('button', { type: 'button', cls: 'btn ghost small toggle', 'aria-expanded': String(open),
      text: 'Apprenants (' + s.inscrits + ')' });
    toggle.addEventListener('click', function () {
      state.open[s.code] = !state.open[s.code];
      toggle.setAttribute('aria-expanded', String(state.open[s.code]));
      tableBox.hidden = !state.open[s.code];
      if (state.open[s.code]) drawTable();
    });
    function drawTable() {
      clear(tableBox);
      var ls = learnersOf(s.code);
      if (!ls.length) tableBox.appendChild(el('p', { cls: 'soft', text: 'Aucun apprenant pour le moment.' }));
      else tableBox.appendChild(learnerTable(ls, false));
      tableBox.appendChild(el('div', { cls: 'lt-foot' }, [
        el('button', { type: 'button', cls: 'btn small', text: 'Ajouter des apprenants', onclick: function () { learnersForm(s); } }),
        ls.length ? el('button', { type: 'button', cls: 'btn ghost small', text: 'Exporter la liste (CSV)', onclick: function () { exportCsv(ls, s.code); } }) : null
      ]));
    }
    if (open) drawTable();

    return el('article', { cls: 'card' }, [
      el('div', { cls: 'sess' }, [
        dayTile(s),
        el('div', { cls: 'sess-main' }, [
          el('h3', { text: s.entreprise }),
          el('p', { cls: 'sess-meta', text: [s.day ? s.creneau + ', ' + when(s.dd) : 'date à fixer', [s.ville, s.pays].filter(Boolean).join(', '), s.code].filter(Boolean).join(' · ') }),
          el('div', { cls: 'chips' }, chips)
        ]),
        el('div', { cls: 'sess-side' }, [el('label', { for: 'tr-' + s.code, text: 'Formateur' }), sel])
      ]),
      el('div', { cls: 'sess-foot' }, [
        toggle,
        el('button', { type: 'button', cls: 'btn ghost small', text: 'Modifier la session', onclick: function () { sessionForm(s); } }),
        el('button', { type: 'button', cls: 'btn ghost small', text: 'Ajouter des apprenants', onclick: function () { learnersForm(s); } })
      ]),
      tableBox
    ]);
  }

  function sessionForm(s) {
    var A = state.admin;
    var f = {
      code: input('s-code', s && s.code, { maxlength: 40, readonly: !!s, placeholder: 'ex. DF-SN-STL-01' }),
      entreprise: input('s-ent', s && s.entreprise, { maxlength: 120 }),
      pays: select('s-pays', A.pays, s ? s.pays : A.pays[0]),
      ville: input('s-ville', s && s.ville, { maxlength: 80 }),
      adresse: input('s-adr', s && s.adresse, { maxlength: 200 }),
      contact: input('s-contact', s && s.contact, { maxlength: 200, placeholder: 'Nom et téléphone' }),
      date: input('s-date', s && s.day, { type: 'date' }),
      creneau: select('s-cren', A.creneaux, s ? s.creneau : A.creneaux[0]),
      statut: select('s-statut', A.statuts, s ? s.statut || A.statuts[0] : A.statuts[0])
    };
    modal(s ? 'Modifier la session' : 'Nouvelle session', [
      s ? el('p', { cls: 'soft', text: s.entreprise + ' · ' + s.code }) : null,
      el('div', { cls: 'grid2' }, [
        field('Code session', f.code), field('Entreprise', f.entreprise), field('Pays', f.pays), field('Ville', f.ville),
        field('Adresse', f.adresse), field('Contact entreprise', f.contact), field('Date', f.date), field('Créneau', f.creneau),
        field('Statut', f.statut)])],
      function () {
        var data = {};
        Object.keys(f).forEach(function (k) { data[k] = f[k].value.trim(); });
        return api('saveSession', { session: data }).then(function (r) { return r.created ? 'Session créée.' : 'Session enregistrée.'; });
      });
  }

  /* Coller depuis Excel ou saisir : Nom ; Fonction ; Telephone ; E-mail (une ligne par apprenant) */
  function parseLearners(text) {
    return text.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(Boolean).map(function (line) {
      var c = line.split(/\t|;/).map(function (x) { return x.trim(); });
      return { nom: c[0] || '', fonction: c[1] || '', tel: c[2] || '', email: c[3] || '' };
    });
  }

  function learnersForm(s) {
    var ta = el('textarea', { id: 'l-list', placeholder: 'Awa Diop ; Commerciale ; +221 77 123 45 67 ; awa@exemple.sn\nMoussa Fall ; Comptable ; 78 222 22 22' });
    var count = el('p', { cls: 'soft', text: '0 apprenant détecté.' });
    ta.addEventListener('input', function () { count.textContent = parseLearners(ta.value).length + ' apprenant(s) détecté(s).'; });
    modal('Ajouter des apprenants', [
      el('p', { cls: 'soft', text: s.entreprise + ' · ' + s.code }),
      el('p', { cls: 'soft', text: 'Une ligne par apprenant : Nom ; Fonction ; Téléphone WhatsApp ; E-mail (facultatif). Vous pouvez coller les colonnes depuis Excel.' }),
      field('Liste', ta), count],
      function () {
        var list = parseLearners(ta.value);
        if (!list.length) throw new Error('La liste est vide.');
        var chunks = []; for (var i = 0; i < list.length; i += 40) chunks.push(list.slice(i, i + 40));
        var added = 0, skipped = [];
        return chunks.reduce(function (p, ch) {
          return p.then(function () { return api('addLearners', { code: s.code, learners: ch }).then(function (r) { added += r.added; skipped = skipped.concat(r.skipped); }); });
        }, Promise.resolve()).then(function () {
          state.open[s.code] = true;
          if (skipped.length) { setTimeout(function () { toast(added + ' ajouté(s). Non ajoutés : ' + skipped.join(', '), true); }, 50); return ''; }
          return added + ' apprenant(s) ajouté(s).';
        });
      }, { saveLabel: 'Ajouter' });
  }

  /* ---------- coordination : apprenants ---------- */
  function learnerTable(ls, withSession) {
    var head = ['Apprenant', 'Téléphone'].concat(withSession ? ['Session'] : []).concat(['Confirmation', 'Questionnaires', '']);
    var tbody = el('tbody', {}, ls.map(function (l) {
      var c = confState(l), s = sessionOf(l.code);
      var cells = [
        el('td', { cls: 'who' }, [el('b', { text: l.nom }), el('span', { text: [l.fonction, l.email].filter(Boolean).join(' · ') })]),
        el('td', { cls: 'tel', text: l.tel })
      ];
      if (withSession) cells.push(el('td', { cls: 'sess-cell' }, [s ? s.entreprise : l.code, el('span', { text: s ? fr(s.day) + ' · ' + l.code : '' })]));
      cells.push(el('td', {}, [chip(c[0], c[1]), l.ordinateur ? el('div', { cls: 'soft', text: 'Ordinateur : ' + l.ordinateur }) : null]));
      cells.push(el('td', {}, [el('div', { cls: 'chips' }, [chip('AVANT', l.avant ? 'ok' : ''), chip('APRÈS', l.apres ? 'ok' : '')])]));
      cells.push(el('td', { cls: 'acts' }, [
        el('button', { type: 'button', cls: 'btn link', text: 'Modifier', onclick: function () { learnerEdit(l); } }),
        el('button', { type: 'button', cls: 'btn link', text: 'Déplacer', onclick: function () { learnerMove(l); } }),
        el('button', { type: 'button', cls: 'btn link danger-text', text: 'Retirer', onclick: function () { learnerRemove(l); } })
      ]));
      return el('tr', {}, cells);
    }));
    return el('table', { cls: 'lt' }, [el('thead', {}, [el('tr', {}, head.map(function (h) { return el('th', { text: h }); }))]), tbody]);
  }

  function renderLearners(v) {
    var A = state.admin, all = A.learners || [];
    var sessOpts = [['', 'Toutes les sessions']].concat(A.sessions.map(function (s) {
      return [s.code, (s.day ? fr(s.day) + ' · ' : '') + s.entreprise + ' (' + learnersOf(s.code).length + ')'];
    }));
    var stOpts = [['', 'Tous les statuts'], ['sansconf', 'Sans confirmation'], ['absent', 'Absents annoncés'],
                  ['avant', 'AVANT manquant'], ['apres', 'APRÈS manquant']];
    var sSel = select('l-sess', sessOpts, state.lsess), stSel = select('l-stat', stOpts, state.lstat);
    sSel.setAttribute('aria-label', 'Session'); stSel.setAttribute('aria-label', 'Statut');
    sSel.addEventListener('change', function () { state.lsess = this.value; drawList(); });
    stSel.addEventListener('change', function () { state.lstat = this.value; drawList(); });
    var countEl = el('span', { cls: 'soft' });
    var exportBtn = el('button', { type: 'button', cls: 'btn ghost', text: 'Exporter (CSV)' });
    v.appendChild(el('section', { cls: 'toolbar' }, [
      el('div', { cls: 'toolbar-row' }, [
        searchBox('q-learn', state.lq, 'Chercher un nom, un téléphone, une fonction ou un e-mail', function (val) { state.lq = val; drawList(); })
      ]),
      el('div', { cls: 'toolbar-row' }, [sSel, stSel, el('span', { cls: 'spacer' }), countEl, exportBtn])
    ]));
    var box = el('section', { cls: 'card' });
    v.appendChild(box);
    var current = [];
    exportBtn.addEventListener('click', function () { if (current.length) exportCsv(current, state.lsess || 'tous'); else toast('Aucun apprenant à exporter.', true); });
    drawList();

    function drawList() {
      var q = norm(state.lq), qd = state.lq.replace(/\D/g, '');
      current = all.filter(function (l) {
        if (state.lsess && l.code !== state.lsess) return false;
        if (state.lstat === 'sansconf' && l.conf) return false;
        if (state.lstat === 'absent' && !/^Non/.test(l.conf || '')) return false;
        if (state.lstat === 'avant' && l.avant) return false;
        if (state.lstat === 'apres' && l.apres) return false;
        if (!q) return true;
        if (qd.length >= 4 && String(l.tel).replace(/\D/g, '').indexOf(qd) !== -1) return true;
        return norm([l.nom, l.fonction, l.email, l.code].join(' ')).indexOf(q) !== -1;
      });
      countEl.textContent = plural(current.length, 'apprenant', 'apprenants');
      clear(box);
      if (!all.length) { box.appendChild(el('p', { cls: 'empty', text: 'Aucun apprenant. Ajoutez-les depuis l\'onglet Sessions.' })); return; }
      if (!current.length) { box.appendChild(el('p', { cls: 'empty', text: 'Aucun apprenant ne correspond.' })); return; }
      var shown = current.slice(0, 300);
      box.appendChild(learnerTable(shown, !state.lsess));
      if (current.length > shown.length) box.appendChild(el('p', { cls: 'soft', text: 'Les 300 premiers sont affichés. Affinez la recherche pour voir les autres.' }));
    }
  }

  function learnerEdit(l) {
    var s = sessionOf(l.code);
    var f = {
      nom: input('le-nom', l.nom, { maxlength: 100 }),
      fonction: input('le-fonction', l.fonction, { maxlength: 80 }),
      tel: input('le-tel', l.tel, { maxlength: 30, inputmode: 'tel' }),
      email: input('le-email', l.email, { type: 'email', maxlength: 120 })
    };
    modal('Modifier un apprenant', [
      el('p', { cls: 'soft', text: (s ? s.entreprise + ' · ' : '') + l.code }),
      el('div', { cls: 'grid2' }, [field('Nom complet', f.nom), field('Fonction', f.fonction),
        field('Téléphone WhatsApp', f.tel), field('E-mail (facultatif)', f.email)]),
      el('p', { cls: 'note', text: 'Le numéro relie les questionnaires AVANT et APRÈS. Changez-le seulement s\'il est faux.' })],
      function () {
        var data = {};
        Object.keys(f).forEach(function (k) { data[k] = f[k].value.trim(); });
        return api('saveLearner', { code: l.code, key: l.key, learner: data }).then(function () { return 'Apprenant enregistré.'; });
      });
  }

  function learnerMove(l) {
    var from = sessionOf(l.code);
    var targets = state.admin.sessions.filter(function (s) { return s.code !== l.code && isActive(s); });
    if (!targets.length) { toast('Aucune autre session disponible.', true); return; }
    targets.sort(function (a, b) { return (a.dd !== null && a.dd < 0) - (b.dd !== null && b.dd < 0) || (a.day < b.day ? -1 : 1); });
    var sel = select('lm-to', targets.map(function (s) {
      return [s.code, (s.day ? fr(s.day) + ' · ' : '') + s.entreprise + ' · ' + s.code + (s.dd !== null && s.dd < 0 ? ' (passée)' : '')];
    }), targets[0].code);
    modal('Déplacer ' + l.nom, [
      el('p', { cls: 'soft', text: 'Session actuelle : ' + (from ? from.entreprise + ', ' + fr(from.day) : l.code) }),
      field('Nouvelle session', sel),
      el('p', { cls: 'note', text: 'Les messages WhatsApp repartent de zéro pour la nouvelle session. Ses questionnaires déjà remplis restent valables.' })],
      function () {
        return api('moveLearner', { code: l.code, key: l.key, to: sel.value }).then(function () {
          var to = sessionOf(sel.value);
          return l.nom + ' est déplacé vers ' + (to ? to.entreprise : sel.value) + '.';
        });
      }, { saveLabel: 'Déplacer' });
  }

  function learnerRemove(l) {
    var s = sessionOf(l.code);
    modal('Retirer ' + l.nom + ' ?', [
      el('p', { text: 'Cet apprenant sera retiré de la session ' + (s ? s.entreprise + ' du ' + fr(s.day) : l.code) + '. Il ne recevra plus de message.' }),
      el('p', { cls: 'soft', text: 'Ses réponses aux questionnaires restent dans le classeur.' })],
      function () {
        return api('removeLearner', { code: l.code, key: l.key }).then(function () { return l.nom + ' est retiré de la session.'; });
      }, { saveLabel: 'Retirer', danger: true, noFocus: true });
  }

  /* Export CSV (separateur ; pour Excel en francais). Les cellules qui commencent par = + - @ sont neutralisees. */
  function exportCsv(ls, name) {
    var head = ['Code session', 'Entreprise', 'Date', 'Nom complet', 'Fonction', 'Téléphone WhatsApp', 'E-mail', 'Confirmation', 'Ordinateur', 'AVANT', 'APRÈS'];
    var rows = ls.map(function (l) {
      var s = sessionOf(l.code) || {};
      return [l.code, s.entreprise, fr(s.day), l.nom, l.fonction, l.tel, l.email, l.conf, l.ordinateur, l.avant ? 'Oui' : 'Non', l.apres ? 'Oui' : 'Non'];
    });
    var csv = [head].concat(rows).map(function (r) {
      return r.map(function (x) {
        var v = String(x === undefined || x === null ? '' : x);
        if (/^[=+\-@]/.test(v)) v = "'" + v;
        return '"' + v.replace(/"/g, '""') + '"';
      }).join(';');
    }).join('\r\n');
    var url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    var a = el('a', { href: url, download: 'apprenants-' + String(name).replace(/[^A-Za-z0-9_-]/g, '') + '.csv' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  /* ---------- coordination : formateurs ---------- */
  function renderTrainers(v) {
    var A = state.admin;
    var box = el('div');
    v.appendChild(el('section', { cls: 'toolbar' }, [el('div', { cls: 'toolbar-row' }, [
      searchBox('q-tr', '', 'Chercher un formateur', function (val) { draw(val); }),
      el('button', { type: 'button', cls: 'btn', text: 'Nouveau formateur', onclick: function () { trainerForm(null); } })
    ])]));
    v.appendChild(box);
    draw('');

    function draw(qv) {
      clear(box);
      var q = norm(qv);
      var list = A.trainers.filter(function (t) { return !q || norm([t.nom, t.code, t.email].join(' ')).indexOf(q) !== -1; });
      if (!list.length) { box.appendChild(el('p', { cls: 'empty', text: 'Aucun formateur.' })); return; }
      list.forEach(function (t) {
        var mine = A.sessions.filter(function (s) { return s.formateur === t.code && isActive(s); });
        var next = mine.filter(function (s) { return s.dd !== null && s.dd >= 0; });
        var miss = mine.filter(function (s) { return s.dd !== null && s.dd < 0 && !s.rapport; }).length;
        var nextS = next[0];
        box.appendChild(el('article', { cls: 'card' }, [
          el('div', { cls: 'sess-head' }, [el('h3', { text: t.nom }), el('span', { cls: 'soft', text: t.code })]),
          el('p', { cls: 'sess-meta', text: [t.email, t.tel].filter(Boolean).join(' · ') }),
          el('div', { cls: 'chips' }, [chip(plural(mine.length, 'session', 'sessions')), chip(next.length + ' à venir', next.length ? 'info' : ''),
            chip(miss ? plural(miss, 'rapport manquant', 'rapports manquants') : 'Rapports à jour', miss ? 'ko' : 'ok'),
            nextS ? chip('Prochaine : ' + nextS.entreprise + ', ' + fr(nextS.day)) : null]),
          el('div', { cls: 'row-actions' }, [el('button', { type: 'button', cls: 'btn ghost small', text: 'Modifier', onclick: function () { trainerForm(t); } })])
        ]));
      });
    }
  }

  function trainerForm(t) {
    var f = {
      code: input('t-code', t && t.code, { maxlength: 20, readonly: !!t, placeholder: 'ex. SN-01' }),
      nom: input('t-nom', t && t.nom, { maxlength: 100 }),
      email: input('t-email', t && t.email, { type: 'email', maxlength: 120 }),
      tel: input('t-tel', t && t.tel, { maxlength: 30, inputmode: 'tel' }),
      pays: select('t-pays', [''].concat(state.admin.pays), t ? t.pays || '' : '')
    };
    modal(t ? 'Modifier ' + t.nom : 'Nouveau formateur', [el('div', { cls: 'grid2' }, [
      field('Code formateur', f.code), field('Nom', f.nom), field('E-mail (sert à la connexion)', f.email),
      field('Téléphone WhatsApp', f.tel), field('Pays', f.pays)])],
      function () {
        var data = {};
        Object.keys(f).forEach(function (k) { data[k] = f[k].value.trim(); });
        return api('saveTrainer', { trainer: data }).then(function (r) { return r.created ? 'Formateur ajouté.' : 'Formateur enregistré.'; });
      });
  }

  /* ---------- formateur ---------- */
  function renderTrainer(v) {
    var T = state.trainer;
    var pending = [];
    T.sessions.forEach(function (s) { s.learners.forEach(function (l) {
      var a = l.suggested ? l.actions.filter(function (x) { return x.step === l.suggested; })[0] : null;
      if (a && !a.sentOn) pending.push({ s: s, l: l, a: a });
    }); });

    var intro = el('section', { cls: 'card' }, [
      el('h2', { text: 'Bonjour ' + T.nom }),
      el('p', { cls: 'soft', text: 'Chaque bouton vert ouvre WhatsApp avec le message prêt. Vous appuyez sur Envoyer. Le bouton passe ensuite en vert clair avec la date.' })
    ]);
    if (pending.length) {
      intro.appendChild(el('button', { type: 'button', cls: 'btn wa', text: 'Envoyer les ' + pending.length + ' message(s) du jour, un par un',
        onclick: function () { state.relay = { list: pending, i: 0 }; renderRelay(); } }));
    } else {
      intro.appendChild(chip('Aucun message en attente aujourd\'hui.', 'ok'));
    }
    v.appendChild(intro);
    v.appendChild(el('div', { id: 'relay' }));

    if (!T.sessions.length) { v.appendChild(el('p', { cls: 'empty', text: 'Aucune session attribuée pour le moment.' })); return; }
    T.sessions.forEach(function (s) {
      var conf = s.learners.filter(function (l) { return /^Oui/.test(l.conf || ''); }).length;
      var card = el('article', { cls: 'card' }, [
        el('div', { cls: 'sess' }, [
          dayTile(s),
          el('div', { cls: 'sess-main' }, [
            el('h3', { text: s.entreprise }),
            el('p', { cls: 'sess-meta', text: [s.heure + ' à ' + s.heureFin + ', ' + when(s.dd), [s.ville, s.pays].filter(Boolean).join(', '), s.adresse, s.contact].filter(Boolean).join(' · ') }),
            el('div', { cls: 'chips' }, [chip(plural(s.learners.length, 'apprenant', 'apprenants')), chip(plural(conf, 'confirmé', 'confirmés')),
              chip('AVANT ' + s.learners.filter(function (l) { return l.avant; }).length + '/' + s.learners.length),
              chip('APRÈS ' + s.learners.filter(function (l) { return l.apres; }).length + '/' + s.learners.length)])
          ])
        ])
      ]);
      if (s.rapportLink) {
        card.appendChild(el('div', { cls: 'row-actions' }, [s.rapport ? chip('Rapport envoyé. Merci.', 'ok')
          : el('a', { cls: 'btn', href: s.rapportLink, target: '_blank', rel: 'noopener noreferrer', text: 'Remplir mon rapport de session' })]));
      }
      var ul = el('ul', { cls: 'learners' });
      s.learners.forEach(function (l) { ul.appendChild(learnerRow(s, l)); });
      if (!s.learners.length) ul.appendChild(el('li', { cls: 'soft', text: 'La liste des apprenants arrive bientôt.' }));
      card.appendChild(ul);
      v.appendChild(card);
    });
  }

  function learnerRow(s, l) {
    var c = confState(l);
    var chips = [chip(c[0], c[1]), chip(l.avant ? 'AVANT fait' : 'AVANT à faire', l.avant ? 'ok' : ''), chip(l.apres ? 'APRÈS fait' : 'APRÈS à faire', l.apres ? 'ok' : '')];
    if (l.ordinateur) chips.push(chip('Ordinateur : ' + l.ordinateur));
    var actions = el('div', { cls: 'row-actions' }, l.actions.map(function (a) { return waButton(s, l, a); }));
    if (!l.actions.length) actions.appendChild(el('span', { cls: 'soft', text: 'Rien à envoyer.' }));
    return el('li', {}, [el('span', { cls: 'name', text: l.nom }), el('span', { cls: 'soft', text: l.fonction ? ' · ' + l.fonction : '' }),
      el('div', { cls: 'chips' }, chips), actions]);
  }

  function waButton(s, l, a) {
    if (!a.wa) return chip('Numéro illisible : ' + l.tel, 'ko');
    var b = el('button', { type: 'button', cls: 'btn small wa' + (a.sentOn ? ' done' : '') + (l.suggested === a.step && !a.sentOn ? ' suggested' : '') });
    b.appendChild(document.createTextNode(a.label));
    var small = el('span', { cls: 'sent', text: a.sentOn ? 'envoyé le ' + fr(a.sentOn) : '' });
    b.appendChild(small);
    b.addEventListener('click', function () { send(s, l, a, b, small); });
    return b;
  }

  /* Ouvre WhatsApp tout de suite (dans le clic, sinon le navigateur bloque), puis date l'envoi cote serveur. */
  function send(s, l, a, btn, small) {
    window.open(a.wa, '_blank', 'noopener,noreferrer');
    return api('markSent', { code: s.code, key: l.key, step: a.step }).then(function (r) {
      a.sentOn = r.sentOn;
      if (btn) { btn.className = 'btn small wa done'; small.textContent = 'envoyé le ' + fr(r.sentOn); }
    }).catch(function (e) { toast(e.message, true); });
  }

  function renderRelay() {
    var box = clear($('relay'));
    var R = state.relay;
    if (!R) return;
    while (R.i < R.list.length && R.list[R.i].a.sentOn) R.i++;   // deja envoye avec son bouton
    if (R.i >= R.list.length) {
      box.appendChild(el('div', { cls: 'relay' }, [el('p', { text: 'Terminé. Tous les messages du jour sont ouverts.' }),
        el('button', { type: 'button', cls: 'btn', text: 'Fermer et actualiser', onclick: function () { state.relay = null; refresh(); } })]));
      return;
    }
    var it = R.list[R.i];
    box.appendChild(el('div', { cls: 'relay' }, [
      el('p', { text: (R.i + 1) + ' sur ' + R.list.length + ' : ' + it.l.nom + ' (' + it.s.entreprise + ')' }),
      el('p', { cls: 'soft', text: it.a.label }),
      el('div', { cls: 'row-actions' }, [
        el('button', { type: 'button', cls: 'btn wa', text: 'Ouvrir WhatsApp', onclick: function () { send(it.s, it.l, it.a, null, null); R.i++; renderRelay(); } }),
        el('button', { type: 'button', cls: 'btn ghost', text: 'Passer', onclick: function () { R.i++; renderRelay(); } }),
        el('button', { type: 'button', cls: 'btn ghost', text: 'Arrêter', onclick: function () { state.relay = null; refresh(); } })
      ])
    ]));
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------- demarrage ---------- */
  if (state.token) {
    api('me').then(function (u) { state.role = u.role; state.nom = u.nom; start(); }).catch(function () { logout(false); });
  }
})();
