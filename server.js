const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const HRACI_FILE = path.join(DATA_DIR, "hraci.json");
const ZAPASY_FILE = path.join(DATA_DIR, "zapasy.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

// Ensure data dir and files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(HRACI_FILE)) fs.writeFileSync(HRACI_FILE, JSON.stringify({ dospeli: [], dorost: [] }, null, 2));
if (!fs.existsSync(ZAPASY_FILE)) fs.writeFileSync(ZAPASY_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(CONFIG_FILE)) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    datum_turnaje: "2025-09-01T09:00:00",
    nazev_turnaje: "Pingpong Turnaj 2025",
    pocet_setu: 3
  }, null, 2));
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---- Helpers ----
const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const adminAuth = (req, res, next) => {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Nesprávné heslo" });
  }
  next();
};

// ---- Admin verify ----
app.get("/api/admin/verify", adminAuth, (req, res) => res.json({ ok: true }));

// ---- Config ----
app.get("/api/config", (req, res) => {
  res.json(readJSON(CONFIG_FILE));
});

app.post("/api/config", (req, res) => {
  const config = readJSON(CONFIG_FILE);
  Object.assign(config, req.body);
  writeJSON(CONFIG_FILE, config);
  res.json({ ok: true, config });
});

// ---- Hráči ----
app.get("/api/hraci", (req, res) => {
  res.json(readJSON(HRACI_FILE));
});

app.post("/api/hraci", (req, res) => {
  const { jmeno, prijmeni, skupina } = req.body;
  if (!jmeno || !prijmeni || !["dospeli", "dorost"].includes(skupina)) {
    return res.status(400).json({ error: "Chybná data" });
  }

  const hraci = readJSON(HRACI_FILE);
  const id = Date.now().toString();
  const hrac = { id, jmeno: jmeno.trim(), prijmeni: prijmeni.trim(), skupina };
  hraci[skupina].push(hrac);
  writeJSON(HRACI_FILE, hraci);
  res.json({ ok: true, hrac });
});

app.put("/api/hraci/:id", adminAuth, (req, res) => {
  const { jmeno, prijmeni } = req.body;
  if (!jmeno || !prijmeni) return res.status(400).json({ error: "Chybná data" });
  const hraci = readJSON(HRACI_FILE);
  let updated = null;
  ["dospeli", "dorost"].forEach(sk => {
    const idx = hraci[sk].findIndex(h => h.id === req.params.id);
    if (idx !== -1) {
      hraci[sk][idx].jmeno = jmeno.trim();
      hraci[sk][idx].prijmeni = prijmeni.trim();
      updated = hraci[sk][idx];
    }
  });
  if (!updated) return res.status(404).json({ error: "Hráč nenalezen" });
  // Update name in matches too
  const zapasy = readJSON(ZAPASY_FILE);
  const plneJmeno = `${updated.jmeno} ${updated.prijmeni}`;
  zapasy.forEach(z => {
    if (z.hrac1_id === req.params.id) z.hrac1_jmeno = plneJmeno;
    if (z.hrac2_id === req.params.id) z.hrac2_jmeno = plneJmeno;
  });
  writeJSON(HRACI_FILE, hraci);
  writeJSON(ZAPASY_FILE, zapasy);
  res.json({ ok: true });
});

app.delete("/api/hraci/:id", adminAuth, (req, res) => {
  const { id } = req.params;
  const hraci = readJSON(HRACI_FILE);
  hraci.dospeli = hraci.dospeli.filter(h => h.id !== id);
  hraci.dorost = hraci.dorost.filter(h => h.id !== id);
  writeJSON(HRACI_FILE, hraci);
  // Also remove their matches
  let zapasy = readJSON(ZAPASY_FILE);
  zapasy = zapasy.filter(z => z.hrac1_id !== id && z.hrac2_id !== id);
  writeJSON(ZAPASY_FILE, zapasy);
  res.json({ ok: true });
});

// ---- Zápasy ----
app.get("/api/zapasy", (req, res) => {
  // Automaticky oprav stare zaznamy s chybnym vitez_id
  const zapasy = readJSON(ZAPASY_FILE);
  let zmeneno = false;
  zapasy.forEach(z => {
    // Odstraň sety 0:0 (nevyplněné)
    z.sety = z.sety.filter(s => s.h1 > 0 || s.h2 > 0);
    let h1 = 0, h2 = 0;
    z.sety.forEach(s => { if (s.h1 > s.h2) h1++; else if (s.h2 > s.h1) h2++; });
    z.h1_sety_won = h1;
    z.h2_sety_won = h2;
    const spravny = h1 > h2 ? z.hrac1_id : h2 > h1 ? z.hrac2_id : null;
    if (z.vitez_id !== spravny) { z.vitez_id = spravny; zmeneno = true; }
  });
  if (zmeneno) writeJSON(ZAPASY_FILE, zapasy);
  res.json(zapasy);
});

