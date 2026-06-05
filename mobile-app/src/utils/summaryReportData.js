import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { buildCycleMonthlyProductionYearData } from './reportCycles';

const REPORT_INPUT_STORAGE_KEY = 'nemexus-summary-report-inputs';
export const MONTH_SHORT_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const REFERENCE_SUMMARY_REPORT_INPUTS = {
  '2025-12': {
    billedVolume: 5895.89,
    nrw: 1052.41,
    totalPower: 4832.96,
    leyecoConsumption: 5777,
    effectiveRate: 11.8,
    electricBill: 68164.36,
  },
  '2026-01': {
    billedVolume: 7615.38,
    nrw: 2057,
    totalPower: 6863.55,
    leyecoConsumption: 6310,
    effectiveRate: 14.09,
    electricBill: 88899.61,
  },
  '2026-02': {
    billedVolume: 6658,
    nrw: 930.31,
    totalPower: 5162.3,
    leyecoConsumption: 4037,
    effectiveRate: 11.19,
    electricBill: 45181.15,
  },
  '2026-03': {
    billedVolume: 4837.16,
    nrw: 1477.01,
    totalPower: 4414.6,
    leyecoConsumption: 4338,
    effectiveRate: 13.13,
    electricBill: 56951.04,
  },
  '2026-04': {
    billedVolume: 6629.99,
    nrw: 2270.81,
    totalPower: 5996.7,
    leyecoConsumption: 5491,
    effectiveRate: 11.77,
    electricBill: 64643.84,
    intakeBill: 63412.42,
    chlorinationBill: 1231.42,
    operatingHours: 550.5,
    powerCostProduction: 8542.2,
    secOverride: 0.64,
    motorLoadOverride: 9.8,
    deepwellPower: 5394.9,
    chlorinationPower: 72.11,
    dateLabel: 'April 21, 2026',
  },
  '2026-05': {
    totalPower: 7671.4,
    leyecoConsumption: 7657,
    effectiveRate: 10.21,
    electricBill: 78151.73,
    intakeBill: 76584.08,
    chlorinationBill: 1567.65,
    operatingHours: 608,
    powerCostProduction: 9813.07,
    secOverride: 0.78,
    motorLoadOverride: 12.35,
    deepwellPower: 7508.8,
    chlorinationPower: 145.39,
    dateLabel: 'May 21, 2026',
  },
};

export function mergeSummaryReportInputs(baseInputs = {}, overrideInputs = {}) {
  const monthKeys = new Set([...Object.keys(baseInputs || {}), ...Object.keys(overrideInputs || {})]);

  return [...monthKeys].reduce((mergedInputs, monthKey) => {
    const overrideRow = Object.entries(overrideInputs?.[monthKey] ?? {}).reduce((row, [field, value]) => {
      if (value !== '' && value !== null && value !== undefined) {
        row[field] = value;
      }

      return row;
    }, {});

    mergedInputs[monthKey] = {
      ...(baseInputs?.[monthKey] ?? {}),
      ...overrideRow,
    };
    return mergedInputs;
  }, {});
}

export async function loadSummaryReportInputs() {
  try {
    const stored = Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(REPORT_INPUT_STORAGE_KEY)
      : await SecureStore.getItemAsync(REPORT_INPUT_STORAGE_KEY);
    const parsed = JSON.parse(stored || '{}');
    return parsed && typeof parsed === 'object'
      ? mergeSummaryReportInputs(REFERENCE_SUMMARY_REPORT_INPUTS, parsed)
      : REFERENCE_SUMMARY_REPORT_INPUTS;
  } catch (_error) {
    return REFERENCE_SUMMARY_REPORT_INPUTS;
  }
}

export async function saveSummaryReportInputs(inputs) {
  const serialized = JSON.stringify(inputs || {});

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(REPORT_INPUT_STORAGE_KEY, serialized);
    return;
  }

  await SecureStore.setItemAsync(REPORT_INPUT_STORAGE_KEY, serialized);
}

export function getCurrentYear() {
  return new Date().getFullYear();
}

export function getCurrentDateKey() {
  const currentDate = new Date();
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
}

