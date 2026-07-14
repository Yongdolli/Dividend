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

## 배포 (Render 무료 티어 권장)

1. 이 폴더를 GitHub 저장소로 푸시:
   ```bash
   git remote add origin https://github.com/<계정>/<저장소>.git
   git push -u origin main
   ```
2. [render.com](https://render.com) 가입 → **New → Web Service** → GitHub 저장소 연결
3. `render.yaml`이 자동 인식됩니다 (빌드: `npm install && npm run build`, 시작: `npm start`)
4. 환경 변수 `GEMINI_API_KEY`만 대시보드에서 입력 (선택)

무료 티어는 15분간 요청이 없으면 잠들었다가 첫 접속 시 몇십 초 걸려 깨어납니다. 개인용으로는 충분합니다.

## API 엔드포인트

| 엔드포인트 | 설명 |
|---|---|
| `GET /api/fx` | USD/JPY/EUR → KRW 실시간 환율 |
| `GET /api/sync-recs` | 추천 종목 보드 (실시간 시세 병합, 10분 캐시, `?force=true`로 강제 갱신) |
| `POST /api/refresh-quotes` | 보유 종목 일괄 시세 갱신 `{ holdings: [{ticker, currency}] }` |
| `POST /api/analyze-stock` | 종목 분석 `{ ticker, country }` — 티커·6자리 코드·한글명 지원 |

## 데이터 출처와 한계

- 시세는 Yahoo Finance 비공식 API([yahoo-finance2](https://github.com/gadicc/yahoo-finance2)) 기반으로, 거래소에 따라 15~20분 지연될 수 있습니다.
- 배당 안전성 점수는 배당성향·연속 증배 연수·수익률·지급 주기로 계산되는 **규칙 기반 점수**입니다.
- 추천 보드의 종목 해설·테마 점수는 큐레이션된 참고 자료이며 수치는 실시간 데이터입니다.
- 본 시뮬레이션 및 분석 결과는 참고용이며, 투자 판단과 책임은 투자자 본인에게 있습니다.
