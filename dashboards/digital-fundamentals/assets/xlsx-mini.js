/* Lecture et ecriture de fichiers Excel (.xlsx) et CSV, sans bibliotheque externe.
 * Lecture : premiere feuille du classeur, renvoyee en tableau de lignes de texte.
 * Ecriture : classeur simple (en-tetes en gras, colonnes de texte), compresse en mode « stocke ».
 * Un .xlsx est une archive zip de fichiers XML : on lit l'archive, on decompresse avec DecompressionStream. */
(function () {
  'use strict';

  /* ---------- lecture de l'archive zip ---------- */
  function u16(v, o) { return v.getUint16(o, true); }
  function u32(v, o) { return v.getUint32(o, true); }

  function unzip(buf) {
    var v = new DataView(buf), end = -1;
    for (var i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) {
      if (u32(v, i) === 0x06054b50) { end = i; break; }
    }
    if (end < 0) throw new Error('Ce fichier n\'est pas un fichier Excel .xlsx lisible.');
    var count = u16(v, end + 10), p = u32(v, end + 16), files = {};
    var dec = new TextDecoder();
    for (var n = 0; n < count; n++) {
      if (u32(v, p) !== 0x02014b50) break;
      var method = u16(v, p + 10), size = u32(v, p + 20), nameLen = u16(v, p + 28);
      var extra = u16(v, p + 30), comment = u16(v, p + 32), local = u32(v, p + 42);
      var name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
      var start = local + 30 + u16(v, local + 26) + u16(v, local + 28);
      files[name] = { method: method, data: new Uint8Array(buf, start, size) };
      p += 46 + nameLen + extra + comment;
    }
    return files;
  }

  function inflate(entry) {
    if (!entry) return Promise.resolve('');
    if (entry.method === 0) return Promise.resolve(new TextDecoder().decode(entry.data));
    if (entry.method !== 8 || typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error('Ce navigateur ne sait pas ouvrir ce fichier. Utilisez Chrome, Edge ou Firefox à jour, ou enregistrez le fichier en CSV.'));
    }
    var stream = new Blob([entry.data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(stream).text();
  }

  function xml(text) { return new DOMParser().parseFromString(text, 'application/xml'); }
  function tags(node, name) { return Array.prototype.slice.call(node.getElementsByTagNameNS('*', name)); }
  function colIndex(ref) {
    var letters = String(ref || '').replace(/[0-9]/g, ''), n = 0;
    for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
    return n - 1;
  }

  function readXlsx(buf) {
    var files = unzip(buf);
    var get = function (name) { return inflate(files[name]); };
    return Promise.all([get('xl/workbook.xml'), get('xl/_rels/workbook.xml.rels'), get('xl/sharedStrings.xml')]).then(function (r) {
      var sheetPath = 'xl/worksheets/sheet1.xml';
      try {
        var first = tags(xml(r[0]), 'sheet')[0];
        var rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
        tags(xml(r[1]), 'Relationship').forEach(function (rel) {
          if (rel.getAttribute('Id') === rid) {
            var t = rel.getAttribute('Target');
            sheetPath = t.charAt(0) === '/' ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '');
          }
        });
      } catch (e) { /* on garde la premiere feuille par defaut */ }
      var shared = r[2] ? tags(xml(r[2]), 'si').map(function (si) { return tags(si, 't').map(function (t) { return t.textContent; }).join(''); }) : [];
      return get(sheetPath).then(function (sheetXml) {
        if (!sheetXml) throw new Error('La première feuille du fichier est introuvable.');
        var rows = [];
        tags(xml(sheetXml), 'row').forEach(function (row) {
          var out = [];
          tags(row, 'c').forEach(function (c, k) {
            var idx = c.getAttribute('r') ? colIndex(c.getAttribute('r')) : k;
            var type = c.getAttribute('t'), vEl = tags(c, 'v')[0], val = '';
            if (type === 's') val = shared[Number(vEl ? vEl.textContent : -1)] || '';
            else if (type === 'inlineStr') val = tags(c, 't').map(function (t) { return t.textContent; }).join('');
            else if (vEl) {
              val = vEl.textContent;
              if (type !== 'str' && type !== 'b' && /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(val)) {
                var num = Number(val);
                val = Number.isInteger(num) ? num.toLocaleString('fullwide', { useGrouping: false }) : String(num);
              }
            }
            out[idx] = String(val).trim();
          });
          for (var i = 0; i < out.length; i++) if (out[i] === undefined) out[i] = '';
          var rn = Number(row.getAttribute('r'));         // garde le numero de ligne d'Excel, meme apres une ligne vide
          if (rn > 0 && rn <= 100000) rows[rn - 1] = out; else rows.push(out);
        });
        for (var j = 0; j < rows.length; j++) if (!rows[j]) rows[j] = [];
        return rows;
      });
    });
  }

  function readCsv(text) {
    text = text.replace(/^﻿/, '');
    var firstLine = text.split(/\r?\n/)[0] || '';
    var sep = [';', '\t', ','].sort(function (a, b) { return firstLine.split(b).length - firstLine.split(a).length; })[0];
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell.trim()); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell.trim()); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
    return rows;
  }

  /** Fichier choisi -> lignes. Accepte .xlsx et .csv. */
  function readFile(file) {
    var name = (file && file.name || '').toLowerCase();
    if (!file) return Promise.reject(new Error('Choisissez un fichier.'));
    if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error('Fichier trop lourd (5 Mo au plus).'));
    if (/\.xls$/.test(name)) return Promise.reject(new Error('Ancien format .xls. Dans Excel, faites Fichier, Enregistrer sous, et choisissez « Classeur Excel (.xlsx) ».'));
    if (/\.csv$|\.txt$/.test(name)) return file.text().then(readCsv);
    return file.arrayBuffer().then(function (buf) {
      var v = new DataView(buf);
      if (buf.byteLength < 4 || v.getUint32(0, true) !== 0x04034b50) throw new Error('Ce fichier n\'est pas un classeur Excel .xlsx.');
      return readXlsx(buf);
    });
  }

  /* ---------- ecriture ---------- */
  var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }

  function zip(entries) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    entries.forEach(function (e) {
      var name = enc.encode(e.name), data = enc.encode(e.text), crc = crc32(data);
      var h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true);
      h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
      c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var size = central.reduce(function (s, x) { return s + x.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function escXml(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

  /** sheets : [{ name, rows: [[...]], widths: [..], note }]. La premiere ligne est l'en-tete (gras). Toutes les colonnes sont au format texte. */
  function writeXlsx(sheets) {
    var files = [];
    files.push({ name: '[Content_Types].xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' });
    files.push({ name: '_rels/.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    files.push({ name: 'xl/workbook.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      sheets.map(function (s, i) { return '<sheet name="' + escXml(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
    // Styles : 0 normal, 1 en-tete (gras, fond vert pale, bordure), 2 texte, 3 note (italique gris)
    files.push({ name: 'xl/styles.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF1C2530"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF5E6A76"/><name val="Calibri"/></font></fonts>' +
      '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCEFD4"/><bgColor indexed="64"/></patternFill></fill></fills>' +
      '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FF5DB246"/></bottom><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="49" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' });
    sheets.forEach(function (s, i) {
      var ncol = Math.max.apply(null, s.rows.map(function (r) { return r.length; }).concat([1]));
      var cols = '<cols>' + Array.apply(null, Array(ncol)).map(function (x, c) {
        return '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + ((s.widths && s.widths[c]) || 20) + '" style="2" customWidth="1"/>';
      }).join('') + '</cols>';
      var rows = s.rows.map(function (r, ri) {
        var style = ri === 0 ? 1 : (s.noteRows && s.noteRows.indexOf(ri) !== -1 ? 3 : 2);
        return '<row r="' + (ri + 1) + '">' + r.map(function (v, c) {
          return '<c r="' + colName(c) + (ri + 1) + '" t="inlineStr" s="' + style + '"><is><t xml:space="preserve">' + escXml(v) + '</t></is></c>';
        }).join('') + '</row>';
      }).join('');
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
        cols + '<sheetData>' + rows + '</sheetData></worksheet>' });
    });
    return zip(files);
  }

  window.XlsxMini = { readFile: readFile, readCsv: readCsv, writeXlsx: writeXlsx };
})();
