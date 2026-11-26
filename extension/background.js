// Sends history to the MindCanvas backend. Runs in the service worker so a send keeps going
// even if the popup is closed half way.
import { getServerUrl, readHistory } from './history.js';

// The backend reads and summarises every page before it answers, which takes minutes for a big history.
const SEND_TIMEOUT_MS = 10 * 60 * 1000;

async function send(days) {
  const { pages } = await readHistory(days);
  if (!pages.length) return { ok: true, sent: 0, added: 0 };

  const server = await getServerUrl();
  const res = await fetch(`${server}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pages),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`The server answered ${res.status}.`);
  const result = await res.json();
  return { ok: true, sent: pages.length, added: result.new ?? 0 };
}

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type !== 'send') return false;
  send(message.days)
    .then(reply)
    .catch(err => reply({ ok: false, error: err?.name === 'TimeoutError' ? 'The server took too long to answer.' : err.message }));
  return true; // keep the channel open for the async reply
});
