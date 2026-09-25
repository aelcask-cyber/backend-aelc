# PRD - Bimbel AELC Admin Portal

## Problem Statement (Original)
User meng-upload zip berisi proyek Emergent "Bimbel AELC" dan meminta: "tolong baca zip ini jadikan app web". Source code dipulihkan dari git history di dalam zip (working tree terhapus) dan di-deploy sebagai web app.

## User Personas
- **Admin Bimbel**: mengelola data siswa, guru, alokasi siswa-guru, jadwal mingguan, invoice, dan pengaturan perusahaan.

## Core Requirements (Static)
- Login admin (JWT email/password saja — Google login DIHAPUS, aplikasi internal kantor)
- Proteksi login: lockout 5x gagal → 15 menit, sesi 8 jam, password policy (min 8 + huruf besar/kecil + angka)
- Email cadangan (1) untuk OTP verifikasi ganti password (email via Emergent email proxy)
- Ganti password berkala dengan OTP; token lama otomatis invalid (pw_version)
- Dashboard statistik + grafik pendapatan 6 bulan
- CRUD Data Siswa (no_urut otomatis)
- CRUD Data Guru dengan Jam Mengajar per hari Senin–Sabtu × 10.00–17.00 (7 slot), format simpan `Monday|10.00 - 11.00`
- Alokasi Siswa per Guru dengan nomor invoice otomatis `{NamaDepan}-INV-AELC-{MM}-{no_urut}` + toggle Paid/Unpaid
- Jadwal mingguan (Senin-Sabtu): sel abu-abu jika guru tidak tersedia; nama siswa ≥3 kata dipotong jadi 2 kata
- Invoice: BILL TO urutan Nama → Tgl Lahir → Sekolah → No HP; PDF ukuran pas area invoice (tanpa ruang kosong); kirim via WhatsApp
- Pengaturan: info perusahaan (alamat, bank) + upload logo + Keamanan Akun

## Arsitektur
- Frontend: React (CRA/craco) + Tailwind + shadcn/ui, `/app/frontend/src/pages/*`
- Backend: FastAPI `/app/backend/server.py`, semua route prefix `/api`
- DB: MongoDB (MONGO_URL, DB_NAME=test_database)

## Implemented
- **25 Sep 2026**: Restore penuh dari zip (via git checkout) ke environment baru; install deps backend (pyjwt, bcrypt, httpx, emergentintegrations) & frontend (html2canvas, jspdf, jszip, pako, xlsx); admin seeded (aelc.ask@gmail.com); testing agent iteration_5: backend 10/10 PASS, frontend 100% PASS.
- **25 Sep 2026 (batch 2)**: (1) Guru: label "Jam Mengajar", checkbox per hari Senin–Sabtu × 7 slot 10.00–17.00, tabel tampil per hari. (2) Jadwal: shortName 2 kata, simpan optimistik + validasi backend (404/409), sel tidak tersedia abu-abu, baris grid = jam guru ∪ jam berjadwal. (3) Invoice: urutan BILL TO baku, PDF format custom [210, h] pas area invoice. (4) Keamanan: Google login dihapus (AuthCallback & /auth/session dihapus), lockout 5x/15 menit (423), JWT 8 jam, password policy, email cadangan + OTP (emailer.py, Emergent email proxy, env EMERGENT_EMAIL_KEY/EMAIL_FROM_NAME), ganti password invalidasi token lama (pw_version), 401 interceptor → /login. Testing agent iteration_6: backend 11/11 PASS, frontend 100% PASS.

## Backlog / Next Tasks
- P1: Tambah suffix unik pada nomor invoice agar tidak kolisi untuk siswa dengan >1 alokasi
- P1: Halaman kelola akun admin tambahan (multi-user internal) — saat ini hanya 1 admin seeded
- P2: Migrasi `@app.on_event` ke lifespan handler (deprecasi FastAPI)
- P2: Export Excel daftar siswa, reminder WhatsApp massal untuk invoice Unpaid
- P2: Pengingat ganti password berkala (mis. banner jika >90 hari sejak password_changed_at)
