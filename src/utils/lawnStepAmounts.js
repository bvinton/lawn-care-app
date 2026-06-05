/** @param {import('../data/LawnPackData').SEASONS[string]['steps'][number]} step @param {number} sqm */
export function getStepAmounts(step, sqm) {
  if (step.rates) {
    return step.rates.map((item) => ({
      name: item.name,
      total: item.ratePerSqm * sqm,
      unit: item.unit,
    }));
  }
  if (step.ratePerSqm != null) {
    return [{ name: null, total: step.ratePerSqm * sqm, unit: step.unit }];
  }
  return [];
}
