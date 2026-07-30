# CIA Bucks

A prize wheel for the Top Farmers Agent team. Members sign in with their work Google
account, **log their daily stats to earn spins**, then spin for $5, $10 or $20 in CIA Bucks
that land in a bank they can watch grow. Members can also earn **Home Run Award baseballs**,
handed out by an admin — 3 baseballs equal $2,500 toward an experience. Admins can move
bucks and baseballs, add other admins, tune the odds, and review everyone's stats.

- **Front end** — plain HTML/CSS/JS on GitHub Pages (`index.html` for members,
  `admin.html` and `transactions.html` for admins).
- **Back end** — a Google Apps Script web app bound to the spreadsheet.
- **Database** — a Google Sheet with five tabs: `Users`, `Admins`, `Ledger`, `Stats`, `Config`.

## Roles

Roles are managed from the **Roles** panel on the Admin page. Each person has one role (or
none). Assign a role by entering an email and picking one — it works whether or not they've
signed in yet, and re-assigning changes an existing person's role.

- **Member** (no role) — signs in, logs their own transfers and OCCs, spins.
- **SDR** — same as a member: logs their own transfers and OCCs to earn spins.
- **Sales** / **Service** — do **not** log their own stats. A Team Lead or Admin assigns
  their transfers (and OCCs), which grant spins by the usual rule. Their wheel page shows a
  "your transfers are assigned for you" note instead of the stat-entry card.
- **Team Lead** — logs their own stats and spins, plus a **Your team** panel and an
  **Assign transfers** panel on the wheel page: re-log a teammate, or post transfers/OCCs to
  Sales and Service people.
- **Admin** — full access to the Admin and Transactions pages, and everything a lead can do.

The owner (`cody@insurancesaleslab.com`) is always an admin and can't be removed. Anyone with
a role can sign in regardless of domain. Roles live in the **Roles** tab of the spreadsheet.

Assigning transfers is separate from a member's own once-a-day self-log — a lead can post to
someone as often as needed, and it never uses up that person's daily entry. Every assignment
is recorded in the `Stats` tab and the `Ledger`, stamped with who assigned it.

## Awards: baseballs and MVP

Two separate hand-granted honors sit on the member's bank slip, both distinct from CIA Bucks
(which are the wheel currency in their bank balance):

- **Baseballs (Home Run Awards)** — shown as baseball icons, grouped in threes with each
  completed trio boxed together. Every 3 baseballs is $2,500 toward an experience.
- **MVP awards** — shown as trophy icons. Each MVP is worth $300 toward an experience.

Admins grant either one by hand from the **Award baseballs** / **Award MVP** panels on the
Admin page, or from the **Transactions** page. Neither touches the bucks balance; the dollar
values are honoured however you decide to honour them.

## Earning spins

There are no free spins and no timed spins. Spins are earned only by logging stats, once
per calendar day:

- **Transfers** — reaching the threshold (default 20) earns 1 spin, then +1 per transfer
  above it. So 20 transfers is 1 spin, 23 is 4 spins, 19 is none.
- **OCCs** (One-Call-Closes) — each one earns 1 spin.

A day's spins are added to the member's balance of available spins, which the wheel then
spends down one at a time. The transfer threshold and the spins-per-OCC are both adjustable
in the admin settings.

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
   permissions prompt. This creates the five tabs and seeds `cody@insurancesaleslab.com`
   as the first admin.

> **Upgrading an existing sheet?** The `Users` tab keeps gaining columns as features are
> added (earned spins, stats, and now a `Baseballs` column in column K). `setupSpreadsheet`
> only creates missing *tabs* — it will not add a missing *column* to an existing `Users`
> tab, and the code will error if the column isn't there. The simplest path before launch is
> to delete the `Users`, `Ledger`, `Stats` and `Config` tabs (or start a brand new
> spreadsheet) and run `setupSpreadsheet` again. If you have real data to keep, instead add
> the missing headers by hand — `Baseballs` in cell **K1** and `MVP` in cell **L1** of the
> `Users` tab — then redeploy.
>
> The old `Admins` tab is now a `Roles` tab (Email, Role, AddedBy, AddedAt). Running
> `setupSpreadsheet` creates `Roles` and, if an old `Admins` tab exists, copies those emails
> over as admins automatically. You can safely delete the leftover `Admins` tab afterward.

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

**Spins are earned, never free.** A member logs transfers and OCCs once per day, and those
convert to spins by the rules above. The wheel is disabled until they have spins to spend.
If someone fat-fingers their numbers, an admin can hit **Re-log** next to their name in the
Members table to let them enter the day again — spins already earned that day stay put.

**Spinning many at once.** When a member has more than 10 spins ready, a **Spin all** button
appears next to the wheel. It spins the whole balance in one server-side batch and shows the
breakdown (e.g. "14 spins → $145 in CIA Bucks! (6×$5, 5×$10, 3×$20)"). Single spins still
work one at a time below that.

**Sound and confetti.** Spins play a decelerating tick and wins play a rising chime, both
synthesized in the browser (no audio files, so nothing extra to host). A **Sound on/off**
toggle under the wheel mutes them, remembered per device. Every win throws confetti; the
amount is set by the admin **Confetti intensity (0–100)** setting — 0 is off, 100 is
deliberately excessive. Big and multi-spin wins scale the burst up automatically. Members
with reduced-motion enabled in their OS get a gentle amount regardless.

**Moving bucks and baseballs.** The **Transactions** page (`transactions.html`, admin only,
linked from the header) is the dedicated place to add or remove CIA Bucks and award or take
back baseballs. Positive amounts add, negative amounts remove, and every move is logged with
your name and reason in a combined transaction log. The Admin page still has a quick bucks
adjuster, but the Transactions page is the full record and the only place baseballs are set.

**The odds.** Weights, not percentages — `60 / 30 / 10` means $5 shows up six times as often
as $20. The admin panel shows the resulting percentages and the average payout per spin as
you type. The wheel's eight visible segments are decoration; only the weights matter.

**Pausing.** Switch **Spinning** to *Paused* in admin settings to freeze the wheel program-wide
(stats can still be logged; the spins just bank up until you reopen it).

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
