# Iron Log — 3-Day PPL Tracker

A self-contained, installable workout tracker for a 3-day Push / Pull / Legs split, built around progressive overload, RIR (reps in reserve), and a 6-week mesocycle with a built-in deload — the core training fundamentals from *Bigger Leaner Stronger*.

No backend, no build step, no dependencies. It's plain HTML/CSS/JS that runs entirely on your phone once hosted, and stores all your data locally on your device.

## The program

**6-week mesocycle:** 5 weeks of progressive overload + 1 deload week (half the volume, much higher RIR), then it loops into a new cycle.

| Day | Focus | Exercises |
|---|---|---|
| Push | Chest, Shoulders, Triceps | Smith bench press, Smith OHP, DB incline press, cable lateral raise, cable fly, cable triceps pushdown |
| Pull | Back, Biceps, Rear delts | Lat pulldown, seated cable row, Smith bent-over row, cable face pull, DB curl, cable hammer curl |
| Legs | Quads, Hamstrings, Glutes, Calves | Smith squat, leg press, DB Romanian deadlift, leg curl, leg extension, calf raise |

Each session runs ~45–60 minutes: compound lifts first (lower reps, longer rest), isolation work after (higher reps, shorter rest). Full explanation of the methodology is built into the app's **Guide** tab.

## Hosting it on GitHub Pages (so you can add it to your homescreen)

1. Create a new GitHub repository (e.g. `iron-log`).
2. Upload every file in this folder to the repo root, keeping the `icons/` folder structure intact.
3. In the repo, go to **Settings → Pages**.
4. Under **Source**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
5. Wait a minute, then visit the URL GitHub gives you (something like `https://yourusername.github.io/iron-log/`).

That's it — it's a static site, so there's nothing else to configure.

## Adding it to your homescreen

**iPhone (Safari):** open the URL → tap the Share icon → **Add to Home Screen**.
**Android (Chrome):** open the URL → tap the **⋮** menu → **Add to Home Screen** / **Install app**.

Once added, it opens full-screen like a native app and works offline (a service worker caches all the app files on first load).

## How your data is stored

Everything — your starting weights, every logged set, and your current week/cycle — is saved in your browser's local storage on your device. Nothing is sent anywhere. This also means:

- Your data is specific to the browser/device you log in. If you reinstall or switch phones, it won't carry over automatically.
- Clearing your browser's site data for this app will erase your history.
- There's a **Reset all data** button in Settings if you ever want to start clean.

## Using it

1. **First launch:** enter your current working weight for each exercise (or skip and fill them in as you go).
2. **Home:** shows your mesocycle progress ring and the next session to do — tap **Start Workout**.
3. **During a workout:** log weight/reps/RIR per set, tap the checkmark to lock it in — a rest timer pops up automatically sized to that exercise. Tap **Finish Workout** when done.
4. **Progression:** if every set of an exercise hits the top of its rep range, the app bumps the suggested weight for next time automatically. Otherwise it keeps the weight the same so you can chase more reps first.
5. **History:** pick an exercise to see a simple chart of your top working set over time, plus a log of past sessions.
6. **Settings:** jump to a different mesocycle week, manually edit any working weight, or reset everything.

## Files

```
index.html          markup for every screen
style.css            visual design
app.js               app logic, state, timers
program.js           the workout program data (exercises, sets, rep ranges, RIR)
manifest.json        PWA install config
service-worker.js    offline caching
icons/               app icons
```

If you want to change an exercise, swap a machine, or adjust sets/reps, everything lives in `program.js` — it's a plain data structure, no need to touch the app logic.
