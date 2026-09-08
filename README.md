# SENTINEL Automation Control Centre

A static, screenshot-friendly GitHub Pages control centre designed to show **operational proof** that SENTINEL is producing repeatable retail and finance outputs from July 2026 onward.

## What is included

- `index.html` — control centre page
- `styles.css` — MRANTI-style white / navy presentation design
- `app.js` — renders coverage, validation, archive, filters, audit trail and CSV export
- `data/sentinel-data.json` — evidence manifest used by the page
- `assets/favicon.svg` — SENTINEL favicon
- `INTEGRATION.md` — how to keep the JSON manifest updated from n8n / GitHub
- `.nojekyll` — keeps GitHub Pages deployment simple

## Current evidence snapshot

The packaged JSON is pre-populated with the actual July, August and September 2026 Google Drive output workbooks for PSS 1 and PSS 2, plus the latest 07 Sep 2026 Cost of Sales reconciliation values.

The page deliberately distinguishes **daily evidence coverage** from exact automation execution timestamps. Daily coverage means a dated station record exists inside the automated monthly report workbook. File update timestamps are Google Drive metadata.

## Deploy to GitHub Pages

1. Create a new GitHub repository, e.g. `sentinel-control-centre`.
2. Upload **all files and folders from this package to the repository root**.
3. Commit to `main`.
4. Open **Settings → Pages**.
5. Under **Build and deployment**, select **Deploy from a branch**.
6. Choose **main** and **/ (root)**, then Save.
7. GitHub will publish the site at a URL similar to:
   `https://<username>.github.io/sentinel-control-centre/`

## Screenshot / presentation use

- Open the live GitHub Pages URL.
- Click **Presentation view** to reduce navigation clutter.
- Capture the top + coverage + validation area for a management slide.
- Use **Open source folder** or any workbook link when presenting live to trace evidence back to Google Drive.

## Updating the evidence manually

Edit `data/sentinel-data.json` only. The HTML and JS do not need to change when a new day or month is added.

For September, increase:

```json
"coverage": {"PSS1": 8, "PSS2": 8}
```

when the 08 Sep dated records are present, then update `latestDataDate`, workbook timestamps and latest validation figures as required.

For automated updates from n8n, see `INTEGRATION.md`.


## Branding / browser tab
The package includes the same favicon treatment used in the MRANTI Staff Directory: a blue square with a white **T** mark. The browser tab uses local multi-size favicon assets under `public/`, and the same T mark appears beside SENTINEL in the page header.

Files:
- `public/favicon-16.png`
- `public/favicon-32.png`
- `public/favicon-512.png`
- `public/favicon.ico`
- `public/apple-touch-icon.png`
- `public/t-logo.svg`
