# 분석 엔진 피처 정의 — Next 와 공유하는 입력 스펙(순서 고정).
# 출처: sdc_deploy 소변검사_AI분석_개발방안 (5장 피처 + PHR 결합).

DISEASES = ["kidney", "diabetes", "hypertension", "uti", "liver"]

# 모델 입력 피처(순서 고정). 결측 시 0/기본값.
FEATURES = [
    # 요화학 반정량 코드(0~4) / 수치
    "glucose", "protein", "blood", "leukocyte", "ketone", "nitrite", "bilirubin",
    "urobilinogen", "ph", "specific_gravity", "vitamin_c",
    # 도메인 파생
    "pos_burden", "uti_flag", "dka_flag", "nephritis_flag", "dehydration_flag", "vitc_disturbance",
    # 시계열
    "protein_consec_pos", "protein_trend_slope",
    # PHR(마이헬스데이터 검진·기저질환)
    "phr_present", "phr_glucose", "phr_egfr", "phr_bmi",
    "phr_diabetes", "phr_hypertension", "phr_dyslipidemia", "phr_kidney_watch", "phr_overweight",
]

# 사용자/의료진 표시용 한글 라벨
FEATURE_LABEL = {
    "glucose": "요당", "protein": "요단백", "blood": "잠혈", "leukocyte": "백혈구", "ketone": "케톤",
    "nitrite": "아질산염", "bilirubin": "빌리루빈", "urobilinogen": "유로빌리노겐", "ph": "산도(pH)",
    "specific_gravity": "비중", "vitamin_c": "비타민C", "pos_burden": "양성 항목 수",
    "uti_flag": "백혈구+아질산염", "dka_flag": "요당+케톤", "nephritis_flag": "단백+잠혈",
    "dehydration_flag": "탈수 패턴", "vitc_disturbance": "비타민C 교란",
    "protein_consec_pos": "단백뇨 지속", "protein_trend_slope": "단백 추세",
    "phr_present": "검진데이터", "phr_glucose": "검진 공복혈당", "phr_egfr": "검진 eGFR", "phr_bmi": "검진 BMI",
    "phr_diabetes": "당뇨 기저(검진·복약)", "phr_hypertension": "고혈압 기저(검진·복약)",
    "phr_dyslipidemia": "이상지질혈증 기저", "phr_kidney_watch": "신장 주의소견", "phr_overweight": "과체중",
}

DEFAULTS = {"ph": 6.0, "specific_gravity": 1.015, "urobilinogen": 0.2, "phr_glucose": 90.0, "phr_egfr": 100.0, "phr_bmi": 22.0}


def to_vector(feat: dict) -> list:
    """피처 dict → FEATURES 순서 벡터(결측 보정)."""
    return [float(feat.get(k, DEFAULTS.get(k, 0.0)) if feat.get(k) is not None else DEFAULTS.get(k, 0.0)) for k in FEATURES]
