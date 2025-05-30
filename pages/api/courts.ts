import { NextApiRequest, NextApiResponse } from 'next';
// import { getCache } from '@/utils/get-cache'; // Commented out due to unused cache logic
// import { setCache } from '@/utils/set-cache'; // Commented out due to unused cache logic
// import { updateCacheForEmail } from '@/utils/update-cache-for-email'; // Commented out due to unused cache logic

// Helper function to parse Microsoft-style date strings
function parseMicrosoftDate(msDate: string): Date | null {
  if (!msDate) return null;
  const match = /Date\((\d+)\)/.exec(msDate);
  if (match && match[1]) {
    return new Date(parseInt(match[1], 10));
  }
  console.warn(`Failed to parse date: ${msDate}`);
  return null;
}

// Interface for the raw slot data from the NTC API (items in responseData.Data)
interface ApiSlotData {
  Id: string;
  Start: string; // Microsoft date string, e.g., "/Date(1748948400000)/"
  End: string;   // Microsoft date string
  CourtType: string;
  AvailableCourtIds: number[];
  AvailableCourts: number; // Number of courts available in this slot
}

// Interface for the initially parsed slot data from callCourtsAPI
interface ParsedSlot {
  id: string;
  startTime: Date; // Changed from Date | null after filter in callCourtsAPI
  endTime: Date;   // Changed from Date | null after filter in callCourtsAPI
  courtType: string;
  availableCourtIds: number[];
  numberOfAvailableCourts: number;
}

// Interface for the final structure expected by the frontend
interface FrontendTimeSlot {
  court: string;
  available: string[];
}

// TODO: Pull out logic into util function that we can call from check-courts-and-send-email.ts - doesn't need to be over the wire
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { daysLater } = req.query;
    const daysToAdd = parseInt(daysLater as string) || 0;
    // const forEmail = req.query.forEmail as string; // Commented out as not used

    // Get today's date in Eastern time
    const today = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const todayET = new Date(today);
    // Add days to the date
    const targetDate = new Date(todayET);
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    // const cachedData = await getCache(targetDate); // Commented out cache logic
    // if (cachedData) { // Commented out cache logic
    //   console.log("got cache!"); // Commented out cache logic
    //   // Transform cached data back to the expected format // Commented out cache logic
    //   const availableTimeSlots = cachedData.courtList.map((court: { court: number; available: string[]; }) => ({ // Commented out cache logic
    //     court: `Court #${court.court}`, // Commented out cache logic
    //     available: court.available // Commented out cache logic
    //   })); // Commented out cache logic
    //   if (forEmail === 'true') { // Commented out cache logic
    //     await updateCacheForEmail(cachedData.id); // Commented out cache logic
    //   } // Commented out cache logic
    //   return res.status(200).json(availableTimeSlots); // Commented out cache logic
    // } // Commented out cache logic

    // If no cache hit, proceed with the original logic
    const parsedSlots: ParsedSlot[] = await callCourtsAPI(targetDate);
    const availableTimeSlots: FrontendTimeSlot[] = getAvailableTimeSlots(parsedSlots);

    res.status(200).json(availableTimeSlots);
  } catch (error) {
    console.error("Error in handler:", error);
    res.status(500).json({ error: 'Failed to fetch court reservations' });
  }
}

