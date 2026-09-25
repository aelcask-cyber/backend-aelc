from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, Header
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

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

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "type": "access",
               "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(request: Request) -> dict:
    # 1) Emergent Google session token (cookie or Authorization header)
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_hdr = request.headers.get("Authorization", "")
        if auth_hdr.startswith("Bearer "):
            # bearer could be either session_token or JWT — try session first
            candidate = auth_hdr[7:]
            sess = await db.user_sessions.find_one({"session_token": candidate}, {"_id": 0})
            if sess:
                session_token = candidate

    if session_token:
        sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
        if sess:
            exp = sess.get("expires_at")
            if isinstance(exp, str):
                exp = datetime.fromisoformat(exp)
            if exp and exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if not exp or exp >= datetime.now(timezone.utc):
                user = await db.users.find_one({"user_id": sess["user_id"]},
                                               {"_id": 0, "password_hash": 0})
                if user:
                    return user

    # 2) JWT token (legacy email/password login)
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0, "_id": 0})
        if not user:
            raise HTTPException(401, "User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")

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
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Email atau password salah")
    token = create_access_token(user["id"], user["email"])
    response.set_cookie("access_token", token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "name": user["name"]}}

@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    # Revoke Google session if present
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_hdr = request.headers.get("Authorization", "")
        if auth_hdr.startswith("Bearer "):
            session_token = auth_hdr[7:]
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

@api.post("/auth/session")
async def process_google_session(response: Response, x_session_id: Optional[str] = Header(None)):
    """Exchange Emergent Auth session_id for a session_token + user profile.
    Frontend receives the session_id from URL fragment after Google auth."""
    if not x_session_id:
        raise HTTPException(400, "Missing X-Session-ID header")
    try:
        async with httpx.AsyncClient(timeout=15) as hx:
            r = await hx.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": x_session_id},
            )
        if r.status_code != 200:
            raise HTTPException(401, "Invalid or expired Google session_id")
        data = r.json()
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Emergent session-data failed")
        raise HTTPException(502, f"Auth provider error: {e}")

    email = (data.get("email") or "").lower()
    name = data.get("name") or ""
    picture = data.get("picture") or ""
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(502, "Malformed session data")

    # Upsert user by email; keep JWT-seeded admin id/user_id if present
    existing = await db.users.find_one({"email": email})
    admin_email = os.environ.get("ADMIN_EMAIL", "").lower()
    role = "admin" if email == admin_email else (existing.get("role", "user") if existing else "user")
    if existing:
        user_id = existing.get("user_id") or existing.get("id") or f"user_{uuid.uuid4().hex[:12]}"
        await db.users.update_one({"email": email},
                                  {"$set": {"user_id": user_id, "name": name or existing.get("name", ""),
                                            "picture": picture, "role": role}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "id": user_id,
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": role,
            "created_at": now_iso(),
        })

    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires,
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie("session_token", session_token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")
    return {"user": {"user_id": user_id, "email": email, "name": name, "picture": picture, "role": role}}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

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
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)

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
        if existing.get("password_hash") and not verify_password(admin_pw, existing["password_hash"]):
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
