import { DEFAULT_SERVER_URL, getServerUrl, readHistory } from './history.js';

const $ = id => document.getElementById(id);
const els = {
  status: $('status'), statusText: $('statusText'), count: $('count'), send: $('send'),
  progress: $('progress'), message: $('message'), open: $('open'), serverForm: $('serverForm'), serverUrl: $('serverUrl'),
};

let days = 1;
let online = false;
let pageCount = 0;

const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

function say(text, kind = '') {
  els.message.hidden = !text;
  els.message.textContent = text;
  els.message.className = `message ${kind}`;
}

function refreshButton() {
  els.send.disabled = !online || pageCount === 0;
  els.send.textContent = pageCount ? `Send ${plural(pageCount, 'page')}` : 'Send pages';
}

async function checkServer() {
  const server = await getServerUrl();
  try {
    const res = await fetch(`${server}/api/health`, { signal: AbortSignal.timeout(4000) });
    online = res.ok;
  } catch {
    online = false;
  }
  els.status.className = `status ${online ? 'online' : 'offline'}`;
  els.statusText.textContent = online ? 'Online' : 'Offline';
  if (!online) say(`Cannot reach ${server}. Start the backend, or change the server below.`, 'error');
  refreshButton();
}

async function count() {
  const { all, pages } = await readHistory(days);
  pageCount = pages.length;
  const skipped = all - pages.length;
  els.count.innerHTML = pageCount
    ? `<strong>${plural(pageCount, 'page')}</strong> to map${skipped ? `, ${skipped.toLocaleString()} search and social pages skipped` : ''}.`
    : 'No readable pages in this range yet.';
  refreshButton();
}

async function send() {
  els.send.disabled = true;
  els.progress.hidden = false;
  say('');
  const reply = await chrome.runtime.sendMessage({ type: 'send', days });
  els.progress.hidden = true;
  if (reply?.ok) {
    say(reply.sent ? `Mapped ${plural(reply.sent, 'page')}, ${reply.added.toLocaleString()} new.` : 'Nothing new to send.', 'ok');
  } else {
    say(reply?.error ?? 'Sending failed.', 'error');
  }
  refreshButton();
}

document.querySelectorAll('.range button').forEach(btn => {
  btn.addEventListener('click', () => {
    days = Number(btn.dataset.days);
    document.querySelectorAll('.range button').forEach(b => b.setAttribute('aria-checked', String(b === btn)));
    void count();
  });
});

els.send.addEventListener('click', () => void send());

els.open.addEventListener('click', async () => {
  const server = await getServerUrl();
  // The default local backend runs on 8090 and the app on 3030; a custom server serves both.
  chrome.tabs.create({ url: server === DEFAULT_SERVER_URL ? 'http://localhost:3030' : server });
});

els.serverForm.addEventListener('submit', async e => {
  e.preventDefault();
  const url = els.serverUrl.value.trim().replace(/\/$/, '');
  if (!url) return;
  await chrome.storage.local.set({ serverUrl: url });
  say('');
  await checkServer();
});

(async () => {
  els.serverUrl.value = await getServerUrl();
  await Promise.all([checkServer(), count()]);
})();
