# Water Quality Protocol & WQI Specification

This document details the standardization and weighting protocols used to calculate the Water Quality Index (WQI).

## WQI Weight Allocation
Each parameter is assigned a weight ($w_i$) relative to its significance for drinking water safety:

| Parameter | Unit | Standard Limit ($S_i$) | Weight ($w_i$) |
|---|---|---|---|
| pH | pH units | 6.5 - 8.5 | 4 |
| Turbidity | NTU | 5.0 | 3 |
| TDS | mg/L | 500.0 | 3 |
| Dissolved Oxygen (DO) | mg/L | 5.0 (min) | 5 |
| BOD | mg/L | 2.0 | 5 |
| COD | mg/L | 10.0 | 4 |
| Nitrate | mg/L | 45.0 | 5 |
| Fluoride | mg/L | 1.0 | 5 |
| Iron | mg/L | 0.3 | 4 |
| Total Coliform | MPN/100mL | 50.0 | 5 |

## Quality Rating ($q_i$) Calculation
For pH and DO:
$$q_{pH} = \frac{V_{pH} - 7.0}{8.5 - 7.0} \cdot 100$$
$$q_{DO} = \frac{V_{DO} - 0.0}{14.6 - 0.0} \cdot 100$$ (where 14.6 is DO solubility)

For all other parameters:
$$q_i = \frac{V_i}{S_i} \cdot 100$$

## WQI Aggregation
WQI is computed as:
$$WQI = \frac{\sum w_i q_i}{\sum w_i}$$

## Strict Rejection of Imputation
- No imputations are made. If any required parameter is missing at a station, the output value is flagged as `No Data` to preserve integrity.
