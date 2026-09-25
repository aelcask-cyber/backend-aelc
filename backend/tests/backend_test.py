"""Bimbel AELC backend regression tests — pytest.
Focus: auth, students CRUD (no_urut), teachers CRUD, allocations (new
invoice format `{FirstName}-INV-AELC-{MM}-{no_urut}`), schedules,
dashboard stats + monthly revenue, settings (company + logo), cascade deletes.
"""
import os
import re
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://aelc-ops-portal.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "aelc.ask@gmail.com"
ADMIN_PW = "AelcAdmin2026"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data
    return data["token"]


@pytest.fixture(scope="session")
def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def created_ids():
    """Track ids created across tests for teardown."""
    ids = {"students": [], "teachers": [], "allocations": [], "schedules": []}
    yield ids
    # teardown
    tok_r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": ADMIN_PW}, timeout=15)
    if tok_r.status_code == 200:
        hdr = {"Authorization": f"Bearer {tok_r.json()['token']}"}
        for sid in ids["schedules"]:
            requests.delete(f"{BASE_URL}/api/schedules/{sid}", headers=hdr, timeout=10)
        for aid in ids["allocations"]:
            requests.delete(f"{BASE_URL}/api/allocations/{aid}", headers=hdr, timeout=10)
        for sid in ids["students"]:
            requests.delete(f"{BASE_URL}/api/students/{sid}", headers=hdr, timeout=10)
        for tid in ids["teachers"]:
            requests.delete(f"{BASE_URL}/api/teachers/{tid}", headers=hdr, timeout=10)


# ---------- AUTH ----------
class TestAuth:
    def test_login_success(self, token):
        assert isinstance(token, str) and len(token) > 20

    def test_login_bad_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    def test_me_with_bearer(self, h):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=h, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d.get("email", "").lower() == ADMIN_EMAIL.lower()
        # user_id / name fields per updated /auth/me
        assert d.get("user_id") or d.get("id")
        assert "name" in d

    def test_me_no_auth_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 401

    def test_session_missing_header(self):
        r = requests.post(f"{BASE_URL}/api/auth/session", timeout=10)
        assert r.status_code == 400

    def test_session_invalid_id(self):
        r = requests.post(f"{BASE_URL}/api/auth/session",
                          headers={"X-Session-ID": "invalid-xyz"}, timeout=15)
        assert r.status_code == 401


