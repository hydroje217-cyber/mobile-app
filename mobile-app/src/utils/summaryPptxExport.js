import { saveNativeExportFile } from './exportFiles';

const PPTX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

const COLORS = {
  ink: '102236',
  black: '111111',
  muted: '60727C',
  teal: '0F766E',
  templateBlue: '4285F4',
  templateYellow: 'FDD966',
  templatePurple: '9900FF',
  templateGray: 'C9C9C9',
  templatePink: 'D6A0BD',
  templateTeal: '0B5D73',
  templateNavy: '0E2841',
  templateNavy2: '14283A',
  referenceNavy: '073153',
  referenceCream: 'F7F1E5',
  referenceCream2: 'EFE7D8',
  referenceRed: 'A13A1F',
  templatePanel: 'F9F9F7',
  blue: '2563EB',
  green: '16A34A',
  amber: 'F59E0B',
  deep: '11233B',
  panel: 'F8FBFC',
  border: 'D3DDE3',
  white: 'FFFFFF',
};

const POWER_COST_TEMPLATE_URL = '/templates/BARUGO-III-Performance-Report_May-2026.pptx';
const POWER_COST_TEMPLATE_SLIDES = [
  { sourceSlide: 12, targetSlide: 12 },
  { sourceSlide: 13, targetSlide: 13 },
];

const DEFAULT_BILLED_VOLUME_ROWS = {
  '2025-12': { billedVolume: 5895.89, nrw: 1052.41 },
  '2026-01': { billedVolume: 7615.38, nrw: 2057.00 },
  '2026-02': { billedVolume: 6658.00, nrw: 930.31 },
  '2026-03': { billedVolume: 4837.16, nrw: 1477.01 },
  '2026-04': { billedVolume: 6629.99, nrw: 2270.81 },
};

const TEXT_SHADOW = {
  type: 'outer',
  color: '000000',
  opacity: 0.22,
  blur: 1,
  angle: 45,
  offset: 1,
};