export function getCurrentMonthKey() {
  return getCurrentDateKey().slice(0, 7);
}

export function getMonthKey(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function getMonthLabel(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return monthKey || '-';
  }

  return `${MONTH_SHORT_LABELS[month - 1]} ${year}`;
}

export function getDateLabelFromKey(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);

  if (![year, month, day].every(Number.isFinite)) {
    return dateKey || '-';
  }

  return `${MONTH_SHORT_LABELS[month - 1]} ${day}, ${year}`;
}

export function getDateKeyFromMonth(monthKey, day = 1) {
  const [year, month] = String(monthKey || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return '';
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getLastDateKeyFromMonth(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return '';
  }

  return getDateKeyFromMonth(monthKey, new Date(year, month, 0).getDate());
}

export function getPreviousMonthKey(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return '';
  }

  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatNumber(value, decimals = 2) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return '-';
  }

  return parsed.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCurrency(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? `PHP ${formatNumber(parsed)}` : '-';
}

export function getFieldStatus(row, fields) {
  return fields.every((field) => Number(row?.[field]) > 0) ? 'added' : 'missing';
}

export function getLatestInputMonth(reportInputs = {}, fields = [], fallbackMonthKey) {
  return Object.entries(reportInputs || {})
    .filter(([_monthKey, row]) => fields.every((field) => Number(row?.[field]) > 0))
    .map(([monthKey]) => monthKey)
    .sort()
    .pop() || fallbackMonthKey;
}

export function getPowerCostRangeMonthKeys(reportInputs = {}, fallbackStartMonthKey, fallbackEndMonthKey) {
  const completeMonths = Object.entries(reportInputs || {})
    .filter(([_monthKey, row]) => ['intakeBill', 'chlorinationBill', 'operatingHours', 'powerCostProduction', 'deepwellPower', 'chlorinationPower'].every((field) => Number(row?.[field]) > 0))
    .map(([monthKey]) => monthKey)
    .sort();

  if (completeMonths.length >= 2) {
    return {
      startMonthKey: completeMonths[completeMonths.length - 2],
      endMonthKey: completeMonths[completeMonths.length - 1],
    };
  }

  return {
    startMonthKey: completeMonths[0] || fallbackStartMonthKey,
    endMonthKey: completeMonths[1] || completeMonths[0] || fallbackEndMonthKey,
  };
}

export function buildExportMonthOptions(dashboard) {
  const optionMap = new Map();
  [
    ...((dashboard?.dailyProductionYears ?? []).flatMap((yearData) => yearData.months ?? [])),
    ...((dashboard?.monthlyProductionYears ?? []).flatMap((yearData) => yearData.rows ?? [])),
    ...((dashboard?.monthlyPowerConsumptionYears ?? []).flatMap((yearData) => yearData.rows ?? [])),
    ...((dashboard?.monthlyChemicalUsageYears ?? []).flatMap((yearData) => yearData.rows ?? [])),
  ].forEach((month) => {
    if (!month?.key) {
      return;
    }

    optionMap.set(month.key, {
      key: month.key,
      monthLabel: month.monthLabel || month.label?.replace('\n', ' ') || getMonthLabel(month.key),
    });
  });

  const currentYear = getCurrentYear();
  const optionYears = Array.from(new Set([
    currentYear,
    ...Array.from(optionMap.keys()).map((key) => Number(String(key).slice(0, 4))).filter(Number.isFinite),
  ]));
  const paddedYears = new Set([...optionYears, currentYear - 1]);
  paddedYears.forEach((year) => {
    Array.from({ length: 12 }, (_item, monthIndex) => {
      const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;

      if (!optionMap.has(key)) {
        optionMap.set(key, { key, monthLabel: getMonthLabel(key) });
      }
    });
  });

  return [...optionMap.values()].sort((first, second) => String(first.key).localeCompare(String(second.key)));
}

export function getDailyDateKeys(dashboard) {
  return (dashboard?.dailyProductionYears ?? [])
    .flatMap((yearData) => yearData.months ?? [])
    .flatMap((month) => month.rows ?? [])
    .map((row) => row.date || row.key)
    .filter(Boolean)
    .sort();
}