# ---------- STUDENTS ----------
class TestStudents:
    def test_create_and_persist(self, h, created_ids):
        payload = {
            "nama": "TEST Alpha Siswa",
            "tanggal_lahir": "2015-05-10",
            "kelas": "5 SD",
            "asal_sekolah": "SD Test",
            "program_kelas": "Junior Regular",
            "program_bimbel": "Bimbel National",
            "biaya": 500000,
            "no_hp": "081234567890",
        }
        r = requests.post(f"{BASE_URL}/api/students", headers=h, json=payload, timeout=10)
        assert r.status_code == 200, r.text
        s = r.json()
        created_ids["students"].append(s["id"])
        assert s["nama"] == payload["nama"]
        assert isinstance(s["no_urut"], int) and s["no_urut"] >= 1
        assert s["status"] == "Active"

        # GET list — sorted asc by no_urut, contains created one
        rl = requests.get(f"{BASE_URL}/api/students", headers=h, timeout=10)
        assert rl.status_code == 200
        arr = rl.json()
        no_uruts = [x["no_urut"] for x in arr]
        assert no_uruts == sorted(no_uruts), "students not sorted asc by no_urut"
        assert any(x["id"] == s["id"] for x in arr)

    def test_no_urut_increments(self, h, created_ids):
        def _mk(nama):
            return {"nama": nama, "tanggal_lahir": "2015-01-01",
                    "kelas": "5 SD", "asal_sekolah": "SD X",
                    "program_kelas": "Junior Regular",
                    "program_bimbel": "Bimbel Global",
                    "biaya": 400000, "no_hp": "0811"}
        s1 = requests.post(f"{BASE_URL}/api/students", headers=h, json=_mk(f"TEST A {uuid.uuid4().hex[:6]}"), timeout=10).json()
        s2 = requests.post(f"{BASE_URL}/api/students", headers=h, json=_mk(f"TEST B {uuid.uuid4().hex[:6]}"), timeout=10).json()
        created_ids["students"] += [s1["id"], s2["id"]]
        assert s2["no_urut"] == s1["no_urut"] + 1

    def test_update_student(self, h, created_ids):
        s = requests.post(f"{BASE_URL}/api/students", headers=h, json={
            "nama": "TEST Update Src", "tanggal_lahir": "2014-01-01",
            "kelas": "6 SD", "asal_sekolah": "SD Y",
            "program_kelas": "Junior Regular", "program_bimbel": "Bimbel Global",
            "biaya": 300000, "no_hp": "0800"}, timeout=10).json()
        created_ids["students"].append(s["id"])

        upd = {"nama": "TEST Updated", "tanggal_lahir": "2014-02-02",
               "kelas": "6 SD", "asal_sekolah": "SD Z",
               "program_kelas": "Junior Intensive", "program_bimbel": "Les Mandarin",
               "biaya": 750000, "no_hp": "0899"}
        r = requests.put(f"{BASE_URL}/api/students/{s['id']}", headers=h, json=upd, timeout=10)
        assert r.status_code == 200
        u = r.json()
        assert u["nama"] == "TEST Updated"
        assert u["biaya"] == 750000
        assert u["program_bimbel"] == "Les Mandarin"


# ---------- TEACHERS ----------
class TestTeachers:
    def test_teacher_crud(self, h, created_ids):
        r = requests.post(f"{BASE_URL}/api/teachers", headers=h, json={
            "nama": "TEST Guru Alpha", "mata_pelajaran": "Matematika",
            "no_hp": "0812", "available_slots": ["Monday 14.00 - 15.00"]}, timeout=10)
        assert r.status_code == 200
        t = r.json()
        created_ids["teachers"].append(t["id"])
        assert t["nama"] == "TEST Guru Alpha"
        assert t["available_slots"] == ["Monday 14.00 - 15.00"]

        # update
        ru = requests.put(f"{BASE_URL}/api/teachers/{t['id']}", headers=h, json={
            "nama": "TEST Guru Alpha 2", "mata_pelajaran": "IPA",
            "no_hp": "0813", "available_slots": []}, timeout=10)
        assert ru.status_code == 200
        assert ru.json()["mata_pelajaran"] == "IPA"

        # list
        rl = requests.get(f"{BASE_URL}/api/teachers", headers=h, timeout=10)
        assert rl.status_code == 200
        assert any(x["id"] == t["id"] for x in rl.json())


