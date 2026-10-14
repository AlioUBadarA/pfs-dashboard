# PFS Sales Training · Impact Dashboard (website)

A public, read-only web page that shows the PFS sales training dashboard with working
**Country** and **Session format** filters. Nobody needs a Google account to view it.

```
Google Form  ->  Google Sheet (answers, attendance)  ->  Apps Script web app (JSON, aggregated only)  ->  this website (GitHub Pages)
```

The website holds no data. Every visit asks the Apps Script web app for the figures of the
selected country and format. The web app computes them from the live Google Sheet with the
same code as the sheet dashboard, so the site and the sheet always show the same numbers.
Only aggregated figures leave the spreadsheet: no participant name is ever sent.

## 1. Publish the Apps Script web app (once)

1. Open the Google Sheet, then Extensions > Apps Script.
2. Make sure the project contains `Api.gs` and the latest `Main.gs`.
3. Deploy > New deployment > gear icon > **Web app**.
   - Description: `PFS dashboard API`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click Deploy, authorise when asked, then copy the **Web app URL** (it ends with `/exec`).

Test it: open the URL in a private browser window. You should see text starting with `{"ok":true`.

When you change the Apps Script code later: Deploy > Manage deployments > pencil icon >
Version: **New version** > Deploy. The URL stays the same.

## 2. Put the website on GitHub Pages

1. Create a repository on GitHub (for example `pfs-dashboard`), public.
2. Upload every file of this folder (`index.html`, `README.md`, the `assets` folder).
3. Edit `assets/config.js` and paste the Web app URL between the quotes:
   ```js
   API_URL: 'https://script.google.com/macros/s/XXXXXXXX/exec'
   ```
4. Settings > Pages > Source: **Deploy from a branch**, Branch: `main`, folder `/ (root)` > Save.
5. After about a minute the site is live at `https://<your-github-name>.github.io/pfs-dashboard/`.

## 3. Everyday use

- New form answers update the site automatically (the web app cache is cleared every time
  the sheet dashboard is rebuilt, and in any case after 10 minutes).
- Filters can be shared as links, for example
  `.../pfs-dashboard/?country=Senegal&format=In%20person`.
- Session format corrections (Online, In person, Both) are made in the `Participants` sheet,
  then menu PFS Dashboard > Refresh now.

## Files

| File | Role |
| --- | --- |
| `index.html` | Page structure |
| `assets/style.css` | Layout and PFS / Oo2 colours, mobile friendly |
| `assets/app.js` | Loads the figures, draws the cards, tables and charts (Chart.js) |
| `assets/config.js` | The only setting: the web app URL |
| `assets/logo-pfs.png`, `assets/logo-oo2.png` | Logos |

## If the page says the figures could not be loaded

- Check that `assets/config.js` contains the full URL ending with `/exec`.
- Open that URL in a private window: it must show `{"ok":true ...}`. If Google asks you to
  sign in, the deployment is not set to "Who has access: Anyone".
- If it shows `{"ok":false,"error":...}`, the message says which sheet or column is missing.
