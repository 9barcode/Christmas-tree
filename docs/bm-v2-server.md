# BM v2 서버 API

기존 `/api/auth/anonymous` 세션의 Bearer 토큰을 사용한다. 신규 데이터는 `tree_bm_` 테이블에만 기록한다. 기존 출석·미션 API와 원장은 구버전 복구를 위해 유지하며 신규 클라이언트에서 호출하지 않는다. 기존 로컬 기록의 소급 적립이나 슬롯 이관은 수행하지 않는다.

광고 변수는 `INTERSTITIAL_AD_GROUP_ID`, `REWARDED_AD_GROUP_ID`, `BANNER_TEXT_AD_GROUP_ID`, `BANNER_IMAGE_AD_GROUP_ID` 네 개다. `/api/config`는 이미 해당 형식을 제공한다. 슬롯별 광고 ID는 사용하지 않는다.

| API | 내용 |
| --- | --- |
| GET /api/v2/state | 서버 슬롯, 트리별 일일 사용량, 미교환 잔액, 최근 지급 상태 |
| POST /api/v2/ads/reserve | `{purpose,slot}` → `{requestId,adGroupId,expiresAt}` |
| POST /api/v2/ads/complete | `{requestId,adGroupId,displayed:true,dismissed:true,eventType}` |
| POST /api/v2/ads/cancel | `{requestId}`; 광고 실패 시 예약 해제 |
| POST /api/v2/trees/complete | `{slot}`; 장식 30개일 때 30포인트 상당 한 번 적립 |
| POST /api/v2/trees/positions | `{slot,revision,positions}`; 획득한 장식·화분의 배치 저장, 변경 시 revision 증가 |
| POST /api/v2/exchanges/recover | `{}`; 교환 완료 광고의 최초 지급과 미확정 지급 복구 |

2026-10-21 최종 광고 규칙: `unlock-slot`과 `exchange-points`는 리워드 `userEarnedReward`, `earn-decoration`만 전면 `dismissed`다. SDK에서 실제 표시와 종료를 확인한 뒤 완료 요청을 전송한다. 실제 리워드 이벤트 없이 슬롯 해제·교환하지 않는다. SDK 이벤트 신고는 광고사업자의 독립 서명 검증이 아니다.

예약은 사용자당 한 건이며 10분 후 만료된다. 날짜가 바뀌면 기존 예약 완료는 거부되므로 취소하고 다시 예약한다. 슬롯 해제와 교환은 장식 일일 한도에 포함하지 않는다. 장식 변경과 요청 소진은 D1 batch 트랜잭션으로 묶으며, 동일 요청의 재전송은 재적립하지 않는다. **트리당 한국시간 하루 10개**, 트리 누적 장식 30개가 상한이다. 같은 날 다른 트리에도 각각 10개까지 모을 수 있다. 연속 출석 조건과 결석 초기화는 없다.

교환은 운영 상세가 미확정이므로 완성 슬롯당 30포인트 단위로 구현한다. 합산 교환과 새 회차 재시작은 제공하지 않는다. 신규 `TOSS_PROMOTION_CODE_EXCHANGE`와 기존 `TOSS_PROMOTION_MODE` 및 mTLS가 필요하다. 기존 출석 프로모션 코드를 자동으로 재사용하지 않는다. 지급 키와 코드·금액은 요청에 저장하고, 불명확한 지급은 같은 키로 복구한다. 성공 확인 전 잔액을 소진하지 않으며 활성 지급이 있으면 새 광고 예약을 거절하고 복구를 안내한다. 테스트 성공은 운영 적립액을 소진하지 않는다.

클라이언트는 교환 광고 완료 후 반드시 recover를 호출하고 재접속 때도 호출한다. 지급 중에는 다시 광고를 요구하지 않는다. 지급 성공 후 원장 갱신이 중단된 경우에도 recover로 복구한다.

## 적용 범위

홈 진입점은 `src/bm-home.js`다. 서버 인증·상태 복원 후 홈을 표시하며, `src/bm-client.js`가 예약 → 실제 광고 → 완료 → 서버 재조회 순서로 처리한다. SDK 완료 증거는 사용자별 로컬 보류 기록에 저장해 응답 유실 시 같은 요청으로 복구한다. 로컬 기록으로 장식·잔액을 만들지 않는다. 기존 `src/home.js`의 출석·결석·15/30일 정산은 새 홈에서 호출하지 않는다.

배치도 서버에 저장한다. revision이 다르면 다른 화면의 배치를 덮어쓰지 않고 최신 상태를 불러온다. 기존 로컬 저장 키는 삭제·덮어쓰기하지 않는다. 기존 사용자 기록 이관과 반복 회차 정책은 별도 확정 후 적용하며 이번에는 자동 소급이나 트리 재시작을 제공하지 않는다. 완성 트리 사진 저장·공유는 지급 성공과 분리한다.

## 배포

`0004_bm_positions.sql`까지 마이그레이션 후 Worker를 배포하고 새 AIT를 빌드한다. 광고 ID는 이미 Worker에 설정한 네 변수를 유지하며 `keep_vars: true`를 변경하지 않는다. 추가로 실제 교환에는 `TOSS_PROMOTION_CODE_EXCHANGE`와 mTLS 바인딩이 필요하다. 출석용 코드를 교환용으로 임의 대체하지 않는다. `TREE_API_BASE_URL`은 AIT 빌드 저장소 Variable에 Worker의 HTTPS 주소로 설정한다. 이전 BM 원장과 복구 API는 유지한다.

테스트 코드는 추가·실행하지 않았다. 빌드, Worker dry-run, JS·마이그레이션 구문과 미리보기 화면을 확인한다. 실제 SDK 노출·리워드 이벤트 및 프로모션 지급은 토스 실기기에서 확인해야 한다.
