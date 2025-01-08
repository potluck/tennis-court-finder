export function parseTime(timeStr: string): Date {
  const timePattern = /(\d{1,2}):(\d{2}) (AM|PM)/;
  const match = timeStr.match(timePattern);

  if (!match) throw new Error(`Invalid time format: ${timeStr}`);
  
  let [hours] = [parseInt(match[1])];
  const [minutes, period] = [parseInt(match[2]), match[3]];
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
} 