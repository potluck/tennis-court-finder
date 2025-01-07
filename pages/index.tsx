import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import { useState, useEffect } from "react";

interface TimeSlot {
  court: string;
  available: string[];
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function createTable(timeSlots: any) {
  console.log("timeSlots pots: ", timeSlots);
  return (
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
  );
}

export default function Home() {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        console.log("Hey pots, trying to fetch data");
        const response = await fetch('/api/courts');
        const data = await response.json();
        setTimeSlots(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching time slots:', error);
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div
      className={`${geistSans.variable} ${geistMono.variable} grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]`}
    >
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <h1>Available Court Time Slots</h1>
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          createTable(timeSlots)
        )}
      </main>
    </div>
  );
}
