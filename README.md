# 트리 꾸미기
포도 키우기의 출석·보상 구조를 재사용하는 트리 꾸미기 게임 기획 저장소.

## 확정된 방향
- 상단 트리 슬롯 5개 중 선택한 트리 한 개만 중앙에 표시.
- 추가 트리는 사용자가 원하는 슬롯의 +를 눌러 생성. 출석 시 다른 슬롯을 자동 생성하지 않으며 순서 제한은 없음.
- 첫 트리는 초록색 고정. 추가 트리는 그린·화이트·핑크·블루·샴페인 골드 5색 전체에서 랜덤.
- 바닥 소품(선물·미니카·인형)도 출석 꾸미기에 포함. 나머지는 트리 오너먼트로 채우고 마지막 날 별을 달아 총 30회에 완성.
- 최종 수량: 선물 4 + 미니카 1 + 인형 1 + 오너먼트 22 + 전구 줄 1 + 마지막 별 1 = 30. 이전 시안 7번 아이보리 리본은 제외.
- 트리·가지·화분은 고정, 일부 장식만 포도 잎 수준으로 가끔 흔들림.
- 0일차에는 큰 트리만 존재하고 출석마다 장식 한 개 추가.
- 마지막 출석에 꼭대기 별 한 개를 달아 완성.
- 기존 포도 키우기의 출석·광고·보상 조건 유지.

## 문서 및 시안
- [전체 기획서](docs/tree-decoration-plan.md)
- [최신 슬롯 UI 시안](docs/images/tree-slots-concept.png)
- [초기 성장 비교 시안](docs/images/tree-growth-early-concept.png)

**트리의 붓터치 그림체는 유지하고, 화분은 큰 리본 없는 단순한 나무 화분으로 교체합니다.** [최신 정리 시안](docs/images/home-cozy-gifts-reference.png)을 선물·화분 디자인 기준으로 사용합니다. 시안의 선물이 모두 놓인 모습은 0일차 상태가 아닙니다. 출석 전에는 트리와 화분만 표시합니다.

- [5색 트리 PNG](assets/trees/)
- [공통 화분 PNG](assets/planters/)
- [에셋 사용 및 제작 기준](docs/assets/tree-assets.md)
- [개별 선물 에셋과 출석 구성](docs/assets/floor-decorations.md)
- [오너먼트·전구·별 에셋](docs/assets/ornaments.md)
- [꼭대기 별 공간 확보 기준](docs/assets/topper-layout.md)

5색 후보는 확정이며 동일 확률·중복 허용은 구현 제안값입니다. 현재 저장소에는 기획과 시안만 있으며 게임 구현은 포함하지 않습니다.


## 홈 프론트엔드

`npm start` 후 `http://localhost:4173`에서 실행합니다. 빌드 없는 ES 모듈 프론트엔드입니다.
- `?preview=1`: 저장 없이 출석 버튼을 반복 눌러 30단계와 슬롯 전환 확인. 실제 출석/광고/보상 아님.
- 일반 실행: `window.treeAds.showRewarded()`가 `{ rewarded: true }`를 반환해야 출석합니다. SDK 미연결 시 출석하지 않습니다. 운영 전 서버가 광고 완료·하루 횟수·보상을 검증해야 합니다. 로컬 저장은 프론트 미리보기용입니다.
- `npm test`: 첫날 5개 해제, 중복 출석, 30회 상한, 저장값 검증, 한국 날짜 경계 테스트.
- 확정 배치: `docs/images/home-approved-layout.png`. 원본 배경·트리·화분·개별 장식으로 합성하며 시안과 세부 배경은 다를 수 있습니다.
- 주아체는 Google Fonts에서 로드합니다. 오프라인에서는 시스템 글꼴로 대체됩니다. 출시 패키징 때 폰트와 OFL 고지 동봉 필요.


### 시작 로딩
`src/bootstrap.js`가 홈 모듈과 실제 표시 이미지를 기다립니다. `src/loading-state.js`에 점 주기와 준비 대기/실패 판정을 분리했습니다. 로딩 배경과 달리기 3프레임은 `assets/loading/`에 있습니다. 서버 API를 연결할 때는 초기 데이터 요청도 준비 Promise에 포함하세요. 실기기에서 애니메이션 및 화면 전환의 시각 검증은 필요합니다.

## 앱인토스 AIT 빌드

GitHub **Actions → Build Release AIT → Run workflow**에서 실행합니다. `app_name`은 앱인토스 콘솔의 앱 이름과 동일하게 입력합니다(기본 `christmas-tree-decorating`). 완료 후 실행 화면의 Artifacts에서 AIT가 포함된 ZIP을 다운로드합니다. 보관 기간은 14일입니다.

포도키우기 기준으로 Node 24, `@apps-in-toss/web-framework` 3.7.0, `npm ci`를 사용합니다. 로컬에서는 `npm ci` 후 `npm run build:toss`를 실행합니다. HTML·ES 모듈·이미지를 `dist/toss`에 복사하고 `ait build`로 패키징합니다. 서버/DB 배포나 프로모션 시크릿 변경은 포함하지 않습니다.

현재 임시 날짜 테스트 버튼도 패키지에 포함됩니다. 광고 및 지급 연동 전 프론트엔드 검증용이며, 출시 전 임시 테스트 진입점을 제거해야 합니다.

## 트리모아 서버 / DB

`treemoa` Cloudflare Worker가 기존 `podomoa-db`에 연결합니다. 모든 앱 테이블은 `treemoa_`, 마이그레이션 이력도 `treemoa_d1_migrations`로 분리합니다. [테이블 구성과 배포 방법](docs/worker-database.md)을 참고하세요. 현재 서버 범위는 DB 구성과 연결 확인 API이며, 홈의 실제 DB 저장·인증·광고·지급 연동은 아직 포함하지 않습니다.
