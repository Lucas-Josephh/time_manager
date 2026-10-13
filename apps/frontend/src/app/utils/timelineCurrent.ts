export function getCurrentTimeline(before: Date, after: Date): boolean {
  const currentDate: Date = new Date();
  currentDate.setHours(currentDate.getHours(), currentDate.getMinutes(), 0, 0);

  return currentDate >= before && currentDate <= after;
}
