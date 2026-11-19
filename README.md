<div align="center">

<img src="./assets/Step1.png" width="100%" alt="GPT Companion" />

<br/>

# GPT Companion

**Your AI, Your Character.**

AI의 대화와 감정을 2D 캐릭터의 표정과 움직임으로 표현하는  
인터랙티브 AI 컴패니언 프로젝트

<br/>

![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)
![OpenCV](https://img.shields.io/badge/OpenCV-5C3EE8?style=flat-square&logo=opencv&logoColor=white)

</div>

---

### Overview

**GPT Companion**은 AI의 응답을 캐릭터의 감정과 움직임으로 시각화하는 프로젝트

사용자가 원하는 이미지로 자신만의 캐릭터를 생성하고,
캐릭터와 상호작용하는 새로운 AI 경험을 목표

### Features

- **AI Chat** — React · FastAPI 기반 채팅
- **Emotion Response** — AI 응답에 따른 감정 및 표정 변화
- **2D Animation** — 감정 강도에 따른 캐릭터 움직임
- **Manual Controls** — 표정 및 행동 수동 제어
- **Desktop Companion** — Electron 기반 데스크톱 캐릭터
- **Character Upload** — 사용자 이미지 업로드 및 분석
- **Automatic Rigging** — 얼굴 파츠 자동 인식 및 분리
- **Image Restoration** — OpenCV 기반 이미지 복원
- **Dynamic Rendering** — JSON 기반 캐릭터 자동 조립
- **Automatic Blinking** — 생성된 캐릭터의 자동 눈 깜빡임

### Automatic Rigging Pipeline

```mermaid
graph TD
    A[Image Upload] --> B[Image Analysis]
    B --> C[Feature Detection]
    C --> D[Part Classification]
    D --> E[Part Extraction]
    E --> F[Image Restoration]
    F --> G[JSON Rig Generation]
    G --> H[Character Rendering]
    H --> I[Animation]