# Lebati AI

Use the **Lebati AI** button on any authenticated portal page. The assistant has its own verified server session because the existing portal OTP and browser session are for demonstration. That browser session grants no assistant permissions. Conversations are separate per assistant session and workspace. The geographic dashboard can prefill a question using its filters.

## Configure synthetic mode on Vercel

In the existing Vercel project's **Settings → Environment Variables**, configure these server variables for the intended deployment. Use sensitive storage for credentials. For local development use the ignored `.env.local` file and restart Vite.

| Variable | Value |
| --- | --- |
| `LEBATI_AI_MODE` | `synthetic` |
| `OPENAI_API_KEY` | A project key from the OpenAI API platform |
| `LEBATI_AI_REDIS_URL` | HTTPS Upstash Redis REST URL. `UPSTASH_REDIS_REST_URL` is also recognised |
| `LEBATI_AI_REDIS_TOKEN` | Redis REST credential with the permissions required for the assistant keys. `UPSTASH_REDIS_REST_TOKEN` is also recognised |
| `LEBATI_AI_ACCOUNTS` | A JSON array of named accounts with salted scrypt hashes and server-side grants |

Run `node scripts/create-assistant-account.mjs <username> "Global Administrator"` privately to generate an account entry and password. Enter the account array in the Vercel variable and share the password through an approved password manager. For additional accounts combine entries into one array. To grant institutional access, use `NSFAS Administrator` or `SASSA Administrator` and list authorised programme IDs such as `nsfas-tuition` or `sassa-child` from the geographic source. For an `Agent`, supply `grants: [{ "programme": "sassa-child", "area": "ZA" }]` using only the approved geographic IDs, and list assigned reference IDs under `cases`. Only synthetic case references are currently available. Empty institutional or agent grants provide no reporting access.

Deploy after setting the variables. Verify `GET /api/ai/session` returns `locked`, sign in to the portal, unlock the assistant and ask for a province comparison. Check that the result streams and includes the reporting period, denominators and synthetic provenance. Test an out-of-scope institutional account separately. Project usage limits and budgets should be set in the OpenAI platform as an additional cost control.

## Serverless endpoints and diagnostics

- `/api/ai/chat` accepts POST requests with an `action` of `ask`, `history` or `reset`, and the selected `workspace`. An `ask` also takes a `question` of at most 1,200 characters. The server retrieves conversation history and permissions itself. The browser supplies no analytics, user ID or role.
- `/api/ai/session` provides GET status, POST sign-in, and DELETE sign-out. The session cookie is server-verified. The original `/api/assistant` route remains available for existing clients.
- Every endpoint response carries a server-generated `X-Request-Id`. JSON errors also include a safe error code and request ID. Application audit events use the same identifier. The chat endpoint rejects GET requests, JSON over 8 KiB, malformed actions and unauthorised sessions.
- Vercel SPA rewrites explicitly exclude `/api`. The Node ESM entry points and all server runtime imports use explicit `.js` specifiers resolved from TypeScript. The server TypeScript project uses NodeNext resolution to detect incompatible import paths before deployment.
- A function boot failure produces a Vercel `FUNCTION_INVOCATION_FAILED` response before application error handling. Inspect runtime logs with the deployment's Vercel project access. After deployment, confirm `/api/ai/session` returns JSON and an unauthenticated POST to `/api/ai/chat` returns 401. Successful HTML indicates the SPA fallback handled the request. Enter sends a message, Shift+Enter inserts a newline, and failed messages can be retried.

The production failure audited on 17 November 2026 was `ERR_MODULE_NOT_FOUND` resolving `/var/task/server/assistant/handler` from `/var/task/api/assistant.js`. Runtime logs confirmed that the function failed during Node ESM import resolution, before the missing-key configuration check could respond.

## Data and security controls

- The backend uses the OpenAI Responses API with GPT-4.1 mini. It requires a structured read-only tool plan, validates every call, re-applies session scope, and streams the response after it retrieves data. Tools provide structured summaries, ranks, monthly trends, case evidence gaps and curated workflow guidance. They accept no SQL, URLs, writes or approvals.
- The geographic tools use the same synthetic aggregation and cohort thresholds as the geographic dashboard. Figures cover May–October 2026. Cases are separate fictional examples. The curated knowledge base explains the portal's workflows and rules. It carries no legal or institutional approval claim.
- Opaque cookies are HTTPS-only outside loopback, HTTP-only and same-site. Sessions expire after an hour. Conversation messages expire after 30 minutes of inactivity, and only the most recent turns are sent back to the model. Locking the assistant, signing out or clearing history revokes access to the prior conversation. Expired or revoked session data TTLs still apply.
- Redis enforces shared sign-in limits, per-account and project request quotas, and concurrent-turn locks. Model calls, output tokens, request size and response time are bounded. Audit logs contain pseudonymous account fingerprints and event metadata without questions, answers, credentials or case evidence. Set access and retention on logs in the deployment environment.
- OpenAI response storage is disabled in the request. Approved provider retention settings and data-processing terms must still be verified before any live use. The UI asks users to omit personal details, and the API blocks common identifiers. Pattern matching cannot detect every sensitive disclosure.

`LEBATI_AI_MODE=production` fails closed. It has no synthetic fallback. Before enabling real records, connect a verified institutional identity provider, server-authorised data and policy sources, validated case assignments, compliant publication and retention controls, and an approved provider data-processing arrangement. Confirm lawful basis, POPIA safeguards, security review and institutional approvals first. No live institutional data connector is included.
