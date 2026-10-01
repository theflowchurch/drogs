import { fileURLToPath } from 'node:url';
// One look for every email the site sends: the Kuriake Castle mark on navy,
// then the message. The logo travels inside the mail (cid) so it shows without
// remote images; the plain-text version is always sent alongside.
const esc = v => String(v).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export function brandedMail({ from, to, replyTo, subject, text, html, attachments = [] }) {
  const body = html || esc(text).split(/\n{2,}/).map(p => `<p style="margin:0 0 12px">${p.replace(/\n/g, '<br>')}</p>`).join('');
  return {
    from, to, replyTo, subject, text,
    html: `<div style="background:#f3f4f8;padding:24px 12px;font:15px/1.6 -apple-system,'Helvetica Neue',Arial,sans-serif;color:#172139">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e3e6ee">
<div style="background:#13324c;padding:18px;text-align:center"><img src="cid:kc-logo" alt="Kuriake Castle" width="150" style="display:block;width:150px;height:auto;margin:0 auto"></div>
<div style="padding:24px 26px">${body}</div>
<div style="padding:14px 26px;border-top:1px solid #e3e6ee;font-size:12px;color:#6a7283">Kuriake Castle · <a href="https://kuriakecastle.org" style="color:#1e3a8a">kuriakecastle.org</a></div>
</div></div>`,
    attachments: [{ filename: 'kuriake-castle.png', path: fileURLToPath(new URL('../../assets/brand/email-logo.png', import.meta.url)), cid: 'kc-logo' }, ...attachments],
  };
}
