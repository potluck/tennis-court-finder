import { parseTime } from './time';

interface TimeSlot {
  court: string;
  available: string[];
}

export function filterShortTimeSlots(timeSlots: TimeSlot[][], minDurationMinutes: number = 30): TimeSlot[][] {
  return timeSlots.map(daySlots => 
    daySlots.map(court => ({
      ...court,
      available: court.available.filter(slot => {
        const [start, end] = slot.split(' to ').map(parseTime);
        const durationInMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
        return durationInMinutes > minDurationMinutes;
      })
    }))
  );
} 