function formatNumber(value, decimals = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '-';
  }

  return parsed.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCurrency(value, decimals = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '-';
  }

  return `₱ ${parsed.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatKwh(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '-';
  }

  return `${formatNumber(parsed)} kWh`;
}

function formatPercent(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return '-';
  }

  return `${parsed >= 0 ? '+' : ''}${formatNumber(parsed, 1)}%`;
}

function formatDateTime(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function safeText(value) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function chartValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function makeFileDate(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function makeFileSafe(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getDateFromKey(dateKey) {
  const parsed = new Date(`${dateKey || ''}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getMonthYearLabelFromDateKey(dateKey) {
  const parsed = getDateFromKey(dateKey);

  if (!parsed) {
    return '';
  }

  return parsed.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function getCoverPeriodLabel(startDateKey, endDateKey) {
  const startDate = getDateFromKey(startDateKey);
  const endDate = getDateFromKey(endDateKey);
  const coverDate = startDate && endDate
    ? (endDate.getTime() >= startDate.getTime() ? endDate : startDate)
    : endDate || startDate;

  return coverDate ? getMonthYearLabelFromDateKey(coverDate.toISOString().slice(0, 10)) : '';
}

function addTemplateBackground(slide) {
  slide.background = { color: COLORS.templateNavy2 };
  slide.addShape('rect', { x: 0, y: 0, w: 9.92, h: 7.5, fill: { color: COLORS.templateTeal }, line: { color: COLORS.templateTeal } });
  slide.addShape('rect', { x: 2.48, y: 0, w: 7.44, h: 7.5, fill: { color: COLORS.templateNavy, transparency: 12 }, line: { color: COLORS.templateNavy, transparency: 100 } });
  slide.addShape('rect', { x: 9.92, y: 2.04, w: 3.41, h: 5.46, fill: { color: COLORS.templateTeal }, line: { color: COLORS.templateTeal } });
  slide.addShape('rect', { x: 0, y: 3.56, w: 13.333, h: 3.94, fill: { color: COLORS.deep, transparency: 26 }, line: { color: COLORS.deep, transparency: 100 } });
}

function addWhitePanel(slide, x, y, w, h, options = {}) {
  slide.addShape(options.rounded ? 'roundRect' : 'rect', {
    x,
    y,
    w,
    h,
    fill: { color: COLORS.templatePanel },
    line: { color: COLORS.templatePanel },
  });
}

function addHeader(slide, title, subtitle) {
  slide.addText(title, {
    x: 1.28,
    y: 0.58,
    w: 10.8,
    h: 0.55,
    fontFace: 'Aptos Display',
    fontSize: 34,
    bold: true,
    italic: true,
    color: COLORS.white,
    fit: 'shrink',
    shadow: TEXT_SHADOW,
  });

  if (subtitle) {
    slide.addText(subtitle, { x: 9.52, y: 0.74, w: 2.9, h: 0.22, fontSize: 7.5, italic: true, align: 'right', color: 'D7EEF5', fit: 'shrink', shadow: TEXT_SHADOW });
  }
}

function addFooter(slide, pageNumber) {
  slide.addText('NemeXus', { x: 0.44, y: 7.16, w: 1.4, h: 0.16, fontSize: 7.5, bold: true, color: 'D7EEF5' });
  slide.addText(String(pageNumber), { x: 12.45, y: 7.16, w: 0.45, h: 0.16, fontSize: 7.5, align: 'right', color: 'D7EEF5' });
}

function addTitleSlide(pptx, context) {
  const slide = pptx.addSlide();
  const coverPeriodLabel = context.coverPeriodLabel || context.reportPeriodLabel || 'SUMMARY REPORT';
  slide.background = { color: COLORS.white };
  slide.addText('BARUGO LEVEL III', {
    x: 2.25,
    y: 2.02,
    w: 8.85,
    h: 0.66,
    align: 'center',
    fontFace: 'Aptos Display',
    fontSize: 39,
    bold: true,
    color: COLORS.black,
    breakLine: false,
    fit: 'shrink',
  });
  slide.addText('PERFORMANCE REVIEW', {
    x: 1.86,
    y: 2.78,
    w: 9.92,
    h: 0.66,
    align: 'center',
    fontFace: 'Aptos Display',
    fontSize: 39,
    bold: true,
    color: COLORS.black,
    breakLine: false,
    fit: 'shrink',
  });
  slide.addText(String(coverPeriodLabel).toUpperCase(), {
    x: 4.56,
    y: 3.74,
    w: 4.2,
    h: 0.28,
    align: 'center',
    fontFace: 'Aptos',
    fontSize: 15.5,
    color: COLORS.black,
    fit: 'shrink',
  });
}

function addTable(slide, columns, rows, options = {}) {
  const tableRows = [
    columns.map((column) => ({ text: column.label, options: { bold: true, color: COLORS.white, fill: { color: COLORS.deep } } })),
    ...rows.map((row) => columns.map((column) => safeText(column.value(row)))),
  ];

  slide.addTable(tableRows, {
    x: options.x ?? 0.52,
    y: options.y ?? 1.25,
    w: options.w ?? 12.25,
    h: options.h ?? 5.75,
    border: { type: 'solid', color: COLORS.border, pt: 0.6 },
    fontSize: options.fontSize ?? 8,
    color: COLORS.ink,
  });
}

function sortRowsForChart(rows) {
  return [...(rows ?? [])].sort((first, second) => String(first.key || first.date || first.label || '').localeCompare(String(second.key || second.date || second.label || '')));
}

function formatMonthLabel(date, full = false) {
  return date.toLocaleString('en-US', {
    month: full ? 'long' : 'short',
    year: 'numeric',
  });
}

function getMonthLabelPartsFromKey(key) {
  const [year, month] = String(key || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return {
      month: safeText(key),
      year: '',
    };
  }

  return {
    month: new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' }),
    year: String(year),
  };
}

function buildMonthYearLabels(rows) {
  return [
    rows.map((row) => getMonthLabelPartsFromKey(row.key).month),
    rows.map((row) => getMonthLabelPartsFromKey(row.key).year),
  ];
}

function buildFullYearRows(rows, year) {
  const rowsByKey = new Map((rows ?? []).map((row) => [row.key, row]));
  const parsedYear = Number(year);
  const safeYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();

  return Array.from({ length: 12 }, (_item, monthIndex) => {
    const date = new Date(safeYear, monthIndex, 1);
    const key = `${safeYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    const row = rowsByKey.get(key);

    return {
      key,
      label: row?.label || formatMonthLabel(date),
      production: safeNumber(row?.production),
      readingCount: row?.readingCount ?? '',
    };
  });
}

function buildTemplateYearRows(rows, year, valueKeys = [], options = {}) {
  const rowsByKey = new Map((rows ?? []).map((row) => [row.key, row]));
  const parsedYear = Number(year);
  const safeYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
  const startMonthKey = String(options.startMonthKey || '');
  const endMonthKey = String(options.endMonthKey || '');
  const allMonths = [
    new Date(safeYear - 1, 11, 1),
    ...Array.from({ length: 12 }, (_item, monthIndex) => new Date(safeYear, monthIndex, 1)),
  ];
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
      label: row?.label || formatMonthLabel(date, true).replace(' ', '\n'),
      readingCount: row?.readingCount ?? '',
    };

    valueKeys.forEach((valueKey) => {
      if (valueKey === 'totalPower') {
        output.totalPower = safeNumber(row?.totalPower) || safeNumber(row?.chlorinationPower) + safeNumber(row?.deepwellPower);
        return;
      }

      output[valueKey] = safeNumber(row?.[valueKey]);
    });

    return output;
  });
}

function addChart(slide, chartType, data, options = {}) {
  const chartRows = data.filter((series) => series.values.some((value) => value > 0));
  const panelX = options.panelX ?? options.x ?? 1.24;
  const panelY = options.panelY ?? options.y ?? 1.26;
  const panelW = options.panelW ?? options.w ?? 10.88;
  const panelH = options.panelH ?? options.h ?? 4.9;

  if (!chartRows.length || !chartRows[0]?.labels?.length) {
    addWhitePanel(slide, panelX, panelY, panelW, panelH, { rounded: options.roundedPanel });
    slide.addShape('rect', {
      x: panelX,
      y: panelY,
      w: panelW,
      h: panelH,
      fill: { color: COLORS.templatePanel },
      line: { color: COLORS.border, pt: 0.8 },
    });
    slide.addText('No chart data available for this selection.', {
      x: panelX + 0.24,
      y: panelY + panelH / 2 - 0.12,
      w: panelW - 0.48,
      h: 0.25,
      fontSize: 12,
      bold: true,
      align: 'center',
      color: COLORS.muted,
    });
    return;
  }

  addWhitePanel(slide, panelX, panelY, panelW, panelH, { rounded: options.roundedPanel });
  slide.addChart(chartType, chartRows, {
    x: options.x ?? 1.24,
    y: options.y ?? 1.26,
    w: options.w ?? 10.88,
    h: options.h ?? 4.9,
    chartColors: options.chartColors ?? [COLORS.teal, COLORS.blue, COLORS.green, COLORS.amber],
    chartArea: options.chartArea ?? { fill: { color: COLORS.templatePanel }, border: { color: COLORS.templatePanel, pt: 0.6 } },
    plotArea: options.plotArea ?? { fill: { color: COLORS.white, transparency: 5 }, border: { color: 'E7EEF2', pt: 0.4 } },
    showLegend: chartRows.length > 1,
    legendPos: 'b',
    legendFontSize: 7,
    catAxisLabelFontSize: options.catAxisLabelFontSize ?? 7,
    catAxisLabelColor: options.catAxisLabelColor ?? COLORS.black,
    catAxisLabelFontItalic: options.catAxisLabelFontItalic ?? true,
    catAxisLabelRotate: options.catAxisLabelRotate ?? 0,
    valAxisLabelFontSize: options.valAxisLabelFontSize ?? 7,
    valAxisLabelColor: options.valAxisLabelColor ?? COLORS.black,
    valAxisLabelFontItalic: options.valAxisLabelFontItalic ?? true,
    valAxisMinVal: options.valAxisMinVal ?? 0,
    valAxisMaxVal: options.valAxisMaxVal,
    valAxisMajorUnit: options.valAxisMajorUnit,
    valGridLine: options.valGridLine ?? { color: COLORS.black, size: 0.5, style: 'solid' },
    showValue: options.showValue ?? false,
    dataLabelFontSize: options.dataLabelFontSize ?? 6.5,
    dataLabelFontBold: options.dataLabelFontBold ?? true,
    dataLabelFontItalic: options.dataLabelFontItalic ?? true,
    dataLabelColor: options.dataLabelColor ?? COLORS.black,
    dataLabelPosition: options.dataLabelPosition ?? 'ctr',
    valLabelFormatCode: options.valLabelFormatCode ?? '#,##0.00',
    dataLabelFormatCode: options.dataLabelFormatCode ?? '#,##0.00',
    barDir: 'col',
    barGrouping: options.barGrouping ?? 'clustered',
    barGapWidthPct: options.barGapWidthPct ?? 80,
    lineSize: 2.2,
    lineDataSymbol: 'circle',
    lineDataSymbolSize: 5,
    lineSmooth: false,
    title: options.title,
    showTitle: Boolean(options.title),
    titleFontSize: options.titleFontSize ?? 13,
    italic: options.titleItalic ?? true,
    titleColor: options.titleColor ?? COLORS.black,
    valAxisTitle: options.valAxisTitle,
    valAxisTitleFontSize: options.valAxisTitleFontSize ?? 9,
    valAxisTitleColor: COLORS.black,
    valAxisTitleFontFace: 'Aptos',
    altText: options.altText,
  });
}

function addChartOnlySlide(pptx, title, subtitle, chartType, chartData, pageNumber, options = {}) {
  const slide = pptx.addSlide();
  addTemplateBackground(slide);
  addHeader(slide, title, subtitle);
  const panelX = options.x ?? 0.68;
  const panelY = options.y ?? 1.38;
  const panelW = options.w ?? 12.0;
  const panelH = options.h ?? 5.42;
  const axisGutter = options.leftAxisTitle ? 1.08 : 0.48;
  const topGutter = options.topGutter ?? 0.48;
  const rightGutter = options.rightGutter ?? 0.44;
  const bottomGutter = options.bottomGutter ?? 0.72;
  const chartX = options.chartX ?? panelX + axisGutter;
  const chartY = options.chartY ?? panelY + topGutter;
  const chartW = options.chartW ?? panelW - axisGutter - rightGutter;
  const chartH = options.chartH ?? panelH - topGutter - bottomGutter;
  addChart(slide, chartType, chartData, {
    x: chartX,
    y: chartY,
    w: chartW,
    h: chartH,
    panelX,
    panelY,
    panelW,
    panelH,
    roundedPanel: true,
    ...options.chartOptions,
  });
  if (options.leftAxisTitle) {
    slide.addText(options.leftAxisTitle, {
      x: options.leftAxisTitleX ?? panelX - 0.42,
      y: options.leftAxisTitleY ?? panelY + 2.2,
      w: 2.3,
      h: 0.34,
      rotate: 270,
      fontFace: 'Aptos',
      fontSize: options.axisFontSize ?? 14,
      italic: true,
      color: COLORS.black,
      align: 'center',
      fit: 'shrink',
      shadow: TEXT_SHADOW,
    });
  }
}

function addChartSectionSlide(pptx, title, subtitle, chartType, chartData, columns, rows, pageNumber, options = {}) {
  addChartOnlySlide(pptx, title, subtitle, chartType, chartData, pageNumber, options);
}

function buildMonthlyProductionChart(rows) {
  const chartRows = sortRowsForChart(rows);
  const labels = buildMonthYearLabels(chartRows);

  return [
    {
      name: 'Production m3',
      labels,
      values: chartRows.map((row) => chartValue(row.production)),
    },
  ];
}

function buildBilledVolumeRows(productionRows = [], billedVolumes = {}) {
  return sortRowsForChart(productionRows).map((productionRow) => {
    const defaultRow = DEFAULT_BILLED_VOLUME_ROWS[productionRow.key];
    const savedBilledVolume = billedVolumes?.[productionRow.key];
    const billedVolume = safeNumber(savedBilledVolume ?? defaultRow?.billedVolume);
    const defaultTotalVolume = safeNumber(defaultRow?.billedVolume) + safeNumber(defaultRow?.nrw);
    const production = safeNumber(productionRow.production) || defaultTotalVolume;
    const nrw = billedVolume > 0 && production > 0
      ? Math.max(production - billedVolume, 0)
      : safeNumber(defaultRow?.nrw);

    const labelParts = getMonthLabelPartsFromKey(productionRow.key);

    return {
      key: productionRow.key,
      label: labelParts.month,
      yearLabel: labelParts.year,
      billedVolume,
      nrw,
      production,
    };
  });
}

function buildBilledVolumeChart(rows) {
  const chartRows = sortRowsForChart(rows);
  const labels = [
    chartRows.map((row) => safeText(row.label)),
    chartRows.map((row) => safeText(row.yearLabel)),
  ];

  return [
    {
      name: 'Billed Volume',
      labels,
      values: chartRows.map((row) => chartValue(row.billedVolume)),
    },
    {
      name: 'NRW',
      labels,
      values: chartRows.map((row) => chartValue(row.nrw)),
    },
  ];
}

function buildDailyProductionChart(rows) {
  const chartRows = sortRowsForChart(rows).slice(-31);
  return [
    {
      name: 'Production m3',
      labels: chartRows.map((row) => safeText(row.label || row.date)),
      values: chartRows.map((row) => chartValue(row.production)),
    },
  ];
}

function buildPowerChart(rows) {
  const chartRows = sortRowsForChart(rows);
  const labels = buildMonthYearLabels(chartRows);

  return [
    {
      name: 'Power kWh',
      labels,
      values: chartRows.map((row) => chartValue(safeNumber(row.totalPower) || safeNumber(row.chlorinationPower) + safeNumber(row.deepwellPower))),
    },
  ];
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

function buildReportInputBilledVolumes(reportInputs = {}) {
  return Object.entries(reportInputs || {}).reduce((volumes, [monthKey, row]) => {
    const billedVolume = Number(row?.billedVolume);

    if (monthKey && Number.isFinite(billedVolume) && billedVolume > 0) {
      volumes[monthKey] = billedVolume;
    }

    return volumes;
  }, {});
}

function buildPowerUnitUsageRows(productionRows = [], powerRows = []) {
  const powerByMonth = buildMonthlyMap(powerRows);

  return sortRowsForChart(productionRows).map((productionRow) => {
    const powerRow = powerByMonth.get(productionRow.key || productionRow.label);
    const production = safeNumber(productionRow.production);
    const power = safeNumber(powerRow?.totalPower);

    return {
      key: productionRow.key,
      label: productionRow.label,
      unitUsage: production > 0 ? power / production : 0,
      production,
      power,
    };
  });
}

function getMonthDateFromKey(key) {
  const [year, month] = String(key || '').split('-').map(Number);
  return Number.isFinite(year) && Number.isFinite(month) ? new Date(year, month - 1, 1) : new Date();
}

function getPreviousMonthKey(key) {
  const date = getMonthDateFromKey(key);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildElectricBillRows(powerRows = [], year) {
  const parsedYear = Number(year);
  const safeYear = Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear();
  const powerByMonth = buildMonthlyMap(powerRows);
  const monthKeys = [
    `${safeYear - 1}-12`,
    ...Array.from({ length: 12 }, (_item, monthIndex) => `${safeYear}-${String(monthIndex + 1).padStart(2, '0')}`),
  ];

  return monthKeys.map((key) => {
    const powerRow = powerByMonth.get(key);
    const combinedConsumption = safeNumber(powerRow?.totalPower) || safeNumber(powerRow?.chlorinationPower) + safeNumber(powerRow?.deepwellPower);
    const leyecoConsumption = safeNumber(powerRow?.leyecoConsumption);
    const effectiveRate = safeNumber(powerRow?.effectiveRate);
    const electricBill = safeNumber(powerRow?.electricBill) || (leyecoConsumption > 0 && effectiveRate > 0 ? leyecoConsumption * effectiveRate : 0);

    return {
      key,
      month: formatMonthLabel(getMonthDateFromKey(key), true),
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
  const availableKeys = new Set([
    ...productionRows.map((row) => row.key || row.label).filter(Boolean),
    ...powerRows.map((row) => row.key || row.label).filter(Boolean),
    ...electricBillRows.map((row) => row.key).filter(Boolean),
  ]);
  const sortedKeys = [...availableKeys].sort();
  const comparisonEndKey = endMonthKey || sortedKeys[sortedKeys.length - 1] || '';

  if (!comparisonEndKey) {
    return [];
  }

  const comparisonKeys = startMonthKey
    ? [startMonthKey, comparisonEndKey].filter(Boolean)
    : sortedKeys.filter((key) => String(key).localeCompare(comparisonEndKey) <= 0);

  const rows = comparisonKeys
    .map((key) => {
      const electricRow = electricBillRows.find((row) => row.key === key) ?? {};
      const productionRow = productionByMonth.get(key);
      const powerRow = powerByMonth.get(key);
      const production = safeNumber(productionRow?.production) || safeNumber(powerRow?.powerCostProduction);
      const chlorinationKwh = safeNumber(powerRow?.chlorinationPower);
      const intakeKwh = safeNumber(powerRow?.deepwellPower);
      const operatingHours = safeNumber(powerRow?.operatingHours);
      const intakeBill = safeNumber(powerRow?.intakeBill) || safeNumber(electricRow.electricBill);
      const chlorinationBill = safeNumber(powerRow?.chlorinationBill);
      const sec = safeNumber(powerRow?.secOverride) || (production > 0 ? (intakeKwh + chlorinationKwh) / production : 0);
      const motorLoad = safeNumber(powerRow?.motorLoadOverride) || (operatingHours > 0 ? intakeKwh / operatingHours : 0);

      return {
        key,
        label: getMonthLabelPartsFromKey(key).month,
        shortLabel: getMonthDateFromKey(key).toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        dateLabel: powerRow?.dateLabel || formatMonthLabel(getMonthDateFromKey(key), true),
        intakeBill,
        chlorinationBill,
        operatingHours,
        production,
        sec,
        intakeKwh,
        chlorinationKwh,
        motorLoad,
      };
    })
    .filter((row) => (
      row.intakeBill > 0 &&
      row.chlorinationBill > 0 &&
      row.operatingHours > 0 &&
      row.production > 0 &&
      row.intakeKwh > 0
    ));

  return startMonthKey ? rows : rows.slice(-2);
}

function addPlainSlideTitle(slide, title, subtitle = '') {
  slide.addText(title, {
    x: 0.72,
    y: 0.34,
    w: 11.9,
    h: 0.44,
    fontFace: 'Aptos Display',
    fontSize: 26,
    bold: true,
    color: COLORS.black,
    fit: 'shrink',
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.74,
      y: 0.84,
      w: 11.4,
      h: 0.24,
      fontSize: 10,
      color: COLORS.muted,
      fit: 'shrink',
    });
  }
}

function addGridCell(slide, text, x, y, w, h, options = {}) {
  slide.addShape('rect', {
    x,
    y,
    w,
    h,
    fill: { color: options.fill ?? COLORS.white },
    line: { color: options.line ?? COLORS.white, pt: options.linePt ?? 0.45 },
  });
  slide.addText(safeText(text), {
    x: x + (options.padX ?? 0.04),
    y: y + (options.padY ?? 0.04),
    w: w - (options.padX ?? 0.04) * 2,
    h: h - (options.padY ?? 0.04) * 2,
    fontFace: 'Aptos',
    fontSize: options.fontSize ?? 8.5,
    bold: options.bold ?? false,
    color: options.color ?? COLORS.black,
    align: options.align ?? 'center',
    valign: 'mid',
    fit: 'shrink',
  });
}

function addElectricBillSlide(pptx, rows) {
  const slide = pptx.addSlide();
  addTemplateBackground(slide);
  addHeader(slide, 'ELECTRIC BILL', '');
  const rowsWithBill = rows.filter((row) => row.electricBill > 0);
  const totalBilling = rowsWithBill.reduce((total, row) => total + row.electricBill, 0);
  const averageRate = rowsWithBill.length
    ? rowsWithBill.reduce((total, row) => total + row.effectiveRate, 0) / rowsWithBill.length
    : 0;
  const x = 1.38;
  const y = 1.48;
  const widths = [1.4, 2.55, 2.35, 2.2, 2.12];
  const headerH = 0.62;
  const rowH = 0.285;
  const summaryH = 0.34;
  const headers = [
    'Month',
    'Chlorination & Intake House\nPower Consumption (kWh)',
    'LEYECO III based Total\nConsumption (kWh)',
    'Effective Rate per kWh (PHP)',
    'Electric Bill (PHP)',
  ];

  let cursorX = x;
  headers.forEach((header, index) => {
    addGridCell(slide, header, cursorX, y, widths[index], headerH, { fill: '356B52', color: COLORS.white, bold: true, fontSize: 8.4 });
    cursorX += widths[index];
  });

  rows.forEach((row, rowIndex) => {
    const rowY = y + headerH + rowIndex * rowH;
    const fill = rowIndex % 2 ? 'F1F4F4' : COLORS.white;
    const values = [
      row.month,
      row.combinedConsumption ? formatNumber(row.combinedConsumption) : '',
      row.leyecoConsumption ? formatNumber(row.leyecoConsumption) : '',
      row.effectiveRate ? formatCurrency(row.effectiveRate) : '',
      row.electricBill ? formatCurrency(row.electricBill) : '',
    ];
    cursorX = x;
    values.forEach((value, index) => {
      addGridCell(slide, value, cursorX, rowY, widths[index], rowH, { fill, line: 'EDF1F1', fontSize: 8.0, align: index === 0 ? 'center' : 'right' });
      cursorX += widths[index];
    });
  });

  const summaryY = y + headerH + rows.length * rowH + 0.18;
  cursorX = x + widths[0] + widths[1] + widths[2];
  addGridCell(slide, averageRate ? formatCurrency(averageRate) : '', cursorX, summaryY, widths[3], summaryH, { fill: COLORS.white, line: COLORS.black, bold: true, align: 'right', fontSize: 8.2 });
  addGridCell(slide, totalBilling ? formatCurrency(totalBilling) : '', cursorX + widths[3], summaryY, widths[4], summaryH, { fill: COLORS.white, line: COLORS.black, bold: true, align: 'right', fontSize: 8.2 });
  addGridCell(slide, 'Average Rate per kWh', cursorX, summaryY + summaryH, widths[3], summaryH, { fill: COLORS.white, line: COLORS.white, fontSize: 8.2 });
  addGridCell(slide, 'Total Billing', cursorX + widths[3], summaryY + summaryH, widths[4], summaryH, { fill: COLORS.white, line: COLORS.white, fontSize: 8.2 });
}

function addPowerCostTable(slide, rows, x, y, w, h, options = {}) {
  const compact = options.compact ?? false;
  const withIcons = options.withIcons ?? false;
  const highlightLatestSec = options.highlightLatestSec ?? false;
  const widths = [0.16, 0.16, 0.17, 0.15, 0.15, 0.17].map((factor) => w * factor);
  const iconH = withIcons ? h * 0.23 : 0;
  const headerH = withIcons ? h * 0.29 : h * 0.44;
  const rowH = (h - headerH - iconH) / Math.max(rows.length, 1);
  const headers = ['Month', 'Intake Bill (₱)', 'Chlorination Bill (₱)', 'Operating Hours', 'Production m³', 'Specific Energy\nConsumption\n(kWh/m³)'];
  const icons = ['▦', '◌', '♙', '◷', '□', '⚡⚡💧'];
  let cursorX = x;

  if (withIcons) {
    icons.forEach((icon, index) => {
      addGridCell(slide, icon, cursorX, y, widths[index], iconH, {
        fill: COLORS.referenceNavy,
        line: 'B8C7D0',
        linePt: 0.5,
        color: 'D3F2FF',
        bold: true,
        fontSize: index === icons.length - 1 ? 13 : 15,
      });
      cursorX += widths[index];
    });
  }

  cursorX = x;
  headers.forEach((header, index) => {
    addGridCell(slide, header, cursorX, y + iconH, widths[index], headerH, {
      fill: COLORS.referenceNavy,
      line: 'B8C7D0',
      linePt: 0.5,
      color: COLORS.white,
      bold: true,
      fontSize: compact ? 8.1 : 9.6,
    });
    cursorX += widths[index];
  });

  rows.forEach((row, rowIndex) => {
    const values = [
      compact ? row.dateLabel : `${row.label} ${String(row.key || '').slice(0, 4)}`,
      formatCurrency(row.intakeBill),
      formatCurrency(row.chlorinationBill),
      `${formatNumber(row.operatingHours, row.operatingHours % 1 ? 1 : 0)} hrs`,
      `${formatNumber(row.production)} m³`,
      `${formatNumber(row.sec, 2)} kWh/m³`,
    ];
    const fill = compact
      ? rowIndex % 2 ? 'E8ECEF' : 'CED4DA'
      : rowIndex % 2 ? COLORS.referenceCream2 : COLORS.referenceCream;
    const rowY = y + iconH + headerH + rowIndex * rowH;
    cursorX = x;
    values.forEach((value, index) => {
      const isLatestSec = highlightLatestSec && rowIndex === rows.length - 1 && index === values.length - 1;
      addGridCell(slide, value, cursorX, rowY, widths[index], rowH, {
        fill: isLatestSec ? COLORS.referenceRed : fill,
        line: compact ? COLORS.white : 'DED6C7',
        linePt: 0.55,
        bold: rowIndex === rows.length - 1 || isLatestSec,
        color: isLatestSec ? COLORS.white : COLORS.black,
        fontSize: compact ? 8.0 : 10.0,
      });
      cursorX += widths[index];
    });
  });
}

function buildFinancialChart(rows) {
  return [
    {
      name: 'Intake Bill',
      labels: rows.map((row) => row.shortLabel),
      values: rows.map((row) => chartValue(row.intakeBill)),
    },
    {
      name: 'Chlorination Bill',
      labels: rows.map((row) => row.shortLabel),
      values: rows.map((row) => chartValue(row.chlorinationBill)),
    },
  ];
}

function buildProductionSecChart(rows) {
  return [
    {
      name: 'Production m3',
      labels: rows.map((row) => row.shortLabel),
      values: rows.map((row) => chartValue(row.production)),
    },
    {
      name: 'Operating Hours',
      labels: rows.map((row) => row.shortLabel),
      values: rows.map((row) => chartValue(row.operatingHours * 15)),
    },
    {
      name: 'SEC x 10000',
      labels: rows.map((row) => row.shortLabel),
      values: rows.map((row) => chartValue(row.sec * 10000)),
    },
  ];
}

function addChartLine(slide, x1, y1, x2, y2, color, width = 1.4, options = {}) {
  slide.addShape('line', {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: {
      color,
      pt: width,
      dash: options.dash,
      beginArrowType: options.beginArrowType,
      endArrowType: options.endArrowType,
    },
  });
}

function addDashedChartLine(slide, x1, y1, x2, y2, color, width = 1.4, dashCount = 8) {
  const segments = Math.max(dashCount, 1);
  for (let index = 0; index < segments; index += 1) {
    if (index % 2 !== 0) {
      continue;
    }

    const start = index / segments;
    const end = (index + 1) / segments;
    addChartLine(
      slide,
      x1 + (x2 - x1) * start,
      y1 + (y2 - y1) * start,
      x1 + (x2 - x1) * end,
      y1 + (y2 - y1) * end,
      color,
      width
    );
  }
}

function getXmlAttr(xml, attrName) {
  return xml.match(new RegExp(`${attrName}="([^"]*)"`))?.[1] || '';
}

function setXmlAttr(xml, attrName, value) {
  const escaped = String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return xml.replace(new RegExp(`${attrName}="[^"]*"`), `${attrName}="${escaped}"`);
}

function dirname(path) {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function resolvePartPath(fromDir, target) {
  const parts = `${fromDir}/${target}`.split('/');
  const resolved = [];
  parts.forEach((part) => {
    if (!part || part === '.') {
      return;
    }
    if (part === '..') {
      resolved.pop();
      return;
    }
    resolved.push(part);
  });
  return resolved.join('/');
}

function getRelativeTarget(fromDir, toPath) {
  const fromParts = fromDir.split('/').filter(Boolean);
  const toParts = toPath.split('/').filter(Boolean);
  let common = 0;

  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) {
    common += 1;
  }

  return [
    ...Array(fromParts.length - common).fill('..'),
    ...toParts.slice(common),
  ].join('/');
}

function getNextPartNumber(zip, folder, prefix, suffix) {
  const matcher = new RegExp(`^${folder}/${prefix}(\\d+)${suffix.replace('.', '\\.')}$`);
  return Object.keys(zip.files).reduce((next, fileName) => {
    const match = fileName.match(matcher);
    return match ? Math.max(next, Number(match[1]) + 1) : next;
  }, 1);
}

async function copyZipPart(sourceZip, targetZip, sourcePath, targetPath) {
  const sourceFile = sourceZip.file(sourcePath);

  if (!sourceFile) {
    return false;
  }

  targetZip.file(targetPath, await sourceFile.async('uint8array'));
  return true;
}

async function transformRelationshipXml(relXml, transformTag) {
  const relationshipMatcher = /<Relationship\b[^>]*\/>/g;
  let transformed = '';
  let cursor = 0;

  for (const match of relXml.matchAll(relationshipMatcher)) {
    transformed += relXml.slice(cursor, match.index);
    transformed += await transformTag(match[0]);
    cursor = match.index + match[0].length;
  }

  return transformed + relXml.slice(cursor);
}

async function updateContentTypeOverride(zip, partName, contentType) {
  const contentTypePath = '[Content_Types].xml';
  const file = zip.file(contentTypePath);

  if (!file) {
    return;
  }

  const normalizedPartName = partName.startsWith('/') ? partName : `/${partName}`;
  let xml = await file.async('string');

  if (xml.includes(`PartName="${normalizedPartName}"`)) {
    return;
  }

  xml = xml.replace(
    '</Types>',
    `<Override PartName="${normalizedPartName}" ContentType="${contentType}"/></Types>`
  );
  zip.file(contentTypePath, xml);
}

async function registerPresentationSlideMaster(zip, slideMasterPath) {
  const presentationPath = 'ppt/presentation.xml';
  const presentationRelPath = 'ppt/_rels/presentation.xml.rels';
  const presentationFile = zip.file(presentationPath);
  const presentationRelFile = zip.file(presentationRelPath);

  if (!presentationFile || !presentationRelFile) {
    return;
  }

  const target = getRelativeTarget('ppt', slideMasterPath);
  let relXml = await presentationRelFile.async('string');
  let relationshipId = [...relXml.matchAll(/<Relationship\b[^>]*Type="[^"]*\/slideMaster"[^>]*>/g)]
    .find((match) => getXmlAttr(match[0], 'Target') === target)?.[0];
  relationshipId = relationshipId ? getXmlAttr(relationshipId, 'Id') : '';

  if (!relationshipId) {
    const nextRelNumber = [...relXml.matchAll(/Id="rId(\d+)"/g)]
      .reduce((next, match) => Math.max(next, Number(match[1]) + 1), 1);
    relationshipId = `rId${nextRelNumber}`;
    relXml = relXml.replace(
      '</Relationships>',
      `<Relationship Id="${relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="${target}"/></Relationships>`
    );
    zip.file(presentationRelPath, relXml);
  }

  let presentationXml = await presentationFile.async('string');
  if (presentationXml.includes(`r:id="${relationshipId}"`)) {
    return;
  }

  const usedMasterAndLayoutIds = await getUsedSlideMasterAndLayoutIds(zip);
  const nextMasterId = usedMasterAndLayoutIds
    .reduce((next, id) => Math.max(next, id + 1), 2147483648);
  const masterEntry = `<p:sldMasterId id="${nextMasterId}" r:id="${relationshipId}"/>`;

  if (/<p:sldMasterIdLst\b/.test(presentationXml)) {
    presentationXml = presentationXml.replace('</p:sldMasterIdLst>', `${masterEntry}</p:sldMasterIdLst>`);
  } else {
    presentationXml = presentationXml.replace(/(<p:presentation\b[^>]*>)/, `$1<p:sldMasterIdLst>${masterEntry}</p:sldMasterIdLst>`);
  }

  zip.file(presentationPath, presentationXml);
}

async function getUsedSlideMasterAndLayoutIds(zip) {
  const ids = [];
  const presentationFile = zip.file('ppt/presentation.xml');

  if (presentationFile) {
    const presentationXml = await presentationFile.async('string');
    ids.push(
      ...[...presentationXml.matchAll(/<p:sldMasterId\b[^>]*\bid="(\d+)"/g)]
        .map((match) => Number(match[1]))
    );
  }

  const slideLayoutIds = await Promise.all(
    Object.keys(zip.files)
      .filter((fileName) => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(fileName))
      .map(async (fileName) => {
        const slideMasterXml = await zip.file(fileName).async('string');
        return [...slideMasterXml.matchAll(/<p:sldLayoutId\b[^>]*\bid="(\d+)"/g)]
          .map((match) => Number(match[1]));
      })
  );

  ids.push(...slideLayoutIds.flat());
  return ids.filter(Number.isFinite);
}

async function renumberSlideLayoutIds(zip, slideMasterXml) {
  let nextId = Math.max(2147483648, ...await getUsedSlideMasterAndLayoutIds(zip)) + 1;

  return slideMasterXml.replace(/(<p:sldLayoutId\b[^>]*\bid=")(\d+)("[^>]*>)/g, (_match, start, _id, end) => {
    const id = nextId;
    nextId += 1;
    return `${start}${id}${end}`;
  });
}

function removeChartLegend(xml) {
  return xml.replace(/<c:legend[\s\S]*?<\/c:legend>/, '');
}

function hideChartLegendEntries(xml, indexes = []) {
  if (!indexes.length || !/<c:legend[\s\S]*?<\/c:legend>/.test(xml)) {
    return xml;
  }

  const legendEntries = indexes
    .map((index) => `<c:legendEntry><c:idx val="${index}"/><c:delete val="1"/></c:legendEntry>`)
    .join('');

  return xml.replace(/(<c:legend\b[^>]*>)/, `$1${legendEntries}`);
}

function cleanTemplateChartLegend(xml, sourceChartPath) {
  const chartName = sourceChartPath.split('/').pop();

  if (chartName === 'chart3.xml' || chartName === 'chart6.xml') {
    return removeChartLegend(xml);
  }

  if (chartName === 'chart4.xml' || chartName === 'chart7.xml') {
    return hideChartLegendEntries(xml, [0, 1]);
  }

  return xml;
}

function getChartGraphicFrames(slideXml) {
  return [...slideXml.matchAll(/<p:graphicFrame\b[\s\S]*?<\/p:graphicFrame>/g)]
    .map((match) => match[0])
    .filter((frame) => /<c:chart\b/.test(frame));
}

function useCleanTemplateChartOnSecFormulaSlide(sourceSlideXml, cleanChartSlideXml) {
  const cleanChartFrames = getChartGraphicFrames(cleanChartSlideXml);
  let chartIndex = 0;

  if (!cleanChartFrames.length) {
    return sourceSlideXml;
  }

  return sourceSlideXml.replace(/<p:graphicFrame\b[\s\S]*?<\/p:graphicFrame>/g, (frame) => {
    if (!/<c:chart\b/.test(frame)) {
      return frame;
    }

    const replacement = cleanChartFrames[chartIndex];
    chartIndex += 1;
    return replacement || '';
  });
}

async function copyTemplateChartPart(sourceZip, targetZip, sourceChartPath) {
  const chartNumber = getNextPartNumber(targetZip, 'ppt/charts', 'chart', '.xml');
  const targetChartPath = `ppt/charts/chart${chartNumber}.xml`;
  const sourceRelPath = `${dirname(sourceChartPath)}/_rels/${sourceChartPath.split('/').pop()}.rels`;
  const targetRelPath = `ppt/charts/_rels/chart${chartNumber}.xml.rels`;

  const sourceChartFile = sourceZip.file(sourceChartPath);
  if (sourceChartFile) {
    const sourceChartXml = await sourceChartFile.async('string');
    targetZip.file(targetChartPath, cleanTemplateChartLegend(sourceChartXml, sourceChartPath));
  }
  await updateContentTypeOverride(targetZip, targetChartPath, 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml');

  const sourceRels = sourceZip.file(sourceRelPath);
  if (!sourceRels) {
    return targetChartPath;
  }

  const sourceRelXml = await sourceRels.async('string');
  const targetRelXml = await transformRelationshipXml(sourceRelXml, async (tag) => {
    const target = getXmlAttr(tag, 'Target');
    const type = getXmlAttr(tag, 'Type');
    const sourcePartPath = resolvePartPath(dirname(sourceChartPath), target);
    let targetPartPath = '';

    if (sourcePartPath.startsWith('ppt/embeddings/')) {
      const ext = sourcePartPath.slice(sourcePartPath.lastIndexOf('.'));
      const nextNumber = getNextPartNumber(targetZip, 'ppt/embeddings', 'Microsoft_Excel_Worksheet', ext);
      targetPartPath = `ppt/embeddings/Microsoft_Excel_Worksheet${nextNumber}${ext}`;
      await copyZipPart(sourceZip, targetZip, sourcePartPath, targetPartPath);
    } else if (sourcePartPath.startsWith('ppt/charts/style')) {
      targetPartPath = `ppt/charts/style${chartNumber}.xml`;
      await copyZipPart(sourceZip, targetZip, sourcePartPath, targetPartPath);
      await updateContentTypeOverride(targetZip, targetPartPath, 'application/vnd.ms-office.chartstyle+xml');
    } else if (sourcePartPath.startsWith('ppt/charts/colors')) {
      targetPartPath = `ppt/charts/colors${chartNumber}.xml`;
      await copyZipPart(sourceZip, targetZip, sourcePartPath, targetPartPath);
      await updateContentTypeOverride(targetZip, targetPartPath, 'application/vnd.ms-office.chartcolorstyle+xml');
    }

    if (!targetPartPath) {
      return tag;
    }

    return setXmlAttr(tag, 'Target', getRelativeTarget('ppt/charts', targetPartPath));
  });

  targetZip.file(targetRelPath, targetRelXml);
  return targetChartPath;
}

async function copyTemplateMediaPart(sourceZip, targetZip, sourceMediaPath) {
  const ext = sourceMediaPath.slice(sourceMediaPath.lastIndexOf('.'));
  const targetNumber = getNextPartNumber(targetZip, 'ppt/media', 'image', ext);
  const targetMediaPath = `ppt/media/image${targetNumber}${ext}`;

  await copyZipPart(sourceZip, targetZip, sourceMediaPath, targetMediaPath);
  return targetMediaPath;
}

function getXmlPartCopySpec(sourcePartPath) {
  if (sourcePartPath.startsWith('ppt/slideLayouts/')) {
    return {
      folder: 'ppt/slideLayouts',
      prefix: 'slideLayout',
      suffix: '.xml',
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml',
    };
  }

  if (sourcePartPath.startsWith('ppt/slideMasters/')) {
    return {
      folder: 'ppt/slideMasters',
      prefix: 'slideMaster',
      suffix: '.xml',
      contentType: 'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml',
    };
  }

  if (sourcePartPath.startsWith('ppt/theme/')) {
    return {
      folder: 'ppt/theme',
      prefix: 'theme',
      suffix: '.xml',
      contentType: 'application/vnd.openxmlformats-officedocument.theme+xml',
    };
  }

  return null;
}

async function copyTemplateXmlPart(sourceZip, targetZip, sourcePartPath, copyCache) {
  if (copyCache.has(sourcePartPath)) {
    return copyCache.get(sourcePartPath);
  }

  const spec = getXmlPartCopySpec(sourcePartPath);
  if (!spec) {
    return sourcePartPath;
  }

  const targetNumber = getNextPartNumber(targetZip, spec.folder, spec.prefix, spec.suffix);
  const targetPartPath = `${spec.folder}/${spec.prefix}${targetNumber}${spec.suffix}`;
  const sourceRelPath = `${dirname(sourcePartPath)}/_rels/${sourcePartPath.split('/').pop()}.rels`;
  const targetRelPath = `${dirname(targetPartPath)}/_rels/${targetPartPath.split('/').pop()}.rels`;
  copyCache.set(sourcePartPath, targetPartPath);

  if (spec.folder === 'ppt/slideMasters') {
    const sourceXml = await sourceZip.file(sourcePartPath).async('string');
    targetZip.file(targetPartPath, await renumberSlideLayoutIds(targetZip, sourceXml));
  } else {
    await copyZipPart(sourceZip, targetZip, sourcePartPath, targetPartPath);
  }
  await updateContentTypeOverride(targetZip, targetPartPath, spec.contentType);
  if (spec.folder === 'ppt/slideMasters') {
    await registerPresentationSlideMaster(targetZip, targetPartPath);
  }

  const sourceRels = sourceZip.file(sourceRelPath);
  if (!sourceRels) {
    return targetPartPath;
  }

  const sourceRelXml = await sourceRels.async('string');
  const targetRelXml = await transformRelationshipXml(sourceRelXml, async (tag) => {
    const target = getXmlAttr(tag, 'Target');
    const type = getXmlAttr(tag, 'Type');
    const sourceRelatedPath = resolvePartPath(dirname(sourcePartPath), target);
    let targetRelatedPath = '';

    if (type.includes('/slideLayout') || type.includes('/slideMaster') || type.includes('/theme')) {
      targetRelatedPath = await copyTemplateXmlPart(sourceZip, targetZip, sourceRelatedPath, copyCache);
    } else if (type.includes('/image')) {
      targetRelatedPath = await copyTemplateMediaPart(sourceZip, targetZip, sourceRelatedPath);
    }

    if (!targetRelatedPath) {
      return tag;
    }

    return setXmlAttr(tag, 'Target', getRelativeTarget(dirname(targetPartPath), targetRelatedPath));
  });

  targetZip.file(targetRelPath, targetRelXml);
  return targetPartPath;
}

async function copyTemplateSlideIntoDeck(sourceZip, targetZip, sourceSlideNumber, targetSlideNumber, copyCache = new Map()) {
  const sourceSlidePath = `ppt/slides/slide${sourceSlideNumber}.xml`;
  const sourceRelPath = `ppt/slides/_rels/slide${sourceSlideNumber}.xml.rels`;
  const targetSlidePath = `ppt/slides/slide${targetSlideNumber}.xml`;
  const targetRelPath = `ppt/slides/_rels/slide${targetSlideNumber}.xml.rels`;
  const rawSourceSlideXml = await sourceZip.file(sourceSlidePath).async('string');
  const sourceSlideXml = sourceSlideNumber === 12 && sourceZip.file('ppt/slides/slide13.xml')
    ? useCleanTemplateChartOnSecFormulaSlide(rawSourceSlideXml, await sourceZip.file('ppt/slides/slide13.xml').async('string'))
    : rawSourceSlideXml;
  const sourceRelXml = await sourceZip.file(sourceRelPath).async('string');
  const targetSlideDir = 'ppt/slides';
  const targetRelXml = await transformRelationshipXml(sourceRelXml, async (tag) => {
    const type = getXmlAttr(tag, 'Type');
    const relationshipId = getXmlAttr(tag, 'Id');
    const target = getXmlAttr(tag, 'Target');
    const cleanChartSource = sourceSlideNumber === 12 && type.includes('/chart')
      ? { rId2: '../charts/chart5.xml', rId3: '../charts/chart6.xml', rId4: '../charts/chart7.xml' }[relationshipId]
      : '';
    const sourcePartPath = resolvePartPath('ppt/slides', cleanChartSource || target);
    let targetPartPath = '';

    if (type.includes('/slideLayout')) {
      targetPartPath = await copyTemplateXmlPart(sourceZip, targetZip, sourcePartPath, copyCache);
    } else if (type.includes('/chart')) {
      targetPartPath = await copyTemplateChartPart(sourceZip, targetZip, sourcePartPath);
    } else if (type.includes('/image')) {
      targetPartPath = await copyTemplateMediaPart(sourceZip, targetZip, sourcePartPath);
    }

    if (!targetPartPath) {
      return tag;
    }

    return setXmlAttr(tag, 'Target', getRelativeTarget(targetSlideDir, targetPartPath));
  });

  targetZip.file(targetSlidePath, sourceSlideXml);
  targetZip.file(targetRelPath, targetRelXml);
}

async function applyPowerCostTemplateSlides(pptxBuffer) {
  if (typeof fetch !== 'function') {
    return pptxBuffer;
  }

  try {
    const response = await fetch(POWER_COST_TEMPLATE_URL);

    if (!response.ok) {
      return pptxBuffer;
    }

    const { default: JSZip } = await import('jszip');
    const targetZip = await JSZip.loadAsync(pptxBuffer);
    const sourceZip = await JSZip.loadAsync(await response.arrayBuffer());
    const copyCache = new Map();

    for (const { sourceSlide, targetSlide } of POWER_COST_TEMPLATE_SLIDES) {
      if (targetZip.file(`ppt/slides/slide${targetSlide}.xml`) && sourceZip.file(`ppt/slides/slide${sourceSlide}.xml`)) {
        await copyTemplateSlideIntoDeck(sourceZip, targetZip, sourceSlide, targetSlide, copyCache);
      }
    }

    return targetZip.generateAsync({ type: 'arraybuffer' });
  } catch (error) {
    console.warn('Could not apply Power Cost template slides.', error);
    return pptxBuffer;
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  if (typeof btoa === 'function') {
    return btoa(binary);
  }

  throw new Error('This device cannot encode the PowerPoint file for sharing.');
}

async function savePptxBuffer(buffer, fileName) {
  if (typeof document !== 'undefined') {
    const blob = buffer instanceof Blob
      ? buffer
      : new Blob([buffer], { type: PPTX_MIME_TYPE });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return;
  }

  await saveNativeExportFile({
    fileName,
    mimeType: PPTX_MIME_TYPE,
    dialogTitle: 'Export summary report PowerPoint',
    uti: 'org.openxmlformats.presentationml.presentation',
    base64Content: arrayBufferToBase64(buffer),
    shareMessage: 'NemeXus summary report PowerPoint export is ready.',
  });
}

function addOperationPerformanceChart(slide, rows, x = 0.08, y = 2.12, w = 8.35, h = 4.55) {
  const previous = rows[0] ?? {};
  const latest = rows[rows.length - 1] ?? {};
  const months = rows.map((row) => row.shortLabel || getMonthDateFromKey(row.key).toLocaleString('en-US', { month: 'short', year: '2-digit' }));
  const plotX = x + 1.32;
  const plotY = y + 0.78;
  const plotW = w - 2.82;
  const plotH = h - 1.6;
  const productionMin = 7500;
  const productionMax = 10000;
  const operatingMin = 520;
  const operatingMax = 620;
  const secMin = 0;
  const secMax = 0.9;
  const barGap = plotW / Math.max(rows.length, 1);
  const productionBarW = 0.58;
  const operatingBarW = 0.34;
  const blue = '11AFE2';
  const operatingBar = 'A6A6A6';
  const operatingBarLine = 'D0D0D0';
  const yellow = 'FFFF00';
  const orange = 'FF7A32';
  const axisBlue = '00B8F1';
  const axisOperating = 'D0D0D0';

  function valueY(value, min, max) {
    return plotY + plotH - ((safeNumber(value) - min) / (max - min)) * plotH;
  }

  function valueX(index) {
    return plotX + barGap * index + barGap * 0.5;
  }

  slide.addShape('rect', { x, y, w, h, fill: { color: '313131' }, line: { color: '313131' } });
  slide.addText('OPERATION PERFORMANCE VISUALIZATION', {
    x: x + 1.55,
    y: y + 0.18,
    w: w - 2.3,
    h: 0.32,
    fontFace: 'Aptos Display',
    fontSize: 14.5,
    bold: true,
    color: 'D9D9D9',
    align: 'center',
    charSpace: 1.2,
    shadow: TEXT_SHADOW,
    fit: 'shrink',
  });

  [7500, 8000, 8500, 9000, 9500, 10000].forEach((tick) => {
    const tickY = valueY(tick, productionMin, productionMax);
    addChartLine(slide, plotX, tickY, plotX + plotW, tickY, '777777', 0.35);
    slide.addText(formatNumber(tick), { x: x + 0.3, y: tickY - 0.08, w: 0.82, h: 0.16, fontSize: 7.6, color: axisBlue, align: 'right', fit: 'shrink' });
  });

  [0, 0.3, 0.6, 0.9].forEach((tick) => {
    const tickY = valueY(tick, secMin, secMax);
    slide.addText(tick ? formatNumber(tick, 1) : '0', { x: x + w - 1.56, y: tickY - 0.08, w: 0.42, h: 0.16, fontSize: 7.4, color: yellow, align: 'right', fit: 'shrink' });
  });

  [520, 530, 540, 550, 560, 570, 580, 590, 600, 610, 620].forEach((tick) => {
    const tickY = valueY(tick, operatingMin, operatingMax);
    slide.addText(String(tick), { x: x + w - 0.82, y: tickY - 0.08, w: 0.4, h: 0.16, fontSize: 7.4, bold: true, color: axisOperating, align: 'right', fit: 'shrink' });
  });

  slide.addText('PRODUCTION (CU. M)', { x: x - 0.46, y: y + 1.08, w: 2.34, h: 0.22, rotate: 270, fontSize: 10.2, bold: true, color: axisBlue, align: 'center', fit: 'shrink', breakLine: false });
  slide.addText('SPECIFIC ENERGY CONSUMPTION', { x: x + w - 1.84, y: y + 1.0, w: 2.76, h: 0.2, rotate: 270, fontSize: 9.0, bold: true, color: yellow, align: 'center', fit: 'shrink', breakLine: false });
  slide.addText('OPERATING HOURS', { x: x + w - 1.06, y: y + 1.16, w: 2.05, h: 0.2, rotate: 270, fontSize: 9.0, bold: true, color: axisOperating, align: 'center', fit: 'shrink', breakLine: false });

  const secPoints = [];
  const operatingPoints = [];
  rows.forEach((row, index) => {
    const centerX = valueX(index);
    const productionHeight = plotY + plotH - valueY(row.production, productionMin, productionMax);
    const operatingHeight = plotY + plotH - valueY(row.operatingHours, operatingMin, operatingMax);
    const productionX = centerX - productionBarW * 0.65;
    const operatingX = centerX + operatingBarW * 0.45;
    const productionTop = plotY + plotH - productionHeight;
    const operatingTop = plotY + plotH - operatingHeight;

    slide.addShape('rect', { x: productionX, y: productionTop, w: productionBarW, h: productionHeight, fill: { color: blue }, line: { color: blue } });
    slide.addShape('rect', { x: operatingX, y: operatingTop, w: operatingBarW, h: operatingHeight, fill: { color: operatingBar }, line: { color: operatingBarLine } });
    slide.addText(months[index], { x: centerX - 0.35, y: plotY + plotH + 0.12, w: 0.7, h: 0.16, fontSize: 7.6, color: 'DADADA', align: 'center', fit: 'shrink' });
    slide.addText(formatNumber(row.production), { x: productionX - 0.42, y: productionTop - 0.24, w: 0.84, h: 0.18, fontSize: 8.4, color: axisBlue, align: 'center', fit: 'shrink' });
    slide.addText(formatNumber(row.operatingHours, row.operatingHours % 1 ? 1 : 0), { x: operatingX - 0.04, y: operatingTop - 0.22, w: 0.58, h: 0.16, fontSize: 7.8, color: axisOperating, align: 'center', fit: 'shrink' });
    slide.addText(formatNumber(row.sec, 2), { x: centerX - 0.58, y: valueY(row.sec, secMin, secMax) - 0.32, w: 0.52, h: 0.18, fontSize: 9.2, color: yellow, align: 'center', fit: 'shrink' });

    addChartLine(slide, productionX + 0.1, productionTop - 0.14, productionX - 0.28, productionTop - 0.36, axisBlue, 0.7);
    secPoints.push({ x: centerX - 0.1, y: valueY(row.sec, secMin, secMax) });
    operatingPoints.push({ x: operatingX + operatingBarW / 2, y: valueY(row.operatingHours, operatingMin, operatingMax) });
  });

  if (secPoints.length >= 2) {
    addChartLine(slide, secPoints[0].x, secPoints[0].y, secPoints[1].x, secPoints[1].y, yellow, 2.2);
    secPoints.forEach((point) => slide.addShape('ellipse', { x: point.x - 0.035, y: point.y - 0.035, w: 0.07, h: 0.07, fill: { color: yellow }, line: { color: yellow } }));
  }

  if (operatingPoints.length >= 2) {
    addDashedChartLine(slide, operatingPoints[0].x, operatingPoints[0].y, operatingPoints[1].x, operatingPoints[1].y, orange, 2.1, 10);
    operatingPoints.forEach((point) => slide.addShape('ellipse', { x: point.x - 0.035, y: point.y - 0.035, w: 0.07, h: 0.07, fill: { color: orange }, line: { color: orange } }));
  }

  slide.addText(`${String(previous.label || '').toUpperCase()} – ${String(latest.label || '').toUpperCase()} (${String(latest.key || '').slice(0, 4)})`, {
    x: x + 2.62,
    y: y + h - 0.82,
    w: 2.4,
    h: 0.22,
    fontSize: 9.6,
    bold: true,
    color: 'D6D6D6',
    align: 'center',
    fit: 'shrink',
  });

  const legendY = y + h - 0.54;
  slide.addShape('rect', { x: x + 0.18, y: legendY, w: 0.16, h: 0.05, fill: { color: blue }, line: { color: blue } });
  slide.addText('Production m³', { x: x + 0.34, y: legendY - 0.05, w: 1.0, h: 0.16, fontSize: 7.5, bold: true, color: axisBlue, fit: 'shrink' });
  addChartLine(slide, x + 0.18, legendY + 0.32, x + 0.48, legendY + 0.32, yellow, 1.7);
  slide.addText('Specific Energy Consumption (kWh/m³)', { x: x + 0.5, y: legendY + 0.22, w: 2.15, h: 0.18, fontSize: 7.3, bold: true, color: yellow, fit: 'shrink' });
  slide.addShape('rect', { x: x + w - 2.28, y: legendY - 0.02, w: 0.22, h: 0.08, fill: { color: operatingBar }, line: { color: operatingBarLine } });
  slide.addText('Operating Hours', { x: x + w - 2.02, y: legendY - 0.07, w: 1.36, h: 0.18, fontSize: 7.4, bold: true, color: axisOperating, fit: 'shrink' });
  addDashedChartLine(slide, x + w - 2.28, legendY + 0.32, x + w - 1.92, legendY + 0.32, orange, 1.9, 6);
  slide.addText('Trend Line (Operating Hours)', { x: x + w - 1.88, y: legendY + 0.22, w: 1.5, h: 0.15, fontSize: 6.8, bold: true, color: orange, fit: 'shrink' });
}

function addPowerCostAnalysisSlide(pptx, rows) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  slide.addShape('rect', { x: 10.9, y: 0, w: 2.45, h: 7.5, fill: { color: 'DCEBF1', transparency: 20 }, line: { color: 'DCEBF1', transparency: 100 } });
  slide.addText('POWER COST ANALYSIS:', {
    x: 0.48,
    y: 0.52,
    w: 8.9,
    h: 0.42,
    fontFace: 'Aptos Display',
    fontSize: 30,
    color: '4B4B4B',
    fit: 'shrink',
  });
  slide.addText('EFFICIENCY LOSS AT INTAKE', {
    x: 0.48,
    y: 1.04,
    w: 8.9,
    h: 0.42,
    fontFace: 'Aptos Display',
    fontSize: 26,
    bold: true,
    color: COLORS.black,
    fit: 'shrink',
  });
  addPowerCostTable(slide, rows, 0.62, 2.48, 12.1, 2.78, { withIcons: true, highlightLatestSec: true });
}

function hasElectricBillData(rows = []) {
  return rows.some((row) => safeNumber(row.electricBill) > 0 || safeNumber(row.leyecoConsumption) > 0 || safeNumber(row.effectiveRate) > 0);
}

function hasPowerCostData(rows = []) {
  return rows.length >= 2 && rows.every((row) => (
    safeNumber(row.intakeBill) > 0 &&
    safeNumber(row.chlorinationBill) > 0 &&
    safeNumber(row.operatingHours) > 0 &&
    safeNumber(row.production) > 0 &&
    safeNumber(row.intakeKwh) > 0
  ));
}

function getCostChangeSummary(rows) {
  const previous = rows[0] ?? {};
  const latest = rows[rows.length - 1] ?? {};
  const intakeIncrease = safeNumber(latest.intakeBill) - safeNumber(previous.intakeBill);
  const chlorinationIncrease = safeNumber(latest.chlorinationBill) - safeNumber(previous.chlorinationBill);
  const totalIncrease = intakeIncrease + chlorinationIncrease;
  const intakeShare = totalIncrease ? (intakeIncrease / totalIncrease) * 100 : 0;

  return {
    previous,
    latest,
    intakeIncrease,
    chlorinationIncrease,
    intakeShare,
    productionChange: safeNumber(previous.production) ? ((safeNumber(latest.production) - safeNumber(previous.production)) / safeNumber(previous.production)) * 100 : 0,
    secChange: safeNumber(previous.sec) ? ((safeNumber(latest.sec) - safeNumber(previous.sec)) / safeNumber(previous.sec)) * 100 : 0,
    motorLoadChange: safeNumber(previous.motorLoad) ? ((safeNumber(latest.motorLoad) - safeNumber(previous.motorLoad)) / safeNumber(previous.motorLoad)) * 100 : 0,
  };
}

function addFinancialPanelSlide(pptx, rows) {
  const slide = pptx.addSlide();
  slide.background = { color: '2D2D2D' };
  slide.addText('FINANCIAL PANEL', { x: 3.65, y: 0.24, w: 5.8, h: 0.45, fontSize: 26, bold: true, color: COLORS.white, align: 'center', shadow: TEXT_SHADOW });
  addChart(slide, 'bar', buildFinancialChart(rows), {
    x: 1.15,
    y: 1.08,
    w: 10.6,
    h: 4.12,
    panelX: 0.78,
    panelY: 0.94,
    panelW: 11.85,
    panelH: 4.42,
    chartColors: ['43D45B', '65C9F0'],
    chartArea: { fill: { color: '2D2D2D' }, border: { color: '2D2D2D', pt: 0.6 } },
    plotArea: { fill: { color: '3A3A3A', transparency: 10 }, border: { color: '3A3A3A', pt: 0.4 } },
    showLegend: true,
    valLabelFormatCode: '#,##0.00',
    dataLabelFormatCode: '#,##0.00',
    showValue: true,
    dataLabelPosition: 'outEnd',
    dataLabelFontSize: 10,
    dataLabelColor: COLORS.white,
    catAxisLabelColor: COLORS.white,
    valAxisLabelColor: COLORS.white,
    valGridLine: { color: 'B8B8B8', size: 0.35, style: 'solid' },
    title: '',
    altText: 'Intake and chlorination bill comparison',
  });

  const summary = getCostChangeSummary(rows);
  slide.addShape('rect', { x: 0, y: 5.55, w: 13.333, h: 1.95, fill: { color: COLORS.white }, line: { color: COLORS.white } });
  slide.addText([
    { text: 'Intake Facility: ', options: { bold: true } },
    { text: `Accounted for ${formatNumber(summary.intakeShare, 0)}% of the cost increase (Spiked by ${formatCurrency(summary.intakeIncrease)}).` },
  ], { x: 2.15, y: 5.95, w: 10.2, h: 0.28, fontSize: 12.2, color: COLORS.black, fit: 'shrink' });
  slide.addText([
    { text: 'Chlorination House: ', options: { bold: true } },
    { text: `Remained stable and nominal, increasing by only ${formatCurrency(summary.chlorinationIncrease)}.` },
  ], { x: 2.15, y: 6.55, w: 10.2, h: 0.28, fontSize: 12.2, color: COLORS.black, fit: 'shrink' });
}

function addSecFormulaBox(slide, row, x, y, w, h) {
  const intake = formatNumber(row.intakeKwh, 0);
  const chlorination = formatNumber(row.chlorinationKwh, 0);
  const production = formatNumber(row.production);
  const sec = formatNumber(row.sec, 2);

  slide.addShape('rect', { x, y, w, h, fill: { color: COLORS.white }, line: { color: COLORS.black, pt: 1.1 } });
  slide.addText('SEC =', {
    x: x + 0.1,
    y: y + 0.24,
    w: 0.55,
    h: 0.22,
    fontFace: 'Cambria',
    fontSize: 13,
    italic: true,
    color: COLORS.black,
    fit: 'shrink',
  });
  slide.addText(`${intake} kWh + ${chlorination} kWh`, {
    x: x + 0.86,
    y: y + 0.11,
    w: 1.95,
    h: 0.2,
    fontFace: 'Cambria',
    fontSize: 12.2,
    color: COLORS.black,
    align: 'center',
    fit: 'shrink',
  });
  addChartLine(slide, x + 0.82, y + 0.34, x + 2.86, y + 0.34, COLORS.black, 0.7);
  slide.addText(`${production} m³`, {
    x: x + 0.9,
    y: y + 0.38,
    w: 1.85,
    h: 0.2,
    fontFace: 'Cambria',
    fontSize: 12.2,
    italic: true,
    color: COLORS.black,
    align: 'center',
    fit: 'shrink',
  });
  slide.addText('=', {
    x: x + 2.88,
    y: y + 0.25,
    w: 0.18,
    h: 0.18,
    fontFace: 'Cambria',
    fontSize: 12.5,
    color: COLORS.black,
    align: 'center',
    fit: 'shrink',
  });
  slide.addShape('rect', { x: x + 3.06, y: y + 0.25, w: 1.18, h: 0.18, fill: { color: 'FFFF00' }, line: { color: 'FFFF00' } });
  slide.addText(`${sec} kWh/m³`, {
    x: x + 3.08,
    y: y + 0.21,
    w: 1.14,
    h: 0.25,
    fontFace: 'Cambria',
    fontSize: 11.2,
    bold: true,
    color: COLORS.black,
    fit: 'shrink',
    breakLine: false,
  });
}

function addSecExplanationSlide(pptx, rows) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  addPowerCostTable(slide, rows, 0, 0, 8.9, 2.06, { compact: true });
  addOperationPerformanceChart(slide, rows, 0.08, 2.16, 8.23, 4.52);

  slide.addText([
    { text: 'The SEC value tells you exactly how\nmany kilowatts of electricity your\nplant burns to process ' },
    { text: 'one cubic\nmeter (m)', options: { bold: true } },
    { text: ' of water.' },
  ], {
    x: 9.16,
    y: 0.73,
    w: 3.45,
    h: 0.98,
    fontFace: 'Aptos',
    fontSize: 13.2,
    color: COLORS.black,
    fit: 'shrink',
  });

  slide.addText('SEC =', { x: 9.12, y: 2.28, w: 0.55, h: 0.22, fontFace: 'Cambria', fontSize: 13.2, italic: true, color: COLORS.black, fit: 'shrink' });
  slide.addText('Intake kWh + Chlorination kWh', { x: 9.72, y: 2.08, w: 2.75, h: 0.22, fontFace: 'Cambria', fontSize: 12.4, italic: true, color: COLORS.black, align: 'center', fit: 'shrink' });
  addChartLine(slide, 9.78, 2.34, 12.45, 2.34, COLORS.black, 0.65);
  slide.addText('Total Production Volume', { x: 9.72, y: 2.36, w: 2.75, h: 0.22, fontFace: 'Cambria', fontSize: 12.4, italic: true, color: COLORS.black, align: 'center', fit: 'shrink' });

  const previous = rows[0] ?? {};
  const latest = rows[rows.length - 1] ?? {};
  [
    { row: previous, y: 3.08 },
    { row: latest, y: 5.2 },
  ].forEach(({ row, y }) => {
    slide.addText(`LEYECO READING (${String(row.dateLabel || '').toUpperCase()})`, { x: 9.15, y, w: 3.35, h: 0.2, fontFace: 'Cambria', fontSize: 12.2, bold: true, italic: true, color: COLORS.black, align: 'center', fit: 'shrink' });
    slide.addText([
      { text: 'INTAKE READING : ', options: { italic: true } },
      { text: `${formatNumber(row.intakeKwh, 0)} kWh\n`, options: { bold: true, italic: true } },
      { text: 'CHLORINATION READING: ', options: { italic: true } },
      { text: `${formatNumber(row.chlorinationKwh, 0)} kWh`, options: { bold: true, italic: true } },
    ], {
      x: 8.95,
      y: y + 0.25,
      w: 3.9,
      h: 0.34,
      fontFace: 'Cambria',
      fontSize: 11.3,
      color: COLORS.black,
      align: 'center',
      fit: 'shrink',
    });
    addSecFormulaBox(slide, row, 8.76, y + 0.74, 4.52, 0.64);
  });
}

function addSecFindingsSlide(pptx, rows) {
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.white };
  addPowerCostTable(slide, rows, 0, 0, 8.9, 2.06, { compact: true });
  addOperationPerformanceChart(slide, rows, 0.03, 2.1, 8.38, 4.57);

  const summary = getCostChangeSummary(rows);
  const previous = summary.previous;
  const latest = summary.latest;
  [
    {
      y: 1.28,
      h: 0.52,
      runs: [
        { text: 'Water production volume increased\nby ' },
        { text: `${formatPercent(summary.productionChange)} (${formatNumber(latest.production)} m³).`, options: { bold: true } },
      ],
    },
    {
      y: 2.13,
      h: 0.76,
      runs: [
        { text: 'Specific Energy Consumption (SEC)\nspiked by ' },
        { text: `${formatPercent(summary.secChange)},`, options: { bold: true } },
        { text: ' jumping from ' },
        { text: `(${formatNumber(previous.sec, 2)}\nkWh/m³) to (${formatNumber(latest.sec, 2)} kWh/m³).`, options: { bold: true } },
      ],
    },
    {
      y: 4.22,
      h: 1.08,
      runs: [
        { text: `Average hourly motor load jumped\nfrom (${formatNumber(previous.motorLoad, 2)} kW) to (${formatNumber(latest.motorLoad, 2)} kW)\n(${formatPercent(summary.motorLoadChange)}), `, options: { bold: true, color: COLORS.black } },
        { text: 'proving the intake pumps\nare drawing significantly more current\nto operate just to move 1 cubic meter.', options: { color: 'FF0000' } },
      ],
    },
  ].forEach((bullet) => {
    slide.addText('•', { x: 8.96, y: bullet.y + 0.02, w: 0.16, h: 0.18, fontSize: 13.5, color: COLORS.black, fit: 'shrink' });
    slide.addText(bullet.runs, {
      x: 9.22,
      y: bullet.y,
      w: 3.95,
      h: bullet.h,
      fontFace: 'Aptos',
      fontSize: 12.4,
      color: COLORS.black,
      fit: 'shrink',
      breakLine: false,
    });
  });
}

function buildChemicalUnitUsageRows(productionRows = [], chemicalRows = [], chemicalKey) {
  const chemicalByMonth = buildMonthlyMap(chemicalRows);

  return sortRowsForChart(productionRows).map((productionRow) => {
    const chemicalRow = chemicalByMonth.get(productionRow.key || productionRow.label);
    const production = safeNumber(productionRow.production);
    const chemical = safeNumber(chemicalRow?.[chemicalKey]);

    return {
      key: productionRow.key,
      label: productionRow.label,
      unitUsage: production > 0 ? chemical / production : 0,
      production,
      chemical,
    };
  });
}

function buildUnitUsageChart(rows, name) {
  const chartRows = sortRowsForChart(rows);
  const labels = buildMonthYearLabels(chartRows);

  return [
    {
      name,
      labels,
      values: chartRows.map((row) => chartValue(row.unitUsage)),
    },
  ];
}

export async function exportSummaryReportPptx({
  selectedMonthlyProduction,
  selectedBilledVolumes,
  selectedDailyProduction,
  selectedPowerConsumption,
  selectedChemicalUsage,
  context,
}) {
  const { default: pptxgen } = await import('pptxgenjs');
  const reportDate = new Date();
  const pptx = new pptxgen();

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'NemeXus';
  pptx.company = 'NemeXus';
  pptx.subject = 'NemeXus dashboard summary report';
  pptx.title = 'NemeXus Summary Report';
  pptx.lang = 'en-US';
  pptx.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos',
    lang: 'en-US',
  };

  const pageContext = {
    reportPeriodLabel: context?.reportPeriodLabel || '',
    coverPeriodLabel: context?.coverPeriodLabel || getCoverPeriodLabel(context?.dailyStartDate, context?.dailyEndDate),
    reportInputs: context?.reportInputs || {},
    productionYear: context?.productionYear || '-',
    dailyProductionLabel: selectedDailyProduction?.monthLabel || '-',
    powerYear: context?.powerYear || '-',
    chemicalYear: context?.chemicalYear || '-',
    graphStartMonthKey: context?.graphStartMonthKey || '',
    graphEndMonthKey: context?.graphEndMonthKey || '',
    powerCostStartMonthKey: context?.powerCostStartMonthKey || '',
    powerCostEndMonthKey: context?.powerCostEndMonthKey || '',
  };
  const productionRows = selectedMonthlyProduction?.rows ?? [];
  const powerRows = mergeReportInputRows(selectedPowerConsumption?.rows ?? [], pageContext.reportInputs);
  const chemicalRows = selectedChemicalUsage?.rows ?? [];
  const graphRange = {
    startMonthKey: pageContext.graphStartMonthKey,
    endMonthKey: pageContext.graphEndMonthKey,
  };
  const templateProductionRows = buildTemplateYearRows(productionRows, pageContext.productionYear, ['production'], graphRange);
  const templatePowerRows = buildTemplateYearRows(powerRows, pageContext.powerYear, ['chlorinationPower', 'deepwellPower', 'totalPower'], graphRange);
  const templateChemicalRows = buildTemplateYearRows(chemicalRows, pageContext.chemicalYear, ['chlorineUsage', 'peroxideUsage'], graphRange);
  const reportInputBilledVolumes = buildReportInputBilledVolumes(pageContext.reportInputs);
  const billedVolumeRows = buildBilledVolumeRows(templateProductionRows, {
    ...selectedBilledVolumes,
    ...reportInputBilledVolumes,
  });
  const powerUnitUsageRows = buildPowerUnitUsageRows(templateProductionRows, templatePowerRows);
  const electricBillRows = buildElectricBillRows(powerRows, pageContext.powerYear);
  const powerCostRows = buildPowerCostRows(
    electricBillRows,
    productionRows,
    powerRows,
    pageContext.powerCostEndMonthKey || pageContext.graphEndMonthKey,
    pageContext.powerCostStartMonthKey
  );
  const chlorineUnitUsageRows = buildChemicalUnitUsageRows(templateProductionRows, templateChemicalRows, 'chlorineUsage');
  const peroxideUnitUsageRows = buildChemicalUnitUsageRows(templateProductionRows, templateChemicalRows, 'peroxideUsage');

  addTitleSlide(pptx, pageContext);

  let pageNumber = 2;

  addChartOnlySlide(
    pptx,
    'PRODUCTION - Monthly',
    '',
    'bar',
    buildMonthlyProductionChart(templateProductionRows),
    pageNumber,
    {
      chartOptions: {
        chartColors: [COLORS.templateBlue],
        catAxisMultiLevelLabels: true,
        catAxisLabelRotate: 0,
        catAxisLabelFontSize: 11,
        valAxisLabelFontSize: 7,
        showValue: true,
        dataLabelFontSize: 10.5,
        dataLabelColor: COLORS.black,
        dataLabelPosition: 'outEnd',
        title: 'Monthly Production',
        titleFontSize: 20,
        altText: 'Monthly production bar chart',
      },
      leftAxisTitle: 'Production Volume (m3)',
      axisFontSize: 12,
      chartX: 1.28,
      chartY: 1.548,
      chartW: 10.96,
      chartH: 4.989,
      leftAxisTitleX: -0.114,
      leftAxisTitleY: 3.58,
    }
  );
  pageNumber += 1;

  addChartOnlySlide(
    pptx,
    'Billed Volume',
    '',
    'bar',
    buildBilledVolumeChart(billedVolumeRows),
    pageNumber,
    {
      chartOptions: {
        chartColors: ['4285F4', 'F44336'],
        barGrouping: 'stacked',
        catAxisMultiLevelLabels: true,
        catAxisLabelRotate: 0,
        catAxisLabelFontSize: 11,
        valAxisLabelFontSize: 7,
        valAxisMaxVal: 10000,
        valAxisMajorUnit: 2500,
        showValue: true,
        dataLabelFontSize: 10.5,
        dataLabelColor: COLORS.black,
        title: 'Billed Volume vs NRW',
        titleFontSize: 20,
        altText: 'Billed volume and NRW stacked bar chart',
      },
      leftAxisTitle: 'Water Volume (m3)',
      axisFontSize: 12,
      chartX: 1.28,
      chartY: 1.538,
      chartW: 10.96,
      chartH: 5.262,
      leftAxisTitleX: -0.098,
      leftAxisTitleY: 3.62,
    }
  );
  pageNumber += 1;

  addChartSectionSlide(
    pptx,
    'PRODUCTION - Daily',
    '',
    'bar',
    buildDailyProductionChart(selectedDailyProduction?.rows ?? []),
    [
      { label: 'Date', value: (row) => row.date || row.label },
      { label: 'Production m3', value: (row) => formatNumber(row.production) },
    ],
    selectedDailyProduction?.rows ?? [],
    pageNumber,
    {
      maxRows: 8,
      chartRowCount: Math.min(selectedDailyProduction?.rows?.length ?? 0, 31),
      chartOptions: {
        chartColors: [COLORS.templateBlue],
        catAxisLabelRotate: 45,
        catAxisLabelFontSize: 10.5,
        valAxisLabelFontSize: 7,
        showValue: true,
        dataLabelFontSize: 7,
        dataLabelColor: COLORS.black,
        dataLabelPosition: 'outEnd',
        title: `${pageContext.dailyProductionLabel} Production`,
        titleFontSize: 13,
        altText: 'Daily production bar chart',
      },
      leftAxisTitle: 'Production (m3)',
      axisFontSize: 12,
      chartX: 1.28,
      chartY: 1.86,
      chartW: 10.96,
      chartH: 4.731,
      leftAxisTitleX: -0.16,
      leftAxisTitleY: 3.58,
    }
  );
  pageNumber += 1;

  addChartSectionSlide(
    pptx,
    'POWER CONSUMPTION',
    '',
    'bar',
    buildPowerChart(templatePowerRows),
    [
      { label: 'Month', value: (row) => row.label },
      { label: 'Chlorination kWh', value: (row) => formatNumber(row.chlorinationPower) },
      { label: 'Deepwell kWh', value: (row) => formatNumber(row.deepwellPower) },
      { label: 'Total kWh', value: (row) => formatNumber(row.totalPower) },
    ],
    templatePowerRows,
    pageNumber,
    {
      chartRowCount: selectedPowerConsumption?.rows?.length ?? 0,
      chartOptions: {
        chartColors: [COLORS.templateYellow],
        catAxisMultiLevelLabels: true,
        catAxisLabelRotate: 0,
        catAxisLabelFontSize: 10.5,
        valAxisLabelFontSize: 7,
        showValue: true,
        dataLabelFontSize: 10.5,
        dataLabelColor: COLORS.black,
        dataLabelPosition: 'outEnd',
        title: 'Monthly Power Consumption',
        titleFontSize: 20,
        altText: 'Monthly power consumption stacked bar chart',
      },
      leftAxisTitle: 'Power (kWh)',
      axisFontSize: 12,
      chartX: 1.167,
      chartY: 1.483,
      chartW: 11.073,
      chartH: 5.317,
      leftAxisTitleX: -0.227,
      leftAxisTitleY: 3.58,
    }
  );
  pageNumber += 1;

  addChartSectionSlide(
    pptx,
    'POWER UNIT USAGE',
    '',
    'bar',
    buildUnitUsageChart(powerUnitUsageRows, 'kWh per m3'),
    [
      { label: 'Month', value: (row) => row.label },
      { label: 'Power kWh', value: (row) => formatNumber(row.power) },
      { label: 'Production m3', value: (row) => formatNumber(row.production) },
      { label: 'kWh/m3', value: (row) => formatNumber(row.unitUsage) },
    ],
    powerUnitUsageRows,
    pageNumber,
    {
      chartRowCount: powerUnitUsageRows.length,
      chartOptions: {
        chartColors: [COLORS.templatePurple],
        catAxisMultiLevelLabels: true,
        catAxisLabelRotate: 0,
        catAxisLabelFontSize: 10.5,
        valAxisLabelFontSize: 7,
        showValue: true,
        dataLabelFontSize: 10.5,
        dataLabelColor: COLORS.black,
        dataLabelPosition: 'outEnd',
        title: 'Power Unit Usage',
        titleFontSize: 20,
        altText: 'Power unit usage bar chart',
      },
      leftAxisTitle: 'Unit usage (kWh/m3)',
      axisFontSize: 12,
      chartX: 1.142,
      chartY: 1.517,
      chartW: 11.098,
      chartH: 5.183,
    }
  );
  pageNumber += 1;

  if (hasElectricBillData(electricBillRows)) {
    addElectricBillSlide(pptx, electricBillRows);
    pageNumber += 1;
  }

  addChartSectionSlide(
    pptx,
    'Unit Usage - Calcium Hypochlorite',
    '',
    'bar',
    buildUnitUsageChart(chlorineUnitUsageRows, 'kg per m3'),
    [
      { label: 'Month', value: (row) => row.label },
      { label: 'Chlorine kg', value: (row) => formatNumber(row.chemical) },
      { label: 'Production m3', value: (row) => formatNumber(row.production) },
      { label: 'kg/m3', value: (row) => formatNumber(row.unitUsage) },
    ],
    chlorineUnitUsageRows,
    pageNumber,
    {
      chartRowCount: chlorineUnitUsageRows.length,
      chartOptions: {
        chartColors: [COLORS.templateGray],
        catAxisMultiLevelLabels: true,
        catAxisLabelRotate: 0,
        catAxisLabelFontSize: 10.5,
        valAxisLabelFontSize: 7,
        showValue: true,
        dataLabelFontSize: 10.5,
        dataLabelColor: COLORS.black,
        dataLabelPosition: 'outEnd',
        dataLabelFormatCode: '#,##0.0000',
        valLabelFormatCode: '#,##0.0000',
        title: 'Chlorine Unit Usages',
        titleFontSize: 13,
        altText: 'Calcium hypochlorite unit usage bar chart',
      },
      leftAxisTitle: 'Unit Usage (PHP/m3)',
      axisFontSize: 12,
      chartX: 1.167,
      chartY: 1.492,
      chartW: 11.073,
      chartH: 5.183,
      leftAxisTitleX: -0.227,
      leftAxisTitleY: 3.58,
    }
  );
  pageNumber += 1;

  addChartSectionSlide(
    pptx,
    'Unit Usage - Hydrogen Peroxide',
    '',
    'bar',
    buildUnitUsageChart(peroxideUnitUsageRows, 'L per m3'),
    [
      { label: 'Month', value: (row) => row.label },
      { label: 'Peroxide L', value: (row) => formatNumber(row.chemical) },
      { label: 'Production m3', value: (row) => formatNumber(row.production) },
      { label: 'L/m3', value: (row) => formatNumber(row.unitUsage) },
    ],
    peroxideUnitUsageRows,
    pageNumber,
    {
      chartRowCount: peroxideUnitUsageRows.length,
      chartOptions: {
        chartColors: [COLORS.templatePink],
        catAxisMultiLevelLabels: true,
        catAxisLabelRotate: 0,
        catAxisLabelFontSize: 11,
        valAxisLabelFontSize: 7,
        showValue: true,
        dataLabelFontSize: 11,
        dataLabelColor: COLORS.black,
        dataLabelPosition: 'outEnd',
        dataLabelFormatCode: '#,##0.0000',
        valLabelFormatCode: '#,##0.0000',
        title: 'Hydrogen Peroxide Unit Usages',
        titleFontSize: 20,
        altText: 'Hydrogen peroxide unit usage bar chart',
      },
      leftAxisTitle: 'Unit Usage (PHP/m3)',
      axisFontSize: 12,
      chartX: 1.28,
      chartY: 1.492,
      chartW: 10.96,
      chartH: 5.158,
      leftAxisTitleX: -0.1,
      leftAxisTitleY: 3.58,
    }
  );
  pageNumber += 1;

  if (hasPowerCostData(powerCostRows)) {
    addPowerCostAnalysisSlide(pptx, powerCostRows);
    pageNumber += 1;

    addFinancialPanelSlide(pptx, powerCostRows);
    pageNumber += 1;

    addSecExplanationSlide(pptx, powerCostRows);
    pageNumber += 1;

    addSecFindingsSlide(pptx, powerCostRows);
  }

  const periodSlug = makeFileSafe(pageContext.reportPeriodLabel);
  const fileName = `nemexus-summary-report-${periodSlug ? `${periodSlug}-` : ''}${makeFileDate(reportDate)}.pptx`;
  const generatedPptx = await pptx.write({ outputType: 'arraybuffer' });
  const templatedPptx = await applyPowerCostTemplateSlides(generatedPptx);
  await savePptxBuffer(templatedPptx, fileName);
  return templatedPptx;
}
