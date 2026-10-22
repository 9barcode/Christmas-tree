# 광고·프로모션 환경변수

> 아래는 이전 출석 버전의 설정 이력이다. 현재 연결된 BM v2에서는 [런타임 광고 변수](runtime-ad-variables.md)와 [서버 연결 명세](bm-v2-server.md)를 사용한다. 광고 변수 4개를 유지하며 트리 추가·교환은 리워드, 장식만 전면광고다. 새 교환용 프로모션 코드는 `TOSS_PROMOTION_CODE_EXCHANGE`이고, 기존 출석 미션 코드를 자동 재사용하지 않는다.

포도모아의 리워드 설정 방식을 트리별 REWARDED_AD_GROUP_ID_1~5로 확장하고, TOSS_PROMOTION_MODE, TOSS_PROMOTION_CODE_ATTENDANCE 이름을 따릅니다. 포도모아 운영 ID와 코드는 복사하지 않습니다.

Cloudflare Dashboard → Workers & Pages → treemoa → Settings → Variables and Secrets에서 등록합니다.

| 이름 | 종류 | 값 |
| --- | --- | --- |
| BANNER_AD_GROUP_ID | Secret 또는 Text | 트리모아 배너 광고 그룹 ID |
| REWARDED_AD_GROUP_ID_1 | Secret 또는 Text | 1번 트리 리워드 광고 그룹 ID |
| REWARDED_AD_GROUP_ID_2 | Secret 또는 Text | 2번 트리 리워드 광고 그룹 ID |
| REWARDED_AD_GROUP_ID_3 | Secret 또는 Text | 3번 트리 리워드 광고 그룹 ID |
| REWARDED_AD_GROUP_ID_4 | Secret 또는 Text | 4번 트리 리워드 광고 그룹 ID |
| REWARDED_AD_GROUP_ID_5 | Secret 또는 Text | 5번 트리 리워드 광고 그룹 ID |
| TOSS_PROMOTION_MODE | Secret 또는 Text | 운영 live, 테스트 test; 생략 시 live |
| TOSS_PROMOTION_CODE_ATTENDANCE | Secret | 트리 출석 누적 보상 지급 프로모션 코드 |

값은 저장소에 넣지 않습니다. wrangler.jsonc에 빈 vars를 넣어 대시보드 값을 덮어쓰지 않습니다. wrangler.jsonc의 keep_vars: true로 대시보드의 일반 Variables를 배포 후에도 유지합니다. 광고 ID·금액·모드·앱 이름은 일반 Variable로 관리할 수 있고, 프로모션 코드는 Worker Secret으로 관리합니다. 같은 이름을 추후 vars에 명시하면 코드 값이 우선하므로 실제 값이나 빈 vars 항목을 코드에 추가하지 않습니다. 이 옵션은 mTLS·D1 같은 바인딩 보존 옵션은 아닙니다. 로컬에서는 .dev.vars.example을 .dev.vars로 복사해 값을 입력합니다.

## 앱의 설정 조회

GitHub 원본 저장소 Settings → Secrets and variables → Actions → Variables에 TREE_API_BASE_URL을 등록합니다. 값은 배포된 treemoa Worker의 HTTPS 기본 주소이며 경로 /api는 붙이지 않습니다. 이 변수는 비밀이 아닙니다. 등록 후 AIT를 새로 빌드해야 기본 주소가 반영됩니다. 로컬 빌드는 TREE_API_BASE_URL 환경변수를 사용합니다. 미설정 시 같은 출처의 /api/config를 요청하므로 별도 출처인 토스 앱은 반드시 Worker 주소를 설정해야 합니다.

GET /api/config는 ads.bannerAdGroupId, ads.rewardedAdGroupIds(키 1~5)만 공개합니다. 프로모션 코드와 모드는 노출하지 않습니다. 광고 ID는 앱에서 사용하므로 Secret으로 등록해도 클라이언트에 공개됩니다.
앱에서는 window.treeServiceConfig.load() 또는 src/service-config.js의 loadServiceConfig()로 조회합니다. 실패 시 다시 호출할 수 있습니다. 홈 초기 로딩 중에는 호출하지 않습니다.

광고 ID 변경은 Worker 설정 반영 후 다음 설정 조회부터 적용됩니다. API 주소가 바뀔 때만 AIT 재빌드가 필요합니다.

## 서버 프로모션 설정

worker/config.js의 promotionConfig(env)는 서버 전용입니다. 운영 모드에 TEST_ 코드가 입력되면 오류로 거부하고, test 모드에서는 TEST_ 접두어를 붙입니다. 누락된 코드를 임의 값으로 대체하지 않습니다. 지급 구현은 빈 code를 거부해야 합니다.

## 현재 범위

이번 변경은 변수 등록·읽기·광고 설정 전달 경로입니다. 배너 SDK 부착 및 누적 출석 정산 프로모션(ATTENDANCE)은 미연결입니다. 리워드 광고 SDK와 비게임 익명 인증, 15일·30일 미션 지급은 연결합니다. 아래 mTLS 인증서·Worker 주소·광고 ID·미션 코드 등록이 필요합니다.

