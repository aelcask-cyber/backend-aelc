# PRD - Bimbel AELC Admin Portal

## Problem Statement (Original)
User meng-upload zip berisi proyek Emergent "Bimbel AELC" dan meminta: "tolong baca zip ini jadikan app web". Source code dipulihkan dari git history di dalam zip (working tree terhapus) dan di-deploy sebagai web app.

## User Personas
- **Admin Bimbel**: mengelola data siswa, guru, alokasi siswa-guru, jadwal mingguan, invoice, dan pengaturan perusahaan.

## Core Requirements (Static)
- Login admin (JWT email/password + Emergent Google Auth)
- Dashboard statistik + grafik pendapatan 6 bulan
- CRUD Data Siswa (no_urut otomatis)
- CRUD Data Guru
- Alokasi Siswa per Guru dengan nomor invoice otomatis `{NamaDepan}-INV-AELC-{MM}-{no_urut}` + toggle Paid/Unpaid
- Jadwal mingguan (Senin-Sabtu)
- Invoice: unduh PDF (jsPDF) + kirim via WhatsApp (wa.me)
- Pengaturan: info perusahaan (alamat, bank) + upload logo

## Arsitektur
- Frontend: React (CRA/craco) + Tailwind + shadcn/ui, `/app/frontend/src/pages/*`
- Backend: FastAPI `/app/backend/server.py`, semua route prefix `/api`
- DB: MongoDB (MONGO_URL, DB_NAME=test_database)

## Implemented
- **25 Sep 2026**: Restore penuh dari zip (via git checkout) ke environment baru; install deps backend (pyjwt, bcrypt, httpx, emergentintegrations) & frontend (html2canvas, jspdf, jszip, pako, xlsx); admin seeded (aelc.ask@gmail.com); testing agent iteration_5: backend 10/10 PASS, frontend 100% PASS.

## Backlog / Next Tasks
- P1: Tambah suffix unik pada nomor invoice agar tidak kolisi untuk siswa dengan >1 alokasi
- P2: Migrasi `@app.on_event` ke lifespan handler (deprecasi FastAPI)
- P2: Google OAuth end-to-end test (butuh akun Google riil)
- P2: Export Excel daftar siswa, reminder WhatsApp massal untuk invoice Unpaid
