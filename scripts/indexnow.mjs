// Tells IndexNow (Bing, Yandex, Seznam, Naver) that the site changed, so Bing
// recrawls the sitemap's pages without waiting. Bing's index also feeds Copilot,
// DuckDuckGo and part of ChatGPT search. The deploy runs this after its health
// check. It never fails the deploy: a ping that doesn't go through is logged.
import { readdirSync } from 'node:fs';

const SITE = 'https://blendpdf.com';
// The key is the name (and content) of public/<32 hex>.txt; IndexNow fetches it to check we own the host.
const KEY_FILE = /^[0-9a-f]{32}\.txt$/;

try {
  const keyFile = readdirSync(new URL('../public/', import.meta.url)).find((name) => KEY_FILE.test(name));
  if (!keyFile) throw new Error('no key file in public/');
  const sitemap = await fetch(`${SITE}/sitemap.xml`, { signal: AbortSignal.timeout(15_000) });
  if (!sitemap.ok) throw new Error(`sitemap.xml: HTTP ${sitemap.status}`);
  const urlList = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (urlList.length === 0) throw new Error('sitemap.xml has no <loc>');

  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(SITE).host,
      key: keyFile.slice(0, -'.txt'.length),
      keyLocation: `${SITE}/${keyFile}`,
      urlList,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  // 200 = received, 202 = received while the key is still being checked.
  console.log(`IndexNow: ${urlList.length} URLs submitted, HTTP ${res.status}`);
} catch (err) {
  console.log(`IndexNow: not submitted (${err instanceof Error ? err.message : err})`);
}
