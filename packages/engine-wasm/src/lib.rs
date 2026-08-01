use wasm_bindgen::prelude::*;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub enum Column {
    Int64(Vec<Option<i64>>),
    Float64(Vec<Option<f64>>),
    Utf8(Vec<Option<String>>),
}

#[wasm_bindgen]
pub struct DataFrame {
    columns: HashMap<String, Column>,
    row_count: usize,
}

#[wasm_bindgen]
impl DataFrame {
    #[wasm_bindgen(constructor)]
    pub fn new() -> DataFrame {
        DataFrame {
            columns: HashMap::new(),
            row_count: 0,
        }
    }

    pub fn from_csv(csv: &str) -> DataFrame {
        let mut lines = csv.lines();

        let headers: Vec<String> = match lines.next() {
            Some(h) => h.split(',').map(|s| s.trim().to_string()).collect(),
            None => return DataFrame::new(),
        };

        let mut raw: Vec<Vec<String>> = headers.iter().map(|_| vec![]).collect();

        for line in lines {
            let values: Vec<&str> = line.split(',').collect();
            for (i, col) in raw.iter_mut().enumerate() {
                col.push(values.get(i).unwrap_or(&"").trim().to_string());
            }
        }

        let mut columns: HashMap<String, Column> = HashMap::new();
        let row_count = raw.first().map(|c| c.len()).unwrap_or(0);

        for (header, values) in headers.iter().zip(raw.into_iter()) {
            let col = if values.iter().all(|v| v.is_empty() || v.parse::<i64>().is_ok()) {
                Column::Int64(values.iter().map(|v| v.parse::<i64>().ok()).collect())
            } else if values.iter().all(|v| v.is_empty() || v.parse::<f64>().is_ok()) {
                Column::Float64(values.iter().map(|v| v.parse::<f64>().ok()).collect())
            } else {
                Column::Utf8(values.into_iter().map(|v| if v.is_empty() { None } else { Some(v) }).collect())
            };
            columns.insert(header.clone(), col);
        }

        DataFrame { columns, row_count }
    }

    pub fn filter(&self, col: &str, op: &str, val: &str) -> DataFrame {
        let mask: Vec<bool> = match self.columns.get(col) {
            None => return DataFrame::new(),
            Some(Column::Float64(v)) => {
                let n: f64 = val.parse().unwrap_or(0.0);
                v.iter().map(|x| match x {
                    Some(x) => match op {
                        ">"  => *x > n,
                        ">=" => *x >= n,
                        "<"  => *x < n,
                        "<=" => *x <= n,
                        "="  => *x == n,
                        "!=" => *x != n,
                        _    => false,
                    },
                    None => false,
                }).collect()
            },
            Some(Column::Int64(v)) => {
                let n: i64 = val.parse().unwrap_or(0);
                v.iter().map(|x| match x {
                    Some(x) => match op {
                        ">"  => *x > n,
                        ">=" => *x >= n,
                        "<"  => *x < n,
                        "<=" => *x <= n,
                        "="  => *x == n,
                        "!=" => *x != n,
                        _    => false,
                    },
                    None => false,
                }).collect()
            },
            Some(Column::Utf8(v)) => {
                v.iter().map(|x| match x {
                    Some(x) => match op {
                        "="  => x == val,
                        "!=" => x != val,
                        _    => false,
                    },
                    None => false,
                }).collect()
            },
        };

        let mut columns: HashMap<String, Column> = HashMap::new();
        for (name, col_data) in &self.columns {
            let filtered = match col_data {
                Column::Int64(v)   => Column::Int64(apply_mask(v, &mask)),
                Column::Float64(v) => Column::Float64(apply_mask(v, &mask)),
                Column::Utf8(v)    => Column::Utf8(apply_mask(v, &mask)),
            };
            columns.insert(name.clone(), filtered);
        }

        let row_count = mask.iter().filter(|&&b| b).count();
        DataFrame { columns, row_count }
    }

