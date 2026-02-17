# poc-idme

> POC — Telegram → GPT-4o → Playwright agentic workflow for the Malaysian **idMe** portal.

## Architecture

```
┌─────────────┐  NL message   ┌─────────────┐  extract    ┌──────────┐
│  Telegram   │ ──────────► │  GPT-4o     │ ────────► │ MongoDB  │
│  User       │ ◄────────── │  Intent     │           │ profile_ │
│             │  screenshot  │  Extractor  │           │ updates  │
└─────┬───────┘  + buttons   └─────────────┘           └──────────┘
      │                                                      │
      │  confirm / cancel                                    │ PENDING
      ▼                                                      ▼
┌─────────────┐  cookies     ┌─────────────┐          ┌──────────┐
│  Playwright │ ◄─────────── │  Supabase   │          │ Audit    │
│  idMe       │              │  sessions   │          │ Logs     │
│  Driver     │              └─────────────┘          └──────────┘
└─────────────┘                    ▲
                                   │ Chrome Extension
                              ┌────┴────┐
                              │ Browser  │
                              │ (manual  │
                              │  login)  │
                              └─────────┘
```

## Modules

| # | Module | Description |
|---|--------|-------------|
| 1 | **Telegram Bot** | Accepts NL messages, shows screenshots, HITL confirm/cancel |
| 2 | **GPT-4o Intent Extractor** | Parses income value from English/Malay text |
| 3 | **Playwright Driver** | Navigates idMe, fills income, screenshots, clicks Simpan |
| 4 | **Supabase Session Store** | Holds idMe cookies captured by the Chrome Extension |
| 5 | **Chrome Extension** | One-click cookie sync from the logged-in idMe session |
| 6 | **MongoDB** | `profile_updates` (state machine) + `audit_logs` (immutable trail) |

## Constraints

- **No credentials handled** — only session cookies.
- **Selector resilience** — uses `getByLabel`, `text=` locators (no brittle CSS IDs).
- **Human-like mimicry** — 200 ms keystroke delay + `mouse.move()` before every click.
- **HITL** — screenshot sent to Telegram before `Simpan`; user must confirm.

---

## Quick Start

### 1. Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| MongoDB | 7+ (or use Docker) |
| A Supabase project | Free tier is fine |
| A Telegram bot token | Via [@BotFather](https://t.me/BotFather) |
| An OpenAI API key | With GPT-4o access |

### 2. Supabase setup

Run the SQL in [`supabase/schema.sql`](supabase/schema.sql) in your Supabase SQL editor to create the `sessions` table.

### 3. Environment

```bash
cp .env.example .env
# Fill in every value in .env
```

### 4. Install & run

```bash
npm install
npx playwright install chromium   # one-time
npm start
```

Or with Docker:

```bash
docker compose up -d
```

### 5. Chrome Extension

1. Open `chrome://extensions` → Enable **Developer mode**.
2. Click **Load unpacked** → select the `extension/` folder.
3. Log into [idme.moe.gov.my](https://idme.moe.gov.my) in Chrome.
4. Click the extension icon → fill in Supabase URL, key, and your Telegram user ID → **Sync Cookies**.

### 6. Use the bot

Send a message to your bot:

```
Set my income to 12000
```

The bot will:
1. Extract the income value via GPT-4o.
2. Open an automated browser, navigate the idMe portal, and fill in the income field.
3. Send you a screenshot for verification.
4. Wait for you to press **🚀 Confirm Update** or **❌ Cancel**.
5. On confirmation, click **Simpan** and log the change.

---

## Project Structure

```
poc-idme/
├── src/
│   ├── index.js                   # Entry point
│   ├── config.js                  # Env loader
│   ├── bot/
│   │   └── telegramBot.js         # grammY bot + HITL callbacks
│   ├── services/
│   │   ├── intentExtractor.js     # GPT-4o intent extraction
│   │   ├── playwrightDriver.js    # Playwright idMe automation
│   │   └── supabaseSession.js     # Supabase session cookie helper
│   └── db/
│       ├── connect.js             # Mongoose connection
│       └── models.js              # ProfileUpdate + AuditLog schemas
├── extension/                     # Chrome Extension (MV3)
│   ├── manifest.json
│   ├── popup.html
│   └── popup.js
├── supabase/
│   └── schema.sql                 # Supabase table DDL
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
└── README.md
```

## License

MIT
