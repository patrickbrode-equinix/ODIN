/* ---------------------------------------------------------------- */
/* ODIN – Employee Contacts unit tests                              */
/* Run:  node Backend/routes/employeeContacts.test.js               */
/* ---------------------------------------------------------------- */

import { generateEmailFromName } from "./employeeContacts.js";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.error(`  ✗ ${label}`);
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

/* ================================================================ */
/* 1. BASIC NAME → EMAIL                                            */
/* ================================================================ */
section("Basic name → email generation");

assert(
  generateEmailFromName("Max Mustermann") === "max.mustermann@eu.equinix.com",
  "Simple 'Vorname Nachname' → vorname.nachname@..."
);

assert(
  generateEmailFromName("Mustermann, Max") === "max.mustermann@eu.equinix.com",
  "'Nachname, Vorname' format handled correctly"
);

assert(
  generateEmailFromName("Anna Maria Schmidt") === "anna.schmidt@eu.equinix.com",
  "Three-part name: first + last used"
);

/* ================================================================ */
/* 2. UMLAUTS + SPECIAL CHARS                                       */
/* ================================================================ */
section("Umlauts and special characters");

assert(
  generateEmailFromName("Müller, Jürgen") === "juergen.mueller@eu.equinix.com",
  "ü→ue, ü→ue in both parts"
);

assert(
  generateEmailFromName("Böhm, Günther") === "guenther.boehm@eu.equinix.com",
  "ö→oe, ü→ue"
);

assert(
  generateEmailFromName("Große, André") === "andr.grosse@eu.equinix.com",
  "ß→ss, accented chars stripped"
);

/* ================================================================ */
/* 3. EDGE CASES                                                    */
/* ================================================================ */
section("Edge cases");

assert(
  generateEmailFromName(null) === null,
  "null input → null"
);

assert(
  generateEmailFromName("") === null,
  "empty string → null"
);

assert(
  generateEmailFromName("SingleName") === null,
  "Single name → null (need first + last)"
);

assert(
  generateEmailFromName("  Spaced , Name  ") === "name.spaced@eu.equinix.com",
  "Extra whitespace trimmed"
);

/* ================================================================ */
/* SUMMARY                                                          */
/* ================================================================ */
console.log(`\n${"═".repeat(50)}`);
console.log(`Employee Contacts Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
