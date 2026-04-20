#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "data", "zapasy.json");
const zapasy = JSON.parse(fs.readFileSync(FILE, "utf8"));
let opraveno = 0;

zapasy.forEach(z => {
  // Přepočítej vitez_id ze setů
  let h1 = 0, h2 = 0;
  // Odstraň sety 0:0 (nevyplněné)
  z.sety = z.sety.filter(s => s.h1 > 0 || s.h2 > 0);
  z.sety.forEach(s => {
    if (s.h1 > s.h2) h1++;
    else if (s.h2 > s.h1) h2++;
  });
  z.h1_sety_won = h1;
  z.h2_sety_won = h2;
  const spravny = h1 > h2 ? z.hrac1_id : h2 > h1 ? z.hrac2_id : null;
  if (z.vitez_id !== spravny) {
    console.log("Opravuji:", z.hrac1_jmeno, "vs", z.hrac2_jmeno,
      "| sety:", h1+":"+h2,
      "| starý vitez_id:", z.vitez_id,
      "-> nový:", spravny);
    z.vitez_id = spravny;
    opraveno++;
  }
});

fs.writeFileSync(FILE, JSON.stringify(zapasy, null, 2));
console.log("\nHotovo. Opraveno zápasů:", opraveno);
