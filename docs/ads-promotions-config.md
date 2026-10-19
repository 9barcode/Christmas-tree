# 광고·프로모션 환경변수

포도모아의 REWARDED_AD_GROUP_ID, TOSS_PROMOTION_MODE, TOSS_PROMOTION_CODE_ATTENDANCE 이름을 따릅니다. 포도모아 운영 ID와 코드는 복사하지 않습니다.

Cloudflare Dashboard → Workers & Pages → treemoa → Settings → Variables and Secrets에서 등록합니다.

| 이름 | 종류 | 값 |
| --- | --- | --- |
| BANNER_AD_GROUP_ID | Secret 또는 Text | 트리모아 배너 광고 그룹 ID |
| REWARDED_AD_GROUP_ID | Secret 또는 Text | 트리모아 리워드 광고 그룹 ID |
| TOSS_PROMOTION_MODE | Secret 또는 Text | 운영 live, 테스트 test; 생략 시 live |
| TOSS_PROMOTION_CODE_ATTENDANCE | Secret | 트리 출석 누적 보상 지급 프로모션 코드 |

값은 저장소에 넣지 않습니다. wrangler.jsonc에 빈 vars를 넣어 대시보드 값을 덮어쓰지 않습니다. 반복 배포에서도 유지하려면 네 항목 모두 Worker Secrets로 등록하는 방식을 권장합니다. 로컬에서는 .dev.vars.example을 .dev.vars로 복사해 값을 입력합니다.

## 앱의 설정 조회

GitHub 원본 저장소 Settings → Secrets and variables → Actions → Variables에 TREE_API_BASE_URL을 등록합니다. 값은 배포된 treemoa Worker의 HTTPS 기본 주소이며 경로 /api는 붙이지 않습니다. 이 변수는 비밀이 아닙니다. 등록 후 AIT를 새로 빌드해야 기본 주소가 반영됩니다. 로컬 빌드는 TREE_API_BASE_URL 환경변수를 사용합니다. 미설정 시 같은 출처의 /api/config를 요청하므로 별도 출처인 토스 앱은 반드시 Worker 주소를 설정해야 합니다.

GET /api/config는 ads.bannerAdGroupId, ads.rewardedAdGroupId만 공개합니다. 프로모션 코드와 모드는 노출하지 않습니다. 광고 ID는 앱에서 사용하므로 Secret으로 등록해도 클라이언트에 공개됩니다.
앱에서는 window.treeServiceConfig.load() 또는 src/service-config.js의 loadServiceConfig()로 조회합니다. 실패 시 다시 호출할 수 있습니다. 홈 초기 로딩 중에는 호출하지 않습니다.

광고 ID 변경은 Worker 설정 반영 후 다음 설정 조회부터 적용됩니다. API 주소가 바뀔 때만 AIT 재빌드가 필요합니다.

## 서버 프로모션 설정

worker/config.js의 promotionConfig(env)는 서버 전용입니다. 운영 모드에 TEST_ 코드가 입력되면 오류로 거부하고, test 모드에서는 TEST_ 접두어를 붙입니다. 누락된 코드를 임의 값으로 대체하지 않습니다. 지급 구현은 빈 code를 거부해야 합니다.

## 현재 범위

이번 변경은 변수 등록·읽기·광고 설정 전달 경로입니다. 배너 SDK 부착, 리워드 SDK 시청 처리, 토스 인증과 실제 프로모션 지급 API는 아직 연결되지 않았습니다. 변수 입력만으로 광고 노출이나 지급이 시작되지는 않습니다.
