# DEPLOY-CPANEL.md — Run NutriClinic (SQLite port) on cPanel Node.js hosting

> Plain-language guide. No PostgreSQL needed: the database is a single SQLite file.
> Time needed the first time: about 30–60 minutes on your PC + host.

---

## English guide

### 0. What you need
- A cPanel account with **"Setup Node.js App"** (CloudLinux Node.js Selector) offering
  **Node.js 20.9 or newer** (20 or 22 is fine). Check this first — Next.js 16 will not
  run on Node 18.
- Terminal access on your own PC (Mac/Linux terminal or Windows PowerShell).
- Your app files (this folder) on your PC.

### 1. Build on YOUR computer (never on the shared host)
```bash
npm install
npm run test        # 33 tests must pass
npm run build       # creates .next/
```

### 2. Upload to the host
Using cPanel **File Manager** or SFTP, upload these into a folder OUTSIDE
`public_html`, e.g. `/home/YOURUSER/nutriclinic/`:

- `.next/` (the build output)
- `package.json` and `package-lock.json`
- `server.js`, `next.config.ts`, `drizzle.config.json`, `postcss.config.mjs`,
  `eslint.config.mjs`, `tsconfig.json`, `next-env.d.ts`
- `public/` (if present), `src/`, `shared/`, `server/`, `data/`
- `seed-data.json`
- `node_modules/` **only if** your host blocks outbound downloads (see step 3)

### 3. Install production dependencies on the host
In cPanel → **Terminal** (or the Node.js App "Run NPM Install" button):
```bash
cd ~/nutriclinic
npm ci --omit=dev
```
`better-sqlite3` ships prebuilt binaries for Node 20/22 on Linux — no compiler needed.
If the install fails because the host blocks downloads, upload your local
`node_modules/` instead (zip it, upload, unzip).

### 4. Create the Node.js app in cPanel
cPanel → **Setup Node.js App**:
- Node.js version: the newest 20.x or 22.x available
- Application mode: **Production**
- Application root: `nutriclinic`
- Application URL: your subdomain/domain
- Application startup file: **`server.js`**

Then click **Run NPM Install** (or use Terminal as in step 3).

### 5. Set environment variables (same screen, "Environment variables")
| Name | Value | Why |
|---|---|---|
| `SQLITE_DB_PATH` | `/home/YOURUSER/dietdata/diet.sqlite` | Keeps the database **outside any web-served folder** so it can never be downloaded. The `dietdata` folder is created automatically. |
| `ALLOW_UNSAFE_DEMO` | `true` — **only for the private demo phase** | Without it, the app deliberately shows 503 in production. This flag is NOT authentication: while it is on, anyone who can open the URL can use the demo logins. |
| `NEXT_TELEMETRY_DISABLED` | `1` | Optional |

Click **Restart**.

### 6. Protect the demo phase (important)
While real authentication is not implemented (P0 items in the project roadmap):
1. Put HTTP basic auth on the app URL. In cPanel → **Directory Privacy** pick the
   document root of the Application URL domain and require a user/password.
   (Alternatively add basic-auth rules to that domain's `.htaccess`.)
2. Use only synthetic data. Do not enter real patient information.
3. When the P0 auth work is done, remove `ALLOW_UNSAFE_DEMO` and restart — the 503
   lock then protects you until real login is live.

### 7. Backups (SQLite makes this easy)
The whole database is one file. In cPanel → **Cron Jobs** add a daily job:
```
0 3 * * * sqlite3 /home/YOURUSER/dietdata/diet.sqlite ".backup /home/YOURUSER/backups/diet-$(date +\%F).sqlite"
```
(If `sqlite3` CLI is not installed, ask the host; otherwise a plain file copy of
`diet.sqlite` while the app is stopped is also a valid backup. Keep several days
and download copies to your PC now and then. WAL files `-wal`/`-shm` next to the DB
are normal; back up the main file with the `.backup` command above, not a raw copy
while running.)

### 8. Update later
On your PC: `git pull` (or copy changed files) → `npm install` → `npm run test` →
`npm run build` → upload `.next/` and changed files → cPanel **Restart**.
Your SQLite file is not touched by redeploys.

### 9. Quick verification checklist
- [ ] `https://your-url/api/health` returns `{"ok":true}`
- [ ] Home page opens; patient login with any phone works (demo mode)
- [ ] Staff login: `consultant / Diet@1405`, `admin / Admin@1405` (demo accounts)
- [ ] Generating a regimen produces a tracking code and a printable plan
- [ ] `/calories` opens and a food page opens from it
- [ ] With `ALLOW_UNSAFE_DEMO` removed, everything returns 503 (lock works)

---

## راهنمای سریع فارسی

۱. **روی کامپیوتر خودتان** (نه روی هاست): `npm install` سپس `npm run test` (۳۳ تست سبز)
   و بعد `npm run build`.
۲. با فایل منیجر یا FTP پوشه‌ای بیرون از `public_html` بسازید (مثلاً `~/nutriclinic`)
   و این‌ها را آپلود کنید: `.next`، `package.json`، `package-lock.json`، `server.js`،
   `next.config.ts`، `tsconfig.json`، پوشه‌های `src` و `shared` و `server` و `data`،
   فایل `seed-data.json` و بقیه فایل‌های پیکربندی.
۳. در ترمینال هاست: `cd ~/nutriclinic && npm ci --omit=dev`
   (اگر هاست دانلود را بلوک کرد، `node_modules` محلی را zip و آپلود کنید).
۴. در **Setup Node.js App**: نسخه Node حداقل ۲۰.۹، حالت Production،
   ریشه برنامه `nutriclinic`، فایل استارتاپ `server.js`.
۵. متغیرهای محیطی:
   - `SQLITE_DB_PATH` = مسیر مطلق بیرون از پوشه‌های وب، مثل `/home/USER/dietdata/diet.sqlite`
   - `ALLOW_UNSAFE_DEMO` = `true` فقط برای دوره تست دمو
۶. **حتماً** روی دامنه دمو رمز بگذارید (Directory Privacy). این نسخه احراز هویت واقعی
   ندارد و نباید با داده واقعی یا بدون رمز عمومی شود.
۷. بکاپ روزانه با Cron: از دستور `.backup` مربوط به sqlite استفاده کنید و نسخه‌ها را
   گاهی روی کامپیوتر خودتان دانلود کنید.
۸. برای بروزرسانی: build محلی، آپلود `.next` و فایل‌های تغییرکرده، Restart در cPanel.
   فایل دیتابیس با استقرار مجدد دست نمی‌خورد.

> یادآوری: تا انجام نشدن موارد P0 سند `نقشه-دیتابیس-و-امنیت.md`، این سایت فقط برای
> تست با داده ساختگی است؛ روی اینترنت عمومی با اطلاعات واقعی اجرا نشود.