function getAvailableTimeSlots(
  parsedSlots: ParsedSlot[]
): FrontendTimeSlot[] {
  if (!parsedSlots || parsedSlots.length === 0) {
    return [];
  }

  // Group slots by individual court ID
  const slotsByCourtId = new Map<number, ParsedSlot[]>();
  parsedSlots.forEach(slot => {
    slot.availableCourtIds.forEach(courtId => {
      if (!slotsByCourtId.has(courtId)) {
        slotsByCourtId.set(courtId, []);
      }
      // Add the parent slot info, duplicating it for each court it applies to
      // Ensure we're creating a new object for each court to avoid reference issues if modifying
      slotsByCourtId.get(courtId)!.push({ ...slot, availableCourtIds: [courtId] });
    });
  });

  const finalCourtAvailability: FrontendTimeSlot[] = [];

  slotsByCourtId.forEach((courtSlots, courtId) => {
    // Sort slots by start time for this specific court
    courtSlots.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const availabilityStrings: string[] = [];
    if (courtSlots.length === 0) {
      finalCourtAvailability.push({ court: `Court #${courtId}`, available: [] });
      return; // Continue to next courtId
    }

    let currentBlockStart: Date | null = null;
    let currentBlockEnd: Date | null = null;

    for (const slot of courtSlots) {
      if (currentBlockStart === null) {
        currentBlockStart = slot.startTime;
        currentBlockEnd = slot.endTime;
      } else if (slot.startTime.getTime() === currentBlockEnd!.getTime()) {
        // This slot is continuous with the current block
        currentBlockEnd = slot.endTime;
      } else {
        // Gap detected, or slot is not continuous. Finalize previous block.
        availabilityStrings.push(`${formatTime(currentBlockStart)} to ${formatTime(currentBlockEnd!)}`);
        // Start new block
        currentBlockStart = slot.startTime;
        currentBlockEnd = slot.endTime;
      }
    }

    // Add the last block after loop finishes
    if (currentBlockStart && currentBlockEnd) {
      availabilityStrings.push(`${formatTime(currentBlockStart)} to ${formatTime(currentBlockEnd)}`);
    }

    finalCourtAvailability.push({
      court: `Court #${courtId}`, // Or a more sophisticated naming/mapping
      available: availabilityStrings
    });
  });

  // Sort final results by court name (e.g., Court #1, Court #10, Court #2)
  return finalCourtAvailability.sort((a, b) => {
    const numA = parseInt(a.court.replace(/\D/g, ''));
    const numB = parseInt(b.court.replace(/\D/g, ''));
    return numA - numB;
  });
}

// Helper function to format time in ET
function formatTime(date: Date): string {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.warn(`Invalid date passed to formatTime:`, date);
    return "Invalid time";
  }
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// This function now returns ParsedSlot[]
async function callCourtsAPI(date: Date): Promise<ParsedSlot[]> {
  console.log("calling courtreserve api for date:", date.toDateString());
  const startDateForAPI = new Date(date);
  const year = startDateForAPI.getFullYear();
  const month = (startDateForAPI.getMonth() + 1).toString().padStart(2, '0');
  const day = startDateForAPI.getDate().toString().padStart(2, '0');
  const rfcDate = startDateForAPI.toUTCString();
  const isoDateForJson = startDateForAPI.toISOString();

  const jsonData = {
    "startDate": isoDateForJson,
    "orgId": "5881",
    "TimeZone": "America/New_York",
    "Date": rfcDate,
    "KendoDate": { "Year": year, "Month": parseInt(month,10), "Day": parseInt(day,10) },
    "UiCulture": "en-US",
    "CostTypeId": "78549",
    "CustomSchedulerId": "294",
    "ReservationMinInterval": "30"
  };
  const formData = new URLSearchParams();
  formData.append('jsonData', JSON.stringify(jsonData));
  
  try {
    const response = await fetch('https://usta.courtreserve.com/Online/Reservations/ReadConsolidated/5881', {
      method: 'POST',
      headers: {
        'authority': 'usta.courtreserve.com',
        'accept': '*/*',
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: formData.toString()
    });
    if (!response.ok) {
      console.error(`API HTTP error! status: ${response.status}`, await response.text());
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const responseData = await response.json();
    console.log('Raw API Response Data:', JSON.stringify(responseData, null, 2));
    if (!responseData || !Array.isArray(responseData.Data)) {
      console.error('API response is not in expected format or Data is missing/not an array', responseData);
      return [];
    }
    return responseData.Data.map((slot: ApiSlotData) => {
      const startTime = parseMicrosoftDate(slot.Start);
      const endTime = parseMicrosoftDate(slot.End);
      return {
        id: slot.Id,
        startTime: startTime,
        endTime: endTime,
        courtType: slot.CourtType,
        availableCourtIds: slot.AvailableCourtIds || [],
        numberOfAvailableCourts: slot.AvailableCourts
      };
    }).filter((slot: ParsedSlot | { startTime: null; endTime: null }): slot is ParsedSlot => 
      slot.startTime instanceof Date && !isNaN(slot.startTime.getTime()) &&
      slot.endTime instanceof Date && !isNaN(slot.endTime.getTime())
    );
  } catch (error) {
    console.error('Error fetching or parsing courts data:', error);
    throw error;
  }
}
