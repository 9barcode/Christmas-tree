# 오너먼트 22종·전구 줄·마지막 별

최종 구성: 기존 바닥 선물 4개 + 미니카 + 곰 인형 + 아래 오너먼트 22개 + 전구 줄 한 묶음 + 꼭대기 별 = 30회.

원본 [23종 비교 시트](../images/ornament-concepts-original-23.png)의 **7번 아이보리 리본은 폐기**한다. 아래 번호는 원본 시안 번호이며 출석 회차와 다르다. 자동으로 1~22로 다시 매기지 않는다.

| 원본 번호 | 에셋 | 경로 |
|---|---|---|
| 1 | 웃는 빨강 구슬 | `assets/ornaments/bauble-red-smile.png` |
| 2 | 초록 눈송이 구슬 | `assets/ornaments/bauble-green-snowflake.png` |
| 3 | 웃는 아이보리 구슬 | `assets/ornaments/bauble-ivory-smile.png` |
| 4 | 금색 줄무늬 구슬 | `assets/ornaments/bauble-gold-stripe.png` |
| 5 | 버건디 다이아 구슬 | `assets/ornaments/bauble-burgundy-diamond.png` |
| 6 | 빨간 리본 | `assets/ornaments/bow-red.png` |
| 8 | 황동 종 | `assets/ornaments/bell-brass.png` |
| 9 | 사탕 지팡이 | `assets/ornaments/candy-cane.png` |
| 10 | 진저브레드 맨 | `assets/ornaments/gingerbread-man.png` |
| 11 | 진저브레드 집 | `assets/ornaments/gingerbread-house.png` |
| 12 | 빨간 양말 | `assets/ornaments/stocking-red.png` |
| 13 | 초록 장갑 한 쌍 | `assets/ornaments/mittens-green.png` |
| 14 | 목마 | `assets/ornaments/rocking-horse.png` |
| 15 | 작은 북 | `assets/ornaments/drum-red.png` |
| 16 | 아이보리 눈송이 | `assets/ornaments/snowflake-ivory.png` |
| 17 | 눈사람 | `assets/ornaments/snowman.png` |
| 18 | 루돌프 | `assets/ornaments/reindeer.png` |
| 19 | 산타 모자 | `assets/ornaments/santa-hat.png` |
| 20 | 솔방울 | `assets/ornaments/pinecone.png` |
| 21 | 눈 덮인 작은 집 | `assets/ornaments/cottage-snow.png` |
| 22 | 아이보리 비둘기 | `assets/ornaments/dove-ivory.png` |
| 23 | 버건디 하트 | `assets/ornaments/heart-burgundy.png` |

## 별도 소품

| 에셋 | 경로 | 출석 수 |
|---|---|---|
| 나무 미니카 | `assets/decorations/toy-car.png` | 1 |
| 곰 인형 | `assets/decorations/teddy-bear.png` | 1 |
| 따뜻한 전구 줄 전체 | `assets/decorations/fairy-lights.png` | 1 |
| 금빛 꼭대기 별 | `assets/toppers/star-gold.png` | 마지막 1 |

전구 개별 개수나 장갑 한 쌍의 좌우는 별도 출석 개체로 세지 않는다.

## 사용 기준

- 모든 제작물은 독립 투명 PNG다. 작은 오너먼트를 원본 해상도 그대로 화면에 표시하지 말고, 통일된 표시 크기·고리 기준점을 지정한다.
- 각 고리의 중앙을 회전 중심으로 삼는다. 일부만 가끔 ±3° 수준으로 움직이고 전체 동시 흔들림은 피한다.
- 전구 줄은 고정 레이어로 사용한다. 트리 실루엣을 참고한 별도 생성물이므로 5색 트리와 장식의 실제 합성 검증이 필요하다.
- 미니카·곰 인형은 바닥에 고정한다. 트리 가지나 출석 버튼을 가리지 않는 크기로 배치한다.
- 별의 고리는 없고 하단 장착부가 있다. [별 배치 기준](topper-layout.md)의 별 전용 공간을 먼저 확보한다.
- 기존 선물 4개·화분·트리·배경은 재생성하지 않는다.

## 제작·검증 범위

내장 이미지 생성 도구로 원본 시안을 참조해 오브젝트별로 제작했다. 번호·배경·UI는 제거하고 붓터치·색면·명암은 유지한다.
개별 프롬프트는 `generation-records/`에 기록한다. PNG 투명도와 파일 누락을 확인하되, 실제 홈 프론트엔드/출석 지급/실기기 모션 검증 완료를 의미하지 않는다.
