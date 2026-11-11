# LiftForge - Progressive Overload Strength Training PWA

LiftForge is an original, mobile-first Progressive Web App (PWA) designed for 5x5 barbell strength training. Built local-first with Dexie and IndexedDB, it ensures full offline functionality with zero external servers or cloud dependencies required.

---

## Technical Stack & Documented Versions

| Package | Version | Purpose |
|---|---|---|
| `next` | `16.4.6` | App Router framework with React 19 |
| `react` / `react-dom` | `19.3.0` | Core UI library |
| `dexie` | `4.4.7` | IndexedDB local-first database with migrations |
| `zod` | `4.6.7` | Domain schema validation and backup checking |
| `recharts` | `3.10.1` | Responsive SVG progress charts & 1RM trajectory |
| `tailwindcss` | `4.3.3` | Mobile-first styling and theme tokens |
| `lucide-react` | `1.71.0` | Accessible SVG interface iconography |
| `vitest` | `5.1.0` | Pure domain and rules engine test runner |
| `@playwright/test` | `1.65.0` | Headless Chromium end-to-end mobile testing |

---

## Progression Rules Engine

- **Alternating Schedule**: Strictly sequences completed sessions between Workout A (`Squat 5x5`, `Bench Press 5x5`, `Barbell Row 5x5`) and Workout B (`Squat 5x5`, `Overhead Press 5x5`, `Deadlift 1x5`), independent of calendar dates.
- **Progression**: Increases weight by the user's configured increment (`+2.5 kg` or `+5 lb`) when all prescribed working reps are completed.
- **Failures & Deload**: 1 or 2 missed sessions repeat the weight; 3 consecutive missed attempts trigger an automatic 10% deload rounded to achievable barbell plate pairs.
- **Skips & Warmups**: Warmups and skipped sets do not count as failures.
- **Pain Flags**: Suppresses automatic progression if discomfort was reported.
- **Break Reviews**: Detects gaps $>14$ days and prompts the lifter to perform a safe load reset.
- **Equipment Math**: Automatically breaks down plate requirements per sleeve given bar weight and available pairs.

---

## Local-First Persistence & Portability

- **Draft Resilience**: State persists to IndexedDB on every single mutation. Reloading or navigating away preserves active workout drafts and rest timer countdowns.
- **Data Portability**: Full versioned JSON backup (`exportDatabaseToJson` / `importDatabaseFromJson`) and historical set CSV export.
- **Offline Support**: PWA manifest and service worker caching strategy (`public/sw.js`).
- **Local Storage Warning**: Explicit UI warning that browser-local data is not a cloud backup.

---

## Scripts & Testing

```bash
# Run unit tests (Progression, Plate rounding, Conversions, Alternation)
npm test

# Run end-to-end mobile browser tests
npx playwright test

# Production build (Vercel-ready)
npm run build
```

---

## Vercel Deployment

LiftForge is configured for zero-configuration deployment on Vercel:
1. Connect repository to Vercel.
2. Framework Preset: **Next.js**.
3. Build Command: `npm run build`.
4. Output Directory: `.next`.
5. Environment Variables: None required.
