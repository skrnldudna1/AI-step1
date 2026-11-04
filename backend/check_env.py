import os
from dotenv import load_dotenv

# .env 파일 불러오기
load_dotenv()

# API 키 읽기
api_key = os.getenv("OPENAI_API_KEY")

if api_key:
    print("OpenAI API 키를 정상적으로 불러왔습니다.")
else:
    print("OpenAI API 키를 찾을 수 없습니다.")