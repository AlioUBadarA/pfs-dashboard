/* Espace Digital Fundamentals : attribution des sessions (coordination) et page des formateurs.
 * Toutes les donnees viennent de l'application web Apps Script (doPost), apres connexion par code.
 * Le serveur verifie le role a chaque requete. Cette page n'affiche du texte qu'avec textContent. */
(function () {
  'use strict';

  var API_URL = (window.PFS_CONFIG && window.PFS_CONFIG.API_URL) || '';
  var TOKEN_KEY = 'pfs_espace_token';
  var $ = function (id) { return document.getElementById(id); };
  var state = { token: load(), role: '', nom: '', tab: '', admin: null, trainer: null, filter: 'avenir', relay: null };

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
  var toastTimer = null;
  function toast(msg, isErr) {
    var t = $('toast');
    t.textContent = msg; t.className = 'esp-toast' + (isErr ? ' err' : ''); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 4000);
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
    $('bar').hidden = true; clear($('view')); $('login').hidden = false;
    $('f-code').hidden = true; $('f-email').hidden = false; $('who').textContent = 'Coordination et formateurs';
    if (expired) $('login-error').textContent = 'Votre session a expiré. Reconnectez-vous.';
  }

  function start() {
    $('login').hidden = true; $('bar').hidden = false;
    $('who').textContent = state.role === 'admin' ? 'Coordination' : 'Espace formateur' + (state.nom ? ' : ' + state.nom : '');
    var tabs = state.role === 'admin' ? [['sessions', 'Sessions'], ['formateurs', 'Formateurs']] : [['mes', 'Mes sessions']];
    state.tab = tabs[0][0];
    var bar = clear($('tabs'));
    tabs.forEach(function (t) {
      bar.appendChild(el('button', { type: 'button', role: 'tab', 'aria-selected': String(t[0] === state.tab), 'data-tab': t[0], text: t[1],
        onclick: function () { state.tab = t[0]; Array.prototype.forEach.call(bar.children, function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === t[0])); }); render(); } }));
    });
    refresh();
  }

  function refresh() {
    var v = clear($('view'));
    v.appendChild(el('p', { cls: 'soft', text: 'Chargement…' }));
    var action = state.role === 'admin' ? 'adminData' : 'trainerData';
    return api(action).then(function (d) {
      if (state.role === 'admin') state.admin = d; else state.trainer = d;
      render();
    }).catch(function (e) { clear(v).appendChild(el('p', { cls: 'esp-error', text: e.message })); });
  }

  function render() {
    var v = clear($('view'));
    if (state.role === 'admin' && state.admin) {
      if (state.tab === 'sessions') renderSessions(v); else renderTrainers(v);
    } else if (state.trainer) {
      renderTrainer(v);
    }
  }

  /* ---------- coordination : sessions ---------- */
  function trainerName(code) {
    var t = (state.admin.trainers || []).filter(function (x) { return x.code === code; })[0];
    return t ? t.nom : '';
  }

  function renderSessions(v) {
    var A = state.admin;
    var filters = [['avenir', 'À venir'], ['sans', 'Sans formateur'], ['passees', 'Passées'], ['toutes', 'Toutes']];
    var sel = el('select', { id: 'filter', 'aria-label': 'Filtrer les sessions', onchange: function () { state.filter = this.value; render(); } },
      filters.map(function (f) { return el('option', { value: f[0], text: f[1], selected: f[0] === state.filter }); }));
    var total = A.sessions.length, sans = A.sessions.filter(function (s) { return !s.formateur && s.statut !== 'Annulée'; }).length;
    v.appendChild(el('div', { cls: 'esp-tools' }, [
      sel,
      el('button', { type: 'button', cls: 'btn small', text: 'Nouvelle session', onclick: function () { sessionForm(null); } }),
      el('span', { cls: 'soft', text: total + ' sessions, dont ' + sans + ' sans formateur' })
    ]));
    v.appendChild(el('div', { id: 'panel' }));

    var list = A.sessions.filter(function (s) {
      if (state.filter === 'avenir') return s.dd === null || s.dd >= 0;
      if (state.filter === 'passees') return s.dd !== null && s.dd < 0;
      if (state.filter === 'sans') return !s.formateur && s.statut !== 'Annulée';
      return true;
    });
    if (state.filter === 'passees') list = list.slice().reverse();
    if (!list.length) { v.appendChild(el('p', { cls: 'empty', text: 'Aucune session.' })); return; }

    list.forEach(function (s) {
      var select = el('select', { 'aria-label': 'Formateur de la session ' + s.code },
        [el('option', { value: '', text: 'Non attribué', selected: !s.formateur })].concat(A.trainers.map(function (t) {
          return el('option', { value: t.code, text: t.nom + ' (' + t.code + ')', selected: t.code === s.formateur });
        })));
      select.addEventListener('change', function () {
        var val = this.value, prev = s.formateur, me = this;
        me.disabled = true;
        api('assign', { code: s.code, trainer: val }).then(function () {
          s.formateur = val; s.prevenu = false;
          toast(val ? 'Session attribuée à ' + trainerName(val) + '. Il sera prévenu dans l\'heure.' : 'Formateur retiré.');
        }).catch(function (e) { me.value = prev; toast(e.message, true); }).then(function () { me.disabled = false; });
      });
      var chips = [
        chip(s.inscrits + ' inscrits', s.inscrits ? '' : 'warn'),
        chip(s.confirmes + ' confirmés'),
        chip('AVANT ' + s.avant + '/' + s.inscrits, s.inscrits && s.avant === s.inscrits ? 'ok' : ''),
        chip('APRÈS ' + s.apres + '/' + s.inscrits, s.inscrits && s.apres === s.inscrits ? 'ok' : '')
      ];
      if (s.dd !== null && s.dd < 0) chips.push(chip(s.rapport ? 'Rapport reçu' : 'Rapport manquant', s.rapport ? 'ok' : 'ko'));
      if (s.statut === 'Annulée') chips.push(chip('Annulée', 'ko'));
      if (s.formateur && !s.prevenu && (s.dd === null || s.dd >= 0)) chips.push(chip('Formateur pas encore prévenu', 'warn'));
      v.appendChild(el('article', { cls: 'card' }, [
        el('div', { cls: 'sess-head' }, [
          el('h3', { text: s.entreprise }),
          el('span', { cls: 'sess-date', text: fr(s.day) + ' · ' + s.creneau + ' · ' + when(s.dd) })
        ]),
        el('p', { cls: 'sess-meta', text: [s.ville, s.pays, s.code].filter(Boolean).join(' · ') }),
        el('div', { cls: 'chips' }, chips),
        el('div', { cls: 'row-actions' }, [
          select,
          el('button', { type: 'button', cls: 'btn ghost small', text: 'Modifier', onclick: function () { sessionForm(s); } }),
          el('button', { type: 'button', cls: 'btn ghost small', text: 'Ajouter des apprenants', onclick: function () { learnersForm(s); } })
        ])
      ]));
    });
  }

  function chip(text, kind) { return el('span', { cls: 'chip' + (kind ? ' ' + kind : ''), text: text }); }

  function field(label, input) { return el('div', {}, [el('label', { for: input.id, text: label }), input]); }
  function input(id, value, attrs) { return el('input', Object.assign({ id: id, value: value || '' }, attrs || {})); }
  function select(id, values, current) {
    return el('select', { id: id }, values.map(function (x) { return el('option', { value: x, text: x, selected: x === current }); }));
  }

  function openPanel(title, body, onSave, saveLabel) {
    var p = clear($('panel'));
    var err = el('p', { cls: 'esp-error', role: 'alert' });
    var save = el('button', { type: 'button', cls: 'btn', text: saveLabel || 'Enregistrer' });
    save.addEventListener('click', function () {
      err.textContent = ''; busy(save, true);
      Promise.resolve().then(onSave).then(function (msg) { clear(p); if (msg) toast(msg); return refresh(); })
        .catch(function (e) { err.textContent = e.message; }).then(function () { busy(save, false); });
    });
    p.appendChild(el('section', { cls: 'card' }, [el('h2', { text: title })].concat(body).concat([
      el('div', { cls: 'row-actions' }, [save, el('button', { type: 'button', cls: 'btn ghost', text: 'Annuler', onclick: function () { clear(p); } })]), err])));
    p.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    openPanel(s ? 'Modifier la session ' + s.code : 'Nouvelle session', [el('div', { cls: 'grid2' }, [
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
    openPanel('Ajouter des apprenants : ' + s.entreprise, [
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
          if (skipped.length) toast(added + ' ajouté(s). Non ajoutés : ' + skipped.join(', '), true);
          return added + ' apprenant(s) ajouté(s).';
        });
      }, 'Ajouter');
  }

  /* ---------- coordination : formateurs ---------- */
  function renderTrainers(v) {
    var A = state.admin;
    v.appendChild(el('div', { cls: 'esp-tools' }, [
      el('button', { type: 'button', cls: 'btn small', text: 'Nouveau formateur', onclick: function () { trainerForm(null); } }),
      el('span', { cls: 'soft', text: A.trainers.length + ' formateurs' })
    ]));
    v.appendChild(el('div', { id: 'panel' }));
    if (!A.trainers.length) { v.appendChild(el('p', { cls: 'empty', text: 'Aucun formateur.' })); return; }
    A.trainers.forEach(function (t) {
      var mine = A.sessions.filter(function (s) { return s.formateur === t.code && s.statut !== 'Annulée'; });
      var next = mine.filter(function (s) { return s.dd !== null && s.dd >= 0; });
      v.appendChild(el('article', { cls: 'card' }, [
        el('div', { cls: 'sess-head' }, [el('h3', { text: t.nom }), el('span', { cls: 'soft', text: t.code })]),
        el('p', { cls: 'sess-meta', text: [t.email, t.tel].filter(Boolean).join(' · ') }),
        el('div', { cls: 'chips' }, [chip(mine.length + ' sessions'), chip(next.length + ' à venir'),
          chip(mine.filter(function (s) { return s.dd < 0 && !s.rapport; }).length + ' rapport(s) manquant(s)', mine.some(function (s) { return s.dd < 0 && !s.rapport; }) ? 'ko' : 'ok')]),
        el('div', { cls: 'row-actions' }, [el('button', { type: 'button', cls: 'btn ghost small', text: 'Modifier', onclick: function () { trainerForm(t); } })])
      ]));
    });
  }

  function trainerForm(t) {
    var f = {
      code: input('t-code', t && t.code, { maxlength: 20, readonly: !!t, placeholder: 'ex. SN-01' }),
      nom: input('t-nom', t && t.nom, { maxlength: 100 }),
      email: input('t-email', t && t.email, { type: 'email', maxlength: 120 }),
      tel: input('t-tel', t && t.tel, { maxlength: 30, inputmode: 'tel' }),
      pays: select('t-pays', [''].concat(state.admin.pays), '')
    };
    openPanel(t ? 'Modifier ' + t.nom : 'Nouveau formateur', [el('div', { cls: 'grid2' }, [
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
      intro.appendChild(el('button', { type: 'button', cls: 'btn wa', text: 'Relancer les ' + pending.length + ' message(s) du jour, un par un',
        onclick: function () { state.relay = { list: pending, i: 0 }; renderRelay(); } }));
    } else {
      intro.appendChild(el('p', { cls: 'chip ok', text: 'Aucun message en attente aujourd\'hui.' }));
    }
    v.appendChild(intro);
    v.appendChild(el('div', { id: 'relay' }));

    if (!T.sessions.length) { v.appendChild(el('p', { cls: 'empty', text: 'Aucune session attribuée pour le moment.' })); return; }
    T.sessions.forEach(function (s) {
      var conf = s.learners.filter(function (l) { return /^Oui/.test(l.conf || ''); }).length;
      var card = el('article', { cls: 'card' }, [
        el('div', { cls: 'sess-head' }, [el('h3', { text: s.entreprise }), el('span', { cls: 'sess-date', text: fr(s.day) + ' · ' + s.heure + ' à ' + s.heureFin + ' · ' + when(s.dd) })]),
        el('p', { cls: 'sess-meta', text: [s.ville, s.pays, s.adresse, s.contact].filter(Boolean).join(' · ') }),
        el('div', { cls: 'chips' }, [chip(s.learners.length + ' apprenants'), chip(conf + ' confirmés'),
          chip('AVANT ' + s.learners.filter(function (l) { return l.avant; }).length + '/' + s.learners.length),
          chip('APRÈS ' + s.learners.filter(function (l) { return l.apres; }).length + '/' + s.learners.length)])
      ]);
      if (s.rapportLink) {
        card.appendChild(s.rapport ? chip('Rapport envoyé. Merci.', 'ok')
          : el('a', { cls: 'btn', href: s.rapportLink, target: '_blank', rel: 'noopener noreferrer', text: 'Remplir mon rapport de session' }));
      }
      var ul = el('ul', { cls: 'learners' });
      s.learners.forEach(function (l) { ul.appendChild(learnerRow(s, l)); });
      if (!s.learners.length) ul.appendChild(el('li', { cls: 'empty', text: 'La liste des apprenants arrive bientôt.' }));
      card.appendChild(ul);
      v.appendChild(card);
    });
  }

  function confChip(l) {
    if (/^Oui/.test(l.conf || '')) return chip('Confirmé', 'ok');
    if (/remplace/.test(l.conf || '')) return chip('Remplacé', 'warn');
    if (/^Non/.test(l.conf || '')) return chip('Absent annoncé', 'ko');
    return chip('Sans réponse');
  }

  function learnerRow(s, l) {
    var chips = [confChip(l), chip(l.avant ? 'AVANT fait' : 'AVANT à faire', l.avant ? 'ok' : ''), chip(l.apres ? 'APRÈS fait' : 'APRÈS à faire', l.apres ? 'ok' : '')];
    if (l.ordinateur) chips.push(chip('Ordinateur : ' + l.ordinateur));
    var actions = el('div', { cls: 'row-actions' }, l.actions.map(function (a) { return waButton(s, l, a); }));
    if (!l.actions.length) actions.appendChild(el('span', { cls: 'soft', text: 'Rien à envoyer.' }));
    return el('li', {}, [el('span', { cls: 'name', text: l.nom }), el('span', { cls: 'soft', text: l.fonction ? ' · ' + l.fonction : '' }),
      el('div', { cls: 'chips' }, chips), actions]);
  }

  function waButton(s, l, a) {
    if (!a.wa) return el('span', { cls: 'chip ko', text: 'Numéro illisible : ' + l.tel });
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