export function getMonthlyProduction(dashboard, monthKey) {
  const year = Number(String(monthKey || '').slice(0, 4));
  const yearData = (dashboard?.monthlyProductionYears ?? []).find((item) => Number(item.year) === year);
  const row = yearData?.rows?.find((item) => item.key === monthKey);
  return parseNumber(row?.production);
}

export function getMonthlyPower(dashboard, monthKey) {
  const year = Number(String(monthKey || '').slice(0, 4));
  const yearData = (dashboard?.monthlyPowerConsumptionYears ?? []).find((item) => Number(item.year) === year);
  const row = yearData?.rows?.find((item) => item.key === monthKey);

  return {
    chlorinationPower: parseNumber(row?.chlorinationPower),
    intakePower: parseNumber(row?.deepwellPower),
    totalPower: parseNumber(row?.totalPower) || parseNumber(row?.chlorinationPower) + parseNumber(row?.deepwellPower),
  };
}

function getYearDataForMonth(collection, monthKey) {
  const year = Number(String(monthKey || '').slice(0, 4));
  return (collection ?? []).find((yearData) => Number(yearData?.year) === year) || (collection ?? [])[0] || {};
}

function getTrendData(yearData, monthKey, totalKeys, yearDataCollection = []) {
  const reportYear = Number(yearData?.year ?? String(monthKey || '').slice(0, 4));
  const previousDecemberKey = Number.isFinite(reportYear) ? `${reportYear - 1}-12` : '';
  const previousYearData = yearDataCollection.find((item) => Number(item?.year) === reportYear - 1);
  const previousDecemberRow = previousYearData?.rows?.find((item) => item.key === previousDecemberKey);
  const rows = [...(previousDecemberRow ? [previousDecemberRow] : []), ...(yearData?.rows ?? [])];
  const row = rows.find((item) => item.key === monthKey);
  const trendRows = rows.filter((item) => String(item.key || '').localeCompare(monthKey) <= 0);

  return {
    ...(yearData ?? {}),
    rows: trendRows.length ? trendRows : row ? [row] : [],
    ...totalKeys.reduce((totals, { source, target }) => {
      totals[target] = row ? Number(row[source] ?? 0) : 0;
      return totals;
    }, {}),
  };
}

function getDailyProductionRangeData(dashboard, startDate, endDate, fallbackMonthKey) {
  const dailyProductionYears = dashboard?.dailyProductionYears ?? [];
  const fallbackMonth = dailyProductionYears
    .flatMap((yearData) => yearData.months ?? [])
    .find((month) => month.key === String(fallbackMonthKey || '').slice(0, 7)) || dashboard?.dailyProduction || {};
  const safeStartDate = startDate && endDate && startDate.localeCompare(endDate) <= 0 ? startDate : endDate || startDate;
  const safeEndDate = endDate && safeStartDate && endDate.localeCompare(safeStartDate) >= 0 ? endDate : safeStartDate;
  const rows = dailyProductionYears
    .flatMap((yearData) => yearData.months ?? [])
    .flatMap((month) => month.rows ?? [])
    .filter((row) => {
      const rowDate = row.date || row.key;
      return rowDate && String(rowDate).localeCompare(safeStartDate) >= 0 && String(rowDate).localeCompare(safeEndDate) <= 0;
    })
    .sort((first, second) => String(first.key || first.date || '').localeCompare(String(second.key || second.date || '')));
  const rangeLabel = safeStartDate === safeEndDate
    ? getDateLabelFromKey(safeStartDate)
    : `${getDateLabelFromKey(safeStartDate)} - ${getDateLabelFromKey(safeEndDate)}`;

  return {
    ...fallbackMonth,
    key: safeStartDate === safeEndDate ? safeStartDate : `${safeStartDate}_${safeEndDate}`,
    monthLabel: rangeLabel,
    totalProduction: rows.length
      ? rows.reduce((total, row) => total + Number(row.production ?? 0), 0)
      : Number(fallbackMonth.totalProduction ?? 0),
    rows: rows.length ? rows : fallbackMonth.rows ?? [],
  };
}

