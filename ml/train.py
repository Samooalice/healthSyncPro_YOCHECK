# LightGBM 다질환 모델 학습 (합성데이터, 약지도).
# 실데이터·라벨이 없으므로 임상 도메인 로직 기반 합성 라벨로 학습한다.
# → 모델은 임상 로직을 부드럽게 근사하며, 데이터가 쌓이면 동일 파이프라인으로 실데이터 재학습.
# 주의: 합성 학습 = 임상 검증 아님(개발방안 7장 검증 별도). 출력은 선별 위험도 제시까지.
import json
import os
import numpy as np
import lightgbm as lgb
from features import FEATURES, DISEASES

RNG = np.random.default_rng(20260612)
N = 12000
HERE = os.path.dirname(__file__)
MODELS = os.path.join(HERE, "models")
os.makedirs(MODELS, exist_ok=True)


def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-z))


def sample_features(n):
    sev_choices = [0, 0, 0, 0, 0, 1, 2, 3, 4]  # 대부분 음성, 일부 양성
    col = {}
    for a in ["glucose", "protein", "blood", "leukocyte", "ketone", "bilirubin"]:
        col[a] = RNG.choice(sev_choices, n)
    col["nitrite"] = RNG.choice([0, 0, 0, 1], n)
    col["vitamin_c"] = RNG.choice([0, 0, 0, 1, 2, 3], n)
    col["ph"] = np.clip(RNG.normal(6.0, 0.8, n), 4.5, 9.0)
    col["specific_gravity"] = np.clip(RNG.normal(1.018, 0.008, n), 1.0, 1.04)
    col["urobilinogen"] = np.clip(RNG.choice([0.2, 0.2, 0.2, 1.0, 2.0, 4.0], n), 0.1, 8.0)

    sev = lambda a: col[a] / 4.0
    col["pos_burden"] = sum((col[a] >= 1).astype(int) for a in ["glucose", "protein", "blood", "leukocyte", "ketone", "nitrite", "bilirubin"])
    col["uti_flag"] = ((col["leukocyte"] >= 2) & (col["nitrite"] >= 1)).astype(int)
    col["dka_flag"] = ((col["glucose"] >= 3) & (col["ketone"] >= 2)).astype(int)
    col["nephritis_flag"] = ((col["protein"] >= 2) & (col["blood"] >= 2)).astype(int)
    col["dehydration_flag"] = ((col["specific_gravity"] >= 1.025) & (col["ketone"] >= 1)).astype(int)
    col["vitc_disturbance"] = (col["vitamin_c"] >= 2).astype(int)
    col["protein_consec_pos"] = RNG.choice([0, 0, 0, 1, 2, 3], n) * (col["protein"] >= 2)
    col["protein_trend_slope"] = RNG.normal(0, 0.4, n)

    present = RNG.random(n) < 0.6
    col["phr_present"] = present.astype(int)
    col["phr_glucose"] = np.where(present, np.clip(RNG.normal(98, 22, n), 70, 260), 90.0)
    col["phr_egfr"] = np.where(present, np.clip(RNG.normal(92, 22, n), 20, 130), 100.0)
    col["phr_bmi"] = np.where(present, np.clip(RNG.normal(24, 4, n), 16, 40), 22.0)
    col["phr_diabetes"] = (present & ((col["phr_glucose"] >= 126) | (RNG.random(n) < 0.15))).astype(int)
    col["phr_hypertension"] = (present & (RNG.random(n) < 0.22)).astype(int)
    col["phr_dyslipidemia"] = (present & (RNG.random(n) < 0.20)).astype(int)
    col["phr_kidney_watch"] = (present & ((col["phr_egfr"] < 90) | (RNG.random(n) < 0.08))).astype(int)
    col["phr_overweight"] = (col["phr_bmi"] >= 25).astype(int)
    return col, sev


def true_prob(col, sev, disease):
    g = lambda k: col[k]
    egfr_term = np.where(col["phr_egfr"] < 60, 2.0, np.where(col["phr_egfr"] < 90, 0.8, 0.0))
    glu_term = np.clip((col["phr_glucose"] - 100) / 25.0, 0, 3)
    uro_term = np.clip(col["urobilinogen"] - 1.0, 0, 4) / 2.0
    if disease == "kidney":
        z = -2.6 + 3.0 * sev("protein") + 1.4 * sev("blood") + 0.7 * sev("leukocyte") + 1.1 * g("nephritis_flag") \
            + 0.5 * g("protein_consec_pos") + egfr_term + 1.1 * g("phr_kidney_watch") + 0.6 * g("phr_hypertension") + 0.6 * g("phr_diabetes")
    elif disease == "diabetes":
        z = -2.8 + 3.6 * sev("glucose") + 1.0 * sev("ketone") + 1.4 * g("dka_flag") + 1.1 * glu_term \
            + 2.0 * g("phr_diabetes") + 0.5 * g("phr_overweight")
    elif disease == "hypertension":
        z = -2.6 + 3.0 * g("phr_hypertension") + 1.0 * sev("protein") + 0.6 * g("phr_overweight")
    elif disease == "uti":
        z = -2.5 + 3.0 * sev("leukocyte") + 2.2 * sev("nitrite") + 0.8 * sev("blood") + 1.5 * g("uti_flag")
    else:  # liver
        z = -3.0 + 3.2 * sev("bilirubin") + 1.6 * uro_term
    return sigmoid(z + RNG.normal(0, 0.4, len(z)))


def main():
    col, sev = sample_features(N)
    X = np.column_stack([np.asarray(col[k], dtype=float) for k in FEATURES])
    meta = {"features": FEATURES, "trained_n": N, "note": "synthetic weak-supervision; not clinically validated"}
    for d in DISEASES:
        p = true_prob(col, sev, d)
        y = (RNG.random(N) < p).astype(int)
        clf = lgb.LGBMClassifier(objective="binary", n_estimators=300, num_leaves=31, learning_rate=0.05,
                                 min_child_samples=30, subsample=0.8, colsample_bytree=0.8, class_weight="balanced", verbose=-1)
        clf.fit(X, y)
        clf.booster_.save_model(os.path.join(MODELS, f"{d}.txt"))
        print(f"  {d}: 양성률 {y.mean():.3f}, 학습 완료")
    with open(os.path.join(MODELS, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print("LightGBM 다질환 학습 완료 →", MODELS)


if __name__ == "__main__":
    main()
