import { NextApiRequest, NextApiResponse } from 'next';
import { setCache } from '@/utils/set-cache';
import { getCache } from '@/utils/get-cache';
import { updateCacheForEmail } from '@/utils/update-cache-for-email';

interface CourtReservation {
  Start: string;
  End: string;
  CourtLabel: string;
}

interface CourtReserveResponse {
  Data: CourtReservation[];
}

// TODO: Pull out logic into util function that we can call from check-courts-and-send-email.ts - doesn't need to be over the wire
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { daysLater, forEmail } = req.query;
    const daysToAdd = parseInt(daysLater as string) || 0;

    // Get today's date in Eastern time
    const today = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const todayET = new Date(today);
    // Add days to the date
    const targetDate = new Date(todayET);
    targetDate.setDate(targetDate.getDate() + daysToAdd);


    const cachedData = await getCache(targetDate);
    if (cachedData) {
      console.log("got cache!");
      // Transform cached data back to the expected format
      const availableTimeSlots = cachedData.courtList.map((court: { court: number; available: string[]; }) => ({
        court: `Court #${court.court}`,
        available: court.available
      }));
      if (forEmail === 'true') {
        await updateCacheForEmail(cachedData.id);
      }
      return res.status(200).json(availableTimeSlots);
    }

    // If no cache hit, proceed with the original logic
    const reservations = await callCourtsAPI(targetDate);
    const availableTimeSlots = getAvailableTimeSlots(reservations, targetDate, daysToAdd);

    // Only cache courts that have available slots
    const courtsWithAvailability = availableTimeSlots
      .filter(court => court.available.length > 0)
      .map(court => ({
        court: parseInt(court.court.replace(/\D/g, '')),
        available: court.available
      }));
    await setCache(courtsWithAvailability, targetDate, forEmail === 'true');

    res.status(200).json(availableTimeSlots);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: 'Failed to fetch court reservations' });
  }
}

// Function to extract available timeslots
function getAvailableTimeSlots(
  reservations: CourtReservation[],
  targetDate: Date,
  daysToAdd: number
): { court: string; available: string[] }[] {

  const results: { court: string; available: string[] }[] = [];

  const targetDayOfWeek = targetDate.getDay();

  // Start time: 13:00 UTC same day (8AM Eastern)
  let startTime = new Date(targetDate);
  startTime.setUTCHours(12, 0, 0, 0); // TODO: 13 in the fall/winter, 12 in the spring/summer

  // End time: 03:00 UTC next day (10PM Eastern) or 8PM Eastern on weekends
  const endTime = new Date(targetDate);
  endTime.setUTCDate(endTime.getUTCDate() + 1);
  // endTime.setUTCHours((targetDayOfWeek === 0 || targetDayOfWeek === 6) ? 1 : 3, 0, 0, 0);  // TODO: This is for the fall/winter
  endTime.setUTCHours((targetDayOfWeek === 0 || targetDayOfWeek === 6) ? 0 : 2, 0, 0, 0); // TODO: This is for the spring/summer


  // For "today", start time should be now (don't look for time slots earlier than now)
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));

  if (daysToAdd === 0 && etTime.getHours() >= 8 && etTime.getHours() < (targetDayOfWeek === 0 || targetDayOfWeek === 6 ? 20 : 22)) {
    // Round up to nearest 30 minutes
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 30) * 30;

    const roundedTime = new Date(now);
    if (roundedMinutes === 60) {
      roundedTime.setHours(roundedTime.getHours() + 1);
      roundedTime.setMinutes(0);
    } else {
      roundedTime.setMinutes(roundedMinutes);
    }
    roundedTime.setSeconds(0);
    roundedTime.setMilliseconds(0);

    startTime = roundedTime;
  } else if (daysToAdd === 0 && etTime.getHours() >= (targetDayOfWeek === 0 || targetDayOfWeek === 6 ? 20 : 22)) {
    return results;
  }

  // Group reservations by court
  const courtReservations = new Map<string, CourtReservation[]>();

  reservations.forEach(reservation => {
    if (!courtReservations.has(reservation.CourtLabel)) {
      courtReservations.set(reservation.CourtLabel, []);
    }
    courtReservations.get(reservation.CourtLabel)?.push(reservation);
  });

  // Process each court
  courtReservations.forEach((bookings, courtLabel) => {
    // Sort bookings by start time
    bookings.sort((a, b) => new Date(a.Start).getTime() - new Date(b.Start).getTime());

    const availableSlots: string[] = [];
    let currentTime = startTime;

    // Skip if we're already past end time
    if (currentTime >= endTime) {
      results.push({ court: courtLabel, available: [] });
      return;
    }
    bookings.forEach(booking => {
      const bookingStart = new Date(booking.Start);
      const bookingEnd = new Date(booking.End);

      // Skip if we're already past end time
      if (currentTime >= endTime) return;

      if (currentTime < bookingStart && currentTime < endTime) {
        // Adjust end time to not exceed 10 PM ET
        const slotEnd = bookingStart.getTime() > endTime.getTime()
          ? endTime
          : bookingStart;

        availableSlots.push(
          `${formatTime(currentTime)} to ${formatTime(slotEnd)}`
        );
      }
      currentTime = new Date(Math.max(currentTime.getTime(), bookingEnd.getTime()));
    });

    // Check for available time after last booking, but before 10 PM ET
    if (currentTime < endTime) {
      availableSlots.push(
        `${formatTime(currentTime)} to ${formatTime(endTime)}`
      );
    }

    results.push({
      court: courtLabel,
      available: availableSlots
    });
  });

  // Sort results by court label
  return results.sort((a, b) => a.court.localeCompare(b.court));
}