function buildBilledVolumeInputs(reportInputs = {}) {
  return Object.entries(reportInputs).reduce((volumes, [monthKey, row]) => {
    if (Number(row?.billedVolume) > 0) {
      volumes[monthKey] = row.billedVolume;
    }

    return volumes;
  }, {});
}

function sortRowsForChart(rows) {
  return [...(rows ?? [])].sort((first, second) => String(first.key || first.date || first.label || '').localeCompare(String(second.key || second.date || second.label || '')));
}

function buildMonthlyMap(rows) {
  return new Map((rows ?? []).map((row) => [row.key || row.label, row]));
}

function mergeReportInputRows(rows = [], reportInputs = {}) {
  const mergedRows = (rows ?? []).map((row) => {
    const monthKey = row.key || row.label;
    const reportInput = reportInputs?.[monthKey];
    return reportInput ? { ...row, ...reportInput } : row;
  });
  const existingKeys = new Set(mergedRows.map((row) => row.key || row.label).filter(Boolean));
  const inputOnlyRows = Object.entries(reportInputs || {})
    .filter(([monthKey]) => monthKey && !existingKeys.has(monthKey))
    .map(([monthKey, reportInput]) => ({ key: monthKey, ...reportInput }));

  return [...mergedRows, ...inputOnlyRows];
}

function buildTemplateYearRows(rows, year, valueKeys = [], options = {}) {
  const rowsByKey = new Map((rows ?? []).map((row) => [row.key, row]));
  const parsedYear = Number(year);
  const safeYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
  const startMonthKey = String(options.startMonthKey || '');
  const endMonthKey = String(options.endMonthKey || '');
  const allMonths = [new Date(safeYear - 1, 11, 1), ...Array.from({ length: 12 }, (_item, monthIndex) => new Date(safeYear, monthIndex, 1))];
  const months = startMonthKey || endMonthKey
    ? allMonths.filter((date) => {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return (!startMonthKey || key.localeCompare(startMonthKey) >= 0) && (!endMonthKey || key.localeCompare(endMonthKey) <= 0);
      })
    : allMonths;

  return months.map((date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const row = rowsByKey.get(key);
    const output = {
      ...(row ?? {}),
      key,
      label: row?.label || getMonthLabel(key),
      readingCount: row?.readingCount ?? '',
    };

    valueKeys.forEach((valueKey) => {
      if (valueKey === 'totalPower') {
        output.totalPower = parseNumber(row?.totalPower) || parseNumber(row?.chlorinationPower) + parseNumber(row?.deepwellPower);
        return;
      }

      output[valueKey] = parseNumber(row?.[valueKey]);
    });

    return output;
  });
}

function buildBilledVolumeRows(productionRows = [], billedVolumes = {}) {
  return sortRowsForChart(productionRows).map((productionRow) => {
    const defaultRow = REFERENCE_SUMMARY_REPORT_INPUTS[productionRow.key];
    const billedVolume = parseNumber(billedVolumes?.[productionRow.key] ?? defaultRow?.billedVolume);
    const defaultTotalVolume = parseNumber(defaultRow?.billedVolume) + parseNumber(defaultRow?.nrw);
    const production = parseNumber(productionRow.production) || defaultTotalVolume;
    const nrw = billedVolume > 0 && production > 0
      ? Math.max(production - billedVolume, 0)
      : parseNumber(defaultRow?.nrw);

    return {
      key: productionRow.key,
      label: getMonthLabel(productionRow.key),
      billedVolume,
      nrw,
      production,
      nrwPercent: production > 0 ? (nrw / production) * 100 : 0,
    };
  });
}

function buildPowerUnitUsageRows(productionRows = [], powerRows = []) {
  const powerByMonth = buildMonthlyMap(powerRows);

  return sortRowsForChart(productionRows).map((productionRow) => {
    const powerRow = powerByMonth.get(productionRow.key || productionRow.label);
    const production = parseNumber(productionRow.production);
    const power = parseNumber(powerRow?.totalPower);

    return {
      key: productionRow.key,
      label: productionRow.label,
      unitUsage: production > 0 ? power / production : 0,
      production,
      power,
    };
  });
}

