# Bimbel AELC — Portal Admin Internal

Aplikasi internal kantor Bimbel AELC (CV Artta Yasa Nusantara): data siswa, guru, alokasi & invoice, jadwal mingguan, laporan pendapatan.

Stack: React (CRA + craco, Tailwind, shadcn/ui) · FastAPI · MongoDB.

## Struktur

```
frontend/   React app (yarn)           → di Vercel dibangun ke frontend/build
backend/    FastAPI (server.py)        → di Vercel dijalankan sebagai Serverless Function via api/index.py
api/index.py  Entrypoint Vercel (import `app` dari backend/server.py)
vercel.json   Konfigurasi Vercel (build frontend + rewrite /api/* → fungsi Python + SPA fallback)
requirements.txt  Dependensi Python minimal untuk Vercel (backend/requirements.txt = lengkap untuk Emergent)
```

Semua endpoint backend berawalan `/api`. Frontend memanggil `REACT_APP_BACKEND_URL + /api`; jika variabel itu tidak diset (mis. di Vercel), frontend otomatis memakai origin domainnya sendiri sehingga frontend & backend cukup satu project Vercel.

## Deploy ke Vercel lewat GitHub (1 project, 1 domain)

1. Push repo ini ke GitHub (gunakan tombol **Save to GitHub** di Emergent).
2. Di Vercel: **Add New Project → Import** repo tersebut. Biarkan *Root Directory* = `/` (root repo). Framework: **Other** (sudah diatur oleh `vercel.json`).
3. Isi **Environment Variables** (Production & Preview):

   | Variabel | Wajib | Contoh / Keterangan |
   |---|---|---|
   | `MONGO_URL` | ya | `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority` (MongoDB Atlas; izinkan IP `0.0.0.0/0` di Network Access) |
   | `DB_NAME` | ya | `aelc` |
   | `JWT_SECRET` | ya | string acak panjang (≥32 karakter) |
   | `ADMIN_EMAIL` | ya | email admin awal (disimpan otomatis saat pertama jalan) |
   | `ADMIN_PASSWORD` | ya | password admin awal — min 8 karakter, huruf besar, kecil, angka |
   | `ADMIN_NAME` | tidak | `Admin AELC` |
   | `CORS_ORIGINS` | tidak | kosongkan/`*` bila frontend & backend satu domain; atau daftar domain dipisah koma |
   | `EMERGENT_EMAIL_KEY` | untuk OTP | kunci layanan email (dipakai fitur ganti password via OTP) |
   | `EMAIL_FROM_NAME` | tidak | `Bimbel AELC` |
   | `REACT_APP_BACKEND_URL` | tidak | **kosongkan** untuk satu domain. Isi hanya bila backend dipisah ke domain lain |

4. Deploy. Cek `https://<domain-anda>/api/health` → `{"ok":true}`, lalu buka `https://<domain-anda>/login`.

### Mengapa dulu muncul `405 Method Not Allowed` saat login?
Frontend yang di-deploy sebagai situs statis menerima `POST /api/auth/login` padahal tidak ada backend di domain tersebut → hosting statis menjawab 405. Dengan `vercel.json` di repo ini, semua `/api/*` diteruskan ke fungsi Python (FastAPI sudah `@api.post("/auth/login")` + CORS aktif + preflight `OPTIONS` otomatis), sehingga login berjalan di domain yang sama.

## Menjalankan lokal (Emergent)
Backend: `uvicorn server:app --port 8001` di `backend/` (env dari `backend/.env`). Frontend: `yarn start` di `frontend/` (env `REACT_APP_BACKEND_URL` dari `frontend/.env`). Test backend: `cd backend && python -m pytest tests -q`.