// Helper function to format time in ET
function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

async function callCourtsAPI(date: Date/*, testing: boolean = false*/): Promise<CourtReservation[]> {
  // if (testing) {
  //   return Promise.resolve(getMockData());
  // }
  console.log("calling courtreserve api");
  // return Promise.resolve(getMockData());

  // Base URL and parameters
  const baseUrl = 'https://memberschedulers.courtreserve.com/SchedulerApi/ReadExpandedApi';

  // Static parameters
  const params = {
    id: '10243',
    uiCulture: 'en-US',
    requestData: 'eb6Pn1vtmodO/y4NZJEchGdVYPE729Bz1Gt1aKWVGfZ0SdVw/fQrnxsxMxElybabX3+5Qv5xLqRtaI39RtH2lWSZ/nr1F444auYnpYERzhRowItFLZRKDQA0ZQcz1Vvs4B5EJuAGbBI=',
    sort: '',
    group: '',
    filter: '',
  };

  // Dynamic JSON data based on input date
  const jsonData = {
    orgId: "10243",
    TimeZone: "America/New_York",
    KendoDate: {
      Year: date.getFullYear(),
      Month: date.getMonth() + 1, // JavaScript months are 0-based
      Day: date.getDate()
    },
    UiCulture: "en-US",
    CostTypeId: "104773",
    CustomSchedulerId: "",
    ReservationMinInterval: "60",
    SelectedCourtIds: "34737,34738,34739,34740,34788,34789,34790",
    SelectedInstructorIds: "",
    MemberIds: "",
    MemberFamilyId: "",
    EmbedCodeId: "",
    HideEmbedCodeReservationDetails: "True"
  };

  // Construct URL with query parameters
  const queryParams = new URLSearchParams({
    ...params,
    jsonData: JSON.stringify(jsonData)
  });

  const url = `${baseUrl}?${queryParams.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json() as CourtReserveResponse;
    // Filter to only include the attributes we care about
    return data.Data.map(({ Start, End, CourtLabel }) => ({
      Start,
      End,
      CourtLabel: CourtLabel.includes('Singles Court') ? 'Court #1' : CourtLabel
    }));
  } catch (error) {
    console.error('Error fetching courts data:', error);
    throw error;
  }
}
