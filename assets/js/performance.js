export function contingencyForecast({
  pendingSchools = 0,
  baseMinutes = 45,
  hoursPerDay = 6,
  totalMembers = 2,
  availableMembers = 2
} = {}) {
  const pending = Math.max(0, Number(pendingSchools || 0));
  const minutes = Math.max(1, Number(baseMinutes || 45));
  const dailyHours = Math.max(1, Number(hoursPerDay || 6));
  const total = Math.max(1, Number(totalMembers || 1));
  const available = Math.max(0, Math.min(total, Number(availableMembers || 0)));
  const baselineHours = pending * minutes / 60;
  const capacityFactor = available / total;
  const baselineDays = baselineHours / dailyHours;
  const estimatedDays = capacityFactor > 0 ? baselineDays / capacityFactor : null;
  return {
    pendingSchools: pending,
    baselineHours,
    baselineDays,
    estimatedDays,
    capacityFactor,
    capacityLossPercent: Math.round((1 - capacityFactor) * 100),
    delayDays: estimatedDays == null ? null : Math.max(0, estimatedDays - baselineDays),
    blocked: available === 0
  };
}

export function performanceSignal(value, target, lowerIsBetter = false) {
  const current = Number(value || 0);
  const reference = Number(target || 0);
  if (!reference) return 'neutral';
  const ratio = current / reference;
  if (lowerIsBetter) {
    if (ratio <= 1) return 'good';
    if (ratio <= 1.25) return 'warning';
    return 'risk';
  }
  if (ratio >= 1) return 'good';
  if (ratio >= 0.75) return 'warning';
  return 'risk';
}

export function minutesLabel(value) {
  const minutes = Number(value || 0);
  if (!minutes) return 'Sin datos';
  if (minutes < 60) return `${minutes.toFixed(1)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
}
