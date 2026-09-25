"""Backend tests for security (login/lockout/backup-email/change-password) and new features."""
import os
import time
import uuid
import pytest
import bcrypt
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

from conftest import BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, MONGO_URL, DB_NAME  # noqa: F401

# Use a dedicated mongo client here for seed/cleanup of otp_codes and login_attempts
mongo = MongoClient(MONGO_URL)
db = mongo[DB_NAME]


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def auth(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ============ AUTH BASIC ============
def test_login_returns_backup_email_field(token):
    # /auth/me should return backup_email field
    r = requests.get(f"{BASE_URL}/api/auth/me",
                     headers={"Authorization": f"Bearer {token}"}, timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert "backup_email" in body
    assert body["email"] == ADMIN_EMAIL


def test_google_session_endpoint_removed():
    r = requests.post(f"{BASE_URL}/api/auth/session", json={}, timeout=10)
    assert r.status_code in (404, 405), f"expected 404/405 got {r.status_code}"


# ============ LOCKOUT ============
def test_lockout_after_5_failed_attempts():
    bogus_email = f"lock-{uuid.uuid4().hex[:8]}@test.com"
    statuses = []
    try:
        for i in range(6):
            r = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": bogus_email, "password": "wrong-pw"}, timeout=10)
            statuses.append(r.status_code)
        # First 4 should be 401
        assert statuses[0] == 401, f"got {statuses}"
        assert statuses[3] == 401, f"got {statuses}"
        # 5th and 6th should be 423
        assert statuses[4] == 423, f"got {statuses}"
        assert statuses[5] == 423, f"got {statuses}"
        # Message contains 'terkunci'
        last = requests.post(f"{BASE_URL}/api/auth/login",
                             json={"email": bogus_email, "password": "wrong-pw"}, timeout=10)
        assert last.status_code == 423
        text = (last.json().get("detail") or "").lower()
        assert "terkunci" in text
    finally:
        db.login_attempts.delete_one({"identifier": bogus_email})


# ============ BACKUP EMAIL ============
def test_backup_email_wrong_password_401(auth):
    r = auth.put(f"{BASE_URL}/api/auth/backup-email",
                 json={"backup_email": "delivered@resend.dev", "current_password": "WRONGpw123"})
    assert r.status_code == 401


def test_backup_email_set_correct(auth):
    r = auth.put(f"{BASE_URL}/api/auth/backup-email",
                 json={"backup_email": "delivered@resend.dev", "current_password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    assert r.json()["backup_email"] == "delivered@resend.dev"
    # verify persisted
    me = auth.get(f"{BASE_URL}/api/auth/me").json()
    assert me["backup_email"] == "delivered@resend.dev"


# ============ CHANGE PASSWORD OTP RATE LIMIT ============
def test_request_otp_and_rate_limit(auth):
    # Ensure backup_email is set first (dependency)
    auth.put(f"{BASE_URL}/api/auth/backup-email",
             json={"backup_email": "delivered@resend.dev", "current_password": ADMIN_PASSWORD})
    r1 = auth.post(f"{BASE_URL}/api/auth/change-password/request-otp")
    assert r1.status_code == 200, r1.text
    assert r1.json().get("ok") is True
    assert "sent_to" in r1.json()
    # Immediate second call → 429
    r2 = auth.post(f"{BASE_URL}/api/auth/change-password/request-otp")
    assert r2.status_code == 429


# ============ CHANGE PASSWORD VALIDATION ============
def _get_admin_user_id():
    u = db.users.find_one({"email": ADMIN_EMAIL})
    return u["id"]


def _seed_otp(code="123456"):
    uid = _get_admin_user_id()
    db.otp_codes.delete_many({"user_id": uid, "purpose": "change_password"})
    code_hash = bcrypt.hashpw(code.encode(), bcrypt.gensalt()).decode()
    db.otp_codes.insert_one({
        "user_id": uid, "purpose": "change_password",
        "code_hash": code_hash, "attempts": 0,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    })


def test_change_password_weak_rejected(auth):
    _seed_otp("123456")
    r = auth.post(f"{BASE_URL}/api/auth/change-password",
                  json={"current_password": ADMIN_PASSWORD, "new_password": "weak", "otp": "123456"})
    assert r.status_code == 400


def test_change_password_wrong_otp(auth):
    _seed_otp("123456")
    r = auth.post(f"{BASE_URL}/api/auth/change-password",
                  json={"current_password": ADMIN_PASSWORD, "new_password": "TempPass2026", "otp": "000000"})
    assert r.status_code == 400
    assert "OTP" in (r.json().get("detail") or "").upper() or "salah" in (r.json().get("detail") or "").lower()


def test_change_password_happy_and_restore(token):
    """Change to TempPass2026 → verify old token invalid → login with new → restore back to AelcAdmin2026."""
    old_headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    # Seed OTP
    _seed_otp("123456")
    r = requests.post(f"{BASE_URL}/api/auth/change-password",
                      headers=old_headers,
                      json={"current_password": ADMIN_PASSWORD, "new_password": "TempPass2026", "otp": "123456"},
                      timeout=15)
    assert r.status_code == 200, r.text
    new_token = r.json().get("token")
    assert new_token

    # Old token must now be invalid
    me_old = requests.get(f"{BASE_URL}/api/auth/me", headers=old_headers, timeout=10)
    assert me_old.status_code == 401

    # Login with new password
    lr = requests.post(f"{BASE_URL}/api/auth/login",
                       json={"email": ADMIN_EMAIL, "password": "TempPass2026"}, timeout=10)
    assert lr.status_code == 200
    tok2 = lr.json()["token"]

    # Restore back
    _seed_otp("123456")
    r2 = requests.post(f"{BASE_URL}/api/auth/change-password",
                       headers={"Authorization": f"Bearer {tok2}", "Content-Type": "application/json"},
                       json={"current_password": "TempPass2026", "new_password": ADMIN_PASSWORD, "otp": "123456"},
                       timeout=15)
    assert r2.status_code == 200, r2.text

    # Verify restored login works
    lr3 = requests.post(f"{BASE_URL}/api/auth/login",
                        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=10)
    assert lr3.status_code == 200


@pytest.fixture
def fresh_auth():
    """Re-login for tests that need a valid token AFTER pw change tests may have run."""
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}", "Content-Type": "application/json"})
    return s


# ============ TEACHER available_slots PERSISTENCE ============
def test_teacher_slots_persist(fresh_auth):
    auth = fresh_auth
    slots = ["Monday|10.00 - 11.00", "Tuesday|13.00 - 14.00"]
    r = auth.post(f"{BASE_URL}/api/teachers",
                  json={"nama": "TEST_SlotGuru", "available_slots": slots})
    assert r.status_code == 200
    t = r.json()
    tid = t["id"]
    try:
        assert t["available_slots"] == slots
        # Fetch list and verify
        lst = auth.get(f"{BASE_URL}/api/teachers").json()
        got = next(x for x in lst if x["id"] == tid)
        assert got["available_slots"] == slots
    finally:
        auth.delete(f"{BASE_URL}/api/teachers/{tid}")


# ============ SCHEDULE VALIDATION ============
def test_schedule_validation_and_all_days(fresh_auth):
    auth = fresh_auth
    tc = auth.post(f"{BASE_URL}/api/teachers", json={"nama": "TEST_SchedGuru2"}).json()
    st = auth.post(f"{BASE_URL}/api/students", json={
        "nama": "TEST_ScSt", "tanggal_lahir": "2015-01-01", "kelas": "3 SD",
        "asal_sekolah": "SD X", "program_kelas": "Junior Regular",
        "program_bimbel": "Bimbel Global", "biaya": 1, "no_hp": "0",
    }).json()
    tid, sid = tc["id"], st["id"]
    created_ids = []
    try:
        # Non-existent student → 404
        r = auth.post(f"{BASE_URL}/api/schedules", json={
            "day": "Monday", "time_slot": "10.00 - 11.00",
            "student_id": "nonexistent-xxx", "teacher_id": tid})
        assert r.status_code == 404

        # Valid for all 6 days
        for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]:
            r = auth.post(f"{BASE_URL}/api/schedules", json={
                "day": day, "time_slot": "10.00 - 11.00",
                "student_id": sid, "teacher_id": tid})
            assert r.status_code == 200, f"{day}: {r.text}"
            created_ids.append(r.json()["id"])

        # Duplicate → 409
        r = auth.post(f"{BASE_URL}/api/schedules", json={
            "day": "Monday", "time_slot": "10.00 - 11.00",
            "student_id": sid, "teacher_id": tid})
        assert r.status_code == 409
    finally:
        for cid in created_ids:
            auth.delete(f"{BASE_URL}/api/schedules/{cid}")
        auth.delete(f"{BASE_URL}/api/students/{sid}")
        auth.delete(f"{BASE_URL}/api/teachers/{tid}")
