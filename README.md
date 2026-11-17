# 아침 5분 묵상

순종·감사·겸손으로 하루를 시작하는 개인용 PWA입니다. 아이폰과 학교 PC에서 함께 씁니다.

```
오늘의 말씀 → 묵상 질문 → 감사·다짐·기도 → 저장 (다짐은 첫 화면에 하루 종일)
```

## 바로 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 날짜·주제 순환·암호화·병합 테스트
npm run build    # dist/ 에 배포 파일 생성
```

## 구조

| 파일 | 하는 일 |
|---|---|
| `src/data/verses.ts` | 주제별 말씀 60구절 (장·절과 찾기용 요약만, 본문 없음) |
| `src/data/questions.ts` | 묵상 질문 30개 |
| `src/lib/today.ts` | 날짜 → 오늘의 주제·말씀·질문 (순종→감사→겸손 하루씩 순환) |
| `src/lib/db.ts` | 기기 안 저장소(IndexedDB, Dexie), 백업 내보내기/가져오기 |
| `src/lib/crypto.ts` | 비밀문구 → AES-GCM 키, 암호화/복호화 |
| `src/lib/sync.ts` | Supabase 동기화 (암호문만 오감, 최근 수정본 우선) |
| `src/lib/lock.ts` | 화면 잠금 PIN |
| `supabase/schema.sql` | 동기화용 표 + RLS |

## 말씀 본문

개역개정은 대한성서공회 저작권이 있어 본문을 코드에 넣지 않았습니다.
처음 만나는 구절은 앱에서 성경을 펴고 직접 적으면 저장되어 다음부터 보입니다.
(나 혼자 쓰는 앱이라는 전제입니다. 배포 주소는 아래처럼 접근을 막아 두세요.)

## 동기화 켜기 (아이폰 ↔ 학교 PC)

1. [supabase.com](https://supabase.com)에서 새 프로젝트 만들기 (무료 플랜으로 충분)
2. SQL Editor에 `supabase/schema.sql` 붙여 넣고 실행
3. Authentication → Sign In / Providers → **Allow new users to sign up 끄기**
4. Authentication → Users → **Add user**로 내 이메일·비밀번호 계정 직접 만들기
5. Project Settings → API에서 URL과 anon key를 복사해 `.env.local`에 넣기 (`.env.example` 참고)
6. 다시 빌드·배포 → 앱 설정에서 로그인 → **비밀문구** 정하기
7. 다른 기기에서도 같은 계정으로 로그인하고 **같은 비밀문구** 입력

> 비밀문구를 잊으면 서버에 있는 글은 되살릴 수 없습니다. 가끔 설정 → 백업 → 내보내기를 해 두세요.

## 배포 (나만 들어오게)

1. 이 폴더를 **비공개** GitHub 저장소로 올리기
2. Cloudflare Pages에서 저장소 연결 → Build command `npm run build`, Output `dist`
   → 환경 변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. Cloudflare Zero Trust → Access → Applications → 배포 주소에 내 이메일만 허용하는 정책 추가
4. 아이폰 Safari에서 열기 → 공유 → **홈 화면에 추가**
5. 학교 PC Chrome/Edge에서 열기 → 주소창의 **앱 설치** 버튼

## 8시 50분 알림

- **아이폰**: 단축어 → 자동화 → ＋ → 특정 시간 08:50, 월~금 → 즉시 실행 → “URL 열기”에 앱 주소
- **학교 PC**: 브라우저 시작 페이지를 앱 주소로 정하기

## 개인정보

- 기본적으로 모든 글은 기기 안에만 있습니다.
- 동기화를 켜면 글은 기기에서 암호화된 뒤 올라가며, 서버에는 알아볼 수 없는 문자열만 저장됩니다.
- 학교 PC에서는 **화면 잠금 PIN**을 켜고, 가능하면 나만 쓰는 브라우저 프로필에서 여세요.
  (PIN은 화면을 가리는 자물쇠이고, PC 안의 데이터를 암호화하지는 않습니다.)
