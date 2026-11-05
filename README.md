# Kitty Pomodoro

A small, calm Pomodoro timer for Chrome, in soft pink pixel art, with a little kitty keeping you company.

![Kitty Pomodoro screenshots](docs/overview.png)

> An unofficial fan project, not affiliated with or endorsed by Sanrio. The pixel art is hand-built from code.

## What it does

- Focus, short break and long break timers (25 / 5 / 15 minutes by default)
- Keeps counting with the popup closed, and shows the minutes left on the toolbar icon
- A notification and a soft chime when a session ends
- A segmented pixel progress bar, and four hearts that fill up before each long break
- A sticky note for what you're working on, and a quiet count of today's sessions

Settings are deliberately tiny: the three durations, and sound on or off.

## The kitty

She's a pixel sprite generated in code (`shared/sprite.js`), and every animation moves in whole pixels:

- blinks, twitches her ears and wiggles her bow now and then
- her eyes follow your cursor
- taps the card with her paws while you focus
- floats little hearts on breaks, and naps with a "z" when you pause
- hops and sparkles when you finish a session (and hops if you poke her)

Keyboard: `Space` starts or pauses, the arrow keys switch modes. All motion turns off with `prefers-reduced-motion`.

## Install

1. Clone the repo: `git clone https://github.com/julianthant/hello-kitty-pomodoro.git`
2. Open `chrome://extensions` and turn on **Developer mode**
3. Click **Load unpacked** and pick the repo folder
4. Pin the kitty icon to your toolbar

Needs Chrome 116 or newer.

## How it works

| File | Purpose |
| --- | --- |
| `background.js` | Service worker. Owns the timer, alarms, badge and notifications |
| `popup/` | The popup UI |
| `shared/sprite.js` | The pixel kitty, icons and digit font, all drawn from small grids |
| `offscreen.js` | Plays the chime while the popup is closed (Manifest V3 offscreen document) |
| `shared/chime.js` | A Web Audio music-box chime (no audio files) |
| `scripts/make-icons.mjs` | Regenerates the toolbar icons from the sprite |
| `scripts/package.sh` | Builds `dist/kitty-pomodoro.zip` for the Chrome Web Store |

The timer stores an absolute end time, so it stays accurate even if Chrome puts the service worker to sleep or you restart the browser. Nothing leaves your machine. Permissions: `storage`, `alarms`, `notifications`, `offscreen`.

## Credits

- Font: [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans), under the SIL Open Font License (see `fonts/`)
- Design and motion restraint informed by [emilkowalski/skills](https://github.com/emilkowalski/skills) and [leonxlnx/taste-skill](https://github.com/leonxlnx/taste-skill)

## License

MIT. See [LICENSE](LICENSE).
