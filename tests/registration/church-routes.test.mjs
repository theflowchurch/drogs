import test from 'node:test';
import assert from 'node:assert/strict';
// Office, 26 Nov: on the live site every church's sign-up was sent to the main page by the
// rule meant only for churches without a built page. This checks that rule as the server
// applies it: built churches keep their own pages; only unknown ones go to /newchurch/.
test('live church addresses: built churches keep their own pages, new ones go to /newchurch/', async () => {
  process.env.NEXT_PUBLIC_REGISTRATION_BACKEND = 'mysql';
  const { default: config } = await import(`../../next.config.mjs?t=${Date.now()}`);
  const { getPathMatch } = await import('next/dist/shared/lib/router/utils/path-match.js');
  const { DENOMINATION_SITES } = await import('../../src/registration/denomination-sites.mjs');
  const rules = (await config.rewrites()).beforeFiles;
  const sentTo = (path) => { for (const r of rules) if (getPathMatch(r.source)(path)) return r.destination; return null; };
  const built = Object.keys(DENOMINATION_SITES);
  assert.ok(built.length > 50);
  for (const church of built) for (const page of ['', 'directory/', 'signup/'])
    assert.equal(sentTo(`/${church}/rollofgoodstanding/licensingauthority/${page}`), null, `${church} ${page || 'home'} must open its own page`);
  assert.equal(sentTo('/brandnewchurch/rollofgoodstanding/licensingauthority/'), '/newchurch/');
  assert.equal(sentTo('/brandnewchurch/rollofgoodstanding/licensingauthority/signup/'), '/newchurch/signup/');
  assert.equal(sentTo('/orderofbishopsingoodstanding/signup/'), null);
  delete process.env.NEXT_PUBLIC_REGISTRATION_BACKEND;
});
