# BlendPDF Blog CMS (Strapi + SQLite)

Strapi v4 with SQLite for the BlendPDF blog. Editors use the Strapi admin to create and publish articles (EN/AR).

## Requirements

- **Node.js 18 or 20** (LTS). Strapi 4 and `better-sqlite3` do not support Node 21+.
  - Use [nvm](https://github.com/nvm-sh/nvm): `nvm use 20` or `nvm install 20`
  - Or install Node 20 from [nodejs.org](https://nodejs.org/)
- npm 6+

## Setup

1. **Use Node 18 or 20**
   ```bash
   nvm use 20   # if using nvm
   node -v      # should show v18.x or v20.x
   ```

2. **Install dependencies**
   ```bash
   cd strapi
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env and set APP_KEYS, ADMIN_JWT_SECRET, API_TOKEN_SALT (use random strings in production)
   ```

4. **Start Strapi (development)**
   ```bash
   npm run develop
   ```
   - Admin: http://localhost:1337/admin  
   - On first run you’ll create an admin user.  
   - API: http://localhost:1337/api/articles  

5. **Seed data**  
   On first start (empty database), the bootstrap automatically creates 4 sample articles in English for UX testing. It also grants Public `find` and `findOne` permissions for Article so the Next.js blog can fetch content.

6. **First-run checklist (Strapi admin)**
   - Create admin user at http://localhost:1337/admin (first run only).
   - **Settings → Users & Permissions → Roles → Public**: enable `find` and `findOne` for **Article** (the seed does this automatically; only needed if you reset the DB manually).
   - **Settings → Internationalization**: locales `en` and `ar` are pre-configured; create articles in each locale as needed.
   - **Content Manager → Article**: create your first article, set slug, add content, and **Publish** (draft posts are not shown on the site).

## Next.js integration

- Set `STRAPI_URL` (or `NEXT_PUBLIC_STRAPI_URL`) in the **Next.js** app:
  - Development: `http://localhost:1337`
  - Production: your Strapi URL (e.g. `https://blendpdf.com/api/cms` if proxied)
- Blog pages at `/blog` and `/ar/blog` fetch from Strapi’s public API.

## Production (e.g. same EC2 as Next.js)

- Build admin: `npm run build`
- Run: `npm run start` (or use PM2).
- Run Strapi on a dedicated port (e.g. 1337) and put Nginx in front:
  - `blendpdf.com/admin` → Strapi admin
  - `blendpdf.com/api/cms` → Strapi API (`/api/*`)
- Keep using SQLite: set `DATABASE_FILENAME` to a path that persists (e.g. `/var/www/strapi/.tmp/data.db`) and back it up.

## Troubleshooting

- **`better-sqlite3` build fails**: Use Node 18 or 20. Paths with spaces can also break native builds; if needed, run from a path without spaces.
- **TypeScript "Debug Failure" / "No inputs were found"**: Strapi was picking up the parent Next.js `tsconfig.json`. A `tsconfig.json` in the `strapi/` folder fixes this.
- **"public folder doesn't exist"**: Run `mkdir -p strapi/public/uploads` before first start.
- **403 on API**: In Strapi admin, Settings → Users & Permissions → Roles → Public: enable `find` and `findOne` for **Article**.
