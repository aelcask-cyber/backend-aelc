# Bimbel AELC — PRD

## Original Problem Statement
Aplikasi web full-stack untuk operasional administrasi Bimbingan Belajar "Bimbel AELC" milik CV ARITA YASA NUSANTARA. Dashboard admin modern dengan 4 modul utama: Master Data Siswa, Data Siswa per Guru, Jadwal Mingguan, dan Invoice Penagihan (Save-to-PDF + Send-to-WhatsApp).

## User Personas
- **Admin Operasional Bimbel**: mengelola data siswa/guru, alokasi pengajaran, jadwal, dan menagih pembayaran via invoice PDF & WhatsApp.

## Core Requirements (Static)
1. Master Data Siswa CRUD (No Urut auto, Nama, Tgl Lahir, Kelas, Sekolah, Program Kelas, Program Bimbel, Biaya, No HP, Status).
2. Master Data Guru CRUD.
3. Alokasi Siswa per Guru dengan No Invoice auto-generate & status Paid/Unpaid.
4. Jadwal mingguan Senin–Jumat, grid time-slot × hari, sumber data dari alokasi.
5. Invoice dinamis dengan header CV ARITA YASA NUSANTARA, Bank BCA, tombol Save-to-PDF (jsPDF+html2canvas) & Send-to-WhatsApp (wa.me link).
6. JWT admin auth, semua endpoint /api prefix.

## Architecture / Tech
- **Backend**: FastAPI + Motor (MongoDB), bcrypt+PyJWT auth, semua model UUID string.
- **Frontend**: React 19, react-router 7, shadcn/ui + Tailwind, sonner toasts, jsPDF+html2canvas untuk PDF.
- **DB**: MongoDB `bimbel_aelc` (users, students, teachers, allocations, schedules).

## Implemented (2026-02-24)
- JWT login (admin seeded: aelc.ask@gmail.com / AelcAdmin2026)
- Sidebar layout + Dashboard KPI (6 stat cards)
- Master Data Siswa: CRUD, search, filter status, no_urut auto-increment
- Master Data Guru: CRUD
- Alokasi Siswa per Guru: CRUD, auto no_invoice INV-AELC-YYYY-NNNN, quick toggle Paid/Unpaid
- Jadwal mingguan grid (Mon–Fri × 7 time slot), tambah/hapus per sel, filter guru
- Invoice generator: preview branded, Save-to-PDF, Send-to-WhatsApp (auto format 0→62)
- Cascade delete siswa/guru → allocations + schedules
- Backend testing: 22/22 pass

## Backlog / Next Priorities
- P1: Dark mode toggle
- P1: Upload logo Bimbel AELC (replace placeholder)
- P1: Ekspor daftar siswa ke Excel/CSV
- P2: Filter tanggal & analitik pendapatan bulanan (chart)
- P2: Multi-invoice bulk WhatsApp reminder
- P2: Role guru (login guru untuk lihat jadwal sendiri)
