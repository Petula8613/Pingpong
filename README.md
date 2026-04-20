# 🏓 Pingpong Turnaj – Instalace

## Adresářová struktura

```
/opt/docker/web/Pingpong/
├── docker-compose.yml
├── Dockerfile
├── package.json
├── server.js              ← Express API + static server
├── data/
│   ├── config.json        ← Nastavení turnaje (datum, název, počet setů)
│   ├── hraci.json         ← Registrovaní hráči
│   └── zapasy.json        ← Odehrané zápasy
└── public/
    ├── router.html        ← Vstupní stránka (přesměruje dle data)
    ├── registrace.html    ← Registrace hráčů (před turnajem)
    ├── index.html         ← Hlavní turnajová stránka
    ├── tabulka_dospeli.html ← Křížová tabulka Dospělí
    ├── tabulka_dorost.html  ← Křížová tabulka Dorost
    ├── style.css
    └── app.js
```

## 1. Nasazení do Dockeru

```bash
# Zkopíruj soubory
cp -r . /opt/docker/web/Pingpong/
cd /opt/docker/web/Pingpong

# Nastav oprávnění pro data
chmod -R 777 data/

# Spusť
docker compose up -d --build
```

## 2. Nastavení Caddy

Ve tvém Caddyfile přidej (port 3000 je container):

```caddyfile
pingpong.petula.fun {
    reverse_proxy pingpong-api:3000
}
```

Ujisti se, že container `pingpong-api` je na stejné Docker síti jako Caddy (`caddy_net`).

## 3. Nastavení data turnaje

Uprav `data/config.json`:

```json
{
  "datum_turnaje": "2025-09-01T09:00:00",
  "nazev_turnaje": "Pingpong Turnaj 2025",
  "pocet_setu": 3
}
```

- **datum_turnaje** – do tohoto data se zobrazuje registrace, pak automaticky turnajová stránka
- **pocet_setu** – počet setů v zápase (3 nebo 5)

## 4. Logika přesměrování

```
pingpong.petula.fun  →  /  →  router.html
  ├── před turnajem  →  registrace.html  (countdown + registrace)
  └── po začátku     →  index.html       (turnaj, pořadí, zápasy)
```

## API endpointy

| Metoda | Endpoint        | Popis                    |
|--------|-----------------|--------------------------|
| GET    | /api/config     | Načte konfiguraci        |
| POST   | /api/config     | Uloží konfiguraci        |
| GET    | /api/hraci      | Všichni hráči            |
| POST   | /api/hraci      | Registruj hráče          |
| DELETE | /api/hraci/:id  | Smaž hráče               |
| GET    | /api/zapasy     | Všechny zápasy           |
| POST   | /api/zapasy     | Zapiš zápas              |
| DELETE | /api/zapasy/:id | Smaž zápas               |
| GET    | /api/stats      | Výpočet statistik (live) |

## Bodování

- **Výhra** = 2 body
- **Prohra** = 0 bodů
- Pořadí: body → výhry → rozdíl setů

## Auto-refresh

Index.html a tabulky se automaticky aktualizují každých **30 sekund**.
