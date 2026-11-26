<div align="center">

<img src="./assets/Step1.png" width="100%" alt="Step1" />

### A little closer to being alive.

대화하고, 감정을 표현하고, 일상을 함께하는 나만의 AI 동반자.

</div>

## About

Step1은 바탕화면에서 함께 생활하는 인터랙티브 AI 캐릭터 프로젝트입니다. 캐릭터의 외형·이름·성격·말투를 직접 설정하고, AI와 대화하며 상황에 어울리는 표정과 움직임을 경험할 수 있습니다.

**Tech:** Electron · React · TypeScript · FastAPI · Python · OpenCV

## Features

- **데스크톱 캐릭터** — 투명 창, 클릭·더블클릭·드래그, 50–200% 크기 조절
- **미니 채팅** — 독립 이동, 크기·투명도 조절 및 저장, 스튜디오와 세션 대화 동기화
- **대화와 감정** — 최근 대화의 맥락과 상황에 맞는 11가지 감정, 행동, 표정 자동 복귀
- **커스텀 캐릭터** — AI 파츠 분석, 수동 영역·관절 편집, 머리와 팔다리의 메시 리깅
- **표정 이미지** — 최대 4개 등록, 감정에 따른 부드러운 이미지 전환과 기본 표정 복귀
- **Companion Studio** — 모찌·루나·포미 또는 직접 만든 캐릭터, 개별 프로필 및 감정 테스트

## Getting Started (macOS)

Python 3.13, Node.js 20.19+ 또는 22.12+가 필요합니다. 저장소를 `~/Desktop/Step1`에 내려받은 경우를 기준으로 설명합니다.

### 1. Backend

```bash
cd ~/Desktop/Step1/backend
python3.13 -m venv ~/.venvs/step1
source ~/.venvs/step1/bin/activate
python -m pip install fastapi "uvicorn[standard]" python-multipart pillow numpy opencv-python-headless openai python-dotenv
uvicorn main:app --reload --reload-dir app
```

가상환경 생성과 라이브러리 설치는 최초 한 번만 실행합니다. 서버 상태: [API Health](http://127.0.0.1:8000/api/health)

### 2. Frontend

새 터미널을 열어 실행합니다.

```bash
cd ~/Desktop/Step1/frontend
npm ci
npm run dev
```

### 3. Desktop App

프론트엔드 서버를 실행한 상태에서 새로운 터미널을 엽니다.

```bash
cd ~/Desktop/Step1/frontend
npm run electron
```

캐릭터 클릭은 미니 채팅, 더블클릭은 설정창 열기·닫기입니다.

## AI Connection

| 방식 | 설명 |
| :--- | :--- |
| Mock | 무료 테스트 모드 (기본값, 제한적인 상황 반응) |
| ChatGPT | 앱의 **Continue with ChatGPT** 버튼으로 지원되는 계정 연동 |
| OpenAI API | `backend/.env.example` 참고, `backend/.env`에 API 키 저장 후 `STEP1_AI_PROVIDER=openai uvicorn main:app --reload --reload-dir app` 실행 |

ChatGPT 계정 연동은 [공식 로컬 앱 로그인 방식](https://developers.openai.com/siwc/token-sharing-open-source)을 사용하며 계정 지원 여부와 사용 한도에 따릅니다. OpenAI API는 별도 사용료가 발생할 수 있습니다.

> 실제 AI 모드에서는 현재 Step1 대화 문맥을 전송합니다. ChatGPT 기존 기록·기억은 가져오지 않으며, 계정 로그인 정보는 OS 암호화 저장소에 저장합니다.

## Custom Character

1. 대표 이미지를 등록합니다. 투명 PNG를 권장합니다.
2. 필요하면 AI 분석 또는 수동 편집으로 움직일 영역을 지정합니다.
3. 다른 표정의 이미지를 최대 4장 추가하고 각각 감정을 지정합니다.
4. 캐릭터를 생성한 후 감정 버튼으로 테스트합니다.

등록한 표정 그림은 대표 그림과 약 260ms 동안 부드럽게 전환됩니다. 표정이 끝나면 기본 그림으로 돌아오며, 표정별 이미지 없이도 메시 리깅으로 기본 감정을 표현할 수 있습니다.

## Development

```bash
# frontend
cd ~/Desktop/Step1/frontend
npm test
npm run build

# backend
cd ~/Desktop/Step1/backend
source ~/.venvs/step1/bin/activate
STEP1_AI_PROVIDER=mock python -m unittest discover -s tests -v
```

현재 단계 **STEP 21-3** · [개발 로드맵](./ROADMAP.md)

자동 리깅의 품질은 이미지와 지정 영역에 따라 달라질 수 있습니다. 장기 기억·대화 영구 저장·음성 대화는 추후 구현 예정입니다.

---

<div align="center"><sub>STEP1 — AI COMPANION PROJECT</sub></div>
