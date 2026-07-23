# CIA Bucks

A prize wheel for the Top Farmers Agent team. Members sign in with their work Google
account, spin for $5, $10 or $20 in CIA Bucks, and the balance lands in a bank they can
watch grow. Admins can adjust balances, add other admins, and tune the odds.

- **Front end** — plain HTML/CSS/JS on GitHub Pages.
- **Back end** — a Google Apps Script web app bound to the spreadsheet.
- **Database** — a Google Sheet with four tabs: `Users`, `Admins`, `Ledger`, `Config`.

## Why there's a back end

GitHub Pages only serves files; it can't write to a Sheet, and it can't keep a secret.
The Apps Script web app does three things the browser can't be trusted with:

1. **Verifies the Google login** against Google's token endpoint, so nobody can forge an identity.
2. **Picks the prize itself.** The wheel animation just follows the answer. Someone opening
   devtools can't award themselves $20 a hundred times.
3. **Enforces the domain rule and the spin cooldown** before writing anything.

---

## Setup

### 1. The spreadsheet

1. Create a new Google Sheet. Name it `CIA Bucks`.
2. **Extensions → Apps Script.**
3. Delete the starter code, paste in everything from `apps-script/Code.gs`, save.
4. In the function dropdown pick `setupSpreadsheet`, click **Run**, and approve the
   permissions prompt. This creates the four tabs and seeds `cody@insurancesaleslab.com`
   as the first admin.

### 2. The OAuth client ID

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create a project
   (or reuse one).
2. **APIs & Services → OAuth consent screen.** Choose **Internal** if the Google Workspace
   account you're signed in as owns `topfarmersagent.com` — that alone blocks outside
   accounts. Otherwise choose **External** and publish it; the domain rule in the code
   still holds the line.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.**
4. Under **Authorised JavaScript origins**, add your Pages origin and, if you want to test
   locally, your local one:
   - `https://YOUR-GITHUB-USERNAME.github.io`
   - `http://localhost:8000`
   
   Origins only — no paths, no trailing slash.
5. Copy the client ID.

### 3. Connect the two

1. Back in Apps Script: **Project Settings → Script Properties → Add script property.**
   - Property: `GOOGLE_CLIENT_ID`
   - Value: the client ID you just copied
2. **Deploy → New deployment → Web app.**
   - Description: `CIA Bucks API`
   - Execute as: **Me**
   - Who has access: **Anyone**
3. Copy the `/exec` web app URL.

> Every time you edit `Code.gs`, use **Deploy → Manage deployments → edit → Version: New version.**
> Creating a brand new deployment gives you a different URL.

### 4. Publish the site

1. Open `assets/config.js` and fill in `GOOGLE_CLIENT_ID` and `API_URL`.
2. Push this folder's contents to the repo root on the `main` branch.
3. **Settings → Pages → Source: Deploy from a branch → main / (root).**
4. Visit `https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPO/` and sign in.

The first person to sign in gets a row in `Users` automatically. Open `/admin.html` with
Cody's account to reach the admin area — the link also appears in the header for admins.

---

## How the pieces behave

**Who can get in.** Anyone with a `@topfarmersagent.com` address, plus anyone listed on the
`Admins` tab. That second rule is what lets `cody@insurancesaleslab.com` in from a different
domain. To change the member domain later, use **Allowed domain** in the admin settings.

**The odds.** Weights, not percentages — `60 / 30 / 10` means $5 shows up six times as often
as $20. The admin panel shows the resulting percentages and the average payout per spin as
you type. The wheel's eight visible segments are decoration; only the weights matter.

**Spin cooldown.** Defaults to 24 hours per person. Set it to "No wait" for a live event,
then switch **Spinning** to *Paused* when the event is over.

**The ledger.** Every spin, credit, debit, admin change and settings change is appended to
the `Ledger` tab with a timestamp and who did it. Nothing is edited in place, so the sheet
doubles as an audit trail.

## Things worth knowing

- Login sessions last about an hour, after which the page asks for a fresh sign-in.
- Apps Script allows roughly 20,000 URL fetches a day on a free Workspace account. One spin
  is one fetch, so a team-sized program has plenty of headroom.
- Balances are whole dollars. If you want cents, change the `Balance` column format and drop
  the rounding in `setBalance`.
- Nobody can pay out real money from this app; a CIA Buck is a number in a spreadsheet that
  you honour however you've decided to honour it.

## Local preview

```bash
cd cia-bucks
python3 -m http.server 8000
```

Then open `http://localhost:8000` — as long as `http://localhost:8000` is listed as an
authorised JavaScript origin on the OAuth client.
