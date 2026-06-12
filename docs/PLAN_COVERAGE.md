# 개발계획서 ↔ 구현 커버리지 감사 (2026-06-12)

대상 문서: 상세실행판 · 세부개발데이터(1-1) · 확장1 API/스키마/시드(1-2) · 콘텐츠원고집(1-3) · 규제임상법무 초안집(1-4).
방식: 문서별 요구 추출 → `web/` 코드·`db/migrations`·`ml/` 실파일 대조.

## 보완 완료 (2026-06-12, 감사 후속)
- **등급 컷오프 단일화**: `engine.scoreToGrade`·`ml/app.py`가 `algoParams.grade_thresholds`(0.25/0.50/0.75, 세부데이터 B.4.2)를 사용하도록 통일. 死상수 해소 + 경계 테스트(0.249→low/0.25→moderate …) 7/7 통과.
- **P1 기준선 파이프라인 연결**: `pipeline`에서 `deviationSd`·`detectChange`로 개인 편차·지속성 산출 → `engine.analyzeAll(personal)`이 `disease_weights.kidney`로 신장 개인편차 보강, `reset_months` 장기 미측정 재설정 적용, 신호를 `measurement.meta.p1`에 기록.
- **explainV2 상수 소비**: `top_k`(의료진 5)·`user_visible_k`(사용자 3)·`counterfactual_max`(2)·`counterfactual_target` 반영. `scoreToGrade` 공유. 안전토큰 `SAFE_PRIVACY`·`SAFE_VITC` 추가·연동.
- **死자산 활성화**: `notification_template` 3종 시드 + `notify.ts`가 템플릿 렌더({var} 치환·폴백). `user_content_log` engage(콘텐츠 조회) 기록.
- **ML 하이퍼파라미터 일치**: `train.py min_child_samples` 40→30(yaml/문서) + 재학습.
- **누락 콘텐츠 적재**: 결과해설 C-RX-PH/SG/URO/BIL/VITC, C-ACT-LOW, C-MOT-FIRST/BADGE/GOAL, C-CARE-GUIDE + 큐레이션 규칙 2종. (전체 콘텐츠 31건/게시 33)
- 검증: tsc 0, 3환자 재분석(신규 등급 반영), E2E 스모크 13/0.

## 종합 결론
핵심 골격(분석 파이프라인 P1~P5, 다질환·KDIGO·SHAP, 8단계 사용자 여정 화면, 의료진 포털, 관리자 콘솔, 큐레이션·게이미피케이션, SaMD 트랙 분리·규제 거버넌스 표시)은 **충실히 반영**됨. 다만 ① 일부 계획 상수/모듈이 정의만 되고 미사용(정합성), ② 콘텐츠 일부 누락, ③ 운영/외부연동·REST API·MLOps 등은 의도적 범위 밖 미구현.

## ✅ 충실히 반영
- P2 품질보정(비중정규화·비타민C 가중·신뢰가중), 요화학 11항목·반정량 코드(음성~4+)·정상범위·콜드스타트SD
- 다질환 위험계층화 5종 + KDIGO형 표준등급 + LightGBM/SHAP(외부 ML, 미설정 시 룰 폴백) + 이중채널 설명·반사실·안전고지
- 케어 폐루프(등급별 액션·진료의뢰·환류 라벨), 인앱 알림
- 화면: 온보딩·홈·측정·결과상세·콘텐츠·케어·미션·알림·마이 + 의료진(목록/대시보드/임상리포트) + 관리자(사용자·콘텐츠·큐레이션·규제·감사·시스템)
- DB 스키마(care/secure 18+확장), 인덱스, RLS(예시), 감사로그
- 큐레이션 규칙 엔진, 게이미피케이션(포인트·스트릭·뱃지·미션), 퀴즈/아티클/체크리스트 payload
- 규제: is_samd_output 트랙 분리, 의도된 사용, 비진단 톤(라벨·알림·고지), 동의 4유형·PII 분리, 보안 헤더·레이트리밋

## ⚠️ 정합성 이슈 (계획 vs 코드 불일치 — 보완 권장)
| 항목 | 내용 | 근거 |
|---|---|---|
| 등급 컷오프 이중기준 | 세부데이터 B.4.2·`algoParams.grade_thresholds`=0.25/0.50/0.75인데, 실제 `engine.scoreToGrade`·`ml/app.py`=**0.2/0.5/0.8** 사용. grade_thresholds는 死상수 | `engine.ts:11-16`, `algoParams.ts:53-58`, `ml/app.py:26` |
| P1 기준선 모듈 미연결 | `detectChange`·`deviationSd`·`reset_months`·`disease_weights`(B.4.1) 정의만, 파이프라인 미호출. 위험분석은 engine 독자 룰 사용 | `baseline.ts`, `engine.ts`, `pipeline.ts` |
| LightGBM 하이퍼파라미터 | `min_child_samples` 문서/yaml=30 vs `train.py`=40 | `ml/train.py:83-84` |
| notification_template | 시드 9종·테이블 존재하나 적재 스크립트 없고 런타임 미참조(死자산) | `notify.ts`, `seed_data.sql` |
| user_content_log | 테이블 존재하나 engage 기록 코드 없음(콘텐츠 참여 미수집) | `0001_init_care.sql:193` |
| SHAP/반사실 상수 | `top_k=5`는 ML만, 룰엔진은 3개 노출. `counterfactual_max=2`·`target=low` 미참조(1건·동적등급) | `explainV2.ts` |

## 🟡 콘텐츠 누락 (원고집 대비)
- 결과해설 12종 중 6종만 적재 → **C-RX-PH·SG·URO·BIL·VITC 5종 누락**, 음성/양성 카드 분리 미반영
- **C-ACT-LOW**(양호 행동지침), 동기부여 **C-MOT-BADGE/GOAL/FIRST**, 보호자 **C-CARE-GUIDE** 미적재
- 안전 토큰 **SAFE_PRIVACY·SAFE_VITC** 미구현(개인정보·비타민C 교란 고지)

## ❌ 미구현 — 의도적 범위 밖(데모 한계)
- 카메라 이미지 판독(measurement.source=analyzer만), 측정 가이드 UX
- 이벤트 버스(Kafka) — 동기 함수 오케스트레이션으로 대체
- REST API 카탈로그(openapi.yaml 27경로) — 서버액션+페이지로 대체, 실 REST는 4개(measurements POST·assessments GET·phr POST·health)
- 외부 연동: push/SMS/카카오 알림, EMR·심평원·측정기 어댑터(PHR FHIR 인제스트만)
- MLOps 재학습 큐(feedback_label 저장만), 모델카드 문서, 변경관리 SOP 실체
- 시설(facility) 키오스크/다대상 모니터링, 만관제 행정 폼 자동생성, 리포트 PDF API
- content_tag(N:M) 미생성(category 단일분류 대체), `/auth/refresh`·`/devices` 등록

## ⛔ 운영 전 필수 보강 (규제·보안)
- **at-rest 암호화 평문(데모)** — user_pii name_enc 등 KMS 암호화 필요
- **보유·파기/비식별화 로직 전무** — 탈퇴·법정보존 정책 미구현
- 모델카드(성능지표·한계)·임상검증 산출물은 상태판 수준(todo/partial)

## 의도적 적응(문서와 다르나 정당)
TimescaleDB 미지원→일반테이블+인덱스 / REST→Next 서버액션 / 톤 완화("즉시 방문"→"의료진 상담 권유") / 추가 테이블(phr_record·clinician_profile·mission_log·notification).
