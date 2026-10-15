#!/usr/bin/env node
/**
 * Self-test kalibrace alkoholmetru.
 * Spuštění: node alkohol/self-test.js
 *
 * Ověří páry ze sheetu „NP Kalibrace 29.9.2026“ (C23 → % obj. na 4 desetinná
 * místa) a české zobrazení na 2 a 3 desetinná místa.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const htmlPath = path.join(__dirname, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const match = html.match(/<script id="calc">([\s\S]*?)<\/script>/);
if (!match) {
  console.error("FAIL  V index.html chybí <script id=\"calc\">.");
  process.exit(1);
}

const sandbox = { module: { exports: {} }, console, Math, Number };
vm.createContext(sandbox);
vm.runInContext(match[1], sandbox, { filename: htmlPath });

const {
  CONFIG,
  alcoholPercent,
  parseRaw,
  formatCzechNumber,
  formatConstant,
  isOutsideCalibration,
  exceedsLegalLimit,
} = sandbox.module.exports;

/** raw → % obj. na 4 desetinná místa (logika buňky C24). */
const PAIRS = [
  [150, "0.0966"],
  [181, "0.1334"],
  [200, "0.1625"],
  [250, "0.2733"],
  [300, "0.4597"],
  [400, "1.3007"],
  [441, "1.9923"],
];

const failures = [];

function check(name, ok, detail) {
  if (ok) {
    console.log("OK   " + name);
  } else {
    failures.push(name + (detail ? " — " + detail : ""));
    console.error("FAIL " + name + (detail ? " — " + detail : ""));
  }
}

console.log("Kalkulačka alkoholu — self-test");
console.log(CONFIG.label + "  a = " + CONFIG.a + "  b = " + CONFIG.b);
console.log("");

check(
  "popisek kalibrace",
  CONFIG.label === "Kalibrace 29. 9. 2026",
  JSON.stringify(CONFIG.label)
);
check("a = 0,000203", formatConstant(CONFIG.a) === "0,000203", formatConstant(CONFIG.a));
check("b = 0,0104", formatConstant(CONFIG.b) === "0,0104", formatConstant(CONFIG.b));

for (const [raw, expected] of PAIRS) {
  const percent = alcoholPercent(raw);
  const got = percent.toFixed(4);
  const d2 = formatCzechNumber(percent, 2);
  const d3 = formatCzechNumber(percent, 3);
  check(
    raw + " → " + expected + " %   zobrazení " + d2 + " % obj. / " + d3 + " %",
    got === expected,
    "vyšlo " + got
  );
}

check("čárka 181,0", parseRaw("181,0") === 181, String(parseRaw("181,0")));
check("tečka 181.0", parseRaw("181.0") === 181, String(parseRaw("181.0")));
check(
  "čárka a tečka dají stejné %",
  alcoholPercent(parseRaw("250,5")) === alcoholPercent(parseRaw("250.5"))
);
check("prázdný vstup", parseRaw("") === null);
check("nečíslo", parseRaw("abc") === null);
check("181 pod rozsahem", isOutsideCalibration(181) === true);
check("189 v rozsahu", isOutsideCalibration(189) === false);
check("441 v rozsahu", isOutsideCalibration(441) === false);
check("442 nad rozsahem", isOutsideCalibration(442) === true);
check("150 pod rozsahem", isOutsideCalibration(150) === true);
check("250 pod limitem 0,35 %", exceedsLegalLimit(alcoholPercent(250)) === false);
check("300 nad limitem 0,35 %", exceedsLegalLimit(alcoholPercent(300)) === true);
check("181 pod limitem 0,35 %", exceedsLegalLimit(alcoholPercent(181)) === false);

console.log("");
if (failures.length) {
  console.error(failures.length + " testů selhalo.");
  process.exit(1);
}
console.log("Všechny testy prošly (" + PAIRS.length + " kalibračních párů).");
