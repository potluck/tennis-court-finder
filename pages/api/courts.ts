import { NextApiRequest, NextApiResponse } from 'next';
import { JSDOM } from 'jsdom';
import puppeteer from 'puppeteer';
import chromium from '@sparticuz/chromium'
import puppeteerCore from 'puppeteer-core'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { daysLater, includeHalfHourSlots } = req.query;
    const daysToAdd = parseInt(daysLater as string) || 0;
    const shouldIncludeHalfHourSlots = includeHalfHourSlots === 'true';
    const reservationUrl = 'https://usta.courtreserve.com/Online/Reservations/Index/10243';

    let browser = null;
    if (process.env.NODE_ENV === 'development') {
      browser = await puppeteer.launch({ headless: true });
    }
    else {
      // Puppeteer-core
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
          headless: chromium.headless,
      });
    }
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to the page and wait for content to load
    await page.goto(reservationUrl, { waitUntil: 'networkidle0' });

    // Click the next button daysToAdd times
    for (let i = 0; i < daysToAdd; i++) {
      await page.click('button[title="Next"]');
    }
    if (daysToAdd > 0) {
      await page.waitForNetworkIdle();
    }
    
    // Get the page content after JavaScript execution
    const html = await page.content();
    // Close the browser
    await browser.close();

    const availableTimeSlots = parseAvailableTimeSlots(html, daysToAdd, shouldIncludeHalfHourSlots);
    console.log("availableTimeSlots: ", availableTimeSlots);
    res.status(200).json(availableTimeSlots);
    
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: 'Failed to fetch court reservations' });
  }
} 
const sanitizeHtml = (html: string) => {
  return html?.replace(/<style([\S\s]*?)>([\S\s]*?)<\/style>/gim, '')?.replace(/<script([\S\s]*?)>([\S\s]*?)<\/script>/gim, '')
}

function parseAvailableTimeSlots(html: string, daysToAdd: number, includeHalfHourSlots: boolean = false) {

  // const virtualConsole = new JSDOM().virtualConsole;
  // virtualConsole.on("error", () => {
  //   // No-op to skip console errors.
  // });
  // const dom = new JSDOM(html, { virtualConsole });
  // const dom = new JSDOM(html, {
  //   resources: undefined,
  //   runScripts: "outside-only",
  //   pretendToBeVisual: true,
  //   includeNodeLocations: false
  // });
  const dom = new JSDOM(sanitizeHtml(html));
  const doc = dom.window.document;
  if (!doc) {
    return [];
  }

  const timeSlots: Array<{time: string, court: number}> = [];

  // Select elements that represent time slots
  const slotElements = doc.querySelectorAll('.k-event');

  slotElements.forEach((slot: Element) => {
    const timeElement = slot.getAttribute('aria-label');
    const style = slot.getAttribute('style');
    
    // Extract left position from style string
    const leftMatch = style?.match(/left:\s*(\d+)px/);
    const leftPosition = leftMatch ? parseInt(leftMatch[1]) : 1;
    const court = process.env.NODE_ENV === 'development' ? (leftPosition - 1) / 120 + 1 : Math.round((leftPosition - 1) / 258 + 1);

    timeSlots.push({
      time: timeElement || 'Unknown Time',
      court: court
    });
  });
  console.log("timeSlots pots: ", timeSlots);

  const availableTimes = getAvailableTimeslots(timeSlots, daysToAdd, includeHalfHourSlots);
  console.log("availableTimes: ", availableTimes);
  // Filter for later day time slots (after 4 PM)
  return availableTimes;
  // return timeSlots.filter(slot => {
  //   if (!slot.time.includes('PM')) return false;
  //   const hour = parseInt(slot.time.split(':')[0]);
  //   return hour >= 4;
  // });
}

// Utility function to parse time strings
function parseTime(timeStr: string): Date {
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

// Function to extract available timeslots
function getAvailableTimeslots(
    timeSlots: { time: string; court: number }[],
    daysToAdd: number,
    includeHalfHourSlots: boolean = false
): { court: number; available: string[] }[] {
  // Get current time in Eastern Time
  const now = new Date();
  const currentTimeET = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true
  }).format(now);
  
  // Set startOfDay based on daysToAdd
  const startOfDay = daysToAdd === 0 
    ? parseTime(currentTimeET)
    : parseTime("8:00 AM");
    
  const endOfDay = parseTime("10:00 PM");

  const courts = new Map<number, { start: Date; end: Date }[]>();

  timeSlots.forEach(({ time, court }) => {
      const timeRangePattern = /(\d{1,2}:\d{2} (AM|PM)) to (\d{1,2}:\d{2} (AM|PM))/;
      const match = time.match(timeRangePattern);

      if (match) {
          const [, start, , end] = match;
          const startTime = parseTime(start);
          const endTime = parseTime(end);

          if (!courts.has(court)) courts.set(court, []);
          courts.get(court)?.push({ start: startTime, end: endTime });
      }
  });

  const results: { court: number; available: string[] }[] = [];

  courts.forEach((bookings, court) => {
      // Sort bookings by start time
      bookings.sort((a, b) => a.start.getTime() - b.start.getTime());

      const availableSlots: string[] = [];
      let lastEnd = startOfDay;

      bookings.forEach(({ start, end }) => {
          if (start > lastEnd) {
              const duration = start.getTime() - lastEnd.getTime();
              // Only add slots that are either 1 hour or (if includeHalfHourSlots is true) 30 minutes
              if (duration >= 3600000 || (includeHalfHourSlots && duration >= 1800000)) {
                  availableSlots.push(
                      `${lastEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  );
              }
          }
          lastEnd = new Date(Math.max(lastEnd.getTime(), end.getTime()));
      });

      if (lastEnd < endOfDay) {
          availableSlots.push(
              `${lastEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} to ${endOfDay.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          );
      }

      results.push({ court, available: availableSlots });
  });

  return results;
}
