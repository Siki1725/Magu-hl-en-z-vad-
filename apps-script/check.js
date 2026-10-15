#!/usr/bin/env node
/**
 * Kontrola Apps Script kopií. Není součást nasazení.
 * Spuštění: node apps-script/check.js
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const dir = __dirname;
let failed = 0;

function check(name, ok, detail) {
  if (ok) {
    console.log("OK   " + name);
  } else {
    failed++;
    console.error("FAIL " + name + (detail ? " — " + detail : ""));
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function nodeCheck(filename, source) {
  const file = path.join("/tmp", filename.replace(/\.gs$/, "") + ".js");
  fs.writeFileSync(file, source);
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  check("node --check " + filename, result.status === 0, result.stderr || result.stdout);
}

function extractScripts(html) {
  const out = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = re.exec(html))) {
    if (/type\s*=\s*["']application\/json["']/.test(match[1])) continue;
    out.push(match[2]);
  }
  return out;
}

function configSlice(html) {
  const start = html.indexOf("const TECH");
  const end = html.indexOf("let LS;");
  if (start < 0 || end < 0) throw new Error("v HTML chybí konfigurace");
  return html.slice(start, end);
}

function makeSheet(name) {
  return { name: name, rows: [], frozen: 0, weight: "", background: "" };
}

function makeRange(sheet, row, col, numRows, numCols) {
  return {
    setValues(values) {
      for (let i = 0; i < values.length; i++) {
        const at = row - 1 + i;
        if (!sheet.rows[at]) sheet.rows[at] = [];
        for (let j = 0; j < values[i].length; j++) sheet.rows[at][col - 1 + j] = values[i][j];
      }
      return this;
    },
    getValues() {
      const out = [];
      for (let i = 0; i < numRows; i++) {
        const src = sheet.rows[row - 1 + i] || [];
        const line = [];
        for (let j = 0; j < numCols; j++) {
          const value = src[col - 1 + j];
          line.push(value === undefined ? "" : value);
        }
        out.push(line);
      }
      return out;
    },
    getValue() {
      return this.getValues()[0][0];
    },
    setFontWeight(weight) {
      sheet.weight = weight;
      return this;
    },
    setBackground(color) {
      sheet.background = color;
      return this;
    },
  };
}

function makeSpreadsheet(store, name) {
  const id = "ss-" + (++store.seq);
  const ss = {
    id: id,
    name: name,
    tz: "",
    sheets: [makeSheet("List 1")],
    getId() { return id; },
    getUrl() { return "https://docs.google.com/spreadsheets/d/" + id + "/edit"; },
    setSpreadsheetTimeZone(tz) { this.tz = tz; },
    getSheets() { return this.sheets; },
    getSheetByName(sheetName) {
      return this.sheets.find((sheet) => sheet.name === sheetName) || null;
    },
    insertSheet(sheetName) {
      const sheet = makeSheet(sheetName);
      this.sheets.push(sheet);
      return sheet;
    },
  };
  for (const sheet of ss.sheets) attachSheet(sheet);
  const originalInsert = ss.insertSheet.bind(ss);
  ss.insertSheet = (sheetName) => {
    const sheet = originalInsert(sheetName);
    attachSheet(sheet);
    return sheet;
  };
  store.byId[id] = ss;
  return ss;
}

function attachSheet(sheet) {
  sheet.setName = (name) => { sheet.name = name; };
  sheet.getRange = (row, col, numRows, numCols) => makeRange(sheet, row, col, numRows || 1, numCols || 1);
  sheet.getLastRow = () => sheet.rows.length;
  sheet.setFrozenRows = (n) => { sheet.frozen = n; };
  sheet.appendRow = (values) => { sheet.rows.push(values.slice()); };
}

function loadHlaseni(options) {
  const store = { seq: 0, byId: {} };
  const session = { email: options && options.email !== undefined ? options.email : "op@magu.co" };
  const locks = { acquired: 0, released: 0, failWait: !!(options && options.failWait) };
  let template = null;
  const sandbox = {
    store,
    session,
    locks,
    SHEET_ID: "",
    SpreadsheetApp: {
      create(name) { return makeSpreadsheet(store, name); },
      openById(id) {
        if (!store.byId[id]) throw new Error("not found " + id);
        return store.byId[id];
      },
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return Object.prototype.hasOwnProperty.call(store, "prop_" + key) ? store["prop_" + key] : null;
          },
          setProperty(key, value) { store["prop_" + key] = String(value); },
        };
      },
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock() {
            if (locks.failWait) throw new Error("timeout");
            locks.acquired++;
          },
          releaseLock() { locks.released++; },
        };
      },
    },
    Session: {
      getActiveUser() {
        return {
          getEmail() {
            if (session.throw) throw new Error("no user");
            return session.email;
          },
        };
      },
    },
    Utilities: {
      formatDate(date, tz, format) {
        return "FMT:" + tz + ":" + format + ":" + date.toISOString();
      },
    },
    HtmlService: {
      createTemplateFromFile(filename) {
        template = {
          file: filename,
          userEmailJson: "",
          evaluate() {
            const page = {
              title: "",
              meta: [],
              setTitle(value) { this.title = value; return this; },
              addMetaTag(name, content) { this.meta.push([name, content]); return this; },
            };
            template.page = page;
            return page;
          },
        };
        return template;
      },
    },
    JSON,
    Date,
    Object,
    String,
    Math,
    isNaN,
    parseInt,
  };
  vm.createContext(sandbox);
  vm.runInContext(read("apps-script/hlaseni/Code.gs"), sandbox, { filename: "Code.gs" });
  sandbox.__template = () => template;
  return sandbox;
}

function report(extra) {
  return Object.assign({
    cas: "15. 10. 2026 18:00:00",
    op: "Jana",
    email: "evil@example.com",
    tech: "Nová linka",
    typ: "Technická závada",
    cast: "Dopravníkové pásy",
    co: "Jiné",
    firma: "",
    pozn: "poznámka",
  }, extra || {});
}

function serverTests() {
  console.log("\nServer hlášení");
  const box = loadHlaseni();
  check("getReports bez tabulky", JSON.stringify(box.getReports(100)) === "[]");

  const page = box.doGet();
  const template = box.__template();
  check("doGet soubor Index", template.file === "Index");
  check("doGet titulek", page.title === "Hlášení závad MAGU", page.title);
  check(
    "doGet viewport",
    page.meta.length === 1 && page.meta[0][0] === "viewport" && page.meta[0][1].indexOf("width=device-width") === 0,
    JSON.stringify(page.meta)
  );
  check("doGet e-mail do stránky", template.userEmailJson === JSON.stringify("op@magu.co"));
  check("doGet zámek se uvolní", box.locks.released === 0 && box.locks.acquired === 0);

  const odd = loadHlaseni({ email: "a<b@magu.co" });
  odd.doGet();
  check(
    "e-mail se do HTML vloží bezpečně",
    odd.__template().userEmailJson === '"a\\u003cb@magu.co"',
    odd.__template().userEmailJson
  );

  let saved;
  try {
    saved = box.saveReport(report());
  } catch (e) {
    check("saveReport proběhne", false, e.message);
    return;
  }
  check("saveReport vrátí adresu", saved.ok === true && saved.url.indexOf("/spreadsheets/d/ss-1/") > 0, saved.url);
  const sheets = Object.values(box.store.byId);
  check("vznikla jedna tabulka", sheets.length === 1 && sheets[0].name === "MAGU – Hlášení závad", sheets.map((s) => s.name).join(","));
  check("časová zóna tabulky", sheets[0].tz === "Europe/Prague");
  check("ID je ve vlastnostech skriptu", box.store.prop_SHEET_ID === "ss-1");
  const sheet = sheets[0].getSheetByName("Hlášení");
  check("list Hlášení", !!sheet);
  check("hlavička", JSON.stringify(sheet.rows[0]) === JSON.stringify([
    "Čas", "Operátor", "E-mail", "Stroj", "Typ", "Část", "Problém", "Kdo řešil", "Poznámka",
  ]), JSON.stringify(sheet.rows[0]));
  check("zelená hlavička", sheet.background === "#26E126" && sheet.weight === "bold" && sheet.frozen === 1);
  check("e-mail je z účtu, ne z prohlížeče", sheet.rows[1][2] === "op@magu.co", String(sheet.rows[1][2]));
  check("čas z telefonu se nemění", sheet.rows[1][0] === "15. 10. 2026 18:00:00");
  check("zámek se po zápisu uvolní", box.locks.acquired === 1 && box.locks.released === 1);

  box.saveReport(report({ cas: "", op: "Petr", pozn: "x".repeat(6000), tech: "Myčka B" }));
  check("druhý zápis nezaloží další tabulku", Object.keys(box.store.byId).length === 1);
  check("chybějící čas doplní server", String(sheet.rows[2][0]).indexOf("FMT:Europe/Prague:d. M. yyyy H:mm:ss:") === 0, sheet.rows[2][0]);
  check("dlouhá poznámka se zkrátí", sheet.rows[2][8].length === 5000);
  check("hlavička se nezdvojí", sheet.rows.length === 3 && sheet.rows[0][0] === "Čas");

  const latest = box.getReports(1);
  check("limit 1 je nejnovější řádek", latest.length === 1 && latest[0].tech === "Myčka B" && latest[0].email === "op@magu.co", JSON.stringify(latest));
  const all = box.getReports(100);
  check("výpis je od nejnovějšího", all.length === 2 && all[0].op === "Petr" && all[1].op === "Jana");
  check("getReports(500) stejně nejvýš 100", box.getReports(500).length === 2);

  sheet.rows.push([new Date("2026-10-15T16:00:00.000Z"), "Eva", "eva@magu.co", "Varna F4", "Technická závada", "Jiné", "Jiné", "Festo", ""]);
  const dated = box.getReports(1)[0];
  check("datum z tabulky se formátuje", dated.cas.indexOf("FMT:Europe/Prague:") === 0, dated.cas);

  const url = box.getSheetUrl();
  check("adresa tabulky", url === saved.url, url);

  let emptyError = "";
  try { box.saveReport(null); } catch (e) { emptyError = e.message; }
  check("prázdné hlášení spadne", emptyError === "Hlášení je prázdné.", emptyError);

  const fixed = loadHlaseni();
  const existing = makeSpreadsheet(fixed.store, "Už mám tabulku");
  existing.getSheets()[0].setName("Hlášení");
  attachSheet(existing.getSheets()[0]);
  existing.getSheets()[0].rows.push(["Čas", "Operátor", "E-mail", "Stroj", "Typ", "Část", "Problém", "Kdo řešil", "Poznámka"]);
  fixed.SHEET_ID = existing.getId();
  fixed.saveReport(report({ op: "Stávající" }));
  check("SHEET_ID použije danou tabulku", fixed.store.prop_SHEET_ID === undefined && existing.getSheets()[0].rows[1][1] === "Stávající");
  check("SHEET_ID nezaloží druhou tabulku", Object.keys(fixed.store.byId).length === 1);

  const broken = loadHlaseni();
  broken.SHEET_ID = "chybi";
  let missing = "";
  try { broken.saveReport(report()); } catch (e) { missing = e.message; }
  check("špatné SHEET_ID vysvětlí chybu", missing.indexOf("Zkontrolujte SHEET_ID") >= 0, missing);
  check("po chybě se zámek uvolní", broken.locks.released === 1, String(broken.locks.released));

  const busy = loadHlaseni({ failWait: true });
  let busyMessage = "";
  try { busy.saveReport(report()); } catch (e) { busyMessage = e.message; }
  check("obsazená tabulka", busyMessage === "Tabulka je právě používaná. Zkuste to znovu za chvíli.", busyMessage);

  const quiet = loadHlaseni({ email: "" });
  quiet.session.throw = true;
  quiet.saveReport(report({ cas: "1. 1. 2026 0:00:00" }));
  const quietSheet = Object.values(quiet.store.byId)[0].getSheetByName("Hlášení");
  check("chybějící e-mail nezahodí hlášení", quietSheet.rows[1][2] === "" && quietSheet.rows[1][1] === "Jana");
}

function alkoholServer() {
  console.log("\nServer kalkulačka");
  let page = null;
  const sandbox = {
    HtmlService: {
      createHtmlOutputFromFile(filename) {
        page = {
          file: filename,
          title: "",
          meta: [],
          setTitle(value) { this.title = value; return this; },
          addMetaTag(name, content) { this.meta.push([name, content]); return this; },
        };
        return page;
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(read("apps-script/alkohol/Code.gs"), sandbox, { filename: "alkohol/Code.gs" });
  const out = sandbox.doGet();
  check("kalkulačka soubor Index", page.file === "Index" && out.title === "Kalkulačka alkoholu");
  check("kalkulačka viewport", out.meta[0][0] === "viewport" && out.meta[0][1].indexOf("viewport-fit=cover") > 0);
}

function manifestTests() {
  console.log("\nManifesty");
  const hlaseni = JSON.parse(read("apps-script/hlaseni/appsscript.json"));
  const alkohol = JSON.parse(read("apps-script/alkohol/appsscript.json"));
  for (const [name, manifest] of [["hlášení", hlaseni], ["kalkulačka", alkohol]]) {
    check(name + " časová zóna", manifest.timeZone === "Europe/Prague");
    check(name + " executeAs", manifest.webapp && manifest.webapp.executeAs === "USER_DEPLOYING");
    check(name + " access DOMAIN", manifest.webapp && manifest.webapp.access === "DOMAIN");
    check(name + " V8", manifest.runtimeVersion === "V8");
  }
  check(
    "rozsahy hlášení",
    JSON.stringify(hlaseni.oauthScopes) === JSON.stringify([
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/userinfo.email",
    ]),
    JSON.stringify(hlaseni.oauthScopes)
  );
  check("bez container.ui", JSON.stringify(hlaseni).indexOf("script.container.ui") < 0 && JSON.stringify(alkohol).indexOf("script.container.ui") < 0);
  check("kalkulačka nežádá tabulky", !alkohol.oauthScopes);
  check("XFrameOptions ALLOWALL se nenastavuje", read("apps-script/hlaseni/Code.gs").indexOf("ALLOWALL") < 0 && read("apps-script/alkohol/Code.gs").indexOf("ALLOWALL") < 0);
}

function syntaxTests() {
  console.log("\nSyntaxe");
  nodeCheck("hlaseni-Code.gs", read("apps-script/hlaseni/Code.gs"));
  nodeCheck("alkohol-Code.gs", read("apps-script/alkohol/Code.gs"));
  const hlaseniHtml = read("apps-script/hlaseni/Index.html");
  const alkoholHtml = read("apps-script/alkohol/Index.html");
  extractScripts(hlaseniHtml).forEach((source, i) => nodeCheck("hlaseni-script-" + i + ".js", source));
  extractScripts(alkoholHtml).forEach((source, i) => nodeCheck("alkohol-script-" + i + ".js", source));
  check("v klientském skriptu není šablona <?", extractScripts(hlaseniHtml).every((source) => source.indexOf("<?") < 0));
  check(
    "konfigurace strojů je stejná",
    configSlice(read("index.html")) === configSlice(hlaseniHtml)
  );
  const originalCalc = extractScripts(read("alkohol/index.html")).find((source) => source.indexOf("const CONFIG") >= 0);
  const copyCalc = extractScripts(alkoholHtml).find((source) => source.indexOf("const CONFIG") >= 0);
  check("výpočet kalkulačky je stejný", originalCalc === copyCalc);
  const norm = (html) => html
    .replace(/<!--[\s\S]*?-->\n?/, "")
    .replaceAll("https://siki1725.github.io/Magu-hl-en-z-vad-/apple-touch-icon.png", "ICON")
    .replaceAll("../apple-touch-icon.png", "ICON");
  check("kalkulačka se jinak neliší", norm(read("alkohol/index.html")) === norm(alkoholHtml));
}

function installGas(window, gas) {
  window.google = {
    script: {
      run: {
        withSuccessHandler(ok) {
          return {
            withFailureHandler(bad) {
              const api = {};
              for (const name of ["saveReport", "getReports", "getSheetUrl", "getAccountEmail"]) {
                api[name] = (arg) => {
                  gas.calls.push({ name, arg });
                  Promise.resolve().then(() => {
                    try {
                      if (name === "saveReport") {
                        if (gas.failSave) throw new Error(gas.failMessage || "síť");
                        gas.saved.push(arg);
                        ok({ ok: true, url: gas.sheetUrl });
                        return;
                      }
                      if (name === "getReports") {
                        if (gas.failReports) throw new Error("tabulka nedostupná");
                        ok(gas.reports.slice(0, arg || 100));
                        return;
                      }
                      if (name === "getSheetUrl") {
                        ok(gas.sheetUrl);
                        return;
                      }
                      ok(gas.accountEmail || "");
                    } catch (e) {
                      bad(e);
                    }
                  });
                };
              }
              return api;
            },
          };
        },
      },
    },
  };
}

async function settle() {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setImmediate(resolve));
}

function freshGas() {
  return {
    calls: [],
    saved: [],
    reports: [],
    failSave: false,
    failReports: false,
    failMessage: "",
    sheetUrl: "https://docs.google.com/spreadsheets/d/test/edit",
    accountEmail: "",
  };
}

async function openHlaseni(options) {
  const { JSDOM } = require("jsdom");
  const gas = options.gas || freshGas();
  const emailJson = JSON.stringify(options.email === undefined ? "jana.novak@magu.co" : options.email).replace(/</g, "\\u003c");
  const html = read("apps-script/hlaseni/Index.html").replace("<?!= userEmailJson ?>", emailJson);
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    url: "https://script.google.com/macros/s/abc/exec",
    beforeParse(window) {
      installGas(window, gas);
      const original = window.setTimeout.bind(window);
      window.__delayed = [];
      window.setTimeout = (fn, ms, ...args) => {
        if ((ms || 0) >= 1500) {
          window.__delayed.push(fn);
          return 0;
        }
        return original(fn, ms, ...args);
      };
      window.HTMLAnchorElement.prototype.click = function () {
        window.__anchorClicks = (window.__anchorClicks || []).concat(this);
      };
      window.confirm = () => options.confirm !== false;
      window.alert = (text) => { window.__alerts = (window.__alerts || []).concat(text); };
      window.open = (url) => { window.__opened = (window.__opened || []).concat(url); return {}; };
      if (options.queue) window.localStorage.setItem("magu_queue", JSON.stringify(options.queue));
      if (options.operator !== undefined) window.localStorage.setItem("magu_op", options.operator);
    },
  });
  await settle();
  return { dom, gas, document: dom.window.document, window: dom.window };
}

function clickText(document, text) {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent === text);
  if (!button) {
    throw new Error("není tlačítko " + text + " (" + [...document.querySelectorAll("button")].map((item) => item.textContent).join(" | ") + ")");
  }
  button.click();
}

async function fillReport(document, options) {
  clickText(document, "Nová linka");
  clickText(document, "Technická závada");
  clickText(document, "Dopravníkové pásy");
  clickText(document, "Strhává / trhá sleeve");
  if (options && options.firma) clickText(document, options.firma);
  else clickText(document, "Přeskočit");
  if (options && options.expectOp !== undefined) {
    check("předvyplněné jméno", document.getElementById("op").value === options.expectOp, document.getElementById("op").value);
  }
  if (options && options.op !== undefined) document.getElementById("op").value = options.op;
  if (options && options.pozn !== undefined) document.getElementById("pozn").value = options.pozn;
  clickText(document, "Uložit hlášení");
  await settle();
}

async function clientTests() {
  console.log("\nProhlížeč hlášení");
  let jsdom;
  try {
    jsdom = require("jsdom");
  } catch (e) {
    check("jsdom je k dispozici", false, e.message);
    return;
  }
  check("jsdom se načetl", !!jsdom);

  const first = await openHlaseni({});
  const doc = first.document;
  check("úvod je výběr stroje", doc.querySelector("h1").textContent === "Vyberte stroj");
  check("velká tlačítka", doc.getElementById("app").className === "big");
  check("při startu se nic neukládá", first.gas.calls.length === 0, JSON.stringify(first.gas.calls));
  check("šest strojů", doc.querySelectorAll(".opts button").length === 6);

  clickText(doc, "Nová linka");
  check("další krok je typ", doc.querySelector("h1").textContent === "Typ problému");
  clickText(doc, "← Zpět");
  check("zpět smaže stroj", doc.querySelector("h1").textContent === "Vyberte stroj" && doc.querySelector(".crumb").textContent === "");

  await fillReport(doc, { expectOp: "jana.novak@magu.co", op: "Jana", pozn: 'text "x"' });
  check("úspěch", doc.querySelector(".ok") && doc.querySelector(".ok").textContent.indexOf("Hlášení uloženo") >= 0, doc.body.textContent);
  check("fronta je prázdná", first.window.localStorage.getItem("magu_queue") === "[]" || first.window.localStorage.getItem("magu_queue") === null, first.window.localStorage.getItem("magu_queue"));
  const sent = first.gas.saved[0];
  check("uložený stroj", sent && sent.tech === "Nová linka" && sent.typ === "Technická závada" && sent.cast === "Dopravníkové pásy" && sent.co === "Strhává / trhá sleeve", JSON.stringify(sent));
  check("přeskočená firma je prázdná", sent && sent.firma === "");
  check("jméno a poznámka", sent && sent.op === "Jana" && sent.pozn === 'text "x"');
  check("jméno zůstane v telefonu", first.window.localStorage.getItem("magu_op") === "Jana");
  check("prohlížeč neposílá svůj e-mail jako sloupec", sent && !Object.prototype.hasOwnProperty.call(sent, "email"));

  const remembered = await openHlaseni({ operator: "Jana" });
  clickText(remembered.document, "Nová linka");
  clickText(remembered.document, "Neočekávaný prostoj");
  clickText(remembered.document, "Dopravníkové pásy");
  clickText(remembered.document, "Jiné");
  clickText(remembered.document, "Festo");
  check("pamatované jméno", remembered.document.getElementById("op").value === "Jana");
  check("vybraná firma v souhrnu", remembered.document.querySelector(".sum").textContent.indexOf("Festo") >= 0);

  const failing = await openHlaseni({});
  failing.gas.failSave = true;
  failing.gas.failMessage = "síť";
  await fillReport(failing.document, { pozn: "offline" });
  const error = failing.document.getElementById("save-error");
  check("chyba uložení je vidět", !!error && error.textContent.indexOf("nepodařilo uložit") >= 0 && error.textContent.indexOf("síť") >= 0, error && error.textContent);
  const queued = JSON.parse(failing.window.localStorage.getItem("magu_queue") || "[]");
  check("hlášení čeká v telefonu", queued.length === 1 && queued[0].report.pozn === "offline" && queued[0].report.tech === "Nová linka", JSON.stringify(queued));
  clickText(failing.document, "Nové hlášení");
  check("po chybě je vidět fronta", failing.document.body.textContent.indexOf("Neodeslaná hlášení v tomto telefonu: 1") >= 0, failing.document.body.textContent);

  failing.gas.failSave = false;
  clickText(failing.document, "Nová linka");
  clickText(failing.document, "← Zpět");
  clickText(failing.document, "Záznamy");
  await settle();
  check("záznamy ukážou čekající řádek", failing.document.body.textContent.indexOf("čeká ·") >= 0 && failing.document.body.textContent.indexOf("offline") >= 0);

  const retry = await openHlaseni({
    queue: [{
      id: "q1",
      report: {
        cas: "1. 1. 2026 8:00:00",
        op: "Jana",
        tech: "Chlazení",
        typ: "Technická závada",
        cast: "Chiller",
        co: "Únik glykolu",
        firma: "Refri systémy",
        pozn: "z fronty",
      },
    }],
  });
  check("fronta se při otevření odešle", retry.gas.saved.length === 1 && retry.gas.saved[0].tech === "Chlazení" && retry.gas.saved[0].cas === "1. 1. 2026 8:00:00", JSON.stringify(retry.gas.saved));
  check("odeslaná fronta zmizí", retry.window.localStorage.getItem("magu_queue") === "[]");

  const records = await openHlaseni({});
  records.gas.reports = [{
    cas: "2. 2. 2026 9:00:00",
    op: "Petr",
    email: "petr@magu.co",
    tech: "Varna F4",
    typ: "Technická závada",
    cast: "Parní kotel / parovod",
    co: "Nefunkční ohřev",
    firma: "E-THERM",
    pozn: "ze sheetu",
  }];
  records.document.getElementById("zaz").click();
  await settle();
  const text = records.document.body.textContent;
  check("záznamy z tabulky", text.indexOf("Nefunkční ohřev") >= 0 && text.indexOf("Petr") >= 0 && text.indexOf("ze sheetu") >= 0, text);
  check("e-mail v tabulce obrazovky není", records.document.querySelectorAll("th").length === 8 && text.indexOf("petr@magu.co") < 0);
  check("odkaz na tabulku", records.document.getElementById("sheet").getAttribute("href") === records.gas.sheetUrl);
  check("getReports žádá 100 řádků", records.gas.calls.some((call) => call.name === "getReports" && call.arg === 100));

  records.document.getElementById("csv").click();
  const download = (records.window.__anchorClicks || [])[0];
  const csv = download ? decodeURIComponent(download.getAttribute("href").replace(/^data:text\/csv;charset=utf-8,/, "")) : "";
  check("CSV hlavička", csv.indexOf("Čas;Operátor;Stroj;Typ;Část;Problém;Kdo řešil;Poznámka") >= 0 && download.download === "hlaseni.csv", csv);
  check("CSV obsahuje řádek", csv.indexOf("Nefunkční ohřev") >= 0 && csv.indexOf("petr@magu.co") < 0, csv);

  const blocked = await openHlaseni({});
  blocked.gas.failReports = true;
  blocked.document.getElementById("zaz").click();
  await settle();
  check("chyba načtení záznamů", blocked.document.getElementById("rec-status").textContent.indexOf("nepodařilo načíst") >= 0, blocked.document.getElementById("rec-status").textContent);

  const kept = freshGas();
  kept.failSave = true;
  const localOnly = await openHlaseni({
    gas: kept,
    queue: [{ id: "local", report: { cas: "3. 3. 2026", op: "A", tech: "Myčka B", typ: "T", cast: "C", co: "P", firma: "", pozn: "smazat" } }],
  });
  localOnly.document.getElementById("zaz").click();
  await settle();
  check("neodeslané je v záznamu", localOnly.document.getElementById("tbl").textContent.indexOf("smazat") >= 0);
  clickText(localOnly.document, "Smazat neodeslané");
  await settle();
  const cleared = localOnly.document.getElementById("app").textContent;
  check("smazání fronty nemaže tabulku", localOnly.gas.saved.length === 0 && localOnly.window.localStorage.getItem("magu_queue") === "[]");
  check("smazaná fronta zmizí z obrazovky", cleared.indexOf("smazat") < 0 && cleared.indexOf("Zatím žádné záznamy") >= 0, cleared);
}

async function main() {
  syntaxTests();
  manifestTests();
  serverTests();
  alkoholServer();
  await clientTests();
  const self = spawnSync(process.execPath, [path.join(root, "alkohol/self-test.js")], { encoding: "utf8" });
  check("původní self-test kalkulačky", self.status === 0, self.stderr || self.stdout);
  console.log("");
  if (failed) {
    console.error(failed + " kontrol selhalo.");
    process.exit(1);
  }
  console.log("Všechny kontroly prošly.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
