from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import logging
import uuid
import secrets
import bcrypt
import jwt
from html import escape
from datetime import datetime, timezone, timedelta
from typing import List, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

from emailer import send_email, EMAIL_FROM_NAME

# ============ SETUP ============
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_ALGO = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

app = FastAPI(title="Bimbel AELC API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aelc")

# ============ HELPERS ============
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

SESSION_HOURS = 8
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 15
OTP_TTL_MINUTES = 10
PASSWORD_RULE = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$")

def create_access_token(user: dict) -> str:
    payload = {"sub": user["id"], "email": user["email"], "type": "access",
               "pv": int(user.get("pw_version", 0)),
               "exp": datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def validate_password_strength(pw: str):
    if not PASSWORD_RULE.match(pw or ""):
        raise HTTPException(400, "Password minimal 8 karakter dan wajib memuat huruf besar, huruf kecil, dan angka")

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Sesi berakhir, silakan login kembali")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(401, "Invalid token type")
    user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0, "_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    if int(payload.get("pv", 0)) != int(user.get("pw_version", 0)):
        raise HTTPException(401, "Sesi tidak berlaku karena password telah diubah")
    return user

def public_user(user: dict) -> dict:
    return {"id": user["id"], "email": user["email"], "name": user.get("name", ""),
            "role": user.get("role", "admin"), "backup_email": user.get("backup_email", "")}

async def check_lockout(email: str):
    rec = await db.login_attempts.find_one({"identifier": email}, {"_id": 0})
    if not rec:
        return
    locked_until = rec.get("locked_until")
    if locked_until:
        if isinstance(locked_until, str):
            locked_until = datetime.fromisoformat(locked_until)
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > datetime.now(timezone.utc):
            remaining = int((locked_until - datetime.now(timezone.utc)).total_seconds() // 60) + 1
            raise HTTPException(423, f"Akun terkunci karena terlalu banyak percobaan gagal. Coba lagi dalam {remaining} menit")
        await db.login_attempts.delete_one({"identifier": email})

async def record_failed_login(email: str) -> int:
    rec = await db.login_attempts.find_one({"identifier": email}, {"_id": 0})
    count = (rec.get("count", 0) if rec else 0) + 1
    update = {"identifier": email, "count": count, "updated_at": datetime.now(timezone.utc)}
    if count >= MAX_LOGIN_ATTEMPTS:
        update["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
    await db.login_attempts.update_one({"identifier": email}, {"$set": update}, upsert=True)
    return count

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def clean(doc):
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc

# ============ MODELS ============
PROGRAM_KELAS = Literal["Junior Regular", "Junior Intensive", "Super Child Regular", "Super Child Intensive"]
PROGRAM_BIMBEL = Literal["Bimbel Global", "Bimbel National", "Les Mandarin", "Les Jari Math Matematika"]
STATUS = Literal["Active", "Inactive"]
PAYMENT = Literal["Paid", "Unpaid"]
DAY = Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class BackupEmailReq(BaseModel):
    backup_email: EmailStr
    current_password: str

class ChangePasswordReq(BaseModel):
    current_password: str
    new_password: str
    otp: str

class Student(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    no_urut: int
    nama: str
    tanggal_lahir: str  # ISO date
    kelas: str
    asal_sekolah: str
    program_kelas: PROGRAM_KELAS
    program_bimbel: PROGRAM_BIMBEL
    biaya: float
    no_hp: str
    status: STATUS = "Active"
    created_at: str = Field(default_factory=now_iso)

class StudentCreate(BaseModel):
    nama: str
    tanggal_lahir: str
    kelas: str
    asal_sekolah: str
    program_kelas: PROGRAM_KELAS
    program_bimbel: PROGRAM_BIMBEL
    biaya: float
    no_hp: str

class Teacher(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nama: str
    mata_pelajaran: str = ""
    no_hp: str = ""
    status: STATUS = "Active"
    available_slots: List[str] = Field(default_factory=list)
    created_at: str = Field(default_factory=now_iso)

class TeacherCreate(BaseModel):
    nama: str
    mata_pelajaran: str = ""
    no_hp: str = ""
    available_slots: List[str] = Field(default_factory=list)

class Allocation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    teacher_id: str
    student_id: str
    pertemuan: int = 0
    biaya: float = 0
    buku: str = ""
    harga_buku: float = 0
    no_invoice: str = ""
    payment_status: PAYMENT = "Unpaid"
    created_at: str = Field(default_factory=now_iso)

class AllocationCreate(BaseModel):
    teacher_id: str
    student_id: str
    pertemuan: int = 0
    biaya: float = 0
    buku: str = ""
    harga_buku: float = 0
    no_invoice: str = ""
    payment_status: PAYMENT = "Unpaid"

class Schedule(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    day: DAY
    time_slot: str  # e.g. "14.00 - 15.00"
    student_id: str
    teacher_id: str
    created_at: str = Field(default_factory=now_iso)

class ScheduleCreate(BaseModel):
    day: DAY
    time_slot: str
    student_id: str
    teacher_id: str

class CompanySettings(BaseModel):
    alamat: str = ""
    bank_name: str = ""
    bank_account_number: str = ""
    bank_account_holder: str = ""

# ============ AUTH ROUTES ============
@api.post("/auth/login")
async def login(body: LoginReq, response: Response):
    email = body.email.lower()
    await check_lockout(email)
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        count = await record_failed_login(email)
        left = MAX_LOGIN_ATTEMPTS - count
        if left <= 0:
            raise HTTPException(423, f"Akun terkunci {LOCKOUT_MINUTES} menit karena {MAX_LOGIN_ATTEMPTS}x percobaan gagal")
        raise HTTPException(401, f"Email atau password salah ({left} percobaan tersisa)")
    await db.login_attempts.delete_one({"identifier": email})
    token = create_access_token(user)
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=SESSION_HOURS * 3600, path="/")
    return {"token": token, "user": public_user(user)}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)

@api.put("/auth/backup-email")
async def set_backup_email(body: BackupEmailReq, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(body.current_password, full.get("password_hash", "")):
        raise HTTPException(401, "Password saat ini salah")
    backup = body.backup_email.lower()
    if backup == full["email"]:
        raise HTTPException(400, "Email cadangan harus berbeda dari email login")
    await db.users.update_one({"id": user["id"]}, {"$set": {"backup_email": backup}})
    return {"ok": True, "backup_email": backup}

@api.post("/auth/change-password/request-otp")
async def request_password_otp(user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    backup = full.get("backup_email")
    if not backup:
        raise HTTPException(400, "Atur email cadangan terlebih dahulu")
    recent = await db.otp_codes.find_one({"user_id": user["id"], "purpose": "change_password",
                                          "created_at": {"$gt": datetime.now(timezone.utc) - timedelta(seconds=60)}})
    if recent:
        raise HTTPException(429, "Kode OTP baru saja dikirim. Tunggu 60 detik sebelum meminta lagi")
    code = f"{secrets.randbelow(1_000_000):06d}"
    await db.otp_codes.delete_many({"user_id": user["id"], "purpose": "change_password"})
    await db.otp_codes.insert_one({
        "user_id": user["id"], "purpose": "change_password",
        "code_hash": hash_password(code), "attempts": 0,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=OTP_TTL_MINUTES),
    })
    html = (
        '<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#0f172a">'
        f'<p>Halo {escape(full.get("name") or "Admin")},</p>'
        f'<p>Kode verifikasi untuk mengganti password akun <strong>{escape(full["email"])}</strong> di portal {escape(EMAIL_FROM_NAME)}:</p>'
        f'<p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#1d4ed8">{code}</p>'
        f'<p>Kode berlaku {OTP_TTL_MINUTES} menit. Abaikan email ini jika Anda tidak meminta penggantian password.</p>'
        f'<p style="font-size:12px;color:#888">Dikirim oleh {escape(EMAIL_FROM_NAME)}. Kami tidak pernah meminta password Anda melalui email.</p>'
        '</td></tr></table>'
    )
    await send_email(to=backup, subject=f"Kode verifikasi ganti password - {EMAIL_FROM_NAME}", html=html)
    masked = backup[:2] + "***" + backup[backup.index("@"):]
    return {"ok": True, "sent_to": masked, "expires_in_minutes": OTP_TTL_MINUTES}

@api.post("/auth/change-password")
async def change_password(body: ChangePasswordReq, response: Response, user: dict = Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(body.current_password, full.get("password_hash", "")):
        raise HTTPException(401, "Password saat ini salah")
    validate_password_strength(body.new_password)
    if body.new_password == body.current_password:
        raise HTTPException(400, "Password baru harus berbeda dari password saat ini")
    otp = await db.otp_codes.find_one({"user_id": user["id"], "purpose": "change_password"})
    if not otp:
        raise HTTPException(400, "Kode OTP belum diminta atau sudah kedaluwarsa")
    exp = otp["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc) or otp.get("attempts", 0) >= 5:
        await db.otp_codes.delete_one({"_id": otp["_id"]})
        raise HTTPException(400, "Kode OTP kedaluwarsa, silakan minta kode baru")
    if not verify_password(body.otp.strip(), otp["code_hash"]):
        await db.otp_codes.update_one({"_id": otp["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(400, "Kode OTP salah")
    await db.otp_codes.delete_one({"_id": otp["_id"]})
    new_version = int(full.get("pw_version", 0)) + 1
    await db.users.update_one({"id": user["id"]}, {"$set": {
        "password_hash": hash_password(body.new_password),
        "pw_version": new_version,
        "password_changed_at": now_iso(),
    }})
    full["pw_version"] = new_version
    token = create_access_token(full)
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=SESSION_HOURS * 3600, path="/")
    return {"ok": True, "token": token}

# ============ STUDENTS ============
async def next_no_urut() -> int:
    last = await db.students.find_one(sort=[("no_urut", -1)])
    return (last["no_urut"] + 1) if last else 1

@api.get("/students")
async def list_students(user: dict = Depends(get_current_user)):
    docs = await db.students.find({}, {"_id": 0}).sort("no_urut", 1).to_list(2000)
    return docs

@api.post("/students")
async def create_student(body: StudentCreate, user: dict = Depends(get_current_user)):
    no = await next_no_urut()
    s = Student(no_urut=no, **body.model_dump())
    await db.students.insert_one(s.model_dump())
    return s.model_dump()

@api.put("/students/{sid}")
async def update_student(sid: str, body: StudentCreate, user: dict = Depends(get_current_user)):
    existing = await db.students.find_one({"id": sid})
    if not existing:
        raise HTTPException(404, "Student not found")
    await db.students.update_one({"id": sid}, {"$set": body.model_dump()})
    return clean(await db.students.find_one({"id": sid}, {"_id": 0}))

@api.delete("/students/{sid}")
async def delete_student(sid: str, user: dict = Depends(get_current_user)):
    await db.students.delete_one({"id": sid})
    await db.allocations.delete_many({"student_id": sid})
    await db.schedules.delete_many({"student_id": sid})
    return {"ok": True}

# ============ TEACHERS ============
@api.get("/teachers")
async def list_teachers(user: dict = Depends(get_current_user)):
    return await db.teachers.find({}, {"_id": 0}).sort("nama", 1).to_list(500)

@api.post("/teachers")
async def create_teacher(body: TeacherCreate, user: dict = Depends(get_current_user)):
    t = Teacher(**body.model_dump())
    await db.teachers.insert_one(t.model_dump())
    return t.model_dump()

@api.put("/teachers/{tid}")
async def update_teacher(tid: str, body: TeacherCreate, user: dict = Depends(get_current_user)):
    if not await db.teachers.find_one({"id": tid}):
        raise HTTPException(404, "Teacher not found")
    await db.teachers.update_one({"id": tid}, {"$set": body.model_dump()})
    return clean(await db.teachers.find_one({"id": tid}, {"_id": 0}))

@api.delete("/teachers/{tid}")
async def delete_teacher(tid: str, user: dict = Depends(get_current_user)):
    await db.teachers.delete_one({"id": tid})
    await db.allocations.delete_many({"teacher_id": tid})
    await db.schedules.delete_many({"teacher_id": tid})
    return {"ok": True}

# ============ ALLOCATIONS ============
async def next_invoice_no(student_id: str = "") -> str:
    """Format: {FirstName}-INV-AELC-{MM}-{no_urut}"""
    mm = datetime.now(timezone.utc).strftime("%m")
    if student_id:
        st = await db.students.find_one({"id": student_id})
        if st:
            first_name = (st.get("nama") or "").split()[0] if st.get("nama") else "Siswa"
            first_name = first_name.replace(" ", "")
            return f"{first_name}-INV-AELC-{mm}-{st.get('no_urut', 0)}"
    year = datetime.now(timezone.utc).year
    count = await db.allocations.count_documents({"no_invoice": {"$regex": f"INV-AELC-{year}-"}})
    return f"INV-AELC-{mm}-{(count + 1):04d}"

@api.get("/allocations")
async def list_allocations(user: dict = Depends(get_current_user)):
    return await db.allocations.find({}, {"_id": 0}).sort("created_at", -1).to_list(2000)

@api.post("/allocations")
async def create_allocation(body: AllocationCreate, user: dict = Depends(get_current_user)):
    data = body.model_dump()
    if not data.get("no_invoice"):
        data["no_invoice"] = await next_invoice_no(data.get("student_id", ""))
    a = Allocation(**data)
    await db.allocations.insert_one(a.model_dump())
    return a.model_dump()

@api.put("/allocations/{aid}")
async def update_allocation(aid: str, body: AllocationCreate, user: dict = Depends(get_current_user)):
    if not await db.allocations.find_one({"id": aid}):
        raise HTTPException(404, "Allocation not found")
    data = body.model_dump()
    if not data.get("no_invoice"):
        existing = await db.allocations.find_one({"id": aid})
        data["no_invoice"] = existing.get("no_invoice") or await next_invoice_no(data.get("student_id", ""))
    await db.allocations.update_one({"id": aid}, {"$set": data})
    return clean(await db.allocations.find_one({"id": aid}, {"_id": 0}))

@api.delete("/allocations/{aid}")
async def delete_allocation(aid: str, user: dict = Depends(get_current_user)):
    await db.allocations.delete_one({"id": aid})
    return {"ok": True}

# ============ SCHEDULES ============
@api.get("/schedules")
async def list_schedules(user: dict = Depends(get_current_user)):
    return await db.schedules.find({}, {"_id": 0}).to_list(2000)

@api.post("/schedules")
async def create_schedule(body: ScheduleCreate, user: dict = Depends(get_current_user)):
    if not await db.students.find_one({"id": body.student_id}):
        raise HTTPException(404, "Siswa tidak ditemukan")
    if not await db.teachers.find_one({"id": body.teacher_id}):
        raise HTTPException(404, "Guru tidak ditemukan")
    dup = await db.schedules.find_one({"teacher_id": body.teacher_id, "student_id": body.student_id,
                                       "day": body.day, "time_slot": body.time_slot})
    if dup:
        raise HTTPException(409, "Siswa sudah terjadwal pada hari & jam ini")
    s = Schedule(**body.model_dump())
    await db.schedules.insert_one(s.model_dump())
    return s.model_dump()

@api.put("/schedules/{sid}")
async def update_schedule(sid: str, body: ScheduleCreate, user: dict = Depends(get_current_user)):
    if not await db.schedules.find_one({"id": sid}):
        raise HTTPException(404, "Schedule not found")
    await db.schedules.update_one({"id": sid}, {"$set": body.model_dump()})
    return clean(await db.schedules.find_one({"id": sid}, {"_id": 0}))

@api.delete("/schedules/{sid}")
async def delete_schedule(sid: str, user: dict = Depends(get_current_user)):
    await db.schedules.delete_one({"id": sid})
    return {"ok": True}

# ============ DASHBOARD ============
def _alloc_total(a: dict) -> float:
    """Total pembayaran = biaya per bulan + harga_buku (pertemuan hanya informasi, tidak dikalikan)."""
    biaya = float(a.get("biaya") or 0)
    harga_buku = float(a.get("harga_buku") or 0)
    return biaya + harga_buku

@api.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    total_siswa = await db.students.count_documents({})
    total_guru = await db.teachers.count_documents({})
    total_unpaid = await db.allocations.count_documents({"payment_status": "Unpaid"})

    allocs = await db.allocations.find({}, {"_id": 0}).to_list(5000)
    pendapatan = sum(_alloc_total(a) for a in allocs if a.get("payment_status") == "Paid")
    outstanding = sum(_alloc_total(a) for a in allocs if a.get("payment_status") == "Unpaid")

    return {
        "total_siswa": total_siswa,
        "total_guru": total_guru,
        "total_unpaid": total_unpaid,
        "pendapatan": pendapatan,
        "outstanding": outstanding,
    }

@api.get("/dashboard/revenue-monthly")
async def revenue_monthly(user: dict = Depends(get_current_user)):
    """Return last 6 months revenue (Paid + Unpaid) grouped by YYYY-MM based on allocation created_at."""
    now = datetime.now(timezone.utc)
    months = []
    for i in range(5, -1, -1):
        y = now.year
        m = now.month - i
        while m <= 0:
            m += 12
            y -= 1
        months.append(f"{y:04d}-{m:02d}")

    allocs = await db.allocations.find({}, {"_id": 0}).to_list(5000)
    buckets = {mk: {"month": mk, "paid": 0, "unpaid": 0} for mk in months}
    for a in allocs:
        ca = a.get("created_at")
        if not ca:
            continue
        key = ca[:7]
        if key not in buckets:
            continue
        total = _alloc_total(a)
        if a.get("payment_status") == "Paid":
            buckets[key]["paid"] += total
        else:
            buckets[key]["unpaid"] += total
    return [buckets[m] for m in months]

# ============ SETTINGS ============
class LogoBody(BaseModel):
    logo_data_url: str  # data:image/...;base64,...

@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    doc = await db.settings.find_one({"key": "app"}, {"_id": 0}) or {}
    return {
        "logo_data_url": doc.get("logo_data_url", ""),
        "alamat": doc.get("alamat", "Jl. Teratai No 19, Rawa Laut, Enggal, Tanjung Karang Timur, Bandar Lampung"),
        "bank_name": doc.get("bank_name", "BCA"),
        "bank_account_number": doc.get("bank_account_number", "4300961717"),
        "bank_account_holder": doc.get("bank_account_holder", "CV ARITA YASA NUSANTARA"),
    }

@api.put("/settings/company")
async def put_company(body: CompanySettings, user: dict = Depends(get_current_user)):
    await db.settings.update_one({"key": "app"},
                                 {"$set": {"key": "app", **body.model_dump(),
                                           "updated_at": now_iso()}},
                                 upsert=True)
    return {"ok": True}

@api.put("/settings/logo")
async def put_logo(body: LogoBody, user: dict = Depends(get_current_user)):
    if len(body.logo_data_url) > 2_500_000:
        raise HTTPException(400, "Logo terlalu besar (maks ~2MB)")
    await db.settings.update_one({"key": "app"},
                                 {"$set": {"key": "app", "logo_data_url": body.logo_data_url,
                                           "updated_at": now_iso()}},
                                 upsert=True)
    return {"ok": True}

@api.delete("/settings/logo")
async def delete_logo(user: dict = Depends(get_current_user)):
    await db.settings.update_one({"key": "app"}, {"$set": {"logo_data_url": ""}}, upsert=True)
    return {"ok": True}

# ============ STARTUP ============
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.students.create_index("no_urut")
    await db.login_attempts.create_index("identifier", unique=True)
    await db.otp_codes.create_index("expires_at", expireAfterSeconds=0)
    await db.schedules.create_index([("teacher_id", 1), ("day", 1), ("time_slot", 1)])

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_pw = os.environ.get("ADMIN_PASSWORD", "admin123")
    admin_name = os.environ.get("ADMIN_NAME", "Admin")

    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        uid = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "id": uid,
            "user_id": uid,
            "email": admin_email,
            "name": admin_name,
            "password_hash": hash_password(admin_pw),
            "role": "admin",
            "created_at": now_iso(),
        })
        logger.info(f"Seeded admin: {admin_email}")
    else:
        updates = {}
        if not existing.get("user_id"):
            updates["user_id"] = existing.get("id") or f"user_{uuid.uuid4().hex[:12]}"
        if existing.get("role") != "admin":
            updates["role"] = "admin"
        if not existing.get("password_hash"):
            updates["password_hash"] = hash_password(admin_pw)
        if updates:
            await db.users.update_one({"email": admin_email}, {"$set": updates})
            logger.info(f"Updated admin user: {admin_email}")

@app.on_event("shutdown")
async def shutdown():
    client.close()

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