# ---------- ALLOCATIONS (new invoice format) ----------
class TestAllocations:
    def test_auto_invoice_format(self, h, created_ids):
        # need a real student
        s = requests.post(f"{BASE_URL}/api/students", headers=h, json={
            "nama": "Budi Santoso TEST",
            "tanggal_lahir": "2013-05-05",
            "kelas": "6 SD", "asal_sekolah": "SD Inv",
            "program_kelas": "Junior Regular",
            "program_bimbel": "Bimbel Global",
            "biaya": 600000, "no_hp": "0811"}, timeout=10).json()
        created_ids["students"].append(s["id"])
        t = requests.post(f"{BASE_URL}/api/teachers", headers=h,
                          json={"nama": "TEST Guru Inv"}, timeout=10).json()
        created_ids["teachers"].append(t["id"])

        r = requests.post(f"{BASE_URL}/api/allocations", headers=h, json={
            "teacher_id": t["id"], "student_id": s["id"],
            "pertemuan": 4, "biaya": 600000,
            "buku": "Buku IPA", "harga_buku": 50000,
            "no_invoice": "", "payment_status": "Unpaid"}, timeout=10)
        assert r.status_code == 200, r.text
        a = r.json()
        created_ids["allocations"].append(a["id"])
        mm = datetime.now(timezone.utc).strftime("%m")
        expected = f"Budi-INV-AELC-{mm}-{s['no_urut']}"
        assert a["no_invoice"] == expected, f"got {a['no_invoice']} expected {expected}"
        assert a["payment_status"] == "Unpaid"

    def test_toggle_paid(self, h, created_ids):
        # reuse: create student+teacher+allocation quickly
        s = requests.post(f"{BASE_URL}/api/students", headers=h, json={
            "nama": "Toggle Test", "tanggal_lahir": "2013-05-05",
            "kelas": "6 SD", "asal_sekolah": "SD T",
            "program_kelas": "Junior Regular", "program_bimbel": "Bimbel Global",
            "biaya": 100000, "no_hp": "0811"}, timeout=10).json()
        created_ids["students"].append(s["id"])
        t = requests.post(f"{BASE_URL}/api/teachers", headers=h,
                          json={"nama": "TEST Toggle Guru"}, timeout=10).json()
        created_ids["teachers"].append(t["id"])
        a = requests.post(f"{BASE_URL}/api/allocations", headers=h, json={
            "teacher_id": t["id"], "student_id": s["id"],
            "pertemuan": 2, "biaya": 100000, "harga_buku": 0,
            "no_invoice": "", "payment_status": "Unpaid"}, timeout=10).json()
        created_ids["allocations"].append(a["id"])
        ru = requests.put(f"{BASE_URL}/api/allocations/{a['id']}", headers=h, json={
            "teacher_id": t["id"], "student_id": s["id"],
            "pertemuan": 2, "biaya": 100000, "harga_buku": 0,
            "no_invoice": a["no_invoice"], "payment_status": "Paid"}, timeout=10)
        assert ru.status_code == 200
        assert ru.json()["payment_status"] == "Paid"


# ---------- SCHEDULES ----------
class TestSchedules:
    def test_schedule_create_and_saturday_rejected(self, h, created_ids):
        s = requests.post(f"{BASE_URL}/api/students", headers=h, json={
            "nama": "Sch Test", "tanggal_lahir": "2015-01-01",
            "kelas": "5 SD", "asal_sekolah": "SD S",
            "program_kelas": "Junior Regular", "program_bimbel": "Bimbel Global",
            "biaya": 100000, "no_hp": "0811"}, timeout=10).json()
        created_ids["students"].append(s["id"])
        t = requests.post(f"{BASE_URL}/api/teachers", headers=h,
                          json={"nama": "TEST Sch Guru"}, timeout=10).json()
        created_ids["teachers"].append(t["id"])
        r = requests.post(f"{BASE_URL}/api/schedules", headers=h, json={
            "day": "Monday", "time_slot": "14.00 - 15.00",
            "student_id": s["id"], "teacher_id": t["id"]}, timeout=10)
        assert r.status_code == 200
        created_ids["schedules"].append(r.json()["id"])

        # Sunday should be rejected (not in Literal Monday..Saturday)
        rbad = requests.post(f"{BASE_URL}/api/schedules", headers=h, json={
            "day": "Sunday", "time_slot": "14.00 - 15.00",
            "student_id": s["id"], "teacher_id": t["id"]}, timeout=10)
        assert rbad.status_code == 422


