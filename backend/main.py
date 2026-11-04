from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.services.ai_service import ai_service


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


# 채팅 요청 데이터
class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


# 채팅 응답 데이터
class ChatResponse(BaseModel):
    reply: str


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
@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest):

    reply = ai_service.chat(request.message)

    return ChatResponse(reply=reply)