# VKG Data Quality Dashboard — Frontend

React + Vite + Tailwind v4 frontend for the VKG Data Quality Dashboard.

## Stack

- **React 18** + **Vite 6** (no CRA)
- **React Router v6** for routing
- **Tailwind CSS v4** — CSS-first config, no `tailwind.config.js`
- **axios** for API calls (with retry interceptor)
- **recharts** for charts
- **lucide-react** for icons
- Plain Tailwind primitives (Card, Button, Select…) — **no shadcn install**
- Drop in `npx shadcn@latest add <component>` later if you ever need a specific one

## Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.js          # dev proxy: /api → http://localhost:8000
├── jsconfig.json           # @/* alias for editor support
└── src/
    ├── main.jsx
    ├── App.jsx             # Routes
    ├── api/
    │   └── index.js        # axios client + all endpoints
    ├── lib/
    │   └── cn.js           # className merge helper
    ├── components/         # small reusable primitives
    │   ├── Layout.jsx
    │   ├── Sidebar.jsx
    │   ├── Card.jsx
    │   ├── Button.jsx
    │   ├── Select.jsx
    │   ├── Tooltip.jsx
    │   ├── Feedback.jsx    # ErrorBox + LoadingSkeleton
    │   ├── CircularProgress.jsx
    │   ├── ClassSelector.jsx
    │   └── IdentityPropertySelector.jsx
    ├── pages/
    │   ├── LandingPage.jsx
    │   └── ConcisenessPage.jsx
    └── styles/
        └── index.css       # Tailwind import + theme tokens
```

## Setup — step by step

These steps assume you've extracted/copied this `frontend/` folder into your monorepo
next to your backend/teiid/obda/docker folders.

### 1. Install Node.js

You need Node 18+ (Node 20 LTS recommended). Check with:

```bash
node -v
```

If missing, install via [nvm](https://github.com/nvm-sh/nvm) or your OS package manager.

### 2. Install dependencies

From the `frontend/` folder:

```bash
cd frontend
npm install
```

This will populate `node_modules/` (already gitignored).

### 3. Make sure your backend is running

The Vite dev server proxies `/api/*` to `http://localhost:8000` (see `vite.config.js`).
Start your FastAPI backend on port 8000 the way you normally do (docker compose, uvicorn, etc.).

If your backend runs on a different port, edit `vite.config.js`:

```js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:YOUR_PORT',
      changeOrigin: true,
    },
  },
},
```

### 4. Run the dev server

```bash
npm run dev
```

Opens on http://localhost:5173. Hot reload is on by default.

### 5. Build for production

```bash
npm run build
```

Outputs to `dist/`. Serve it however you like (nginx, FastAPI's StaticFiles, Caddy, etc.).

```bash
npm run preview   # local preview of the built dist/
```

## Routing

| Path             | Page              | Status   |
|------------------|-------------------|----------|
| `/`              | LandingPage       | ✅ done  |
| `/conciseness`   | ConcisenessPage   | ✅ done  |
| `/accuracy`      | —                 | Sidebar item only ("Soon") |
| `/completeness`  | —                 | Sidebar item only ("Soon") |
| `/consistency`   | —                 | Sidebar item only ("Soon") |

To add a new dimension page later:

1. Create `src/pages/AccuracyPage.jsx`
2. Add a route in `src/App.jsx`:
   ```jsx
   <Route path="accuracy" element={<AccuracyPage />} />
   ```
3. Flip `available: false` → `true` in `src/components/Sidebar.jsx` and `src/pages/LandingPage.jsx`

## Theme tokens

Defined as CSS variables in `src/styles/index.css` and exposed to Tailwind v4 via `@theme inline`.

| Token             | Hex        | Usage                        |
|-------------------|-----------|------------------------------|
| `--navy`          | `#003663` | Primary brand, headers       |
| `--accent`        | `#9E2B0A` | CTAs, active states          |
| `--accent-soft`   | `#FBEAE3` | Soft accent backgrounds      |
| `--navy-soft`     | `#E0EAF2` | Soft navy backgrounds        |
| `--sidebar`       | `#0B1720` | Sidebar background           |
| `--success` / `--warning` / `--danger` | — | Score color coding |

Use them as Tailwind utilities: `bg-navy`, `text-accent`, `border-border`, etc.

## Adding shadcn components later (optional)

If you ever decide you want a real shadcn primitive (e.g. a proper Dialog or
Command palette), you can add them one at a time without bringing in the whole library:

```bash
npx shadcn@latest init   # one-time, will ask config questions
npx shadcn@latest add dialog
```

This drops a single `dialog.jsx` into `src/components/ui/` (or wherever you configure).
You're not forced to take all 48 components.