app.post("/api/zapasy", (req, res) => {
  const { skupina, hrac1_id, hrac2_id, sety } = req.body;
  // sety = [{h1: 11, h2: 8}, {h1: 7, h2: 11}, {h1: 11, h2: 6}]
  if (!skupina || !hrac1_id || !hrac2_id || !sety || !Array.isArray(sety)) {
    return res.status(400).json({ error: "Chybná data" });
  }

  const hraci = readJSON(HRACI_FILE);
  const skupinaHraci = hraci[skupina];
  const h1 = skupinaHraci.find(h => h.id === hrac1_id);
  const h2 = skupinaHraci.find(h => h.id === hrac2_id);
  if (!h1 || !h2) return res.status(400).json({ error: "Hráč nenalezen" });

  // Determine winner by sets won
  let h1_sety = 0, h2_sety = 0;
  sety.forEach(s => {
    if (s.h1 > s.h2) h1_sety++;
    else if (s.h2 > s.h1) h2_sety++;
  });

  // Ignoruj sety 0:0 (nevyplněné)
  const platne_sety = sety.filter(s => s.h1 > 0 || s.h2 > 0);
  // Přepočítej pouze z platných setů
  let h1_sety_final = 0, h2_sety_final = 0;
  platne_sety.forEach(s => {
    if (s.h1 > s.h2) h1_sety_final++; else if (s.h2 > s.h1) h2_sety_final++;
  });
  // null = remíza
  const vitez_id = h1_sety_final > h2_sety_final ? hrac1_id : h2_sety_final > h1_sety_final ? hrac2_id : null;

  const zapas = {
    id: Date.now().toString(),
    skupina,
    hrac1_id,
    hrac2_id,
    hrac1_jmeno: `${h1.jmeno} ${h1.prijmeni}`,
    hrac2_jmeno: `${h2.jmeno} ${h2.prijmeni}`,
    sety: platne_sety,
    h1_sety_won: h1_sety_final,
    h2_sety_won: h2_sety_final,
    vitez_id,
    datum: new Date().toISOString()
  };

  const zapasy = readJSON(ZAPASY_FILE);
  zapasy.push(zapas);
  writeJSON(ZAPASY_FILE, zapasy);
  res.json({ ok: true, zapas });
});

