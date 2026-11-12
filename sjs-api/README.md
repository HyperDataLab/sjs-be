# sjs-api

Cloudflare Worker API for Firebase Auth and Firestore.

## Local development

Install dependencies and start the Worker:

```sh
npm.cmd ci
npm.cmd run dev
```

The ignored `.dev.vars` file enables a development-only mock login. Call
`POST /api/v1/dev/login`, then send its `token` as a Bearer token to protected
routes. The mock identity is `dev-user`; projects created with it are held in
the Worker isolate's memory and are cleared when the local Worker restarts.
The mock route and token are accepted only when `DEV_AUTH_ENABLED=true` is
present in local `.dev.vars`. That variable is not part of the deployed
Wrangler configuration.

With mock login enabled, `GET /api/v1/projects` lists projects and
`POST /api/v1/projects` accepts `{"title":"...","subjectAreaId":"..."}`.
Remove the local flag when you want to exercise Firebase ID-token verification
and Firestore.

## Firebase and Firestore

The Worker targets Firebase project `sjs-be` (project number
`827720641620`) and database `(default)`. The selected Firestore location is
`asia-southeast1` (Singapore); a Firestore database's location cannot be
changed after creation.

Authenticate with Firebase CLI, then inspect the project's databases first:

```sh
npx.cmd --yes firebase-tools@latest login
npx.cmd --yes firebase-tools@latest firestore:databases:list --project sjs-be
```

If `(default)` does not exist, create it in Singapore:

```sh
npx.cmd --yes firebase-tools@latest firestore:databases:create '(default)' --location asia-southeast1 --edition standard --project sjs-be
```

Deploy the owner-scoped rules after reviewing the current Firebase rules:

```sh
npx.cmd --yes firebase-tools@latest deploy --only firestore:rules --project sjs-be
```

The Worker verifies Firebase ID tokens and forwards the user's token to the
Firestore REST API, so Firestore Security Rules enforce per-user access. No
service-account key is stored in the Worker.

## Cloudflare Worker

Authenticate Wrangler, then run locally or deploy:

```sh
npx.cmd wrangler login
npx.cmd wrangler dev
npx.cmd wrangler deploy
```

`FIREBASE_PROJECT_ID`, `FIRESTORE_DATABASE_ID`, and `ALLOWED_ORIGINS` are
non-secret Wrangler variables in `wrangler.jsonc`. The Worker needs no Firebase
service-account secret.