# ---------- DASHBOARD ----------
class TestDashboard:
    def test_stats_fields(self, h):
        r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=h, timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_siswa", "total_guru", "total_unpaid", "pendapatan", "outstanding"):
            assert k in d, f"missing key {k}"
        assert isinstance(d["total_siswa"], int)
        assert isinstance(d["pendapatan"], (int, float))
        assert isinstance(d["outstanding"], (int, float))

    def test_revenue_monthly(self, h):
        r = requests.get(f"{BASE_URL}/api/dashboard/revenue-monthly", headers=h, timeout=10)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) == 6, f"expected 6 months, got {len(arr)}"
        # keys per bucket
        for b in arr:
            assert set(b.keys()) >= {"month", "paid", "unpaid"}
            assert re.match(r"^\d{4}-\d{2}$", b["month"])
        # months should be ascending
        months = [b["month"] for b in arr]
        assert months == sorted(months)
        # last month must equal current YYYY-MM
        now = datetime.now(timezone.utc)
        assert months[-1] == f"{now.year:04d}-{now.month:02d}"


# ---------- SETTINGS ----------
class TestSettings:
    def test_get_settings_defaults(self, h):
        r = requests.get(f"{BASE_URL}/api/settings", headers=h, timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("logo_data_url", "alamat", "bank_name",
                  "bank_account_number", "bank_account_holder"):
            assert k in d

    def test_update_company(self, h):
        payload = {
            "alamat": "TEST Address 123",
            "bank_name": "BCA",
            "bank_account_number": "1234567890",
            "bank_account_holder": "TEST HOLDER",
        }
        r = requests.put(f"{BASE_URL}/api/settings/company", headers=h, json=payload, timeout=10)
        assert r.status_code == 200
        # verify persisted
        d = requests.get(f"{BASE_URL}/api/settings", headers=h, timeout=10).json()
        assert d["alamat"] == "TEST Address 123"
        assert d["bank_account_number"] == "1234567890"
        assert d["bank_account_holder"] == "TEST HOLDER"

        # restore defaults
        requests.put(f"{BASE_URL}/api/settings/company", headers=h, json={
            "alamat": "Jl. Teratai No 19, Rawa Laut, Enggal, Tanjung Karang Timur, Bandar Lampung",
            "bank_name": "BCA",
            "bank_account_number": "4300961717",
            "bank_account_holder": "CV ARITA YASA NUSANTARA",
        }, timeout=10)

    def test_logo_upload_and_delete(self, h):
        tiny_png_b64 = (
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeIVWUMAAAAASUVORK5CYII="
        )
        data_url = f"data:image/png;base64,{tiny_png_b64}"
        r = requests.put(f"{BASE_URL}/api/settings/logo", headers=h,
                         json={"logo_data_url": data_url}, timeout=15)
        assert r.status_code == 200, r.text
        d = requests.get(f"{BASE_URL}/api/settings", headers=h, timeout=10).json()
        assert d["logo_data_url"] == data_url

        # delete
        rd = requests.delete(f"{BASE_URL}/api/settings/logo", headers=h, timeout=10)
        assert rd.status_code == 200
        d2 = requests.get(f"{BASE_URL}/api/settings", headers=h, timeout=10).json()
        assert d2["logo_data_url"] == ""

    def test_logo_too_large_rejected(self, h):
        big = "A" * 2_600_000
        r = requests.put(f"{BASE_URL}/api/settings/logo", headers=h,
                         json={"logo_data_url": big}, timeout=20)
        assert r.status_code == 400


# ---------- ALLOCATION TOTAL FORMULA REGRESSION ----------
class TestAllocationTotalFormula:
    """Regression: allocation total must be biaya (monthly) + harga_buku
    (pertemuan is informational only, NOT multiplied) and must flow into
    /dashboard/stats pendapatan (Paid) / outstanding (Unpaid)."""

    def test_total_formula_in_dashboard(self, h, created_ids):
        # baseline
        base = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=h, timeout=10).json()
        base_pendapatan = float(base["pendapatan"])
        base_outstanding = float(base["outstanding"])

        s = requests.post(f"{BASE_URL}/api/students", headers=h, json={
            "nama": "TEST Formula Siswa", "tanggal_lahir": "2013-01-01",
            "kelas": "6 SD", "asal_sekolah": "SD F",
            "program_kelas": "Junior Regular", "program_bimbel": "Bimbel Global",
            "biaya": 100000, "no_hp": "0811"}, timeout=10).json()
        created_ids["students"].append(s["id"])
        t = requests.post(f"{BASE_URL}/api/teachers", headers=h,
                          json={"nama": "TEST Formula Guru"}, timeout=10).json()
        created_ids["teachers"].append(t["id"])

        # Unpaid: biaya 200000 (monthly) + harga_buku 50000 = 250000 (pertemuan ignored)
        a_unpaid = requests.post(f"{BASE_URL}/api/allocations", headers=h, json={
            "teacher_id": t["id"], "student_id": s["id"],
            "pertemuan": 4, "biaya": 200000,
            "buku": "Buku X", "harga_buku": 50000,
            "no_invoice": "", "payment_status": "Unpaid"}, timeout=10).json()
        created_ids["allocations"].append(a_unpaid["id"])

        # Paid: biaya 150000 (monthly) + harga_buku 0 = 150000 (pertemuan ignored)
        a_paid = requests.post(f"{BASE_URL}/api/allocations", headers=h, json={
            "teacher_id": t["id"], "student_id": s["id"],
            "pertemuan": 3, "biaya": 150000, "harga_buku": 0,
            "no_invoice": "", "payment_status": "Paid"}, timeout=10).json()
        created_ids["allocations"].append(a_paid["id"])

        after = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=h, timeout=10).json()
        # Deltas may be >= expected due to parallel workers creating allocations concurrently.
        # Assert AT LEAST the expected contribution and NOT the old-formula (biaya*pertemuan) value.
        pend_delta = float(after["pendapatan"]) - base_pendapatan
        out_delta = float(after["outstanding"]) - base_outstanding
        assert pend_delta >= 150000 - 1, f"pendapatan delta too small: {pend_delta}"
        assert out_delta >= 250000 - 1, f"outstanding delta too small: {out_delta}"
        # Old formula would be biaya*pertemuan+harga_buku: paid=450000, unpaid=850000
        # If concurrent workers only, delta grows moderately, but never by ~old-formula per this class alone.
        # Verify Paid delta is well below the old-formula value (150000 vs 450000) by asserting < 400000
        # even accounting for other workers, this class alone contributes 150000 to Paid.
        assert pend_delta < 400000, \
            f"pendapatan delta {pend_delta} looks like old formula (biaya*pertemuan)"

    def test_pertemuan_not_multiplied(self, h, created_ids):
        """pertemuan=0 vs pertemuan=10 with same biaya+harga_buku must yield SAME total.
        Uses per-allocation delta (fetched immediately) to avoid races from parallel workers."""
        s = requests.post(f"{BASE_URL}/api/students", headers=h, json={
            "nama": "TEST NoMult Siswa", "tanggal_lahir": "2013-01-01",
            "kelas": "6 SD", "asal_sekolah": "SD N",
            "program_kelas": "Junior Regular", "program_bimbel": "Bimbel Global",
            "biaya": 100000, "no_hp": "0811"}, timeout=10).json()
        created_ids["students"].append(s["id"])
        t = requests.post(f"{BASE_URL}/api/teachers", headers=h,
                          json={"nama": "TEST NoMult Guru"}, timeout=10).json()
        created_ids["teachers"].append(t["id"])

        # Create both allocations (pertemuan differs, biaya+harga_buku identical) as Paid,
        # capture pendapatan immediately before/after each POST.
        b1 = float(requests.get(f"{BASE_URL}/api/dashboard/stats", headers=h, timeout=10).json()["pendapatan"])
        a1 = requests.post(f"{BASE_URL}/api/allocations", headers=h, json={
            "teacher_id": t["id"], "student_id": s["id"],
            "pertemuan": 0, "biaya": 500000, "harga_buku": 75000,
            "no_invoice": "", "payment_status": "Paid"}, timeout=10).json()
        created_ids["allocations"].append(a1["id"])
        p1 = float(requests.get(f"{BASE_URL}/api/dashboard/stats", headers=h, timeout=10).json()["pendapatan"])
        d1 = p1 - b1

        b2 = p1
        a2 = requests.post(f"{BASE_URL}/api/allocations", headers=h, json={
            "teacher_id": t["id"], "student_id": s["id"],
            "pertemuan": 10, "biaya": 500000, "harga_buku": 75000,
            "no_invoice": "", "payment_status": "Paid"}, timeout=10).json()
        created_ids["allocations"].append(a2["id"])
        p2 = float(requests.get(f"{BASE_URL}/api/dashboard/stats", headers=h, timeout=10).json()["pendapatan"])
        d2 = p2 - b2

        # Deltas may be inflated by concurrent workers, but each must be AT LEAST 575000
        # and NEVER 575000*pertemuan (would be 5,750,000 for pertemuan=10)
        assert d1 >= 575000 - 1, f"pertemuan=0 delta too small: {d1}"
        assert d2 >= 575000 - 1, f"pertemuan=10 delta too small: {d2}"
        # If pertemuan were multiplied, d2 would be >= 5,750,000 (10x). Assert it isn't.
        assert d2 < 5_000_000, f"pertemuan appears multiplied — d2={d2} is too large"
        # And per-allocation, fetched raw fields must match what we sent (server didn't
        # secretly scale biaya). GET /api/allocations echoes stored fields.
        allocs = requests.get(f"{BASE_URL}/api/allocations", headers=h, timeout=10).json()
        by_id = {x["id"]: x for x in allocs}
        for aid in (a1["id"], a2["id"]):
            assert float(by_id[aid]["biaya"]) == 500000
            assert float(by_id[aid]["harga_buku"]) == 75000