app.put("/api/zapasy/:id", adminAuth, (req, res) => {
  const { sety } = req.body;
  if (!sety || !Array.isArray(sety)) return res.status(400).json({ error: "Chybná data" });
  const zapasy = readJSON(ZAPASY_FILE);
  const idx = zapasy.findIndex(z => z.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Zápas nenalezen" });
  const z = zapasy[idx];
  const platne = sety.filter(s => s.h1 > 0 || s.h2 > 0);
  z.sety = platne;
  let h1 = 0, h2 = 0;
  platne.forEach(s => { if (s.h1 > s.h2) h1++; else if (s.h2 > s.h1) h2++; });
  z.h1_sety_won = h1;
  z.h2_sety_won = h2;
  z.vitez_id = h1 > h2 ? z.hrac1_id : h2 > h1 ? z.hrac2_id : null;
  zapasy[idx] = z;
  writeJSON(ZAPASY_FILE, zapasy);
  res.json({ ok: true, zapas: z });
});

app.delete("/api/zapasy/:id", adminAuth, (req, res) => {
  let zapasy = readJSON(ZAPASY_FILE);
  zapasy = zapasy.filter(z => z.id !== req.params.id);
  writeJSON(ZAPASY_FILE, zapasy);
  res.json({ ok: true });
});

app.patch("/api/zapasy/:id", (req, res) => {
  const { sety: noveSety } = req.body;
  if (!noveSety || !Array.isArray(noveSety)) {
    return res.status(400).json({ error: "Chybná data" });
  }
  const zapasy = readJSON(ZAPASY_FILE);
  const idx = zapasy.findIndex(z => z.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Zápas nenalezen" });

  const z = zapasy[idx];
  const platne = noveSety.filter(s => s.h1 > 0 || s.h2 > 0);
  z.sety = [...z.sety, ...platne];

  let h1 = 0, h2 = 0;
  z.sety.forEach(s => { if (s.h1 > s.h2) h1++; else if (s.h2 > s.h1) h2++; });
  z.h1_sety_won = h1;
  z.h2_sety_won = h2;
  z.vitez_id = h1 > h2 ? z.hrac1_id : h2 > h1 ? z.hrac2_id : null;
  z.datum = new Date().toISOString();

  zapasy[idx] = z;
  writeJSON(ZAPASY_FILE, zapasy);
  res.json({ ok: true, zapas: z });
});

// ---- Stats endpoint (computed) ----
app.get("/api/stats", (req, res) => {
  const hraci = readJSON(HRACI_FILE);
  // Vždy oprav/vyčisti zapasy před výpočtem statistik
  const zapasy = readJSON(ZAPASY_FILE).map(z => {
    z.sety = z.sety.filter(s => s.h1 > 0 || s.h2 > 0);
    let h1=0, h2=0;
    z.sety.forEach(s => { if(s.h1>s.h2) h1++; else if(s.h2>s.h1) h2++; });
    z.h1_sety_won = h1;
    z.h2_sety_won = h2;
    z.vitez_id = h1>h2 ? z.hrac1_id : h2>h1 ? z.hrac2_id : null;
    return z;
  });

  const computeStats = (skupina) => {
    return hraci[skupina].map(hrac => {
      const mojeZapasy = zapasy.filter(z => z.skupina === skupina && (z.hrac1_id === hrac.id || z.hrac2_id === hrac.id));
      let vyhry = 0, prohry = 0, sety_za = 0, sety_proti = 0;
      mojeZapasy.forEach(z => {
        const jsemH1 = z.hrac1_id === hrac.id;
        const platne = z.sety.filter(s => s.h1 > 0 || s.h2 > 0);
        let h1s = 0, h2s = 0;
        platne.forEach(s => { if (s.h1 > s.h2) h1s++; else if (s.h2 > s.h1) h2s++; });
        vyhry   += jsemH1 ? h1s : h2s;
        prohry  += jsemH1 ? h2s : h1s;
        sety_za += jsemH1 ? h1s : h2s;
        sety_proti += jsemH1 ? h2s : h1s;
      });

      const body = vyhry; // 1 bod za každý vyhraný set

      const celkemHracu = hraci[skupina].length;
      const celkemZapasu = celkemHracu > 1 ? celkemHracu - 1 : 0;
      const zbyvajicich = celkemZapasu - mojeZapasy.length;

      return {
        ...hrac,
        odehrano: mojeZapasy.length,
        zbyvajicich: Math.max(0, zbyvajicich),
        vyhry,
        prohry,
        body,
        sety_za,
        sety_proti
      };
    });
  };

  // --- Razeni s rozhodujicim zapasem ---
  const seradit = (seznam, zapasy) => {
    // Spocitat vzajemne body mezi dvojici hracu
    const vzajemneBody = (hA, hB) => {
      const spol = zapasy.filter(z =>
        z.skupina === seznam[0]?.skupina &&
        ((z.hrac1_id === hA.id && z.hrac2_id === hB.id) ||
         (z.hrac1_id === hB.id && z.hrac2_id === hA.id))
      );
      let bA = 0, bB = 0;
      spol.forEach(z => {
        const aJeH1 = z.hrac1_id === hA.id;
        z.sety.filter(s => s.h1 > 0 || s.h2 > 0).forEach(s => {
          bA += aJeH1 ? s.h1 : s.h2;
          bB += aJeH1 ? s.h2 : s.h1;
        });
      });
      return { bA, bB, shodne: bA === bB };
    };

    const sorted = [...seznam].sort((a, b) => {
      if (b.body !== a.body) return b.body - a.body;
      // Stejna pocet bodu -> vzajemny zapas
      const vz = vzajemneBody(a, b);
      if (!vz.shodne) return vz.bB - vz.bA; // vice bodu = lepsi
      return 0; // nutny rozhodujici zapas
    });

    // Oznacit dvojice se stejnymi body I vzajemnymi body -> playoff
    const playoff = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (a.body === b.body) {
        const vz = vzajemneBody(a, b);
        if (vz.shodne) {
          if (!playoff.find(p => p.includes(a.id) && p.includes(b.id))) {
            playoff.push([a.id, b.id]);
          }
        }
      }
    }

    return { sorted, playoff };
  };

  const dStat = computeStats("dospeli");
  const rStat = computeStats("dorost");

  // Pridat skupinu pro vzajemne pocitani
  dStat.forEach(h => h.skupina = "dospeli");
  rStat.forEach(h => h.skupina = "dorost");

  const dResult = seradit(dStat, zapasy);
  const rResult = seradit(rStat, zapasy);

  res.json({
    dospeli: dResult.sorted,
    dorost:  rResult.sorted,
    playoff: {
      dospeli: dResult.playoff,
      dorost:  rResult.playoff
    }
  });
});

// ---- 404 fallback ----
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`PingPong server running on port ${PORT}`));
