from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from PIL import Image, UnidentifiedImageError
from io import BytesIO

from app.services.ai_service import ai_service
from app.services.character_service import character_service
from app.services.rig_service import rig_service
from app.schemas.ai import AIResponse


# FastAPI 애플리케이션 생성
app = FastAPI()


# React 개발 서버 접근 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# 생성된 캐릭터 이미지 접근 허용
app.mount(
    "/generated",
    StaticFiles(directory=str(rig_service.output_dir)),
    name="generated"
)


# 채팅 요청 데이터
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


# 기본 API
@app.get("/")
def read_root():
    return {
        "message": "GPT Companion Backend is running!"
    }


# 서버 상태 확인 API
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "message": "FastAPI 서버 연결 성공!"
    }


# 채팅 API
@app.post("/api/chat", response_model=AIResponse)
def chat(request: ChatRequest) -> AIResponse:
    return ai_service.chat(request.message)


# ========================================
# 공통 이미지 검증 함수
# ========================================

async def validate_image(file: UploadFile):

    allowed_types = [
        "image/png",
        "image/jpeg",
        "image/webp",
    ]

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="지원하지 않는 이미지 형식입니다."
        )

    max_size = 10 * 1024 * 1024

    contents = await file.read(max_size + 1)

    if len(contents) > max_size:
        raise HTTPException(
            status_code=400,
            detail="이미지는 10MB 이하여야 합니다."
        )

    try:
        with Image.open(BytesIO(contents)) as image:

            if image.format not in ["PNG", "JPEG", "WEBP"]:
                raise HTTPException(
                    status_code=400,
                    detail="지원하지 않는 이미지 형식입니다."
                )

            width, height = image.size

            if width * height > 16000000:
                raise HTTPException(
                    status_code=400,
                    detail="이미지 해상도가 너무 큽니다."
                )

            metadata = {
                "width": width,
                "height": height,
                "format": image.format,
                "mode": image.mode,
                "has_alpha": (
                    "A" in image.getbands()
                    or "transparency" in image.info
                )
            }

            image.verify()

    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
    ):
        raise HTTPException(
            status_code=400,
            detail="이미지를 분석할 수 없습니다."
        )

    return contents, metadata


# ========================================
# 캐릭터 이미지 분석 API
# ========================================

@app.post("/api/character/analyze")
async def analyze_character(file: UploadFile = File(...)):

    contents, metadata = await validate_image(file)

    try:
        geometry = await run_in_threadpool(
            character_service.analyze,
            contents
        )

    except (ValueError, OSError) as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    return {
        "status": "success",
        "filename": file.filename,
        **metadata,
        "geometry": geometry,
        "message": "캐릭터 이미지 분석 완료!"
    }


# ========================================
# 캐릭터 자동 리깅 생성 API
# ========================================

@app.post("/api/character/generate")
async def generate_character(file: UploadFile = File(...)):

    contents, metadata = await validate_image(file)

    try:
        rig = await run_in_threadpool(
            rig_service.generate,
            contents
        )

    except (ValueError, OSError) as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )

    return {
        "status": "success",
        "filename": file.filename,
        "base_url": f"/generated/{rig['id']}/",
        "rig": rig,
        "message": "캐릭터 리깅 생성 완료!"
    }