    pub fn group_aggregate(&self, group_col: &str, agg_fn: &str, agg_col: &str) -> DataFrame {
        let group_values = match self.columns.get(group_col) {
            Some(Column::Utf8(v)) => v.iter().map(|x| x.clone().unwrap_or_default()).collect::<Vec<_>>(),
            _ => return DataFrame::new(),
        };

        let agg_values: Vec<f64> = match self.columns.get(agg_col) {
            Some(Column::Float64(v)) => v.iter().map(|x| x.unwrap_or(0.0)).collect(),
            Some(Column::Int64(v))   => v.iter().map(|x| x.unwrap_or(0) as f64).collect(),
            _ => return DataFrame::new(),
        };

        let mut groups: HashMap<String, Vec<f64>> = HashMap::new();
        for (key, val) in group_values.iter().zip(agg_values.iter()) {
            groups.entry(key.clone()).or_default().push(*val);
        }

        let mut keys: Vec<String> = groups.keys().cloned().collect();
        keys.sort();

        let mut result_keys: Vec<Option<String>> = vec![];
        let mut result_vals: Vec<Option<f64>> = vec![];

        for key in &keys {
            let vals = &groups[key];
            let agg = match agg_fn {
                "SUM"   => vals.iter().sum(),
                "COUNT" => vals.len() as f64,
                "AVG"   => vals.iter().sum::<f64>() / vals.len() as f64,
                "MIN"   => vals.iter().cloned().fold(f64::INFINITY, f64::min),
                "MAX"   => vals.iter().cloned().fold(f64::NEG_INFINITY, f64::max),
                _       => 0.0,
            };
            result_keys.push(Some(key.clone()));
            result_vals.push(Some(agg));
        }

        let row_count = result_keys.len();
        let mut columns = HashMap::new();
        columns.insert(group_col.to_string(), Column::Utf8(result_keys));
        columns.insert(agg_col.to_string(), Column::Float64(result_vals));

        DataFrame { columns, row_count }
    }

    pub fn sort(&self, col: &str, ascending: bool) -> DataFrame {
        let mut indices: Vec<usize> = (0..self.row_count).collect();

        match self.columns.get(col) {
            Some(Column::Float64(v)) => {
                indices.sort_by(|&a, &b| {
                    let va = v[a].unwrap_or(f64::NAN);
                    let vb = v[b].unwrap_or(f64::NAN);
                    if ascending { va.partial_cmp(&vb) } else { vb.partial_cmp(&va) }
                        .unwrap_or(std::cmp::Ordering::Equal)
                });
            },
            Some(Column::Int64(v)) => {
                indices.sort_by(|&a, &b| {
                    let va = v[a].unwrap_or(0);
                    let vb = v[b].unwrap_or(0);
                    if ascending { va.cmp(&vb) } else { vb.cmp(&va) }
                });
            },
            Some(Column::Utf8(v)) => {
                indices.sort_by(|&a, &b| {
                    let va = v[a].as_deref().unwrap_or("");
                    let vb = v[b].as_deref().unwrap_or("");
                    if ascending { va.cmp(vb) } else { vb.cmp(va) }
                });
            },
            None => return DataFrame::new(),
        }

        let mut columns: HashMap<String, Column> = HashMap::new();
        for (name, col_data) in &self.columns {
            let reordered = match col_data {
                Column::Float64(v) => Column::Float64(indices.iter().map(|&i| v[i]).collect()),
                Column::Int64(v)   => Column::Int64(indices.iter().map(|&i| v[i]).collect()),
                Column::Utf8(v)    => Column::Utf8(indices.iter().map(|&i| v[i].clone()).collect()),
            };
            columns.insert(name.clone(), reordered);
        }

        DataFrame { columns, row_count: self.row_count }
    }

    pub fn to_json(&self) -> String {
        let mut rows: Vec<HashMap<String, serde_json::Value>> = vec![HashMap::new(); self.row_count];

        for (name, col_data) in &self.columns {
            match col_data {
                Column::Float64(v) => {
                    for (i, val) in v.iter().enumerate() {
                        rows[i].insert(name.clone(), match val {
                            Some(n) => serde_json::Value::from(*n),
                            None    => serde_json::Value::Null,
                        });
                    }
                },
                Column::Int64(v) => {
                    for (i, val) in v.iter().enumerate() {
                        rows[i].insert(name.clone(), match val {
                            Some(n) => serde_json::Value::from(*n),
                            None    => serde_json::Value::Null,
                        });
                    }
                },
                Column::Utf8(v) => {
                    for (i, val) in v.iter().enumerate() {
                        rows[i].insert(name.clone(), match val {
                            Some(s) => serde_json::Value::String(s.clone()),
                            None    => serde_json::Value::Null,
                        });
                    }
                },
            }
        }

        serde_json::to_string(&rows).unwrap_or_else(|_| "[]".to_string())
    }
}

fn apply_mask<T: Clone>(values: &[Option<T>], mask: &[bool]) -> Vec<Option<T>> {
    values.iter().zip(mask.iter())
        .filter(|(_, &keep)| keep)
        .map(|(v, _)| v.clone())
        .collect()
}