function buildChemicalUnitUsageRows(productionRows = [], chemicalRows = [], chemicalKey) {
  const chemicalByMonth = buildMonthlyMap(chemicalRows);

  return sortRowsForChart(productionRows).map((productionRow) => {
    const chemicalRow = chemicalByMonth.get(productionRow.key || productionRow.label);
    const production = parseNumber(productionRow.production);
    const chemical = parseNumber(chemicalRow?.[chemicalKey]);

    return {
      key: productionRow.key,
      label: productionRow.label,
      unitUsage: production > 0 ? chemical / production : 0,
      production,
      chemical,
    };
  });
}

function buildElectricBillRows(powerRows = [], year) {
  const parsedYear = Number(year);
  const safeYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
  const powerByMonth = buildMonthlyMap(powerRows);

  return Array.from({ length: 12 }, (_item, monthIndex) => {
    const key = `${safeYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    const powerRow = powerByMonth.get(key);
    const combinedConsumption = parseNumber(powerRow?.totalPower) || parseNumber(powerRow?.chlorinationPower) + parseNumber(powerRow?.deepwellPower);
    const leyecoConsumption = parseNumber(powerRow?.leyecoConsumption);
    const effectiveRate = parseNumber(powerRow?.effectiveRate);
    const electricBill = parseNumber(powerRow?.electricBill) || (leyecoConsumption > 0 && effectiveRate > 0 ? leyecoConsumption * effectiveRate : 0);

    return {
      key,
      label: getMonthLabel(key),
      combinedConsumption,
      leyecoConsumption,
      effectiveRate,
      electricBill,
    };
  });
}

function buildPowerCostRows(electricBillRows = [], productionRows = [], powerRows = [], endMonthKey = '', startMonthKey = '') {
  const productionByMonth = buildMonthlyMap(productionRows);
  const powerByMonth = buildMonthlyMap(powerRows);
  const availableKeys = new Set([...electricBillRows.map((row) => row.key), ...productionRows.map((row) => row.key), ...powerRows.map((row) => row.key)].filter(Boolean));
  const sortedKeys = [...availableKeys].sort();
  const comparisonEndKey = endMonthKey || sortedKeys[sortedKeys.length - 1] || '';
  const comparisonKeys = startMonthKey
    ? sortedKeys.filter((key) => key.localeCompare(startMonthKey) >= 0 && key.localeCompare(comparisonEndKey) <= 0)
    : sortedKeys.filter((key) => key.localeCompare(comparisonEndKey) <= 0).slice(-2);

  return comparisonKeys
    .map((key) => {
      const electricRow = electricBillRows.find((row) => row.key === key) ?? {};
      const productionRow = productionByMonth.get(key);
      const powerRow = powerByMonth.get(key);
      const production = parseNumber(powerRow?.powerCostProduction) || parseNumber(productionRow?.production);
      const chlorinationKwh = parseNumber(powerRow?.chlorinationPower);
      const intakeKwh = parseNumber(powerRow?.deepwellPower);
      const operatingHours = parseNumber(powerRow?.operatingHours);
      const intakeBill = parseNumber(powerRow?.intakeBill) || parseNumber(electricRow.electricBill);
      const chlorinationBill = parseNumber(powerRow?.chlorinationBill);
      const sec = parseNumber(powerRow?.secOverride) || (production > 0 ? (intakeKwh + chlorinationKwh) / production : 0);
      const motorLoad = parseNumber(powerRow?.motorLoadOverride) || (operatingHours > 0 ? intakeKwh / operatingHours : 0);

      return {
        key,
        label: getMonthLabel(key),
        dateLabel: powerRow?.dateLabel || getMonthLabel(key),
        intakeBill,
        chlorinationBill,
        operatingHours,
        production,
        intakeKwh,
        chlorinationKwh,
        sec,
        motorLoad,
      };
    })
    .filter((row) => row.intakeBill > 0 || row.chlorinationBill > 0 || row.production > 0 || row.sec > 0);
}

export function buildSummaryReportPayload({ dashboard, reportInputs, exportOptions }) {
  const effectiveInputs = mergeSummaryReportInputs(REFERENCE_SUMMARY_REPORT_INPUTS, reportInputs);
  const reportMonthKey = String(exportOptions.dailyStartDate || exportOptions.graphEndMonthKey || getCurrentMonthKey()).slice(0, 7);
  const reportYear = Number(String(exportOptions.graphEndMonthKey).slice(0, 4)) || getCurrentYear();
  const monthlyProductionYears = dashboard?.monthlyProductionYears ?? [];
  const monthlyPowerConsumptionYears = dashboard?.monthlyPowerConsumptionYears ?? [];
  const monthlyChemicalUsageYears = dashboard?.monthlyChemicalUsageYears ?? [];
  const cycleMonthlyProductionYears = monthlyProductionYears.map((yearData) =>
    buildCycleMonthlyProductionYearData(dashboard, yearData, exportOptions.dailyStartDate, exportOptions.dailyEndDate)
  );
  const productionYearData = getYearDataForMonth(cycleMonthlyProductionYears, exportOptions.graphEndMonthKey);
  const powerYearData = getYearDataForMonth(monthlyPowerConsumptionYears, exportOptions.graphEndMonthKey);
  const chemicalYearData = getYearDataForMonth(monthlyChemicalUsageYears, exportOptions.graphEndMonthKey);
  const selectedMonthlyProduction = getTrendData(productionYearData, exportOptions.graphEndMonthKey, [
    { source: 'production', target: 'totalProduction' },
    { source: 'production', target: 'averageProduction' },
  ], cycleMonthlyProductionYears);
  const selectedPowerConsumption = getTrendData(powerYearData, exportOptions.graphEndMonthKey, [{ source: 'totalPower', target: 'totalPower' }], monthlyPowerConsumptionYears);
  const selectedChemicalUsage = getTrendData(chemicalYearData, exportOptions.graphEndMonthKey, [
    { source: 'chlorineUsage', target: 'totalChlorine' },
    { source: 'peroxideUsage', target: 'totalPeroxide' },
  ], monthlyChemicalUsageYears);
  const selectedDailyProduction = getDailyProductionRangeData(dashboard, exportOptions.dailyStartDate, exportOptions.dailyEndDate, reportMonthKey);
  const graphRange = {
    startMonthKey: exportOptions.graphStartMonthKey,
    endMonthKey: exportOptions.graphEndMonthKey,
  };
  const productionRows = selectedMonthlyProduction?.rows ?? [];
  const powerRows = mergeReportInputRows(selectedPowerConsumption?.rows ?? [], effectiveInputs);
  const chemicalRows = selectedChemicalUsage?.rows ?? [];
  const templateProductionRows = buildTemplateYearRows(productionRows, reportYear, ['production'], graphRange);
  const templatePowerRows = buildTemplateYearRows(powerRows, reportYear, ['chlorinationPower', 'deepwellPower', 'totalPower'], graphRange);
  const templateChemicalRows = buildTemplateYearRows(chemicalRows, reportYear, ['chlorineUsage', 'peroxideUsage'], graphRange);
  const billedVolumeRows = buildBilledVolumeRows(templateProductionRows, {
    ...buildBilledVolumeInputs(effectiveInputs),
  });
  const powerUnitUsageRows = buildPowerUnitUsageRows(templateProductionRows, templatePowerRows);
  const electricBillRows = buildElectricBillRows(powerRows, reportYear);
  const powerCostRows = buildPowerCostRows(
    electricBillRows,
    productionRows,
    powerRows,
    exportOptions.powerCostEndMonthKey || exportOptions.graphEndMonthKey,
    exportOptions.powerCostStartMonthKey
  );
  const chlorineUnitUsageRows = buildChemicalUnitUsageRows(templateProductionRows, templateChemicalRows, 'chlorineUsage');
  const peroxideUnitUsageRows = buildChemicalUnitUsageRows(templateProductionRows, templateChemicalRows, 'peroxideUsage');
  const reportPeriodLabel = exportOptions.dailyStartDate === exportOptions.dailyEndDate
    ? getDateLabelFromKey(exportOptions.dailyStartDate)
    : `${getDateLabelFromKey(exportOptions.dailyStartDate)} - ${getDateLabelFromKey(exportOptions.dailyEndDate)}`;

  return {
    reportPeriodLabel,
    reportYear,
    selectedDailyProduction,
    monthlyProductionRows: templateProductionRows,
    billedVolumeRows,
    powerRows: templatePowerRows,
    powerUnitUsageRows,
    electricBillRows,
    chemicalRows: templateChemicalRows,
    chlorineUnitUsageRows,
    peroxideUnitUsageRows,
    powerCostRows,
  };
}

export function buildSummaryReportPptxArgs({ dashboard, reportInputs, exportOptions }) {
  const effectiveInputs = mergeSummaryReportInputs(REFERENCE_SUMMARY_REPORT_INPUTS, reportInputs);
  const reportMonthKey = String(exportOptions.dailyStartDate || exportOptions.graphEndMonthKey || getCurrentMonthKey()).slice(0, 7);
  const reportYear = Number(String(exportOptions.graphEndMonthKey).slice(0, 4)) || getCurrentYear();
  const monthlyProductionYears = dashboard?.monthlyProductionYears ?? [];
  const monthlyPowerConsumptionYears = dashboard?.monthlyPowerConsumptionYears ?? [];
  const monthlyChemicalUsageYears = dashboard?.monthlyChemicalUsageYears ?? [];
  const cycleMonthlyProductionYears = monthlyProductionYears.map((yearData) =>
    buildCycleMonthlyProductionYearData(dashboard, yearData, exportOptions.dailyStartDate, exportOptions.dailyEndDate)
  );
  const productionYearData = getYearDataForMonth(cycleMonthlyProductionYears, exportOptions.graphEndMonthKey);
  const powerYearData = getYearDataForMonth(monthlyPowerConsumptionYears, exportOptions.graphEndMonthKey);
  const chemicalYearData = getYearDataForMonth(monthlyChemicalUsageYears, exportOptions.graphEndMonthKey);

  return {
    selectedMonthlyProduction: getTrendData(productionYearData, exportOptions.graphEndMonthKey, [
      { source: 'production', target: 'totalProduction' },
      { source: 'production', target: 'averageProduction' },
    ], cycleMonthlyProductionYears),
    selectedBilledVolumes: buildBilledVolumeInputs(effectiveInputs),
    selectedDailyProduction: getDailyProductionRangeData(dashboard, exportOptions.dailyStartDate, exportOptions.dailyEndDate, reportMonthKey),
    selectedPowerConsumption: getTrendData(powerYearData, exportOptions.graphEndMonthKey, [{ source: 'totalPower', target: 'totalPower' }], monthlyPowerConsumptionYears),
    selectedChemicalUsage: getTrendData(chemicalYearData, exportOptions.graphEndMonthKey, [
      { source: 'chlorineUsage', target: 'totalChlorine' },
      { source: 'peroxideUsage', target: 'totalPeroxide' },
    ], monthlyChemicalUsageYears),
    context: {
      reportScope: 'monthly',
      reportPeriodLabel: exportOptions.dailyStartDate === exportOptions.dailyEndDate
        ? getDateLabelFromKey(exportOptions.dailyStartDate)
        : `${getDateLabelFromKey(exportOptions.dailyStartDate)} - ${getDateLabelFromKey(exportOptions.dailyEndDate)}`,
      dailyStartDate: exportOptions.dailyStartDate,
      dailyEndDate: exportOptions.dailyEndDate,
      graphStartMonthKey: exportOptions.graphStartMonthKey,
      graphEndMonthKey: exportOptions.graphEndMonthKey,
      powerCostStartMonthKey: exportOptions.powerCostStartMonthKey,
      powerCostEndMonthKey: exportOptions.powerCostEndMonthKey,
      reportInputs: effectiveInputs,
      productionYear: reportYear,
      powerYear: reportYear,
      chemicalYear: reportYear,
    },
  };
}