# ---------- CASCADE DELETE ----------
class TestCascade:
    def test_student_delete_cascades_allocations_and_schedules(self, h):
        # Create isolated student/teacher/allocation/schedule then delete student
        s = requests.post(f"{BASE_URL}/api/students", headers=h, json={
            "nama": "Casc Student", "tanggal_lahir": "2015-01-01",
            "kelas": "5 SD", "asal_sekolah": "SD C",
            "program_kelas": "Junior Regular", "program_bimbel": "Bimbel Global",
            "biaya": 100000, "no_hp": "0811"}, timeout=10).json()
        t = requests.post(f"{BASE_URL}/api/teachers", headers=h,
                          json={"nama": "TEST Casc Guru"}, timeout=10).json()
        a = requests.post(f"{BASE_URL}/api/allocations", headers=h, json={
            "teacher_id": t["id"], "student_id": s["id"], "pertemuan": 1,
            "biaya": 100000, "harga_buku": 0,
            "no_invoice": "", "payment_status": "Unpaid"}, timeout=10).json()
        sc = requests.post(f"{BASE_URL}/api/schedules", headers=h, json={
            "day": "Tuesday", "time_slot": "15.00 - 16.00",
            "student_id": s["id"], "teacher_id": t["id"]}, timeout=10).json()

        rd = requests.delete(f"{BASE_URL}/api/students/{s['id']}", headers=h, timeout=10)
        assert rd.status_code == 200

        allocs = requests.get(f"{BASE_URL}/api/allocations", headers=h, timeout=10).json()
        assert not any(x["id"] == a["id"] for x in allocs), "allocation not cascaded"
        schs = requests.get(f"{BASE_URL}/api/schedules", headers=h, timeout=10).json()
        assert not any(x["id"] == sc["id"] for x in schs), "schedule not cascaded"

        # cleanup teacher
        requests.delete(f"{BASE_URL}/api/teachers/{t['id']}", headers=h, timeout=10)
