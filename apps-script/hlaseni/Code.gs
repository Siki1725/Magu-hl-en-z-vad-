/**
 * Hlášení závad MAGU — serverová část.
 *
 * V editoru Apps Script tento soubor pojmenujte Code.gs a vložte sem
 * celý obsah. Ukázkovou funkci myFunction smažte.
 *
 * E-mail bere Session.getActiveUser().getEmail(). U nasazení „spouštět jako
 * já“ (USER_DEPLOYING) vrátí e-mail člověka, který stránku právě otevřel,
 * když jsou splněné všechny tyto podmínky:
 *   - nasazující účet i návštěvník jsou ve stejné doméně Google Workspace,
 *   - webová aplikace má přístup DOMAIN (jen lidé z té domény),
 *   - manifest žádá rozsah userinfo.email.
 * getEffectiveUser() nepoužívejte: ten vrací účet, pod kterým skript běží,
 * tedy pořád účet člověka, který aplikaci nasadil.
 */

// Volitelné. ID existující tabulky (část adresy mezi /d/ a /edit).
// Nechte prázdné: při prvním hlášení se založí tabulka
// „MAGU – Hlášení závad“ a její ID se uloží do vlastností skriptu.
var SHEET_ID = '';

var SHEET_NAME = 'Hlášení';
var SPREADSHEET_NAME = 'MAGU – Hlášení závad';
var HEADER = ['Čas', 'Operátor', 'E-mail', 'Stroj', 'Typ', 'Část', 'Problém', 'Kdo řešil', 'Poznámka'];
var PROP_KEY = 'SHEET_ID';

function doGet() {
  var template = HtmlService.createTemplateFromFile('Index');
  template.userEmailJson = JSON.stringify(activeEmail_()).replace(/</g, '\\u003c');
  return template.evaluate()
      .setTitle('Hlášení závad MAGU')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function getAccountEmail() {
  return activeEmail_();
}

/**
 * Přidá jeden řádek na list Hlášení.
 * E-mail se bere z přihlášeného účtu, ne z dat odeslaných prohlížečem.
 * obj.cas se ukládá tak, jak přišel, aby opakované odeslání z telefonu
 * nepřepsalo původní čas hlášení.
 */
function saveReport(obj) {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Hlášení je prázdné.');
  }
  var ss = getOrCreateSpreadsheet_();
  var sheet = ensureSheet_(ss);
  var cas = asText_(obj.cas);
  if (!cas) {
    cas = Utilities.formatDate(new Date(), 'Europe/Prague', 'd. M. yyyy H:mm:ss');
  }
  sheet.appendRow([
    cas,
    asText_(obj.op),
    activeEmail_(),
    asText_(obj.tech),
    asText_(obj.typ),
    asText_(obj.cast),
    asText_(obj.co),
    asText_(obj.firma),
    asText_(obj.pozn)
  ]);
  return { ok: true, url: ss.getUrl() };
}

/** Posledních `limit` řádků, nejnovější první. Výchozí i strop je 100. */
function getReports(limit) {
  var n = parseInt(limit, 10);
  if (!n || n < 1) n = 100;
  if (n > 100) n = 100;
  var ss = openKnownSpreadsheet_();
  if (!ss) return [];
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return [];
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var start = Math.max(2, last - n + 1);
  var values = sheet.getRange(start, 1, last - start + 1, HEADER.length).getValues();
  var out = [];
  for (var i = values.length - 1; i >= 0; i--) {
    out.push(rowToReport_(values[i]));
  }
  return out;
}

function getSheetUrl() {
  return getOrCreateSpreadsheet_().getUrl();
}

function activeEmail_() {
  try {
    return Session.getActiveUser().getEmail() || '';
  } catch (e) {
    return '';
  }
}

function spreadsheetId_() {
  var fixed = String(SHEET_ID || '').trim();
  if (fixed) return fixed;
  return PropertiesService.getScriptProperties().getProperty(PROP_KEY) || '';
}

function openKnownSpreadsheet_() {
  var id = spreadsheetId_();
  if (!id) return null;
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error('Uloženou tabulku se nepodařilo otevřít. Zkontrolujte SHEET_ID v Code.gs. (' + e.message + ')');
  }
}

function getOrCreateSpreadsheet_() {
  return withLock_(function () {
    var id = spreadsheetId_();
    if (id) {
      var existing;
      try {
        existing = SpreadsheetApp.openById(id);
      } catch (e) {
        throw new Error('Uloženou tabulku se nepodařilo otevřít. Zkontrolujte SHEET_ID v Code.gs. (' + e.message + ')');
      }
      ensureSheet_(existing);
      return existing;
    }
    var created = SpreadsheetApp.create(SPREADSHEET_NAME);
    created.setSpreadsheetTimeZone('Europe/Prague');
    var sheet = created.getSheets()[0];
    sheet.setName(SHEET_NAME);
    writeHeader_(sheet);
    PropertiesService.getScriptProperties().setProperty(PROP_KEY, created.getId());
    return created;
  });
}

function ensureSheet_(ss) {
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (!asText_(sheet.getRange(1, 1).getValue())) writeHeader_(sheet);
  return sheet;
}

function writeHeader_(sheet) {
  sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADER.length).setFontWeight('bold').setBackground('#26E126');
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    throw new Error('Tabulka je právě používaná. Zkuste to znovu za chvíli.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function rowToReport_(row) {
  return {
    cas: cellToString_(row[0]),
    op: cellToString_(row[1]),
    email: cellToString_(row[2]),
    tech: cellToString_(row[3]),
    typ: cellToString_(row[4]),
    cast: cellToString_(row[5]),
    co: cellToString_(row[6]),
    firma: cellToString_(row[7]),
    pozn: cellToString_(row[8])
  };
}

function cellToString_(value) {
  var isDate = value instanceof Date || Object.prototype.toString.call(value) === '[object Date]';
  if (isDate && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, 'Europe/Prague', 'd. M. yyyy H:mm:ss');
  }
  return asText_(value);
}

function asText_(value) {
  if (value === null || value === undefined) return '';
  var text = String(value);
  if (text.length > 5000) text = text.slice(0, 5000);
  return text;
}
