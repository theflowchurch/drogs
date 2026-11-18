"use client";
// The way in to the Order of Bishops / Pastors pages and the Councils (office,
// 17 Nov): 1) the Order pages password, 2) sign in (or create an account),
// 3) be in good standing this year. The server checks every step again before
// it serves those pages (src/server/http.mjs); this page only walks people through.
import { useEffect, useState } from 'react';
import * as api from './client';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';

const safeNext = (value) => (/^\/(orderofbishopsingoodstanding|orderofpastorsingoodstanding|councils)(\/[^\s]*)?$/.test(value || '') ? value : '/orderofbishopsingoodstanding/');
async function call(path, body) {
  const res = await fetch(`${base}/api/registration/${path}`, body === undefined ? { credentials: 'same-origin', cache: 'no-store' } : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Kc-Door': 'member' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

export default function AccessGate() {
  const [next, setNext] = useState('/orderofbishopsingoodstanding/');
  const [step, setStep] = useState('loading'), [standing, setStanding] = useState(null);
  const [mode, setMode] = useState('signin'); // signin | create
  const [code, setCode] = useState(''), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const pastors = next.startsWith('/orderofpastorsingoodstanding');
  const signup = `${base}/${pastors ? 'orderofpastorsingoodstanding' : 'orderofbishopsingoodstanding'}/signup/`;
  const check = async (to = next) => {
    const r = await call('order-access');
    if (r.step === 'ok') { location.replace(`${base}${to}`); return; }
    setStanding(r); setStep(r.step);
  };
  useEffect(() => {
    const to = safeNext(new URLSearchParams(location.search).get('next'));
    setNext(to);
    check(to).catch((e) => { setError(e.message); setStep('code'); });
  }, []);
  const run = async (fn) => { setError(''); setBusy(true); try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const title = pastors ? 'Order of Pastors in Good Standing' : next.startsWith('/councils') ? 'The Councils' : 'Order of Bishops in Good Standing';
  return <div className="reg-access-gate">
    <header className="reg-access-head">
      <img src={`${base}/assets/organisations/dhmm-logo-white.webp`} alt="DHMM – Dag Heward-Mills Ministries" width="1200" height="396" />
      <span>{pastors ? 'WORLDWIDE FELLOWSHIP OF PASTORS' : 'WORLDWIDE FELLOWSHIP OF BISHOPS'}</span>
    </header>
    <main className="reg-access-main">
      <section className="reg-card reg-access-card" aria-live="polite">
        <span className="reg-eyebrow">PRIVATE · {title.toUpperCase()}</span>
        {step === 'loading' && <p role="status">Checking your access…</p>}
        {step === 'code' && <form onSubmit={(e) => { e.preventDefault(); run(async () => { await call('auth/order-code', { code }); setCode(''); await check(); }); }}>
          <h1>Enter the password</h1>
          <p>This page is private. Enter the password you were given to continue.</p>
          <label className="reg-field"><span>Password</span><input type="password" value={code} onChange={(e) => setCode(e.target.value)} required autoComplete="off" autoFocus /></label>
          <button className="reg-primary full" disabled={busy}>{busy ? 'Checking…' : 'Continue →'}</button>
        </form>}
        {step === 'signin' && <form onSubmit={(e) => { e.preventDefault(); run(async () => {
          if (mode === 'create') {
            if (password !== confirm) throw Error('The two passwords do not match. Please type them again.');
            if (password.length < 8) throw Error('Choose a password of at least 8 characters.');
            await api.passwordSignup(email, password, 'general', false);
            location.assign(signup); // a new account goes on to the normal sign-up first
            return;
          }
          await api.passwordLogin(email, password, false);
          await check();
        }); }}>
          <h1>{mode === 'create' ? 'Create an account' : 'Sign in'}</h1>
          <p>{mode === 'create' ? 'You will then complete your registration. Once you are in good standing you can view this page.' : 'Sign in with your Kuriake Castle account to continue.'}</p>
          <label className="reg-field"><span>Email address</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
          <label className="reg-field"><span>{mode === 'create' ? 'Create a password' : 'Password'}</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === 'create' ? 'new-password' : 'current-password'} /></label>
          {mode === 'create' && <label className="reg-field"><span>Type the password again</span><input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" /></label>}
          <button className="reg-primary full" disabled={busy}>{busy ? 'Please wait…' : mode === 'create' ? 'Create account →' : 'Sign in →'}</button>
          {mode === 'signin' ? <>
            <p className="reg-small">No account yet? <button type="button" className="reg-text" onClick={() => { setError(''); setMode('create'); }}>Create an account</button></p>
            <p className="reg-small"><a href={`${signup}#signin`}>Forgot password?</a></p>
          </> : <p className="reg-small">Already have an account? <button type="button" className="reg-text" onClick={() => { setError(''); setMode('signin'); }}>Sign in</button></p>}
        </form>}
        {step === 'standing' && <div>
          <h1>{standing?.status === 'none' || standing?.status === 'draft' ? 'Complete your registration' : 'Not yet in good standing'}</h1>
          <p>{standing?.status === 'none' || standing?.status === 'draft'
            ? 'Only bishops and pastors in good standing can view this page. Please finish your registration and payment first.'
            : standing?.status === 'unclaimed' ? 'Your registration is waiting for your bishop to confirm you. Once you are confirmed and in good standing you can view this page.'
            : 'Your registration is being reviewed. Once it is confirmed and you are in good standing you can view this page.'}</p>
          <a className="reg-primary full reg-access-button" href={signup}>{standing?.status === 'none' || standing?.status === 'draft' ? 'Complete my registration →' : 'Open my profile →'}</a>
        </div>}
        {error && <p className="reg-receipt-error" role="alert">{error}</p>}
      </section>
    </main>
  </div>;
}