## 트리별 선택

출석 광고와 선물 수령 광고 모두 선택한 트리 번호를 src/tree-ads.js에 전달합니다. 이 모듈이 해당 번호의 광고 ID를 조회하여 광고 어댑터에 treeId, adGroupId를 전달합니다. 1~5 밖의 번호나 해당 트리의 빈 ID는 광고 호출 전에 오류로 처리합니다. 공통 REWARDED_AD_GROUP_ID나 다른 트리 ID로 대체하지 않습니다. 실제 SDK 어댑터는 전달된 adGroupId를 사용해야 합니다.

## 15일·30일 미션 자동 지급

| 변수 | 기본값/역할 |
| --- | --- |
| TOSS_PROMOTION_CODE_DAY_15 | 15일 달성 프로모션 코드; Worker Secret |
| TOSS_PROMOTION_CODE_DAY_30 | 30일 달성 프로모션 코드; Worker Secret |
| TOSS_PROMOTION_AMOUNT_DAY_15 | 기본 15P, 양의 정수; 일반 Variable |
| TOSS_PROMOTION_AMOUNT_DAY_30 | 기본 20P, 양의 정수; 일반 Variable |

금액 기본값은 포도모아 15/30일 미션 기준입니다. 콘솔에 설정한 금액·조건과 반드시 맞춥니다. 15일차 출석도장 찍기와 트리에 별 달기 중 어느 캠페인을 각 코드에 연결할지는 운영자가 정합니다. 30일 누적 465P 정산은 미션 20P와 별개이며 ATTENDANCE 지급은 이번 미션 구현에 포함하지 않습니다.

사용자당 15일과 30일 보상을 각각 한 번 지급합니다. 다섯 트리 중 먼저 달성한 트리에서 자격이 생깁니다. 같은 트리의 연속 출석 기준이며 하루 빠지면 서버 미션 연속 횟수는 1부터 다시 시작합니다. tree_promotion_missions의 (user_id, day) 기본키로 트리 간·새 회차 간 중복을 막습니다. 테스트 지급은 tested_at만 기록하여 라이브 자격을 소진하지 않습니다.

앱은 User.getAnonymousKey를 가져와 서버에서 토스 anon-key/verify로 검증한 뒤 tree_sessions 세션을 사용합니다. 서버 날짜는 한국 시간이며 프론트 count/day/amount는 지급 판단에 사용하지 않습니다. 출석 광고 완료 이벤트와 트리별 광고 그룹 ID를 검증한 뒤 서버 미션 출석을 기록합니다. 포도모아와 같은 SDK 완료 이벤트 신고 방식이며 독립적인 광고사업자 서명 영수증 검증 방식은 아닙니다.

원본 GitHub 저장소 Actions Repository Secret TOSS_MTLS_CERTIFICATE_ID에 트리모아용으로 Cloudflare에 등록한 인증서 ID를 지정합니다. 배포 시 TOSS_MTLS 바인딩을 생성합니다. 포도모아의 인증서를 임의로 복사하거나 인증서 비밀키를 저장소에 넣지 않습니다. 값이 없으면 Worker 헬스/공개 설정은 동작하지만 인증·미션 출석·지급은 실행되지 않습니다. 실제 appName이 다르면 Worker Variable TOSS_APP_NAME 또는 ALLOWED_ORIGINS도 맞춥니다.

### 지급·복구

서버 출석 기록 후 미션 자격을 저장하고 waitUntil로 자동 지급을 시작합니다. 화면 저장과 외부 지급은 분리됩니다. 홈 진입·재접속 때 미지급 자격과 불명확한 지급을 복구하며 보상 내역에서 결과를 확인합니다.
지급 키와 submitted 상태를 외부 지급 요청 전에 저장하고, 불명확한 요청에는 새 키를 발급하지 않습니다. 기존 키로 결과 조회 또는 같은 키 재요청만 수행합니다. 사용자별 토스 호출은 분당 8회로 제한하고 남은 건은 재접속 때 이어서 확인합니다.
코드가 아직 없으면 출석 자격은 유지됩니다. 설정한 금액은 자격 획득 시 저장하므로 이후 환경변수 변경이 기존 자격 금액을 바꾸지 않습니다.

### 기존 로컬 기록

로컬 저장소의 기존 출석 횟수는 신뢰할 수 없어 지급 자격으로 자동 이전하지 않습니다. 화면의 기존 꾸미기는 유지하지만 미션 자격은 이번 서버 기록을 시작한 시점부터 셉니다. 기존 로컬 달성자 보상은 별도 검토가 필요합니다.
서버 미션 진행은 tree_mission_progress, 지급은 tree_mission_payments, 호출 제한은 tree_mission_api_calls를 사용합니다. 모든 신규 테이블은 tree_ 접두어를 사용하며 포도모아 테이블은 수정하지 않습니다.
