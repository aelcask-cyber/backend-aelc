"""Backend API tests for Bimbel AELC."""
import os
import pytest
import requests

from conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, MONGO_URL, DB_NAME  # noqa: F401


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["user"]["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture(scope="session")
def auth(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# Auth
def test_login_invalid():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=10)
    assert r.status_code == 401


def test_students_requires_auth():
    r = requests.get(f"{BASE_URL}/api/students", timeout=10)
    assert r.status_code == 401


def test_me(auth):
    r = auth.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


# Students CRUD
def test_students_crud(auth):
    payload = {
        "nama": "TEST_Student One", "tanggal_lahir": "2015-05-10", "kelas": "3 SD",
        "asal_sekolah": "SD Test", "program_kelas": "Junior Regular",
        "program_bimbel": "Bimbel Global", "biaya": 500000, "no_hp": "081234567890",
    }
    r = auth.post(f"{BASE_URL}/api/students", json=payload)
    assert r.status_code == 200, r.text
    st = r.json()
    sid = st["id"]
    assert st["nama"] == payload["nama"]
    assert isinstance(st["no_urut"], int)

    r = auth.get(f"{BASE_URL}/api/students")
    assert r.status_code == 200
    assert any(s["id"] == sid for s in r.json())

    payload["nama"] = "TEST_Student Updated"
    r = auth.put(f"{BASE_URL}/api/students/{sid}", json=payload)
    assert r.status_code == 200
    assert r.json()["nama"] == "TEST_Student Updated"

    r = auth.delete(f"{BASE_URL}/api/students/{sid}")
    assert r.status_code == 200


# Teachers CRUD
def test_teachers_crud(auth):
    r = auth.post(f"{BASE_URL}/api/teachers",
                  json={"nama": "TEST_Guru", "mata_pelajaran": "Math", "no_hp": "081"})
    assert r.status_code == 200
    tid = r.json()["id"]
    r = auth.put(f"{BASE_URL}/api/teachers/{tid}",
                 json={"nama": "TEST_Guru2", "mata_pelajaran": "Math", "no_hp": "081"})
    assert r.status_code == 200 and r.json()["nama"] == "TEST_Guru2"
    r = auth.delete(f"{BASE_URL}/api/teachers/{tid}")
    assert r.status_code == 200


# Allocations + invoice format
def test_allocations_invoice_and_payment(auth):
    st = auth.post(f"{BASE_URL}/api/students", json={
        "nama": "TESTAndi Wijaya", "tanggal_lahir": "2015-01-01", "kelas": "3 SD",
        "asal_sekolah": "SD X", "program_kelas": "Junior Regular",
        "program_bimbel": "Bimbel Global", "biaya": 400000, "no_hp": "0812",
    }).json()
    tc = auth.post(f"{BASE_URL}/api/teachers", json={"nama": "TEST_Bu Rina"}).json()

    r = auth.post(f"{BASE_URL}/api/allocations", json={
        "teacher_id": tc["id"], "student_id": st["id"],
        "pertemuan": 8, "biaya": 400000, "buku": "Modul", "harga_buku": 50000,
    })
    assert r.status_code == 200, r.text
    a = r.json()
    assert "INV-AELC" in a["no_invoice"]
    assert a["payment_status"] == "Unpaid"

    r = auth.put(f"{BASE_URL}/api/allocations/{a['id']}", json={
        "teacher_id": tc["id"], "student_id": st["id"],
        "pertemuan": 8, "biaya": 400000, "buku": "Modul", "harga_buku": 50000,
        "no_invoice": a["no_invoice"], "payment_status": "Paid",
    })
    assert r.status_code == 200
    assert r.json()["payment_status"] == "Paid"

    auth.delete(f"{BASE_URL}/api/allocations/{a['id']}")
    auth.delete(f"{BASE_URL}/api/students/{st['id']}")
    auth.delete(f"{BASE_URL}/api/teachers/{tc['id']}")


# Schedules
def test_schedule_crud(auth):
    st = auth.post(f"{BASE_URL}/api/students", json={
        "nama": "TEST_Sched", "tanggal_lahir": "2015-01-01", "kelas": "3 SD",
        "asal_sekolah": "SD Y", "program_kelas": "Junior Regular",
        "program_bimbel": "Bimbel Global", "biaya": 100, "no_hp": "081",
    }).json()
    tc = auth.post(f"{BASE_URL}/api/teachers", json={"nama": "TEST_Sched_Guru"}).json()
    r = auth.post(f"{BASE_URL}/api/schedules", json={
        "day": "Monday", "time_slot": "14.00 - 15.00",
        "student_id": st["id"], "teacher_id": tc["id"],
    })
    assert r.status_code == 200
    sid = r.json()["id"]
    r = auth.get(f"{BASE_URL}/api/schedules")
    assert any(s["id"] == sid for s in r.json())
    auth.delete(f"{BASE_URL}/api/schedules/{sid}")
    auth.delete(f"{BASE_URL}/api/students/{st['id']}")
    auth.delete(f"{BASE_URL}/api/teachers/{tc['id']}")


# Dashboard
def test_dashboard_stats(auth):
    r = auth.get(f"{BASE_URL}/api/dashboard/stats")
    assert r.status_code == 200
    for k in ("total_siswa", "total_guru", "total_unpaid", "pendapatan", "outstanding"):
        assert k in r.json()


def test_dashboard_revenue(auth):
    r = auth.get(f"{BASE_URL}/api/dashboard/revenue-monthly")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) == 6
    for row in data:
        assert set(row.keys()) >= {"month", "paid", "unpaid"}


# Settings
def test_settings(auth):
    r = auth.get(f"{BASE_URL}/api/settings")
    assert r.status_code == 200
    orig = r.json()
    payload = {"alamat": "TEST alamat", "bank_name": "BCA",
               "bank_account_number": "12345", "bank_account_holder": "TEST"}
    try:
        r = auth.put(f"{BASE_URL}/api/settings/company", json=payload)
        assert r.status_code == 200
        r = auth.get(f"{BASE_URL}/api/settings")
        assert r.json()["alamat"] == "TEST alamat"
    finally:
        auth.put(f"{BASE_URL}/api/settings/company", json={k: orig.get(k, "") for k in payload})
