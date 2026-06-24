# Iron Log — 3-Day PPL Tracker

A self-contained, installable workout tracker for a 3-day Push / Pull / Legs split, built around progressive overload, RIR (reps in reserve), and a 6-week mesocycle with a built-in deload — the core training fundamentals from *Bigger Leaner Stronger*.

Your account, mesocycle position, working weights, and full workout history are stored in **Firestore** (a free Google database) behind **Firebase Authentication** — so your progress survives a cleared cache, a new phone, or a reinstalled browser, as long as you sign back into the same account.

## Part 1 — Create your free Firebase project

This takes about 10 minutes, once, and it's free for personal use.

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)** and sign in with any Google account.
2. Click **Add project** → give it a name (e.g. `iron-log`) → click through the prompts (you can disable Google Analytics, you don't need it) → **Create project**.
3. In the left sidebar, click **Build → Authentication** → **Get started**.
4. Under **Sign-in method**, enable:
   - **Email/Password** — toggle it on, save.
   - **Google** — toggle it on, pick a support email, save.
5. In the left sidebar, click **Build → Firestore Database** → **Create database**.
   - Choose a location close to you → **Start in production mode** → **Create**.
6. Once created, click the **Rules** tab. Open `firestore.rules` from this folder, replace `YOUR_EMAIL_HERE` with your exact email address (the one you'll sign in with), then paste the whole file into the Rules editor, replacing everything there → **Publish**.

   This does two things: it scopes every read/write to your own account (`request.auth.uid`), and it locks the whole database to one specific email address — so even if someone else finds your app's URL and creates an account, Firestore will refuse every request from it. It also validates the shape of anything being written (correct field names, types, and reasonable ranges), so a malformed or malicious write gets rejected before it ever reaches your data.

7. Now register a web app: click the gear icon next to **Project Overview** → **Project settings** → scroll to **Your apps** → click the **`</>`** (web) icon.
8. Give it a nickname (e.g. `iron-log-web`), skip Firebase Hosting (you're using GitHub Pages), click **Register app**.
9. You'll see a code block with a `firebaseConfig` object containing `apiKey`, `authDomain`, `projectId`, etc. **Copy those values.**
10. Open `firebase-config.js` in this folder and paste your values in, replacing the placeholders. Also set `ALLOWED_EMAIL` to the same exact email address you put in `firestore.rules` in step 6:

    ```js
    const firebaseConfig = {
      apiKey: "your-actual-key",
      authDomain: "your-project.firebaseapp.com",
      projectId: "your-project",
      storageBucket: "your-project.appspot.com",
      messagingSenderId: "your-actual-sender-id",
      appId: "your-actual-app-id"
    };

    const ALLOWED_EMAIL = "your-actual-email@example.com";
    ```

    This client-side check just shows a friendly "this app is private" message — the Firestore rule from step 6 is what actually blocks anyone else's access, even if they bypass the app's JavaScript entirely.

11. Last step: in **Authentication → Settings → Authorized domains**, add your GitHub Pages domain once you know it (e.g. `yourusername.github.io`). `localhost` is already allowed by default, which is handy for testing.

These config values are not secret — they identify your project, they don't grant access on their own. The Firestore rules from step 6 are what actually keep your data private.

## Part 2 — Host it on GitHub Pages

1. Create a new GitHub repository (e.g. `iron-log`).
2. Upload the files in this folder to the repo root — including your edited `firebase-config.js`, and the `icons/` folder. **Do not upload `firestore.rules`** if your repo is public — it has your real email address in it once you've edited it, and it doesn't need to be in the repo at all. It's only ever pasted into the Firebase console (Part 1, step 6), which isn't public. Keep your local copy for whenever you need to update the rules later.
3. In the repo, go to **Settings → Pages**.
4. Under **Source**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
5. Wait a minute, then visit the URL GitHub gives you (something like `https://yourusername.github.io/iron-log/`).
6. Go back to Firebase → Authentication → Settings → Authorized domains, and add that `github.io` domain if you haven't already.

## Security model

A quick summary of what's protecting your data, end to end:

- **Authentication** — every read/write requires a signed-in Firebase user; there's no anonymous or public access path.
- **Single-account allowlist** — Firestore rules check `request.auth.token.email` against your exact address, server-side, on every request. This can't be bypassed from the browser, a modified client, or a direct API call — it's enforced by Firestore itself, not by `app.js`.
- **Per-user isolation** — even if another account existed, rules scope every path to `request.auth.uid`, so accounts can never read or write each other's data.
- **Schema validation** — rules also check field names, types, and ranges on every write (e.g. `week` must be an integer 1–6), rejecting malformed or unexpected data before it's stored.
- **Least privilege** — the app never deletes or edits a finished workout once logged; rules explicitly deny `update`/`delete` on history documents, and deny everything outside the one collection path the app actually uses.
- **No secrets in the client** — the Firebase web config (`firebase-config.js`) is meant to be public; it identifies your project but grants no access on its own. The actual secret-equivalent is your Firestore rules, which live only in the Firebase console.
- **Transport** — GitHub Pages and Firebase are HTTPS-only; there's no path for plaintext credentials or data in transit.
- **PII hygiene** — your email address (in `firestore.rules`) is the one piece of personal data this setup touches; keeping it out of your public repo (above) avoids leaking it for no benefit.

## Part 3 — Install it on your phone

**Android (Chrome):** open the URL → you should see an **Install** banner right on the Home screen, or tap the **⋮** menu → **Install app** / **Add to Home Screen**.
**iPhone (Safari):** open the URL → tap the Share icon → **Add to Home Screen** (iOS doesn't support automatic install prompts for any web app — this manual step is the only way Apple allows it).

Once added, it opens full-screen like a native app and keeps working offline for anything already loaded (a service worker caches the app's files). New data still needs a connection to sync to Firestore.

## How your data works now

- **Sign in** with email/password or Google. Same account on a new device = same data.
- Finished workouts, your mesocycle week, and your working weights are written to Firestore the moment you finish a workout or change a setting.
- The **in-progress** workout (sets you've checked off but haven't tapped "Finish Workout" on yet) is cached locally on that device only, so a refresh mid-session doesn't lose your inputs — but it isn't synced anywhere until you finish. If you want it preserved across devices, finish the session before switching.
- **Reset all data** in Settings clears your local state and starting weights; past history documents remain in Firestore under your account (not shown anymore, but not destructively bulk-deleted from the client either — you can delete them directly in the Firebase console under Firestore Database if you want them fully gone).

## Using the app

1. **Sign up** with email/password or Google on first visit.
2. **Onboarding:** enter your current working weight for each exercise (or skip and fill them in as you go).
3. **Home:** shows your mesocycle progress ring and the next session — tap **Start Workout**.
4. **During a workout:** log weight/reps/RIR per set, tap the checkmark to lock it in — a rest timer pops up sized to that exercise. Tap **Finish Workout** when done.
5. **Progression:** if every set of an exercise hits the top of its rep range, the app bumps the suggested weight for next time automatically.
6. **History:** pick an exercise to see a chart of your top working set over time, plus a log of past sessions.
7. **Settings:** jump to a different mesocycle week, manually edit any working weight, install the app, or sign out.

## Files

```
index.html          markup for every screen, including the login screen
style.css            visual design
app.js               app logic, state, timers, auth UI (ES module)
program.js           the workout program data (exercises, sets, rep ranges, RIR)
firebase.js          thin wrapper around Firebase Auth + Firestore calls
firebase-config.js   YOUR project keys + allowed email go here (see Part 1)
firestore.rules       security rules to paste into the Firebase console (see Part 1, step 6)
manifest.json        PWA install config
service-worker.js    offline caching of the app shell
favicon.ico, icons/  app icons and favicons
```

If you want to change an exercise, swap a machine, or adjust sets/reps, everything lives in `program.js` — it's a plain data structure, no need to touch the app logic.

## Costs

Firebase's free "Spark" plan includes 50K document reads and 20K writes per day on Firestore, and unlimited Authentication users — for one person logging a few workouts a week, you will not come close to those limits.
