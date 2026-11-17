const backend = process.env.NEXT_PUBLIC_REGISTRATION_BACKEND;
const mysqlBackend = backend === 'mysql';
if (process.env.NEXT_PUBLIC_REGISTRATION_BACKEND && !['mysql', 'demo', 'supabase'].includes(process.env.NEXT_PUBLIC_REGISTRATION_BACKEND)) throw Error('Unknown registration backend.');
if (mysqlBackend && process.env.NEXT_PUBLIC_BASE_PATH) throw Error('Hostinger uses a domain root; leave NEXT_PUBLIC_BASE_PATH empty.');
// A partial or privileged backend configuration must fail the build, never fall back to demo.
const registrationUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
const registrationKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!mysqlBackend && backend !== 'demo' && Boolean(registrationUrl)!==Boolean(registrationKey))throw new Error('Configure both the Supabase URL and public key.');
if(backend === 'supabase' && (!registrationUrl || !registrationKey)) throw Error('Configure both the Supabase URL and public key.');
if(registrationKey){
 if(registrationKey.startsWith('sb_secret_'))throw new Error('Use a public Supabase key, never a secret key.');
 if(registrationKey.startsWith('eyJ')){let claims;try{claims=JSON.parse(Buffer.from(registrationKey.split('.')[1],'base64url').toString());}catch{}if(claims?.role==='service_role')throw new Error('A service-role key cannot be included in the website.');}
}
// A group the office adds later has no page built for it; on the live (server)
// site its address opens it through /orderofbishopsingoodstanding/new-group/.
const { ORGANISATION_PAGES } = mysqlBackend ? await import('./src/registration/ministry-organisations.mjs') : { ORGANISATION_PAGES: [] };
const builtPages = [...ORGANISATION_PAGES, 'signup', 'new-group'].map(s => s.replace(/[^a-z0-9-]/g, '')).join('|');
/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(mysqlBackend ? {
    async rewrites() { return { beforeFiles: [{ source: `/orderofbishopsingoodstanding/:group((?!(?:${builtPages})$)[a-z0-9]+(?:-[a-z0-9]+)*)/`, destination: '/orderofbishopsingoodstanding/new-group/' }] }; },
  } : { output: 'export' }),
  trailingSlash: true,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
};
export default nextConfig;
