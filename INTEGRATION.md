# Keeping SENTINEL Control Centre Live

The GitHub Pages site is static. To make it update automatically, SENTINEL / n8n only needs to update one file:

`data/sentinel-data.json`

## Recommended architecture

```text
Daily station files / source data
          ↓
       SENTINEL
          ↓
Extract → Validate → Reconcile → Generate
          ↓
Google Drive output workbooks
          ↓
Update data/sentinel-data.json in GitHub
          ↓
GitHub Pages control centre refreshes automatically
```

## Recommended n8n step after a successful SENTINEL run

After the existing output-generation and Google Drive steps succeed:

1. Read the current `data/sentinel-data.json` from the GitHub repository.
2. Update:
   - `meta.latestDataDate`
   - `meta.latestFileModifiedAt`
   - the active month's `coverage.PSS1` / `coverage.PSS2`
   - latest validation figures
   - workbook metadata if a new monthly workbook is created
3. Commit the new JSON back to the repository using the GitHub API / GitHub node.
4. GitHub Pages will serve the updated JSON on the next page refresh.

## Important evidence rule

Only mark a day as verified **after the dated station record exists in the generated monthly workbook**. Do not increment coverage merely because the workflow was triggered.

This keeps the control centre defensible: it proves the actual output exists, not just that a workflow ran.

## Suggested JSON update logic

For each station:

```text
if monthly_report_contains(target_date):
    coverage[station] = max(coverage[station], day_of_month(target_date))
```

For Cost of Sales:

```text
if debit_total == credit_total:
    latestValidation.difference = 0
    latestValidation.status = "validated"
else:
    latestValidation.difference = debit_total - credit_total
    latestValidation.status = "exception"
```

## GitHub credential approach

Use a GitHub fine-grained token with the minimum repository permission required to update repository contents. Store it in n8n Credentials; do not hard-code it in this package or in browser-side JavaScript.

## Why the JSON is separate

Keeping evidence in a standalone JSON manifest means:

- no rebuild framework is required;
- GitHub Pages remains simple static hosting;
- n8n updates only one small file;
- management screenshots always reflect the latest evidence after refresh;
- the source workbooks remain in Google Drive and can be opened directly from the page.
