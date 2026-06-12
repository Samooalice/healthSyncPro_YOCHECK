# 추론 서비스 — LightGBM 다질환 위험 + TreeSHAP 기여도. (개발방안 9장 추론 서비스)
# 실행: ml 폴더에서  uvicorn app:app --port 8800
import json
import os
import lightgbm as lgb
from fastapi import FastAPI
from pydantic import BaseModel
from features import FEATURES, FEATURE_LABEL, DISEASES, to_vector

HERE = os.path.dirname(__file__)
MODELS = os.path.join(HERE, "models")
MODEL_VERSION = "lgbm-multi-2026.06.01"

boosters = {d: lgb.Booster(model_file=os.path.join(MODELS, f"{d}.txt")) for d in DISEASES}
with open(os.path.join(MODELS, "meta.json"), encoding="utf-8") as f:
    META = json.load(f)

app = FastAPI(title="WellCare AI 분석 서비스")

DISEASE_LABEL = {"kidney": "만성신장질환", "diabetes": "당뇨", "hypertension": "고혈압", "uti": "요로감염", "liver": "간담도"}
KDIGO_A = {0: "A1", 1: "A2", 2: "A3", 3: "A3", 4: "A3"}
ZONES = ["green", "yellow", "orange", "red"]


# 등급 컷오프: 세부데이터 B.4.2 (0.25/0.50/0.75) — TS algoParams.grade_thresholds와 일치.
def grade(s: float) -> str:
    return "low" if s < 0.25 else "moderate" if s < 0.5 else "high" if s < 0.75 else "very_high"


class PredictIn(BaseModel):
    features: dict


@app.get("/health")
def health():
    return {"status": "ok", "model_version": MODEL_VERSION, "diseases": DISEASES}


@app.post("/predict")
def predict(body: PredictIn):
    feat = body.features
    x = to_vector(feat)
    results = []
    for d in DISEASES:
        b = boosters[d]
        score = float(b.predict([x])[0])
        contrib = b.predict([x], pred_contrib=True)[0]  # len = n_features+1 (마지막=base)
        pairs = sorted(
            [(FEATURES[i], FEATURE_LABEL.get(FEATURES[i], FEATURES[i]), float(contrib[i]), float(x[i])) for i in range(len(FEATURES))],
            key=lambda t: -abs(t[2]),
        )
        shap_top = [
            {"feature_key": k, "feature": lab, "shap": round(s, 4), "value": v}
            for (k, lab, s, v) in pairs if s > 0
        ][:5]
        standard = None
        if d == "kidney":
            pr = int(round(feat.get("protein", 0) or 0))
            standard = f"{KDIGO_A.get(pr, 'A1')}/{ZONES[min(int(score * 4), 3)]}"
        results.append({
            "disease": d, "label": DISEASE_LABEL[d], "risk_score": round(score, 4),
            "risk_grade": grade(score), "standard_grade": standard, "shap_top": shap_top,
        })
    results.sort(key=lambda r: -r["risk_score"])
    return {"model_version": MODEL_VERSION, "results": results}
