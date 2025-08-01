// IPC (Consumer Price Index) data for Russia.
//
// This script computes the IPC series dynamically from monthly CPI percentages
// published by the Federal State Statistics Service (Rosstat).  The series
// is normalised so that the first value (February 2003) equals 1.0.  Each
// observation is dated on the last calendar day of its month to align with
// the bond index data, which also use month‑end dates.

let ipc = {};

// Monthly CPI percentages by year (January through December).  For the most
// recent year (2025) data are available only through June.
const monthlyCPI = {
  2003: [102.40, 101.63, 101.05, 101.02, 100.80, 100.80, 100.71, 99.59, 100.34, 101.00, 100.96, 101.10],
  2004: [101.75, 100.99, 100.75, 100.99, 100.74, 100.78, 100.92, 100.42, 100.43, 101.14, 101.11, 101.14],
  2005: [102.62, 101.23, 101.34, 101.12, 100.80, 100.64, 100.46, 99.86, 100.25, 100.55, 100.74, 100.82],
  2006: [102.43, 101.66, 100.82, 100.35, 100.48, 100.28, 100.67, 100.19, 100.09, 100.28, 100.63, 100.79],
  2007: [101.68, 101.11, 100.59, 100.57, 100.63, 100.95, 100.87, 100.09, 100.79, 101.64, 101.23, 101.13],
  2008: [102.31, 101.20, 101.20, 101.42, 101.35, 100.97, 100.51, 100.36, 100.80, 100.91, 100.83, 100.69],
  2009: [102.37, 101.65, 101.31, 100.69, 100.57, 100.60, 100.63, 100.00, 99.97, 100.00, 100.29, 100.41],
  2010: [101.64, 100.86, 100.63, 100.29, 100.50, 100.39, 100.36, 100.55, 100.84, 100.50, 100.81, 101.08],
  2011: [102.37, 100.78, 100.62, 100.43, 100.48, 100.23, 99.99, 99.76, 99.96, 100.48, 100.42, 100.44],
  2012: [100.50, 100.37, 100.58, 100.31, 100.52, 100.89, 101.23, 100.10, 100.55, 100.46, 100.34, 100.54],
  2013: [100.97, 100.56, 100.34, 100.51, 100.66, 100.42, 100.82, 100.14, 100.21, 100.57, 100.56, 100.51],
  2014: [100.59, 100.70, 101.02, 100.90, 100.90, 100.62, 100.49, 100.24, 100.65, 100.82, 101.28, 102.62],
  2015: [103.85, 102.22, 101.21, 100.46, 100.35, 100.19, 100.80, 100.35, 100.57, 100.74, 100.75, 100.77],
  2016: [100.96, 100.63, 100.46, 100.44, 100.41, 100.36, 100.54, 100.01, 100.17, 100.43, 100.44, 100.40],
  2017: [100.62, 100.22, 100.13, 100.33, 100.37, 100.61, 100.07, 99.46, 99.85, 100.20, 100.22, 100.42],
  2018: [100.31, 100.21, 100.29, 100.38, 100.38, 100.49, 100.27, 100.01, 100.16, 100.35, 100.50, 100.84],
  2019: [101.01, 100.44, 100.32, 100.29, 100.34, 100.04, 100.20, 99.76, 99.84, 100.13, 100.28, 100.36],
  2020: [100.40, 100.33, 100.55, 100.83, 100.27, 100.22, 100.35, 99.96, 99.93, 100.43, 100.71, 100.83],
  2021: [100.67, 100.78, 100.66, 100.58, 100.74, 100.69, 100.31, 100.17, 100.60, 101.11, 100.96, 100.82],
  2022: [100.99, 101.17, 107.61, 101.56, 100.12, 99.65, 99.61, 99.48, 100.05, 100.18, 100.37, 100.78],
  2023: [100.84, 100.46, 100.37, 100.38, 100.31, 100.37, 100.63, 100.28, 100.87, 100.83, 101.11, 100.73],
  2024: [100.86, 100.68, 100.39, 100.50, 100.74, 100.64, 101.14, 100.20, 100.48, 100.75, 101.43, 101.32],
  2025: [101.23, 100.81, 100.65, 100.40, 100.43, 100.20],
};

// Helper to compute the last day of a given month (1‑indexed)
function getLastDay(year, month) {
  return new Date(year, month, 0).getDate();
}

// Build the IPC series.  Normalise so that February 2003 is 1.0.
ipc.x = [];
ipc.y = [];
let cumulative = 1.0;
let firstValue = null;
const startYear = 2003;
const startMonth = 2; // skip January 2003
for (let year = startYear; year <= 2025; year++) {
  const yearCPI = monthlyCPI[year];
  for (let idx = 0; idx < yearCPI.length; idx++) {
    const monthNumber = idx + 1;
    // skip months before the start
    if (year === startYear && monthNumber < startMonth) {
      continue;
    }
    cumulative *= yearCPI[idx] / 100;
    if (firstValue === null) {
      firstValue = cumulative;
    }
    const normalised = cumulative / firstValue;
    const day = getLastDay(year, monthNumber);
    ipc.y.push(parseFloat(normalised.toFixed(10)));
    ipc.x.push(`${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
}

// Meta‑data for the Plotly chart
ipc.name = "ИПЦ";
ipc.type = "scatter";
ipc.line = {};
ipc.line.color = "grey";
ipc.line.dash = "solid";
