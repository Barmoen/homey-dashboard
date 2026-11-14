# Home Panel: a wall dashboard for Homey Pro

A touch dashboard made for an iPad on the wall. It talks **directly to your Homey Pro on your home network**, so no extra server is needed. Changes show up live: when a light turns on anywhere, its tile updates right away.

**What it shows**

A calm home screen you can read from across the room:
- A large clock and date, with weather, inside temperature, power use and who is home in the corner
- One sentence about the house: which lights are on (with a *Turn off* button), plus anything that needs attention, such as an open window, an unlocked door, or water or smoke. Tap an alert to see that device.
- Round scene buttons for your Homey flows. The one that fits the time of day is highlighted (it recognises names like *morning*, *leaving*, *dinner*, *movie* and *night*, in English or Norwegian).
- A row of rooms at the bottom. Rooms with lights on glow, and rooms with an alert get a red edge. Tap a room, or the grid icon for everything, to slide up its devices: tap a tile to toggle it, **hold** it for brightness, thermostat, blinds and sensor details.
- Open panels close by themselves after a minute without touches, so the panel always falls back to the calm view.
- A screensaver clock after a few minutes idle, which goes very dark during night hours
- Reloads itself every night at 04:00, so it keeps running for weeks

---

## 1. Create an API key on Homey

1. Open **https://my.homey.app** on a computer → choose your Homey → **Settings → API Keys → New API Key**.
2. Name it `Wall iPad` and give it these permissions:

   | Permission | Used for |
   |---|---|
   | Devices: view (`homey.device.readonly`) | showing devices |
   | Devices: control (`homey.device.control`) | switching and dimming |
   | Zones: view (`homey.zone.readonly`) | grouping by room |
   | Flows: view (`homey.flow.readonly`) | listing scenes |
   | Flows: start (`homey.flow.start`) | scene buttons |
   | Users: view (`homey.user.readonly`) | who is home (optional) |
   | Geolocation: view (`homey.geolocation.readonly`) | weather (optional) |

3. Copy the key. You'll paste it on the iPad later. **Don't put it in any file.**

Also note your Homey's IP address (Homey app → Settings → General → Network, or your router's device list). Give the Homey a **fixed IP (a DHCP reservation)** in your router so it never changes.

## 2. Put the dashboard online (free, GitHub Pages)

The iPad needs to load the page from somewhere. GitHub Pages is free and fine for this. The files contain no secrets: the API key is only ever stored on the iPad.

1. Create a free account at github.com, then **New repository** → name it e.g. `home-panel`. It can be Public. Private repos need a paid plan for Pages.
2. **Add file → Upload files** → drag in *everything inside this folder* (`index.html`, `app.js`, `demo.js`, `styles.css`, `manifest.webmanifest`, `icon.svg`, `icon-180.png`, and the `vendor` folder) → **Commit**.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / `(root)` → Save.
4. After a minute, the page is live at `https://<your-username>.github.io/home-panel/`.

> **About HTTPS:** GitHub Pages is HTTPS, so the dashboard reaches Homey through Homey's own secure local address, `https://192-168-1-50.homey.homeylocal.com` (your IP with dashes). It works this out for you from the IP. The traffic still stays inside your home. Only the name lookup uses the internet.

Other free static hosts (Netlify, Cloudflare Pages) work the same way.

## 3. Set up the iPad

1. Open the GitHub Pages URL in **Safari** → **Share → Add to Home Screen** → Add.
2. Open **Home Panel** from the Home Screen. It runs full-screen without Safari's bars.
3. **Hold the gear icon (top right) for 1 second** → enter the Homey IP and paste the API key → **Connect**.
   - The Home Screen app has its own storage, separate from Safari, so do this step inside the Home Screen app.
4. In the same settings screen, pick your scene buttons and which devices to show → **Done**.
5. Kiosk settings on the iPad:
   - **Settings → Display & Brightness → Auto-Lock → Never**
   - **Settings → Accessibility → Guided Access → On** (set a passcode). Open Home Panel and **triple-click the Home button → Start**. The iPad now stays on the dashboard. Triple-click and enter the code to leave.
   - Turn on a **Focus / Do Not Disturb** mode so notifications don't pop up.
   - Turn off **Settings → General → Software Update → Automatic Updates** if you don't want it restarting on its own.

**Tip, battery health:** an iPad charging 24/7 can wear out or swell its battery. Plug the charger into a **Homey-controlled smart plug** and make a flow that turns it on for ~3 hours, twice a day.

## Try it first: demo mode

Open the page, hold the gear, tap **Try demo mode**. You get sample rooms and devices to explore without a Homey.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Could not reach Homey" | iPad and Homey must be on the same network. Check the IP. In Safari, open `https://<ip-with-dashes>.homey.homeylocal.com/api/manager/system/ping`: it should return a short reply. |
| "Homey refused the API key" | The key was copied incompletely, or it is missing a permission from the table above. |
| Red pulsing dot (top right) | The live connection dropped. It reconnects by itself, and values are re-checked every 2 minutes anyway. |
| A device doesn't appear | Hold gear → tick it under *Devices on the dashboard*. |
| A flow isn't in the scene list | The flow must start with the **"This flow is started"** trigger card (Advanced flows: the *Start* card). |
| Changed the IP, or want to start over | Hold gear → change the IP and tap Connect, or use **Reset everything**. |

## Files

```
index.html            page layout
styles.css            look and feel (colors at the top in :root)
app.js                dashboard logic, settings, Homey connection
demo.js               fake devices for demo mode
vendor/homey-api.min.js   Athom's official homey-api library (v3.21.3), bundled for the browser
manifest.webmanifest, icon.svg, icon-180.png   Home Screen app icon/name
```

**Customising:** colors are CSS variables at the top of `styles.css`. Which capabilities show on a tile is decided in `describe()` in `app.js`. After editing, upload the changed files to GitHub again. The iPad picks them up on the next reload, or at 04:00.

**Rebuilding the Homey library** (only needed to update it):
```bash
npm i homey-api esbuild
echo "require('homey-api/lib/HomeyAPI/HomeyAPIV3Local'); window.HomeyAPI = require('homey-api/lib/HomeyAPI/HomeyAPI');" > entry.js
echo "module.exports = window.FormData;" > stub-formdata.js
echo "module.exports = function () { return window.fetch.apply(window, arguments); };" > stub-fetch.js
npx esbuild entry.js --bundle --minify --platform=browser --target=safari15 --define:global=window \
  --alias:form-data=./stub-formdata.js --alias:node-fetch=./stub-fetch.js --legal-comments=eof \
  --outfile=vendor/homey-api.min.js
```

**Publishing changes:** bump the `?v=` number on the `styles.css`, `demo.js` and `app.js` links in `index.html` whenever you change those files, so the iPad fetches the new versions instead of cached ones.
