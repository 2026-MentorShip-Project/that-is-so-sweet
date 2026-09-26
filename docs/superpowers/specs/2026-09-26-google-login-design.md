# Google Login Integration Design

**Date:** 2026-09-26  
**Branch:** feat/google-login  
**Status:** Approved

## Problem

Login is currently simulated (`src/mocks/fakeAuth.ts`). The backend (Django REST) already has `POST /api/auth/google/` and expects a real Google ID token. The frontend needs to obtain that token via Google Identity Services and exchange it for backend JWT tokens.

## Backend Contract

```
POST /api/auth/google/
Body:    { "idToken": "string" }
Success: { "access": "string", "refresh": "string", "user": { "id": "string", "name": "string", "email": "string" } }
```

## Auth Flow

```
[GoogleLogin button click]
  → Google popup (Google's own UI)
  → onSuccess({ credential })   ← Google ID token (JWT)
  → loginWithIdToken(credential)
  → POST /api/auth/google/ { idToken: credential }
  → { access, refresh, user }
  → store in localStorage → setUser() → app unlocks
```

## Architecture

### Provider

`src/main.tsx` wraps the entire app with:

```tsx
<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <App />
</GoogleOAuthProvider>
```

### New auth module: `src/lib/googleAuth.ts`

Replaces `src/mocks/fakeAuth.ts`. Manages three localStorage keys:

| Key | Contents |
|-----|----------|
| `jiu_access_token` | Bearer token (already read by `src/api/http.ts`) |
| `jiu_refresh_token` | Refresh token (stored for future use) |
| `jiu_user` | `{ id, name, email }` as JSON |

Exports:
- `AuthUser` interface `{ id: string; name: string; email: string }`
- `useGoogleAuth()` hook returning `{ user, isAuthenticating, authError, loginWithIdToken, logout }`

`loginWithIdToken(idToken)` calls `apiFetch` with `skipAuth: true`, stores all three keys on success, sets `user` state.  
`logout()` removes all three keys and clears `user` state.

`isAuthenticating` is `true` only during the backend API call (after the Google popup closes, before the backend responds). The Google popup itself shows Google's own loading UI.

### Type change

`FakeUser { name, email }` → `AuthUser { id, name, email }` defined in `src/types.ts`. All call sites updated.

### LoginScreen UI

Both `src/pages/app/LoginScreen.tsx` (mobile) and `src/components/LoginScreen.tsx` (desktop):

- Props: `onLogin: (idToken: string) => Promise<void>` (was `() => void`)
- Replace `<Button onClick={onLogin}>` with `<GoogleLogin>` component
- Remove the demo disclaimer paragraph

```tsx
<GoogleLogin
  onSuccess={(res) => onLogin(res.credential!)}
  onError={() => setError("Google 登入失敗，請重試")}
  locale="zh_TW"
  size="large"
  shape="rectangular"
/>
```

### App.tsx

Replace `useFakeAuth()` with `useGoogleAuth()`. Pass `loginWithIdToken` as `onLogin` to both `LoginScreen` (desktop) and `MobileApp` (which forwards it to its `LoginScreen`).

`GoogleLoginOverlay` is no longer rendered (the `isAuthenticating` state can show a lightweight inline spinner instead).

## Files Changed

| File | Action |
|------|--------|
| `src/lib/googleAuth.ts` | **Create** — auth hook and storage helpers |
| `src/types.ts` | **Edit** — add `AuthUser`, remove or alias `FakeUser` |
| `src/main.tsx` | **Edit** — add `GoogleOAuthProvider` |
| `src/App.tsx` | **Edit** — swap hook, update `onLogin` prop type |
| `src/pages/app/LoginScreen.tsx` | **Edit** — `GoogleLogin` component, remove demo text |
| `src/components/LoginScreen.tsx` | **Edit** — same as above |
| `src/pages/app/MobileApp.tsx` | **Edit** — `FakeUser` → `AuthUser` |
| `src/mocks/fakeAuth.ts` | **Delete** |
| `src/components/app/GoogleLoginOverlay.tsx` | **Delete** |
| `src/components/GoogleLoginOverlay.tsx` | **Delete** |
| `.env.local` | **Edit** — add `VITE_GOOGLE_CLIENT_ID` |

## Dependencies

```
npm install @react-oauth/google
```

## Environment Variables

`.env.local` only (no deployment config needed):

```env
VITE_GOOGLE_CLIENT_ID=<your_client_id>.apps.googleusercontent.com
```

The Client ID must have the local dev origin (`http://localhost:5173`) in Google Cloud Console → Authorized JavaScript origins.

## Out of Scope

- Token refresh on 401 (refresh token is stored but not used)
- Server-side ID token verification audit
