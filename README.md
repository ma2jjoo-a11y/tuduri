# 투두리 — 조이의 스케줄 매니저

Google Calendar와 연동되는 모바일 웹앱입니다.

## 설정 방법

### 1. Google Cloud Console 설정

1. [Google Cloud Console](https://console.cloud.google.com/)에서 새 프로젝트 생성
2. "API 및 서비스" → "라이브러리"에서 **Google Calendar API** 활성화
3. "사용자 인증 정보" → **OAuth 2.0 클라이언트 ID** 생성
   - 유형: 웹 애플리케이션
   - 승인된 JavaScript 출처: `https://ma2jjoo-a11y.github.io`
4. **API 키** 생성 (Calendar API용)

### 2. app.js에 키 입력

```js
const GOOGLE_CLIENT_ID = '여기에_클라이언트_ID_입력';
const GOOGLE_API_KEY = '여기에_API_키_입력';
```

### 3. GitHub Pages 활성화

저장소 Settings → Pages → Source: main branch / root

접속 주소: `https://ma2jjoo-a11y.github.io/tuduri/`

## 기능

- 📅 Google Calendar 일정 조회 / 추가 / 수정
- ✅ 트랙 소개 자료 제작 할 일 체크리스트
- 📊 진행률 표시
- 📱 모바일 홈 화면에 앱으로 설치 가능 (PWA)
