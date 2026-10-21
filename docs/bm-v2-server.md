# BM v2 서버 API

기존 `/api/auth/anonymous` 세션의 Bearer 토큰을 사용한다. 신규 데이터는 `tree_bm_` 테이블에만 기록한다. 기존 출석·미션 API와 원장은 구버전 복구를 위해 유지하며 신규 클라이언트에서 호출하지 않는다. 기존 로컬 기록의 소급 적립이나 슬롯 이관은 수행하지 않는다.

광고 변수는 `INTERSTITIAL_AD_GROUP_ID`, `REWARDED_AD_GROUP_ID`, `BANNER_TEXT_AD_GROUP_ID`, `BANNER_IMAGE_AD_GROUP_ID` 네 개다. `/api/config`는 이미 해당 형식을 제공한다. 슬롯별 광고 ID는 사용하지 않는다.

| API | 내용 |
| --- | --- |
| GET /api/v2/state | 서버 슬롯, 전체 일일 사용량, 미교환 잔액, 최근 지급 상태 |
| POST /api/v2/ads/reserve | `{purpose,slot}` → `{requestId,adGroupId,expiresAt}` |
| POST /api/v2/ads/complete | `{requestId,adGroupId,displayed:true,dismissed:true,eventType}` |
| POST /api/v2/ads/cancel | `{requestId}`; 광고 실패 시 예약 해제 |
| POST /api/v2/trees/complete | `{slot}`; 장식 30개일 때 30포인트 상당 한 번 적립 |
| POST /api/v2/exchanges/recover | `{}`; 교환 완료 광고의 최초 지급과 미확정 지급 복구 |

목적은 `unlock-slot`(리워드 `userEarnedReward`), `earn-decoration`(전면 `dismissed`), `exchange-points`(전면 `dismissed`)다. SDK에서 실제 표시와 종료를 확인한 뒤 완료 요청을 전송한다. SDK 이벤트 신고는 광고사업자의 독립 서명 검증이 아니다.

예약은 사용자당 한 건이며 10분 후 만료된다. 날짜가 바뀌면 기존 예약 완료는 거부되므로 취소하고 다시 예약한다. 슬롯 해제와 교환은 장식 일일 한도에 포함하지 않는다. 장식 변경과 요청 소진은 D1 batch 트랜잭션으로 묶으며, 동일 요청의 재전송은 재적립하지 않는다. 하루 전체 10개, 슬롯 장식 30개가 상한이다. 결석으로 초기화하지 않는다.

교환은 운영 상세가 미확정이므로 완성 슬롯당 30포인트 단위로 구현한다. 합산 교환과 새 회차 재시작은 제공하지 않는다. 신규 `TOSS_PROMOTION_CODE_EXCHANGE`와 기존 `TOSS_PROMOTION_MODE` 및 mTLS가 필요하다. 기존 출석 프로모션 코드를 자동으로 재사용하지 않는다. 지급 키와 코드·금액은 요청에 저장하고, 불명확한 지급은 같은 키로 복구한다. 성공 확인 전 잔액을 소진하지 않으며 활성 지급이 있으면 새 광고 예약을 거절하고 복구를 안내한다. 테스트 성공은 운영 적립액을 소진하지 않는다.

클라이언트는 교환 광고 완료 후 반드시 recover를 호출하고 재접속 때도 호출한다. 지급 중에는 다시 광고를 요구하지 않는다. 지급 성공 후 원장 갱신이 중단된 경우에도 recover로 복구한다.

## 적용 범위

이번 변경은 서버 및 추가 마이그레이션이다. 프론트의 출석/정산 UI와 광고 호출은 아직 새 API로 교체해야 한다. 새 BM 클라이언트를 연결하기 전 운영 전환으로 안내하지 않는다. 기존 사용자 기록 이관과 반복 회차 정책은 별도 확정 후 적용한다. 테스트 코드는 추가·실행하지 않았으며 JavaScript 구문과 SQL 마이그레이션 구문만 확인했다.
