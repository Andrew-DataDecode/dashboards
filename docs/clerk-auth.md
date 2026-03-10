# Clerk Auth Operations Guide

## Architecture Overview

```
Browser                        Backend (FastAPI)
  |                                |
  |  ClerkProvider (main.tsx)      |
  |  - loads Clerk.js              |
  |  - manages session             |
  |  - sets __session cookie       |
  |                                |
  |  useAuth().getToken()          |
  |  -> Authorization: Bearer JWT  |  -> require_auth() dependency
  |                                |     - extracts Bearer token
  |  OR                            |     - fetches JWKS from Clerk
  |  __session cookie (browser)    |  -> verify_session_cookie()
  |                                |     - reads __session cookie
  |                                |     - same JWT verification
  |                                |
  |  JWT claims include:           |
  |  - sub (user ID)              |
  |  - publicMetadata.groups       |  -> get_user_permissions()
  |  - publicMetadata.allowedRoutes|     - maps to UserPermissions
  |  - publicMetadata.allowedDashboards
```

### Key files

| File | Purpose |
|------|---------|
| `frontend/src/main.tsx` | ClerkProvider wraps the app with `VITE_CLERK_PUBLISHABLE_KEY` |
| `frontend/src/App.tsx` | SignedIn/SignedOut gates, SignIn component, ProtectedRoute wrapper |
| `frontend/src/hooks/usePermissions.ts` | Client-side route access check via `publicMetadata.groups` |
| `frontend/src/config/permissions.ts` | Route-to-group mapping (which groups can access which routes) |
| `frontend/src/components/Auth/ProtectedRoute.tsx` | Redirects to `/not-authorized` if `canAccess()` fails |
| `backend/auth.py` | JWT verification via JWKS -- `require_auth()` and `verify_session_cookie()` |
| `backend/permissions.py` | Server-side permissions from `permissions.json` config |
| `backend/config.py` | `CLERK_PUBLISHABLE_KEY` validation on startup |

### JWT verification flow (backend)

1. Extract token from `Authorization: Bearer <token>` header (API calls) or `__session` cookie (browser requests)
2. Decode the JWT header to get `kid` (key ID)
3. Fetch JWKS from `https://<clerk-frontend-api>/.well-known/jwks.json` (cached 60 min)
4. Find matching RSA public key by `kid`
5. Verify signature with RS256
6. If `kid` not found in cache, force-refresh JWKS once (handles key rotation)
7. Return decoded claims dict

### Frontend permission model

Route permissions are defined in `frontend/src/config/permissions.ts`:

```typescript
{ path: '/',              groups: [] },          // open to all signed-in users
{ path: '/dashboards',    groups: ['analytics', 'clinical', 'executive'] },
{ path: '/dashboards/:slug', groups: ['analytics', 'clinical', 'executive'] },
```

Access logic (`usePermissions.ts`):
- If route has `groups: []` -- any signed-in user can access
- If user's `publicMetadata.allowedRoutes` matches the path -- access granted
- If user is in any of the route's required groups -- access granted
- Otherwise -- redirect to `/not-authorized`

---

## User Management

### Add a user

1. Go to Clerk Dashboard > Users > Create User
2. Set email, name, password
3. Under **Public Metadata**, set groups and permissions:

```json
{
  "groups": ["analytics"],
  "allowedRoutes": ["/dashboards/*"],
  "allowedDashboards": ["payment-audit"]
}
```

Or grant full dashboard access:

```json
{
  "groups": ["analytics", "executive"],
  "allowedDashboards": ["*"]
}
```

### Available groups

| Group | Access |
|-------|--------|
| `analytics` | Dashboards |
| `clinical` | Dashboards |
| `executive` | Dashboards |

Routes with `groups: []` (Chat, Metric Tree, Process Maps) are open to all signed-in users.

### Remove a user

Clerk Dashboard > Users > select user > Delete User

### Modify permissions

Clerk Dashboard > Users > select user > Public Metadata > edit JSON > Save

Changes take effect on next token refresh (within ~60 seconds for active sessions).

---

## MFA Configuration

1. Clerk Dashboard > Configure > Multi-factor
2. Enable desired methods:
   - SMS verification
   - Authenticator app (TOTP)
   - Backup codes
3. Set enforcement policy:
   - **Optional**: users choose whether to enable
   - **Required**: all users must set up MFA

Users manage their own MFA setup through the Clerk-hosted user profile UI or the `<UserButton />` component if embedded.

---

## Session Timeout Configuration

Clerk Dashboard > Configure > Sessions

Key settings:

| Setting | Description | Recommended |
|---------|-------------|-------------|
| Session lifetime | Max duration before forced re-auth | 7 days |
| Inactivity timeout | Idle time before session expires | 1 hour |
| Token lifetime | JWT expiry (`exp` claim) | 60 seconds (default) |

Token lifetime controls how often the frontend refreshes the JWT. Short token lifetime (60s) means permission changes propagate quickly. The Clerk SDK handles token refresh automatically via `getToken()`.

