from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import shutil
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from ai.remove_bg import remove_background, extract_garment
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="NOVA AI Server",
    version="1.0.0"
)

app.mount("/output", StaticFiles(directory="output"), name="output")
# Allow React App
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "NOVA AI Server is Running 🚀"
    }

@app.get("/health")
def health():
    return {
        "status": "healthy"
    }

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@app.post("/upload")
async def upload_image(file: UploadFile = File(...), category: str = Form("")):
    file_path = UPLOAD_DIR / file.filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    output_path = Path("output") / f"{Path(file.filename).stem}_no_bg.png"

    extract_garment(file_path, output_path, category)

    return {
        "success": True,
        "filename": file.filename,
        "path": str(file_path),
        "processed_image": f"http://127.0.0.1:8000/output/{output_path.name}",
        "scan_note": "Garment-only crop generated. Review details before saving."
    }
