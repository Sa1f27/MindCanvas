# Contributing

The standards every change to MindCanvas meets, backend, frontend or extension. Read this before your first change.
The last section says where everything lives.

---

## What we build

- **Better, then consistent.** Look for the solution that is genuinely better, not the first one that works, then
  apply it the same way everywhere and make sure it holds as the graph grows.
- **Built with care.** Everything should feel like a product made by an experienced team. No template look: no stock
  gradients, glowing cards, decorative icons or emoji-heavy copy. Every element earns its place.
- **Minimal and to the point.** Code, interface text and docs say what is needed and stop.
- **Honest about what it knows.** Every answer cites the pages it came from, and the map shows them. Nothing on screen
  is invented or assumed.

## How we work

1. **Research first.** Read the current code and everything that uses it. Confirm facts in the official docs and
   on real data before changing anything.
2. **Plan, then build.** A change of any size starts as a short written plan in phases. Finish one phase end to end
   before the next.
3. **Plan for real use.** Account for thousands of pages, slow or failing page fetches, an LLM that times out, rate
   limits or returns bad JSON, and a database that is briefly away. Fix root causes, never symptoms.
4. **One change per commit.** A commit is one finished, verified unit of work, with its docs in the same commit.
   Messages are short and plain, prefixed `feat`, `fix`, `perf`, `chore` or `docs` with a scope where it helps:
   `perf: graph export reuses the cached clustering`. Never commit secrets.

## Backend

5. **Endpoints are production grade:** correct, fast, resilient to failure, and easy to maintain.
6. **Queries are as efficient as they can be.** pgvector indexes for similarity, one round trip where possible, no
   N+1, batched writes, paginated reads. Check plans with `EXPLAIN` on a realistic amount of data.
7. **The LLM is optional.** Every feature except chat works without one: clustering, names and links fall back to the
   embeddings (`backend/semantic_graph.py`). LLM output is validated before use, and small clusters are merged in code
   because models do not follow counts reliably.
8. **One model setting.** Every LLM call goes through `OPENAI_MODEL` and `OPENAI_BASE_URL`, so any OpenAI-compatible
   provider works. Never hard-code a model name or provider.
9. **No work without a reason.** The graph is recomputed only when the data changes (ingest or reset clear the cache),
   never on a timer. A repeated LLM call costs money and changes what the user sees.
10. **Secure by default.** Validated input, secrets never printed or committed, keys only in `backend/.env`.

## Frontend and design

11. **Colour belongs to the data.** Each cluster gets one fluorescent hue from `frontend/src/lib/palette.ts`. The
    interface around the map stays neutral: one type family, quiet greys, no accent colour of its own.
12. **One design everywhere.** Every list, tab, button and panel looks and behaves the same. Rows of pages use
    `PageRow`, so hovering any page anywhere lights it on the map.
13. **Reuse, never copy.** Use the shared components, stores and theme tokens (`index.css`), and extend a shared
    piece rather than forking it. State lives in its store (`store/graph.ts`, `store/chat.ts`, `store/ui.ts`).
14. **Motion answers the user.** The camera moves because someone asked, searched or clicked, never on its own.
    Typing never moves it. Reduced-motion settings turn flights into cuts.
15. **Every screen is complete:** loading, empty and error states, accessible labels, keyboard focus and contrast.
16. **Accuracy first.** Counts and scores come from the graph or the server, unknown values show `-`, and analysis is
    computed in `lib/graphStats.ts` so every number agrees with what is on the map.
17. **Heavy code loads when needed.** three.js only downloads with the 3D view; keep large dependencies behind a
    lazy import.

## Extension

18. **What the popup counts is what gets sent.** Filtering lives once in `extension/history.js`, shared by the popup
    and the service worker. Only titles and links leave the browser, and only to the user's own server.
19. **Ask for the least.** Permissions stay at `history` and `storage` plus the server hosts.

## Code, checks and docs

20. **Match the surrounding code.** Strict TypeScript, comments of one or two lines. No em or en dashes anywhere.
21. **Verify once, at the end of a change set:** in `frontend/`, `npm test`, `npm run typecheck`, `npm run lint` and
    `npm run build`; for the backend, start it against PostgreSQL with pgvector, ingest `sample/sample_data.json` and
    check the map, chat and search in the browser. Say what was not verified.
22. **The README stays true.** A change to setup, features, endpoints or the stack updates `README.md` in the same
    commit, and its screenshots are retaken from one run so names and colours match.

## Structure

23. **Everything has one home.** New code goes where its kind already lives: the map in `components/graph/`, panels in
    `components/rail/`, chat in `components/ask/`, pure logic in `lib/`, page processing and endpoints in
    `backend/main.py`, graph algorithms in `backend/semantic_graph.py`, database access in `backend/database.py`.
    When nothing fits, create the folder.
24. **One file, one concern, about 800 lines.** Split by concern before a file passes that, never by line count alone.
25. **Shared once, reused everywhere.** What two places need lives once and is extended rather than copied. A value that
    can change (a limit, threshold, colour or label) comes from one constant or the config, never typed in twice.
26. **Logic is tested where it can be.** Pure functions in `lib/` get unit tests next to them in `lib/__tests__/`.

## MindCanvas specifics

1. **Embeddings are 384-dimensional** (`all-MiniLM-L6-v2`, run locally). The `vector(384)` column in
   `backend/init.sql` depends on it; changing the model means a migration and re-embedding every page.
2. **The published paper describes v1.** Never change what it claims; new work is described as v2 in the README.
3. **pgvector returns `Vector` objects.** Convert with `_vec()` in `backend/database.py`, never with `list()`.

## Where to look

| Need | File |
| --- | --- |
| Setup, features, API and stack | `README.md` |
| Environment settings | `backend/.env.example` |
| Database schema | `backend/init.sql` |
| Clustering, naming and links without an LLM | `backend/semantic_graph.py` |
| Retrieval and cited answers | `backend/rag_chatbot.py` |
| Graph analysis (hubs, bridges, area links) | `frontend/src/lib/graphStats.ts` |
| Colours and design tokens | `frontend/src/lib/palette.ts`, `frontend/src/index.css` |
| Extension filtering | `extension/history.js` |
| Sample data | `sample/sample_data.json` |