---

## Local Dev Workflow

### 1. Create a Clerk test instance

1. Go to https://dashboard.clerk.com
2. Create a new application (this creates a Development instance)
3. Note the **Publishable Key** (`pk_test_...`) from the API Keys page

### 2. Set up environment

Copy the template and fill in credentials:

```bash
cd project/tanit
cp .env.local.template .env.local
```

Edit `.env.local` -- set at minimum:

```
CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
```

The frontend reads a separate env var. Create/edit `frontend/.env`:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
```

Both values must be the same publishable key. The backend reads `CLERK_PUBLISHABLE_KEY` (used for JWKS URL derivation). The frontend reads `VITE_CLERK_PUBLISHABLE_KEY` (passed to ClerkProvider).

### 3. Create test users

Clerk Dashboard > Users > Create User for your dev instance.

Set `publicMetadata` for the test user:

```json
{
  "groups": ["analytics", "executive"],
  "allowedDashboards": ["*"]
}
```

### 4. Run locally

```bash
# Backend
cd project/tanit
source ../../.venv/bin/activate
uvicorn backend.app:app --reload --port 8000

# Frontend (separate terminal)
cd project/tanit/frontend
npm run dev
```

The frontend dev server runs on port 5173 by default. CORS is pre-configured for `http://localhost:5173` in the backend defaults.

### .env.local template reference

```
# project/tanit/.env.local.template
ENVIRONMENT=local
CONTENT_ROOT=/app/content
PERMISSIONS_CONFIG=/app/content/permissions.json
DUCKDB_GCS_URL=gs://dashboard-example/analyte_health/dashboard.duckdb
DUCKDB_GCS_CREDENTIALS=/app/secrets/gcs-credentials.json
DUCKDB_LOCAL_PATH=/app/data/dashboard.duckdb
CLERK_PUBLISHABLE_KEY=pk_test_...
LOG_LEVEL=DEBUG
LOG_FORMAT=text
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002,http://localhost:5173
```

---

## __session Cookie Fallback

Clerk sets a `__session` cookie containing the same JWT that `getToken()` returns via the Authorization header.

Two verification paths exist:

| Method | Function | Used by |
|--------|----------|---------|
| `Authorization: Bearer <jwt>` | `require_auth()` | API calls from frontend (`useAuth().getToken()`) |
| `__session` cookie | `verify_session_cookie()` | Browser requests for protected static assets |

The cookie fallback exists because browser-initiated requests (like loading a protected page directly, or `<img>` tags pointing to protected URLs) cannot set custom Authorization headers. The `__session` cookie is automatically included by the browser.

Both functions perform identical JWT verification -- they only differ in where they read the token from.

---

## Troubleshooting

### Token expired (401: "Token expired")

**Cause**: JWT `exp` claim has passed. Clerk tokens are short-lived (default 60s).

**Fix**:
- Frontend: `getToken()` from `useAuth()` auto-refreshes. If you're caching tokens manually, stop.
- Check system clock on the server -- clock skew breaks JWT verification.
- Verify the user's session hasn't timed out in Clerk Dashboard.

```bash
# Check server clock
date -u
timedatectl status
```

### JWKS mismatch (401: "No matching signing key found")

**Cause**: The JWT's `kid` header doesn't match any key in the JWKS endpoint. Usually happens after key rotation or when using the wrong Clerk instance.

**Fix**:
1. Confirm `CLERK_PUBLISHABLE_KEY` in backend matches `VITE_CLERK_PUBLISHABLE_KEY` in frontend
2. Both must point to the same Clerk instance (dev vs prod)
3. Restart the backend to clear the JWKS cache (cached for 60 min)
4. The backend auto-retries once on `kid` mismatch (force-refreshes cache), so persistent failures mean a real config mismatch

```bash
# Decode the publishable key to see which Clerk instance it points to
echo "pk_test_xxxxx" | cut -d_ -f3 | base64 -d 2>/dev/null
```

### CORS issues (browser console: "blocked by CORS policy")

**Cause**: Frontend origin not in the backend's allowed origins list.

**Fix**:
1. Check `ALLOWED_ORIGINS` in `.env.local` (comma-separated list)
2. Default dev origins: `http://localhost:3000`, `http://localhost:3002`, `http://localhost:5173`
3. If using a custom port, add it:

```
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002,http://localhost:5173,http://localhost:YOURPORT
```

4. Backend CORS config is in `backend/app.py` -- uses `CORSMiddleware` with:
   - `allow_credentials=True`
   - `allow_methods=["*"]`
   - `allow_headers=["*"]`

### User has no permissions / redirected to Not Authorized

**Cause**: User's `publicMetadata` is missing or doesn't include the required group.

**Check**:
1. Clerk Dashboard > Users > select user > Public Metadata
2. Verify `groups` array includes a group listed in `frontend/src/config/permissions.ts`
3. For dashboard access, verify `allowedDashboards` includes the slug or `"*"`

### __session cookie not being sent

**Cause**: Cookie domain/path mismatch, or SameSite restrictions.

