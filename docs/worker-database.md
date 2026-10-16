# 트리모아 Worker / D1

- Worker: `treemoa`
- D1 binding: `DB`
- 기존 공유 DB: `podomoa-db` (`8a232a2e-424c-45cc-a132-eae0e884fcef`)
- 앱 테이블: 전부 `treemoa_` 접두사 사용
- 마이그레이션: `migrations/treemoa`, 이력 테이블 `treemoa_d1_migrations`

포도모아의 테이블 및 `d1_migrations`는 수정하지 않는다. 새 데이터베이스를 생성하지 않는다. 같은 DB를 공유하므로 저장 용량과 D1 사용량은 공유된다.

| 테이블 | 용도 |
| --- | --- |
| treemoa_users | 토스 사용자 키와 트리모아 사용자 |
| treemoa_sessions | 세션 토큰 해시 및 만료 |
| treemoa_trees | 사용자별 1~5 슬롯, 색상, 현재 회차 |
| treemoa_cycles | 회차별 출석 횟수·마지막 한국 날짜·장식 배치 |
| treemoa_ad_completions | 서버 검증 광고 증빙과 소비 여부 |
| treemoa_attendance | 트리·회차·날짜별 출석 원장 |
| treemoa_settlements | 회차별 단일 보상 예약과 지급 상태 |
| treemoa_promotion_api_calls | 지급 및 결과 조회 이력 |

이전 회차 원장은 삭제하지 않는다. 다시 시작할 때 현재 회차를 증가시키고 새 회차를 생성해야 한다. 금액은 서버 출석 원장에서 계산하며 클라이언트 값을 신뢰하지 않는다. 광고 증빙 검증, 증빙 소비, 출석 기록, 횟수 변경, 다음 슬롯 해제는 서버에서 원자적으로 처리해야 한다. 사용자 소유권도 인증된 사용자로 확인해야 한다.

## 배포

해당 DB가 있는 Cloudflare 계정으로 로그인한 환경에서 실행한다.

```bash
npm ci
npx wrangler login
npm run db:migrate:remote
npm run worker:deploy
```

배포된 `treemoa` Worker의 `/api/health`가 200과 `database: ready`를 반환하면 연결 및 테이블 존재 확인이 완료된다. 미적용이면 503 `migration_required`, DB 연결 실패면 503 `unavailable`을 반환한다.

로컬 개발은 `npm run db:migrate:local`, `npm run worker:dev`를 사용한다.

## 현재 구현 범위

Worker 연결 설정, 초기 테이블 및 연결 확인 API만 추가했다. 프론트엔드는 아직 로컬 저장 방식을 사용한다. 토스 인증·실제 광고 검증·프로모션 지급과 프론트 DB 연동은 후속 구현이 필요하다. 인증되지 않은 사용자로 데이터가 저장되거나 포인트가 지급되는 쓰기 API는 노출하지 않는다. 이 문서의 배포 명령은 운영 적용 완료를 의미하지 않는다.
