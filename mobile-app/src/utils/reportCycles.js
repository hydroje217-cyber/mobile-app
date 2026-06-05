function parseDateKey(dateKey) {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function addMonthsClamped(date, monthOffset) {
  if (!date) {
    return null;
  }

  const year = date.getFullYear();
  const month = date.getMonth() + monthOffset;
  const day = date.getDate();
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getMonthOffset(fromMonthKey, toMonthKey) {
  const [fromYear, fromMonth] = String(fromMonthKey || '').split('-').map(Number);
  const [toYear, toMonth] = String(toMonthKey || '').split('-').map(Number);

  if (![fromYear, fromMonth, toYear, toMonth].every(Number.isFinite)) {
    return 0;
  }

  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

function getAllDailyProductionRows(dashboard) {
  return (dashboard?.dailyProductionYears ?? [])
    .flatMap((yearData) => yearData.months ?? [])
    .flatMap((month) => month.rows ?? [])
    .map((row) => ({
      ...row,
      date: row.date || row.key,
    }))
    .filter((row) => row.date);
}

function sumDailyProductionRows(rows, startDate, endDate) {
  return rows
    .filter((row) => String(row.date).localeCompare(startDate) >= 0 && String(row.date).localeCompare(endDate) <= 0)
    .reduce((total, row) => total + Number(row.production ?? 0), 0);
}

export function buildCycleMonthlyProductionYearData(dashboard, yearData, cycleStartDate, cycleEndDate) {
  const startDate = parseDateKey(cycleStartDate);
  const endDate = parseDateKey(cycleEndDate);
  const endMonthKey = String(cycleEndDate || '').slice(0, 7);

  if (!startDate || !endDate || !endMonthKey || !yearData?.rows?.length) {
    return yearData;
  }

  const dailyRows = getAllDailyProductionRows(dashboard);
  if (!dailyRows.length) {
    return yearData;
  }

  const rows = (yearData.rows ?? []).map((row) => {
    const monthOffset = getMonthOffset(endMonthKey, row.key);
    const rangeStart = formatDateKey(addMonthsClamped(startDate, monthOffset));
    const rangeEnd = formatDateKey(addMonthsClamped(endDate, monthOffset));
    const production = sumDailyProductionRows(dailyRows, rangeStart, rangeEnd);

    return {
      ...row,
      production,
      total: production,
      cycleStartDate: rangeStart,
      cycleEndDate: rangeEnd,
    };
  });
  const rowsWithProduction = rows.filter((row) => Number(row.production) > 0);
  const totalProduction = rows.reduce((total, row) => total + Number(row.production ?? 0), 0);

  return {
    ...yearData,
    rows,
    totalProduction,
    averageProduction: rowsWithProduction.length ? totalProduction / rowsWithProduction.length : 0,
  };
}
