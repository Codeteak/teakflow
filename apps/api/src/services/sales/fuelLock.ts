export function fuelAlreadySaved(report: { fuel: number; fuelLocked?: boolean } | null | undefined) {
  return Boolean(report?.fuelLocked) || (report?.fuel ?? 0) > 0;
}
