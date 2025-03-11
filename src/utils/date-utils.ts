export function DateToHhMmSsString(date: Date): string {
  const pad = (num: number) => String(num).padStart(2, "0");
  return [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join(":");
}