**Fix**:
- Ensure frontend and backend are on the same domain (or localhost) in dev
- Check browser dev tools > Application > Cookies for `__session`
- Clerk sets `__session` as `SameSite=None; Secure` in production -- requires HTTPS

### Backend fails to start ("CLERK_PUBLISHABLE_KEY is required")

**Fix**: Set `CLERK_PUBLISHABLE_KEY` in the environment before starting the backend.

```bash
export CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
# or add to project/tanit/.env.local and ensure it's loaded
```

The backend validates this on startup in `backend/config.py:validate()`.

---

## Production Auth Checklist

### Clerk production instance setup

- [ ] Create a Production instance in Clerk Dashboard (separate from the Development instance)
- [ ] Note the **Publishable Key** -- it will start with `pk_live_` (not `pk_test_`)
- [ ] Configure the allowed domains for the production instance under Configure > Domains
- [ ] Enable MFA enforcement if required (Configure > Multi-factor > Required)
- [ ] Set session lifetime and inactivity timeout to match security policy (Configure > Sessions)
- [ ] Create all production users with correct `publicMetadata` (groups, allowedRoutes, allowedDashboards)
- [ ] Verify no test/dev users exist in the production instance

### Secret Manager integration

The `deploy.sh` script pulls three secrets from GCP Secret Manager at deploy time:

- [ ] Create the `clerk-publishable-key` secret in Secret Manager:
  ```bash
  echo -n "pk_live_..." | gcloud secrets create clerk-publishable-key \
    --data-file=- --project=$CLOUD_RUN_PROJECT
  ```
- [ ] Create the `anthropic-api-key` secret:
  ```bash
  echo -n "sk-ant-..." | gcloud secrets create anthropic-api-key \
    --data-file=- --project=$CLOUD_RUN_PROJECT
  ```
- [ ] Create the `bq-credentials` secret (BQ service account JSON):
  ```bash
  gcloud secrets create bq-credentials \
    --data-file=path/to/service-account.json --project=$CLOUD_RUN_PROJECT
  ```
- [ ] Grant the Cloud Run service account `roles/secretmanager.secretAccessor` on each secret
- [ ] Confirm `deploy.sh` mounts secrets correctly -- the `--set-secrets` flag maps:
  - `ANTHROPIC_API_KEY` from `anthropic-api-key:latest`
  - `CLERK_PUBLISHABLE_KEY` from `clerk-publishable-key:latest`
  - `/secrets/gcs-credentials.json` (file mount) from `bq-credentials:latest`
- [ ] Run `deploy.sh` and verify `/api/health` returns `status: ok`

### ALLOWED_ORIGINS config

The backend reads `ALLOWED_ORIGINS` as a comma-separated list. If unset, it falls back to localhost defaults (which will block all production traffic).

- [ ] Set `ALLOWED_ORIGINS` to the production frontend URL before deploying:
  ```bash
  export ALLOWED_ORIGINS=https://app.yourdomain.com
  ./deploy.sh
  ```
- [ ] If serving from multiple origins (e.g. custom domain + Cloud Run URL), comma-separate them:
  ```
  ALLOWED_ORIGINS=https://app.yourdomain.com,https://tanit-abc123-uc.a.run.app
  ```
- [ ] Confirm the value is passed to `--set-env-vars` in the `gcloud run deploy` call (it is included in `deploy.sh` by default as `ALLOWED_ORIGINS=${ALLOWED_ORIGINS}`)
- [ ] After deploy, test from the browser: open DevTools > Network, make an API call, confirm no CORS errors in the console
- [ ] Confirm `allow_credentials=True` is set in `CORSMiddleware` (required for the `__session` cookie to be sent cross-origin)

### Monitoring auth failures in event logs

The backend uses structlog with JSON output (`LOG_FORMAT=json`) in production. All requests are logged via `RequestIDMiddleware` with `method`, `path`, `status`, and `duration_ms`.

- [ ] Confirm `LOG_LEVEL=INFO` and `LOG_FORMAT=json` are set in the Cloud Run environment (both are set in `deploy.sh` by default)
- [ ] Auth failures surface as HTTP 401 responses -- filter for them in Cloud Logging:
  ```
  resource.type="cloud_run_revision"
  resource.labels.service_name="tanit"
  jsonPayload.status=401
  ```
- [ ] Watch for `"No matching signing key found"` errors -- indicates a JWKS mismatch (wrong Clerk instance key in Secret Manager)
- [ ] Watch for `"Token expired"` errors at high volume -- may indicate clock skew on the Cloud Run instance or clients not refreshing tokens
- [ ] Watch for `"CLERK_PUBLISHABLE_KEY is required"` in startup logs -- means the secret was not mounted correctly
- [ ] Optionally set up a Cloud Logging sink to GCS for long-term retention of auth events (the `deploy.sh` header includes the `gcloud logging sinks create` command for this)
- [ ] Set up a log-based alert in Cloud Monitoring for 401 error spikes exceeding a threshold appropriate for expected user volume
