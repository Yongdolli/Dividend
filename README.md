# 배당 복리 재투자 플래너 (Dividend Compounding Planner)

배당 복리 시뮬레이션, 포트폴리오 설계, 종목 분석을 제공하는 웹 앱입니다.

**v2.0 — 실시간 시장 데이터 기반으로 전면 재작성**

- 주가·배당수익률·배당 이력·연속 증배 연수: **Yahoo Finance 실시간 조회** (무료, API 키 불필요)
- 한글 종목명 검색(삼성전자, 맥쿼리인프라 등): 네이버 증권 자동완성으로 종목코드 변환
- 환율(USD/JPY/EUR → KRW): 실시간 조회
- Gemini AI는 **정성 해설(사업 모델·해자 분석 텍스트)에만 사용** — 모든 숫자는 실측 데이터
- 데이터 조회 실패 시 가짜 데이터를 만들지 않고 실패를 정직하게 표시

## 로컬 실행

**필요 사항:** Node.js 22+

```bash
npm install
npm run dev        # http://localhost:3000
```

Gemini AI 해설을 쓰려면 (선택):

```bash
cp .env.example .env.local
# .env.local 에 GEMINI_API_KEY 입력
```

키가 없어도 앱은 정상 동작합니다 — AI 해설 대신 실측 수치 기반 자동 요약이 표시됩니다.

## 배포 (Vercel 무료 티어 권장 — 잠들지 않음)

이 앱은 Vercel에 맞게 구성되어 있습니다. 화면은 CDN 정적 파일로, API 4개는 서버리스 함수(`api/` 폴더)로 배포되어 **콜드 슬립 없이** 무료로 운영됩니다.

1. 이 폴더를 GitHub 저장소로 푸시:
   ```bash
   git remote add origin https://github.com/<계정>/<저장소>.git
   git push -u origin main
   ```
2. [vercel.com](https://vercel.com) 가입(GitHub 계정으로) → **Add New → Project** → 저장소 선택
3. 설정은 `vercel.json`이 자동 적용되므로 그대로 **Deploy** 클릭
4. (선택) 프로젝트 Settings → Environment Variables 에 `GEMINI_API_KEY` 입력 후 재배포

로컬 개발은 기존 그대로 `npm run dev` (Express 서버가 동일한 핸들러를 사용합니다).

### 대안: Render

`render.yaml`도 포함되어 있어 Render로도 배포할 수 있습니다. 단, 무료 티어는 15분 미사용 시 잠들었다 깨어나는 지연이 있습니다.

## 주요 기능 (v2.1)

- **실전 포트폴리오 트래커**: 매수 평단가 입력 → 평가손익, 실측 Yield on Cost
- **실데이터 백테스트**: 과거 실제 주가·배당·환율로 적립식+배당재투자(DRIP) 재현 (최대 20년)
- **은퇴 설계**: 목표 세후 월배당 → 필요 월 적립액 역산 + 은퇴 후 30년 인출기 시뮬레이션
- **클라우드 저장** (선택): 이메일 매직링크 로그인으로 폰↔PC 포트폴리오 동기화

## 클라우드 저장 활성화 (선택)

Supabase 무료 티어를 사용합니다. 미설정 시 이 기능만 숨겨지고 나머지는 정상 동작합니다.

1. [supabase.com](https://supabase.com) 가입 → **New Project** 생성 (무료)
2. 프로젝트의 **SQL Editor**에서 아래 SQL 실행 (테이블 + 보안 정책 생성):
   ```sql
   create table public.portfolios (
     user_id uuid primary key references auth.users(id) on delete cascade,
     data jsonb not null,
     updated_at timestamptz not null default now()
   );
   alter table public.portfolios enable row level security;
   create policy "own row" on public.portfolios for all
     using (auth.uid() = user_id) with check (auth.uid() = user_id);
   ```
3. **Project Settings → API** 에서 `Project URL`과 `anon public` 키 복사
4. Vercel 프로젝트 **Settings → Environment Variables** 에 추가 후 재배포:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public 키
5. (로컬에서 쓰려면 `.env.local`에도 동일하게 추가)

## API 엔드포인트

| 엔드포인트 | 설명 |
|---|---|
| `GET /api/fx` | USD/JPY/EUR → KRW 실시간 환율 |
| `GET /api/sync-recs` | 추천 종목 보드 (실시간 시세 병합, 10분 캐시, `?force=true`로 강제 갱신) |
| `POST /api/refresh-quotes` | 보유 종목 일괄 시세 갱신 `{ holdings: [{ticker, currency}] }` |
| `POST /api/analyze-stock` | 종목 분석 `{ ticker, country }` — 티커·6자리 코드·한글명 지원 |
| `POST /api/backtest` | 과거 실데이터 백테스트 `{ holdings, years, initialCapital, monthlyContribution, reinvestDividends }` |

## 데이터 출처와 한계

- 시세는 Yahoo Finance 비공식 API([yahoo-finance2](https://github.com/gadicc/yahoo-finance2)) 기반으로, 거래소에 따라 15~20분 지연될 수 있습니다.
- 배당 안전성 점수는 배당성향·연속 증배 연수·수익률·지급 주기로 계산되는 **규칙 기반 점수**입니다.
- 추천 보드의 종목 해설·테마 점수는 큐레이션된 참고 자료이며 수치는 실시간 데이터입니다.
- 본 시뮬레이션 및 분석 결과는 참고용이며, 투자 판단과 책임은 투자자 본인에게 있습니다.
