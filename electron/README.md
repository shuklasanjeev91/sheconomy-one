# SHEconomy Desktop (Electron / Windows)

Wraps the SHEconomy web app in a native desktop window.

## Development

1. Start the web app: `yarn dev`
2. Launch Electron: `yarn desktop:dev`

By default Electron loads `http://localhost:8081`. Override with:

```bash
SHECONOMY_DESKTOP_URL=https://your-deployed-app.example yarn desktop:dev
```

## Windows installer

Cross-build an NSIS `.exe` from macOS:

```bash
yarn desktop:build:win
```

Output lands in `dist-desktop/`.

For production packaging, point Electron at your deployed URL:

```bash
SHECONOMY_DESKTOP_URL=https://app.sheconomy.com yarn desktop:build:win
```
