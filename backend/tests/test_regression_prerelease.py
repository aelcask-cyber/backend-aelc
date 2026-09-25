"""Pre-release regression tests: invoice numbering, cascade deletes, auth guards."""
import os
import pytest
import requests

from conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, MONGO_URL, DB_NAME  # noqa: F401


@pytest.fixture(scope="module")
def auth():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"})
    return s


# ---- Unauthenticated requests -> 401 ----
@pytest.mark.parametrize("path", [
    "/api/students", "/api/teachers", "/api/allocations",
    "/api/schedules", "/api/dashboard/stats", "/api/dashboard/revenue-monthly",
    "/api/settings", "/api/auth/me",
])
def test_unauthenticated_returns_401(path):
    r = requests.get(f"{BASE_URL}{path}", timeout=10)
    assert r.status_code == 401, f"{path}: got {r.status_code}"


# ---- Invoice numbering: -2 suffix on second allocation of same student ----
def test_invoice_second_allocation_gets_suffix(auth):
    st = auth.post(f"{BASE_URL}/api/students", json={
        "nama": "TEST_InvSiswa", "tanggal_lahir": "2015-01-01", "kelas": "3 SD",
        "asal_sekolah": "SD X", "program_kelas": "Junior Regular",
        "program_bimbel": "Bimbel Global", "biaya": 100000, "no_hp": "081",
    }).json()
    tc = auth.post(f"{BASE_URL}/api/teachers", json={"nama": "TEST_InvGuru"}).json()
    created = []
    try:
        a1 = auth.post(f"{BASE_URL}/api/allocations", json={
            "teacher_id": tc["id"], "student_id": st["id"],
            "pertemuan": 8, "biaya": 100000, "buku": "", "harga_buku": 0}).json()
        created.append(a1["id"])
        a2 = auth.post(f"{BASE_URL}/api/allocations", json={
            "teacher_id": tc["id"], "student_id": st["id"],
            "pertemuan": 4, "biaya": 50000, "buku": "", "harga_buku": 0}).json()
        created.append(a2["id"])
        # a2 must have "-2" suffix appended to a1's invoice base
        assert a2["no_invoice"].endswith("-2"), f"expected -2 suffix, got: a1={a1['no_invoice']}, a2={a2['no_invoice']}"
        assert a1["no_invoice"] != a2["no_invoice"]
        # 409 on manual duplicate
        r = auth.post(f"{BASE_URL}/api/allocations", json={
            "teacher_id": tc["id"], "student_id": st["id"],
            "pertemuan": 4, "biaya": 50000, "buku": "", "harga_buku": 0,
            "no_invoice": a1["no_invoice"]})
        assert r.status_code == 409
    finally:
        for aid in created:
            auth.delete(f"{BASE_URL}/api/allocations/{aid}")
        auth.delete(f"{BASE_URL}/api/students/{st['id']}")
        auth.delete(f"{BASE_URL}/api/teachers/{tc['id']}")


# ---- Cascade delete: student ----
def test_delete_student_cascades(auth):
    st = auth.post(f"{BASE_URL}/api/students", json={
        "nama": "TEST_CascSt", "tanggal_lahir": "2015-01-01", "kelas": "3 SD",
        "asal_sekolah": "SD X", "program_kelas": "Junior Regular",
        "program_bimbel": "Bimbel Global", "biaya": 100000, "no_hp": "081"}).json()
    tc = auth.post(f"{BASE_URL}/api/teachers", json={"nama": "TEST_CascGr"}).json()
    a = auth.post(f"{BASE_URL}/api/allocations", json={
        "teacher_id": tc["id"], "student_id": st["id"],
        "pertemuan": 8, "biaya": 100000, "buku": "", "harga_buku": 0}).json()
    sc = auth.post(f"{BASE_URL}/api/schedules", json={
        "day": "Monday", "time_slot": "10.00 - 11.00",
        "student_id": st["id"], "teacher_id": tc["id"]}).json()
    try:
        r = auth.delete(f"{BASE_URL}/api/students/{st['id']}")
        assert r.status_code == 200
        allocs = auth.get(f"{BASE_URL}/api/allocations").json()
        scheds = auth.get(f"{BASE_URL}/api/schedules").json()
        assert not any(x["id"] == a["id"] for x in allocs), "allocation not cascade-deleted"
        assert not any(x["id"] == sc["id"] for x in scheds), "schedule not cascade-deleted"
    finally:
        auth.delete(f"{BASE_URL}/api/teachers/{tc['id']}")


# ---- Cascade delete: teacher ----
def test_delete_teacher_cascades(auth):
    st = auth.post(f"{BASE_URL}/api/students", json={
        "nama": "TEST_CascStT", "tanggal_lahir": "2015-01-01", "kelas": "3 SD",
        "asal_sekolah": "SD X", "program_kelas": "Junior Regular",
        "program_bimbel": "Bimbel Global", "biaya": 100000, "no_hp": "081"}).json()
    tc = auth.post(f"{BASE_URL}/api/teachers", json={"nama": "TEST_CascGrT"}).json()
    a = auth.post(f"{BASE_URL}/api/allocations", json={
        "teacher_id": tc["id"], "student_id": st["id"],
        "pertemuan": 8, "biaya": 100000, "buku": "", "harga_buku": 0}).json()
    sc = auth.post(f"{BASE_URL}/api/schedules", json={
        "day": "Tuesday", "time_slot": "11.00 - 12.00",
        "student_id": st["id"], "teacher_id": tc["id"]}).json()
    try:
        r = auth.delete(f"{BASE_URL}/api/teachers/{tc['id']}")
        assert r.status_code == 200
        allocs = auth.get(f"{BASE_URL}/api/allocations").json()
        scheds = auth.get(f"{BASE_URL}/api/schedules").json()
        assert not any(x["id"] == a["id"] for x in allocs)
        assert not any(x["id"] == sc["id"] for x in scheds)
    finally:
        auth.delete(f"{BASE_URL}/api/students/{st['id']}")


# ---- Settings persistence ----
def test_settings_put_and_get_persist(auth):
    orig = auth.get(f"{BASE_URL}/api/settings").json()
    try:
        payload = {"alamat": "TEST_regress alamat 123", "bank_name": "TEST_BCA",
                   "bank_account_number": "9999", "bank_account_holder": "TEST_Holder"}
        r = auth.put(f"{BASE_URL}/api/settings/company", json=payload)
        assert r.status_code == 200
        g = auth.get(f"{BASE_URL}/api/settings").json()
        for k, v in payload.items():
            assert g[k] == v, f"{k} not persisted"
    finally:
        # restore
        auth.put(f"{BASE_URL}/api/settings/company", json={
            "alamat": orig.get("alamat", ""),
            "bank_name": orig.get("bank_name", ""),
            "bank_account_number": orig.get("bank_account_number", ""),
            "bank_account_holder": orig.get("bank_account_holder", ""),
        })
