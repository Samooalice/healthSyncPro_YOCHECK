# ML 분석 서비스 (LightGBM + TreeSHAP)

요화학 + PHR + 시계열 피처로 **다질환 위험(CKD/DM/HTN/UTI/LIV)** 을 예측하고 **SHAP 기여도**를 산출하는 CPU 추론 서비스. (GPU 불필요)

> 출처: sdc_deploy `소변검사_AI분석_개발방안` Phase 1(LightGBM 질환별 다중 모델). 현재 모델은 **합성데이터 약지도 학습**이며 임상 검증 전 — 선별 위험도 제시까지만.

## 구성
- `features.py` — 입력 피처 스펙(순서 고정), Next `mlClient.ts` 와 일치.
- `train.py` — 합성데이터로 질환별 LightGBM 학습 → `models/*.txt`.
- `app.py` — FastAPI `/predict`(LightGBM 예측 + `pred_contrib` TreeSHAP), `/health`.

## 실행 (CPU)
```bash
cd ml
python train.py                       # 모델 학습(최초 1회) → models/
python -m uvicorn app:app --port 8800 # 추론 서비스
```
- Next 의 `.env.local` `ML_SERVICE_URL=http://localhost:8800` 로 연결.
- **서비스가 떠 있으면** 새 측정이 LightGBM/SHAP 로 분석되고, **꺼져 있으면** Next 의 룰 기반 엔진(`engine.ts`)으로 자동 폴백(무중단). 기존 저장된 결과는 DB 에 있어 서비스와 무관하게 표시됨.

## 실데이터 전환
데이터가 쌓이면 `train.py` 의 합성 생성부를 실측 라벨 로딩으로 교체하고 동일 파이프라인으로 재학습 → `models/` 만 갱신하면 됨(피처·서빙 인터페이스 동일).
