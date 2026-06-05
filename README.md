# 🌿 The Lawn Pack Companion

A data-driven lawn care workflow tracker built for **The Lawn Pack** seasonal system. Plan, log, and automate your full-year lawn routine — from Spring renovation through Winter moss treatment — with dose calculations, weather-aware irrigation, and context-sensitive maintenance alarms.

**Live repo:** [github.com/bvinton/lawn-care-app](https://github.com/bvinton/lawn-care-app)

---

## Features

### 📋 Seasonal Workflow Engine
- **Spring, Summer, Autumn & Winter** packs with step-by-step timelines
- Per-step dose calculations based on your lawn size (SQM)
- Sprayer mixing instructions for Birchmeier, watering can, or knapsack profiles
- Cascading target dates anchored to uniform season baselines (1st of each month)
- Weedol 6-week soft advisory for Spring prep and seeding steps

### 🌦️ 7-Day Weather Radar
- Live rainfall forecast for the North East / Newcastle region (Open-Meteo)
- Pauses watering reminders when 7-day projected rain ≥ 5mm
- Amber warning when a deep soak is inbound

### 🚰 Intelligent Irrigation Controller
- Sprinkler profile selector with real product photos (Oscillating, Impact, Static, Hose)
- Calculates exact runtime for a 10mm soak based on your sprinkler's mm/hour rate
- Tap any photo to enlarge and identify your setup

### ✂️ Context-Aware Maintenance Alarms
- **Mowing:** Suspended in Winter; locked during 21-day Spring seed establishment; amber alert at 5+ days
- **Watering:** Suspended in Winter; paused when rain is forecast; amber alert at 3+ dry days
- Backdated log dates for mowing and watering

### 🐶 Pet Safety & Master Guides
- Separate bold blue pet safety banners on every chemical, granular, and liquid step
- Full seasonal maintenance guides with best-practice bullet blocks per season

### 💾 Persistent Local Storage
All task logs and maintenance dates survive browser refresh:
- `lawnPackUserLogs` — completed step dates
- `lawnPackLastMowedDate` / `lawnPackLastWateredDate`
- `lawnPackSelectedSprinkler` — irrigation profile

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| UI | React 18 |
| Build | Vite 5 |
| Styling | Tailwind CSS 3 |
| Weather | [Open-Meteo API](https://open-meteo.com/) (free, no key required) |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or later
- npm

### Install & Run

```bash
git clone https://github.com/bvinton/lawn-care-app.git
cd lawn-care-app
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

---

## Project Structure

```
lawn-care-app/
├── public/                  # Sprinkler reference photos (.jfif)
├── src/
│   ├── App.jsx              # App shell
│   ├── components/
│   │   └── lawn/
│   │       ├── LawnCareApp.jsx       # Thin shell: settings vs workflow
│   │       ├── LawnSettings.jsx      # Postcode, lawn size, sprinklers, etc.
│   │       ├── LawnWorkflow.jsx      # Alerts, header, maintenance, timeline
│   │       ├── MaintenancePanel.jsx  # Weather, mowing, watering, gypsum
│   │       ├── SeasonTimeline.jsx    # Season tabs, step timeline, guidelines
│   │       ├── SprinklerLightbox.jsx # Enlarged sprinkler modal
│   │       └── UkDateInput.jsx       # UK date picker input
│   ├── data/
│   │   ├── LawnPackData.js  # Seasons, steps, equipment & sprinkler config
│   │   └── lawnUiConfig.jsx # UI constants (mower options, pet safety, etc.)
│   ├── hooks/
│   │   └── useLawnCareApp.js # State, effects, handlers, derived schedule values
│   ├── services/            # Supabase sync, weather, location, schedule engine
│   └── utils/
│       ├── lawnDates.js     # Date formatting & parsing helpers
│       ├── lawnStorage.js   # localStorage JSON helpers
│       └── lawnStepAmounts.js # Per-step dose calculations
├── supabase/                # SQL migrations for cloud sync tables
├── index.html
├── package.json
└── vite.config.js
```

---

## Configuration

Open **⚙️ Show Setup** in the app to configure:

- **Lawn dimensions** — length × width sliders (auto-calculates SQM)
- **Application tool** — Birchmeier Aquamix, watering can, or knapsack sprayer
- **Irrigation profile** — select your primary sprinkler with photo identification

---

## License

Private project — all rights reserved.
