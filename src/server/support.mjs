import { HttpError, emailAddress } from './auth.mjs';
// "Any issues?" reports from the website. Email is the record of the report;
// Telegram is an optional heads-up and never blocks or fails the report.
export function createSupport({ config, mailer, fetcher = fetch, logger = console }) {
  return async function report(actor, input) {
    const message = String(input?.message || '').trim();
    if (message.length < 5) throw new HttpError(400, 'Describe what went wrong in a sentence or two.');
    if (message.length > 4000) throw new HttpError(400, 'Please shorten the description to 4,000 characters.');
    const replyTo = input?.contact ? emailAddress(input.contact) : actor.email;
    const heading = `DROGS website issue from ${replyTo}`;
    const body = `${heading}\nAccount: ${actor.id}\nOffice access: ${actor.office ? 'yes' : 'no'}\nReported: ${new Date().toISOString()}\n\n${message}\n`;
    await mailer.sendMail({ from: config.from, to: config.admins.join(','), replyTo, subject: heading, text: body });
    if (config.telegram) {
      try {
        const response = await fetcher(`https://api.telegram.org/bot${config.telegram.token}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: config.telegram.chat, text: body, disable_web_page_preview: true }),
        });
        if (!response.ok) throw Error(`status ${response.status}`);
      } catch (error) {
        // The office already has the email; never lose a report over Telegram.
        logger.error('Telegram notification failed', { type: error.name });
      }
    }
    return { ok: true };
  };
}
