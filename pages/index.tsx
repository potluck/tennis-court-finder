import { Geist, Geist_Mono } from "next/font/google";
import { useState, useEffect } from "react";
import { useRouter } from 'next/router';
import { filterShortTimeSlots } from '@/utils/timeSlots';

interface TimeSlot {
  court: string;
  available: string[];
}

interface TimeSlotsByDay {
  [key: number]: TimeSlot[];
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function createTable(timeSlots: TimeSlot[], dayLabel: string) {
  return (
    <div className="w-full">
      <h2 className="text-xl font-semibold mb-4">{dayLabel}</h2>
      <table className="min-w-full border-collapse bg-white shadow-sm rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-gray-50 border-b">
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Court</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {timeSlots
            .filter((slot: TimeSlot) => slot.available && slot.available.length > 0)
            .map((slot: TimeSlot) => (
              <tr key={`${slot.court}-${slot.available.join('-')}`} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{slot.court}</td>
                <td className="px-6 py-4 whitespace-pre-line text-sm text-gray-900">
                  {slot.available.join('\n')}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function getDayLabel(daysLater: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysLater);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function Home() {
  const [timeSlots, setTimeSlots] = useState<TimeSlotsByDay>({});
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const includeHalfHourSlots = router.query.includeHalfHourSlots === 'true';
        const responses = await Promise.all([
          fetch(`/api/courts?daysLater=0`),
          fetch(`/api/courts?daysLater=1`),
          fetch(`/api/courts?daysLater=2`),
          fetch(`/api/courts?daysLater=3`),
          fetch(`/api/courts?daysLater=4`)
        ]);
        
        const data = await Promise.all(
          responses.map(res => res.json() as Promise<TimeSlot[]>)
        );

        const processedData = includeHalfHourSlots ? data : filterShortTimeSlots(data);

        setTimeSlots({
          0: processedData[0],
          1: processedData[1],
          2: processedData[2],
          3: processedData[3],
          4: processedData[4]
        });
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching time slots:', error);
        setIsLoading(false);
      }
    }

    if (router.isReady) {
      fetchData();
    }
  }, [router.isReady, router.query.includeHalfHourSlots]);


  return (
    <div
      className={`${geistSans.variable} ${geistMono.variable} grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]`}
    >
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start w-full">
        <h1 className="text-3xl font-semibold text-gray-900 mb-6">McCarren Available Court Time Slots</h1>
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <div className="flex flex-col gap-8 w-full">
            {Object.entries(timeSlots).some(([, slots]) => slots && slots.some((slot: TimeSlot) => slot.available && slot.available.length > 0)) ? (
              <>
                {timeSlots[0]?.some(slot => slot.available && slot.available.length > 0) &&
                  createTable(timeSlots[0], "Today's Available Times")}
                {timeSlots[1]?.some(slot => slot.available && slot.available.length > 0) &&
                  createTable(timeSlots[1], "Tomorrow's Available Times")}
                {timeSlots[2]?.some(slot => slot.available && slot.available.length > 0) &&
                  createTable(timeSlots[2], `Available Times for ${getDayLabel(2)}`)}
                {timeSlots[3]?.some(slot => slot.available && slot.available.length > 0) &&
                  createTable(timeSlots[3], `Available Times for ${getDayLabel(3)}`)}
                {timeSlots[4]?.some(slot => slot.available && slot.available.length > 0) &&
                  createTable(timeSlots[4], `Available Times for ${getDayLabel(4)}`)}
              </>
            ) : (
              <p className="text-lg text-gray-600">No time slots available in the next 5 days</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
