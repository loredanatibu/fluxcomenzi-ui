# fluxcomenzi-ui

Angular 18 (standalone components) frontend for fluxcomenzi-api.

## Struct

- `src/app/core/models` — interfaces care oglindesc DTO-urile/entitățile din backend (`auth.model.ts`, `lucrare.model.ts`, `objective.model.ts`).
- `src/app/core/services` — `AuthService` (login/logout, token în `localStorage`), `LucrareService` (`GET`/`POST /api/lucrari`), `ObjectiveService` (`GET /api/obiective`), `RuntimeConfigService` (URL backend, vezi mai jos).
- `src/app/core/interceptors` — `auth.interceptor.ts` atașează automat `Authorization: Bearer <token>` pe orice request, în afară de `/auth/login`.
- `src/app/features` — câte un folder per ecran/componentă: `nav` (opțiunile 1-3, mereu vizibile — trăiesc în afara `<router-outlet>`, în `app.component.html`), `login` (user + parolă + buton Login), `tasks` (`TaskFormComponent`, formularul de creare lucrare de sub opțiunea 1), `placeholder` (opțiunile 2-3, de completat ulterior), `home`.
- `src/app/app.routes.ts` — `''`, `'obiective'` (opțiunea 1 → formular lucrare nouă), `'optiune-2/3'`.

## Backend contract folosit

- `POST /api/auth/login` cu `{ email, password }` → `{ token }` (câmpul din formular se numește "User" dar e validat ca email, conform `AuthDtos.LoginRequest`).
- `GET /api/obiective` (necesită `Authorization: Bearer <token>`) → listă de obiective (`{ id, nume, ... }`, vezi `com.mep.fluxcomenzi.model.Obiectiv`), folosită pentru combobox-ul "Obiectiv".
- `GET`/`POST /api/lucrari` → listă/creare lucrări (`{ id, idObiectiv, nume }`, vezi `com.mep.fluxcomenzi.model.Lucrare`). Formularul de sub opțiunea 1 ("Lucrare noua") creează o lucrare legată de obiectivul ales.

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
