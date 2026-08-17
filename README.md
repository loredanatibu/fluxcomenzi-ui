# fluxcomenzi-ui

Angular 18 (standalone components) frontend for fluxcomenzi-api.

## Struct

- `src/app/core/models` — interfaces care oglindesc DTO-urile/entitățile din backend (`auth.model.ts`, `task.model.ts`).
- `src/app/core/services` — `AuthService` (login/logout, token în `localStorage`), `TaskService` (`GET /api/tasks`), `RuntimeConfigService` (URL backend, vezi mai jos).
- `src/app/core/interceptors` — `auth.interceptor.ts` atașează automat `Authorization: Bearer <token>` pe orice request, în afară de `/auth/login`.
- `src/app/features` — câte un folder per ecran/componentă: `nav` (opțiunile 1-4, mereu vizibile — trăiesc în afara `<router-outlet>`, în `app.component.html`), `login` (user + parolă + buton Login), `tasks` (grid-ul de sub opțiunea 1), `placeholder` (opțiunile 2-4, de completat ulterior), `home`.
- `src/app/app.routes.ts` — `''`, `'obiective'` (opțiunea 1 → grid task-uri), `'optiune-2/3/4'`.

## Backend contract folosit

- `POST /api/auth/login` cu `{ email, password }` → `{ token }` (câmpul din formular se numește "User" dar e validat ca email, conform `AuthDtos.LoginRequest`).
- `GET /api/tasks` (necesită `Authorization: Bearer <token>`) → listă de task-uri; grid-ul afișează `id` și `name` (coloana "Nume Obiectiv" — vezi comentariul din `task.model.ts` pentru de ce nu există încă un nume de obiectiv denormalizat). Coloanele sunt definite ca listă în `TaskListComponent`, ușor de extins.

## Rulare locală (fără Docker)

```bash
npm install
npm start          # ng serve, http://localhost:4200
```

Backend-ul e așteptat la `http://localhost:8080/api` (vezi `src/environments/environment.ts`).

## Docker

```bash
cp .env.example .env   # ajustează UI_PORT / API_URL
docker compose up --build
```

`API_URL` e citit din environment la pornirea containerului (nu la build) — `docker/generate-env.sh` regenerează `src/assets/env.js` de fiecare dată, deci poți schimba backend-ul fără să reconstruiești imaginea.
