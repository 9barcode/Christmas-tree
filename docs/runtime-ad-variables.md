# 서버 담당자 전달: 광고 런타임 변수

실제 광고 ID는 소스, `wrangler.jsonc`, AIT 빌드 환경변수에 입력하지 않는다. 서버 담당자가 Cloudflare Worker `treemoa`의 런타임 변수에 입력한다. 코드에는 아래 변수명과 `/api/config` 응답 필드 매핑만 둔다.

| Worker 런타임 변수명 | `/api/config`의 `ads` 응답 필드 | 용도 |
| --- | --- | --- |
| `INTERSTITIAL_AD_GROUP_ID` | `interstitialAdGroupId` | 장식 획득용 전면광고 |
| `BANNER_TEXT_AD_GROUP_ID` | `bannerTextAdGroupId` | 문구형 공통. 로딩 텍스트 배너 및 트리 장면 바깥 홈 하단에서 재사용 |
| `BANNER_IMAGE_AD_GROUP_ID` | `bannerImageAdGroupId` | 이미지형 공통. 로딩 이미지 피드형 배너 |
| `REWARDED_AD_GROUP_ID` | `rewardedAdGroupId` | 트리 추가·완성 후 포인트 교환용 리워드 광고 |

총 4개 변수만 사용한다. 슬롯 번호나 화면 위치별로 별도 광고 변수를 만들지 않는다. 2026-10-20 통합으로 이전 슬롯별 리워드·화면별 배너 변수는 더 이상 읽지 않는다. 서버 담당자는 위 이름으로 재설정하고 새 Worker와 AIT를 함께 적용해야 한다. 기존 캐시된 앱/이전 AIT는 이전 응답 형식을 사용하므로 이전 번들과 혼용하지 않는다.

## 연결 계약

- Worker `worker/config.js`가 `env`에서 읽어 공개 광고 ID만 응답한다. 지급 코드·인증서·토큰은 이 API에 넣지 않는다.
- 프론트엔드 `src/service-config.js`가 런타임에 `GET /api/config`를 호출한다. 광고 ID 자체를 AIT 번들에 하드코딩하지 않는다.
- 미설정 값은 빈 문자열로 응답한다. 가짜 ID나 다른 종류의 광고 ID로 대체하지 않는다. 미설정 배너는 숨긴다.
- `src/bm-home.js`와 `src/bm-client.js`가 BM v2 API를 사용한다. 장식은 트리당 한국시간 하루 10개까지 획득하고 누적 30개 완성 후에만 교환할 수 있다. 결석에 따른 초기화는 없다.
- 기존 리워드 설정에 전면형 ID를 넣으면 안 된다. 두 광고 유형은 이벤트가 다르다.
- 리스트형과 이미지형은 콘솔에서도 각각 해당 유형으로 발급된 서로 다른 ID를 넣는다.
- `keep_vars: true`를 유지하고 광고 ID를 `wrangler.jsonc`의 `vars`에서 제거해 배포 때 코드 값으로 덮어쓰지 않도록 한다. 실제 Worker 설정값은 이 커밋에서 변경하지 않는다.
- 로컬 개발 값은 Git에서 제외한 `.dev.vars` 등으로 관리한다. 운영 ID로 자동 테스트하지 않는다.
- 프론트엔드는 앱 실행 중 설정을 캐시한다. 런타임 ID 변경은 앱을 다시 열었을 때 반영되며, ID 변경만으로 AIT를 다시 빌드할 필요는 없다. 최초 설정 전달 코드 적용에는 새 AIT가 필요하다.

이 문서는 서버 담당자에게 전달할 인터페이스다. 광고 그룹 생성이나 운영 변수 값 입력은 포함하지 않는다.
