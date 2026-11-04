# aPI 독립적 실행 test  

from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

# 현재 파일과 같은 폴더의 .env 불러오기
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

# OpenAI 클라이언트 생성
client = OpenAI()

print("GPT에게 메시지를 보내는 중...")

# GPT API 호출
response = client.responses.create(
    model="gpt-4.1-mini",
    instructions=(
        "너는 GPT Companion 프로젝트의 친절한 AI 캐릭터야. "
        "한국어로 자연스럽고 간결하게 대답해."
    ),
    input="안녕! 나는 지금 너를 캐릭터로 만드는 프로그램을 개발하고 있어. 인사해 줄래?",
    max_output_tokens=150,
)

# GPT 답변 출력
print("\n===== GPT 응답 =====")
print(response.output_text)
print("====================")