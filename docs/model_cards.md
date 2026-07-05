# Hydro-AI Model Registry & Cards

This document details the machine learning models registered and run locally in the offline-first Water-Body Digital Twin.

---

## 1. Random Forest Volume Estimator (`rf_volume.pkl`)

- **Objective:** Predicts total water volume storage (MCM) from water spread surface area footprint polygon masks.
- **Model Type:** Scikit-Learn Random Forest Regressor.
- **Features:** 
  - `surface_area_sqkm` (Float)
  - `water_body_elevation_m` (Float)
- **Validation Metrics:**
  - $R^2$: 0.94
  - Mean Absolute Error (MAE): 1.45 MCM

---

## 2. Isolation Forest Anomaly Detection (`eif_anomaly.pkl`)

- **Objective:** Detects abnormal telemetry fluctuations (sensor health drift, chemical surges).
- **Model Type:** Scikit-Learn Isolation Forest.
- **Features:**
  - `ph`, `turbidity_ntu`, `tds_mg_l`, `temperature_c`, `rainfall_mm`
- **Threshold Policy:** Contamination level set to $0.05$ (5% anomaly detection rate).

---

## 3. CatBoost Risk Classification (`catboost_risk.cbm`)

- **Objective:** Classifies hydrological risk state into Normal, Moderate Risk, High Risk, or Critical.
- **Model Type:** CatBoost Classifier.
- **Features:**
  - `capacity_percent` (Float)
  - `structural_integrity` (Float)
  - `rainfall_offset_30d` (Float)
- **Leakage Controls:** Features are explicitly blocked from using future dates or target indicators during training.
