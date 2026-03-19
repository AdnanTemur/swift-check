# SwiftCheck — Browser Speed Test Extension

A free, open-source Chrome extension that tests your internet speed directly in the browser. No websites to visit, no accounts, no tracking.

![Version](https://img.shields.io/badge/version-1.2.0-4ade80?style=flat-square) ![Manifest](https://img.shields.io/badge/manifest-v3-2dd4bf?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-86efac?style=flat-square)

---

## Why SwiftCheck?

Most speed test tools report speeds in **Mbps** (megabits). When you download a file, your OS shows **MB/s** (megabytes). This gap causes constant confusion — people see "10 Mbps" on a speed test and wonder why their downloads only show 1.2 MB/s in the browser.

SwiftCheck reports everything in **MB/s** — the same unit your file manager, browser downloads, and torrent clients use. What you see is exactly what you get.

```
10 Mbps  =  1.25 MB/s   ← SwiftCheck shows 1.25
100 Mbps =  12.5 MB/s   ← SwiftCheck shows 12.5
1 Gbps   =  125 MB/s    ← SwiftCheck shows 125
```

---

## Features

- **MB/s display** — real megabytes, not megabits
- **Live animated speedometer** — needle fluctuates like a real analog meter during the test
- **Dynamic dial scale** — probes your speed first, then sets the ceiling to match your line. A 1 MB/s connection gets a 0–3 scale with full needle travel; a 50 MB/s connection gets 0–100
- **Hardware-level timing** — uses `PerformanceResourceTiming` (browser network stack) not JS wall clock, so measurements reflect actual bytes-on-wire throughput
- **Adaptive test size** — downloads just enough data to get an accurate reading (~3 seconds worth), not a fixed large file
- **Persistent results** — last test result survives popup close/reopen with a timestamp
- **Light / dark theme** — toggle in the header, preference saved across sessions
- **Zero tracking** — no analytics, no data collection, no accounts. One outbound host: `speed.cloudflare.com`

---

## How It Works

### Measurement method

```
1. Warmup fetch (1 KB)      → opens TCP/TLS connection
2. Probe fetch   (256 KB)   → estimates your speed
3. Set dial ceiling         → ceiling = probe × 2, rounded to clean step
4. Main fetch    (adaptive) → sized to ~3 seconds at probed speed
5. Confirm fetch (same)     → second sample for accuracy
6. Report median            → of probe + main + confirm
```

Download throughput is calculated using browser-native timing:

```js
// responseStart → responseEnd is measured by the browser network stack
// at the OS/NIC level — not affected by JS execution overhead
const transferMs = entry.responseEnd - entry.responseStart;
const mbPerSec = entry.transferSize / (transferMs / 1000) / 1_000_000;
```

Upload uses wall-clock timing against `speed.cloudflare.com/__up` with small payloads (200 KB → 500 KB → 1 MB) for speed.

### Live needle animation

A `requestAnimationFrame` loop runs at 60fps during the test. The needle position is driven by smooth noise (sum of sine waves at irrational frequencies) layered over the live reading, giving it the feel of a real analog meter reacting to line variance. The loop stops and the needle settles smoothly to the final value when the test completes.

---

## Installation (Developer Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the repository folder

The extension icon will appear in your toolbar.

---

## File Structure

```
swiftcheck/
├── manifest.json     # Chrome extension manifest (MV3)
├── popup.html        # UI — glassmorphism layout, SVG speedometer, CSS variables
├── popup.js          # All logic — measurement, jitter engine, theme, persistence
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

No build step. No dependencies. No npm. Edit and reload.

---

## Modifying

### Changing the color theme

All colors are CSS variables at the top of `popup.html`:

```css
:root {
  --a: #4ade80; /* primary accent  */
  --a2: #86efac; /* secondary accent */
  --a3: #2dd4bf; /* teal accent */
  --a4: #bef264; /* lime accent */
  --bg: #030a06; /* background */
  /* ... */
}
html.light {
  /* light theme overrides */
}
```

Change `--a` / `--a2` / `--a3` and the orb colors (`--orb1` through `--orb4`) to retheme the entire extension.

### Changing the test server

The extension currently uses Cloudflare's speed test infrastructure. To use a different server, replace the fetch URLs in `popup.js`:

```js
const BASE = "https://speed.cloudflare.com/__down";
// upload endpoint:
("https://speed.cloudflare.com/__up");
```

Any server that returns raw bytes on GET and accepts POST bodies will work. Update `host_permissions` in `manifest.json` accordingly.

### Adjusting dial ceiling steps

The dynamic ceiling snaps to one of these clean values (in MB/s):

```js
[1, 2, 3, 5, 8, 10, 15, 20, 30, 50, 75, 100, 125, 200];
```

Edit the `pickCeiling()` function in `popup.js` to add or change steps.

### Adjusting jitter intensity

In `popup.js`, the `startJitter()` function controls wobble amplitude:

```js
const amplitude = Math.max(dialCeiling * 0.06, 0.05);
```

Increase `0.06` for more dramatic needle movement, decrease for calmer behavior. The `0.05` floor keeps a tiny flicker even on near-zero readings.

---

## Permissions

| Permission                       | Why                                                      |
| -------------------------------- | -------------------------------------------------------- |
| `storage`                        | Save last result and theme preference across popup opens |
| `https://speed.cloudflare.com/*` | Download and upload test traffic                         |

No other permissions. No broad host access.

---

## Privacy

SwiftCheck makes fetch requests only to `speed.cloudflare.com` during a test. These requests are indistinguishable from normal browser traffic to that domain. No user data, IP addresses, or results are sent anywhere. Everything is computed locally and stored in `chrome.storage.local` on your own device.

---

## Contributing

Pull requests welcome. A few things to keep in mind:

- No build tooling — keep it plain HTML/CSS/JS, loadable directly as an unpacked extension
- No external libraries — the point is a self-contained, auditable codebase
- MB/s stays MB/s — do not add Mbps display, it defeats the purpose

---

## License

MIT — do whatever you want, just keep the attribution.

---

## Credits

Built with [Cloudflare Speed Test infrastructure](https://speed.cloudflare.com) for the test endpoints.  
Fonts: [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed), [Inter](https://fonts.google.com/specimen/Inter), [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) via Google Fonts.
