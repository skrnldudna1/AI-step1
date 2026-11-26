# Step1 — Development

개발 환경 실행 및 테스트를 위한 문서입니다. [프로젝트 소개](./README.md)

## macOS

Python 3.13과 Node.js 22.12 이상 (또는 Node.js 20.19 이상 20.x)을 사용합니다. 아래 예시는 `~/Desktop/Step1` 기준입니다.

### Backend

```bash
cd ~/Desktop/Step1/backend
python3.13 -m venv ~/.venvs/step1
source ~/.venvs/step1/bin/activate
python -m pip install fastapi "uvicorn[standard]" python-multipart pillow numpy opencv-python-headless openai python-dotenv
uvicorn main:app --reload --reload-dir app
```

가상환경 생성과 라이브러리 설치는 최초 한 번만 실행합니다. 기존 가상환경이 있는 경우 활성화한 뒤 실행하면 됩니다.

서버 상태: [API Health](http://127.0.0.1:8000/api/health)

### Frontend

```bash
cd ~/Desktop/Step1/frontend
npm ci
npm run dev
```

### Desktop

프런트엔드 개발 서버를 실행한 상태에서 새 터미널을 엽니다.

```bash
cd ~/Desktop/Step1/frontend
npm run electron
```

## AI 연결

- 기본값: 무료 Mock 테스트 모드.
- ChatGPT: 데스크톱 앱의 **Continue with ChatGPT** 버튼으로 연결합니다. 계정 지원 여부와 사용 한도에 따릅니다.
- OpenAI API: `backend/.env.example`을 참고하여 `backend/.env`에 API 키를 설정한 다음 백엔드를 실행합니다. 별도 API 사용료가 발생할 수 있습니다.

```bash
STEP1_AI_PROVIDER=openai uvicorn main:app --reload --reload-dir app
```

실제 AI 모드에서는 현재 Step1 대화 문맥이 전송됩니다. ChatGPT의 기존 대화 기록 또는 기억은 가져오지 않으며, 계정 로그인 정보는 OS 암호화 저장소에서 관리합니다.

## Tests

```bash
cd ~/Desktop/Step1/frontend
npm test
npm run build

cd ~/Desktop/Step1/backend
source ~/.venvs/step1/bin/activate
STEP1_AI_PROVIDER=mock python -m unittest discover -s tests -v
```
