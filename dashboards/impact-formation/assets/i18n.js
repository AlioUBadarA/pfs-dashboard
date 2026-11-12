/* EN / FR for the Impact dashboard.
 * The Apps Script API answers in English only, so the French text is applied here, at display time.
 * The API values themselves (filter values, headers used by the logic) are never changed.
 * A string missing from the dictionary is shown in English. */
(function () {
  'use strict';

  var FR = {
    // Page and filters
    'PFS Sales Training · Impact Dashboard': 'PFS Formation commerciale · Tableau de bord d\'impact',
    'Partners in Food Solutions × Oo2 Formations & Consulting': 'Partners in Food Solutions × Oo2 Formations & Consulting',
    'All countries': 'Tous les pays', 'All formats': 'Tous les formats',
    'Online': 'En ligne', 'In person': 'En présentiel', 'Both': 'Les deux',
    'Benin': 'Bénin', 'Senegal': 'Sénégal', 'Togo': 'Togo', 'Côte d\'Ivoire': 'Côte d\'Ivoire',

    // KPI cards
    'Participants reached': 'Participants touchés',
    'Online participants': 'Participants en ligne',
    'In-person participants': 'Participants en présentiel',
    'Rice mills represented': 'Rizeries représentées',
    'Average score after training': 'Score moyen après la formation',
    'Success rate after training': 'Taux de réussite après la formation',
    'Satisfaction (4 or 5 out of 5)': 'Satisfaction (4 ou 5 sur 5)',
    'Online attendance rate': 'Taux de présence en ligne',
    'correct answers out of 9 questions': 'bonnes réponses sur 9 questions',
    'answered after training': 'ont répondu après la formation',
    'attended at least one session / enrolled': 'présents à au moins une séance / inscrits',

    // How to read
    'Before = questionnaire at the start of the online program.': 'Avant = questionnaire au début du programme en ligne.',
    'After = questionnaire at the end of the training (sent after the online sessions and the in-person days).':
      'Après = questionnaire à la fin de la formation. Il part après les séances en ligne et les journées présentielles.',
    'Each person is counted once (latest answer).': 'Chaque personne compte une fois. La page garde sa dernière réponse.',
    'Green = improvement, red = decline.': 'Vert = progression. Rouge = recul.',
    'Use the two filters above: the whole page recalculates.': 'Les deux filtres recalculent toute la page.',

    // Sections
    'Training evaluation': 'Évaluation de la formation',
    'Online vs in person': 'En ligne vs présentiel',
    'Reach and attendance': 'Portée et assiduité',
    'Country representation': 'Représentation par pays',
    'Knowledge results': 'Résultats en connaissances',
    'Success by question': 'Réussite par question',
    'Sales tracking tools': 'Outils de suivi des ventes',
    'What participants said at the end of the training: satisfaction, expectations and how much they feel they learned.':
      'Voici l\'avis des participants à la fin de la formation. Ils parlent de leur satisfaction, de leurs attentes et de ce qu\'ils ont appris.',
    'Results after training, side by side. People who attended both formats count in each column.':
      'Les résultats après la formation sont côte à côte. Une personne qui a suivi les deux formats compte dans chaque colonne.',
    'Online figures come from the attendance sheets (virtual classes). A session counts only if attendance was recorded for it. Project staff are excluded.':
      'Les chiffres en ligne viennent des feuilles de présence des classes virtuelles. Une séance compte seulement si la présence a été relevée. L\'équipe projet n\'est pas comptée.',
    'In-person figures come from the attendance sheets of the in-person days. People present at an in-person day and in the online classes count as "Both".':
      'Les chiffres en présentiel viennent des feuilles de présence des journées présentielles. Une personne présente en salle et en ligne compte dans « Les deux ».',
    'Calculated for the selected format, across all countries. Response rate = rice mills that answered after training / rice mills enrolled.':
      'Le calcul porte sur le format choisi, pour tous les pays. Taux de réponse = rizeries qui ont répondu après la formation / rizeries inscrites.',
    'Score = correct answers out of 9 questions.': 'Score = bonnes réponses sur 9 questions.',
    'Score = correct answers out of 9 questions. In-person-only participants answered once, after training, so they have no before score.':
      'Score = bonnes réponses sur 9 questions. Les participants en présentiel seul ont répondu une fois, après la formation. Ils n\'ont pas de score avant.',
    'Share of people who chose the correct answer, question by question.': 'Part des personnes qui ont choisi la bonne réponse, pour chaque question.',
    'Several answers possible, so totals can exceed 100%.': 'Plusieurs réponses sont possibles. Les totaux peuvent dépasser 100 %.',

    // Table and chart titles
    'Summary': 'Synthèse',
    'Did the training meet expectations?': 'La formation a-t-elle répondu aux attentes ?',
    'Self-reported knowledge improvement': 'Progression des connaissances (auto-évaluation)',
    'Satisfaction index (NPS style)': 'Indice de satisfaction (type NPS)',
    'Satisfaction rating (1 to 5)': 'Note de satisfaction (1 à 5)',
    'After training: online vs in person': 'Après la formation : en ligne vs présentiel',
    'Participation by format': 'Participation par format',
    'In-person days': 'Journées présentielles',
    'Questionnaire response rate by in-person day': 'Taux de réponse au questionnaire par journée présentielle',
    'Online attendance by group': 'Présence en ligne par groupe',
    'Attendance rate by group': 'Taux de présence par groupe',
    'Attendance by session': 'Présence par séance',
    'Attendance by session, all groups': 'Présence par séance, tous groupes',
    'Response rate and satisfaction by country': 'Taux de réponse et satisfaction par pays',
    'Average score out of 9: before vs after': 'Score moyen sur 9 : avant vs après',
    'Average score out of 9 after training': 'Score moyen sur 9 après la formation',
    'Success by question: before vs after': 'Réussite par question : avant vs après',
    'Tracking tools': 'Outils de suivi',
    'Tracking tools: before vs after': 'Outils de suivi : avant vs après',

    // Column headers
    'Indicator': 'Indicateur', 'Before': 'Avant', 'After': 'Après', 'Change': 'Évolution',
    'n before': 'n avant', 'n after': 'n après', 'Count': 'Effectif',
    'Format': 'Format', 'Country': 'Pays', 'Group': 'Groupe', 'Session': 'Séance', 'Total': 'Total',
    'Enrolled': 'Inscrits', 'Took part': 'Ont participé', 'Present': 'Présents',
    'Answered before': 'Ont répondu avant', 'Answered after': 'Ont répondu après',
    'Response rate': 'Taux de réponse', 'Success rate': 'Taux de réussite',
    'Satisfied (4-5)': 'Satisfaits (4-5)', 'Satisfaction': 'Satisfaction',
    'In-person day': 'Journée présentielle', 'Attended at least once': 'Présents au moins une fois',
    'Sessions held': 'Séances tenues', 'Attendance rate': 'Taux de présence', 'All groups': 'Tous les groupes',
    'Rice mills enrolled': 'Rizeries inscrites', 'NPS index': 'Indice NPS',
    '😞 Detractors (1 to 3)': '😞 Détracteurs (1 à 3)', '😐 Passives (4)': '😐 Passifs (4)', '😍 Promoters (5)': '😍 Promoteurs (5)',

    // Row labels
    'Average satisfaction rating out of 5': 'Note moyenne de satisfaction sur 5',
    'Share of ratings 4 or 5': 'Part des notes 4 ou 5',
    'Expectations met or exceeded': 'Attentes atteintes ou dépassées',
    'Exceeded expectations': 'Attentes dépassées',
    'Met expectations': 'Attentes atteintes',
    'Partly met expectations': 'Attentes partiellement atteintes',
    'Did not meet expectations': 'Attentes non atteintes',
    'Greatly improved': 'Nettement améliorées',
    'Moderately improved': 'Moyennement améliorées',
    'Slightly improved': 'Légèrement améliorées',
    'No improvement': 'Aucune amélioration',
    'Breakdown of ratings': 'Répartition des notes',
    'Success rate (correct answers)': 'Taux de réussite (bonnes réponses)',
    'Satisfied (4 or 5 out of 5)': 'Satisfaits (4 ou 5 sur 5)',
    'Catch-up sessions (open to all)': 'Séances de rattrapage (ouvertes à tous)',
    'Total (unique people)': 'Total (personnes uniques)',
    'Average score out of 9': 'Score moyen sur 9',
    'Unique respondents': 'Répondants uniques',
    'Questions answered': 'Réponses aux questions',
    'Q1 Know your product': 'Q1 Connaître son produit',
    'Q2 Identify buyers': 'Q2 Identifier les acheteurs',
    'Q3 Organise the sales area': 'Q3 Organiser l\'espace de vente',
    'Q4 Sales interview': 'Q4 Entretien de vente',
    'Q5 Payment': 'Q5 Paiement',
    'Q6 Manage sales': 'Q6 Gérer les ventes',
    'Q7 Prospecting': 'Q7 Prospection',
    'Q8 Negotiation': 'Q8 Négociation',
    'Q9 Sales management': 'Q9 Gestion commerciale',
    'Handwritten notebook': 'Cahier manuscrit',
    'Excel or phone spreadsheet': 'Tableur Excel ou sur téléphone',
    'Other tool mentioned': 'Autre outil cité',

    // Notes under tables
    'NPS index = % promoters (rating 5) minus % detractors (ratings 1 to 3). It ranges from -100 to +100; above 0, promoters outnumber detractors.':
      'Indice NPS = % de promoteurs (note 5) moins % de détracteurs (notes 1 à 3). Il va de -100 à +100. Au-dessus de 0, les promoteurs sont plus nombreux que les détracteurs.',
    'Enrolled in person = listed on an in-person attendance sheet. Took part = attended at least one session or answered a questionnaire.':
      'Inscrits en présentiel = personnes notées sur une feuille de présence d\'une journée présentielle. Ont participé = personnes présentes à au moins une séance ou qui ont répondu à un questionnaire.',
    'Response rate = people present who answered the after questionnaire. Success rate and satisfaction are calculated on those who answered.':
      'Taux de réponse = personnes présentes qui ont répondu au questionnaire après. Le taux de réussite et la satisfaction portent sur ces répondants.',
    'Attendance rate = sessions attended / sessions planned for the people enrolled. The total rate covers the group sessions only (catch-up sessions are optional).':
      'Taux de présence = séances suivies / séances prévues pour les inscrits. Le taux total couvre seulement les séances de groupe. Les séances de rattrapage sont facultatives.',
    'Share of enrolled people present at each session. An empty cell means no attendance was recorded for that session.':
      'Part des inscrits présents à chaque séance. Une cellule vide indique une séance sans relevé de présence.',
    'Satisfaction = share of people rating 4 or 5 out of 5.': 'Satisfaction = part des personnes qui ont donné 4 ou 5 sur 5.'
  };

  /** Strings with numbers in them: [pattern, French builder]. */
  var PATTERNS = [
    [/^Showing: (.+) · (.+) · (\d+) answered before, (\d+) after \(each person counted once\)$/,
      function (m) { return 'Affichage : ' + tr(m[1]) + ' · ' + tr(m[2]) + ' · ' + m[3] + ' réponses avant, ' + m[4] + ' après (chaque personne comptée une fois)'; }],
    [/^(\d+) online · (\d+) in person$/, function (m) { return m[1] + ' en ligne · ' + m[2] + ' en présentiel'; }],
    [/^correct answers · (\d+) people$/, function (m) { return 'bonnes réponses · ' + m[1] + (m[1] === '1' ? ' personne' : ' personnes'); }],
    [/^average (.+) \/ 5 · NPS (.+)$/, function (m) { return 'moyenne ' + m[1] + ' / 5 · NPS ' + m[2]; }],
    [/^(\d+) of (\d+) seats filled$/, function (m) { return m[1] + ' places occupées sur ' + m[2]; }],
    [/^(\d+) of (\d+) present answered \((.+)\)$/, function (m) { return m[1] + ' présents sur ' + m[2] + ' ont répondu (' + m[3] + ')'; }],
    [/^Satisfaction index: (.+)$/, function (m) { return 'Indice de satisfaction : ' + m[1]; }],
    [/^(\S+\s+)(\d) out of 5$/, function (m) { return m[1] + m[2] + ' sur 5'; }],
    [/^Group (\S+)$/, function (m) { return 'Groupe ' + m[1]; }],
    [/^Session (\d+)$/, function (m) { return 'Séance ' + m[1]; }],
    [/^(\d+)\. (.+)$/, function (m) { return m[1] + '. ' + tr(m[2]); }]
  ];

  var lang = initLang();

  function initLang() {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'fr' || q === 'en') return q;
    try { var saved = localStorage.getItem('pfs_lang'); if (saved === 'fr' || saved === 'en') return saved; } catch (e) { /* ignore */ }
    return 'en';
  }

  /** French version of an English API string (unchanged in English or when unknown). */
  function tr(s) {
    if (lang !== 'fr' || typeof s !== 'string' || !s) return s;
    if (Object.prototype.hasOwnProperty.call(FR, s)) return FR[s];
    for (var i = 0; i < PATTERNS.length; i++) {
      var m = s.match(PATTERNS[i][0]);
      if (m) return PATTERNS[i][1](m);
    }
    return s;
  }

  window.PFS_I18N = {
    get lang() { return lang; },
    set: function (l) {
      lang = l;
      try { localStorage.setItem('pfs_lang', l); } catch (e) { /* ignore */ }
    },
    /** Translates an API string. */
    tr: tr,
    /** Picks the page text: t('English', 'Français'). */
    t: function (en, fr) { return lang === 'fr' ? fr : en; }
  };
})();
