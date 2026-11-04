// FastAPI 서버 주소
const API_BASE_URL = "http://127.0.0.1:8000";

// 서버에서 반환하는 응답 타입
interface ChatResponse {
  reply: string;
}

// 백엔드에 메시지를 보내는 함수
export async function sendChatMessage(
  message: string
): Promise<string> {

  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      message: message,
    }),
  });

  // 서버에서 오류가 발생한 경우
  if (!response.ok) {
    throw new Error(
      `채팅 요청 실패: ${response.status}`
    );
  }

  // 서버 응답을 JSON으로 변환
  const data: ChatResponse = await response.json();

  return data.reply;
}