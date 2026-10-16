// Shared by the worker and the browser.

/** Totals returned by /api/count. Calendar periods are UTC; weeks begin Monday. */
export interface Stats {
  total: number;
  today: number;
  week: number;
  month: number;
  year: number;
}

/** Most clicks a single request may add. */
export const MAX_BATCH = 50;
