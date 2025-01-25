import { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from "nodemailer";
import { filterShortTimeSlots } from '@/utils/timeSlots';

interface TimeSlot {
  court: string;
  available: string[];
}

interface EmailContent {
  html: string;
  text: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    console.log("Checking courts and sending email");
    // Fetch data for the next 5 days
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    // console.log("yo pots", `${baseUrl}/api/courts?daysLater=0&forEmail=true`);

    const responses = await Promise.all([
      fetch(`${baseUrl}/api/courts?daysLater=0&forEmail=true`),
      fetch(`${baseUrl}/api/courts?daysLater=1&forEmail=true`),
      fetch(`${baseUrl}/api/courts?daysLater=2&forEmail=true`),
      fetch(`${baseUrl}/api/courts?daysLater=3&forEmail=true`),
      fetch(`${baseUrl}/api/courts?daysLater=4&forEmail=true`),
      fetch(`${baseUrl}/api/last-email-entries`)
    ]);

    // Destructure the responses - separate courts data from last email data
    const [day0, day1, day2, day3, day4, lastEmailResponse] = responses;
    const slotsData = await Promise.all([day0, day1, day2, day3, day4].map(res => res.json()));
    const rows = await lastEmailResponse.json();
    // console.log("Fetched data pots", JSON.stringify(rows, null, 2));

    // Filter out short time slots from the data
    const filteredData = filterShortTimeSlots(slotsData);

    const filteredLastEmailRows = filterShortTimeSlots(rows.map((row: { court_list: TimeSlot[]; }) => row.court_list));


    const hasAvailableSlots = (filteredData as TimeSlot[][]).some((daySlots: TimeSlot[]) =>
      daySlots.some(slot => slot.available && slot.available.length > 0)
    );

    if (hasAvailableSlots && hasNewAvailabilityAfterLastEmailData(filteredData, filteredLastEmailRows)) {
      //TODO: update day0 - day4 in the db, set sent_email to true. Update last-email-entries to just look for sent_email
      const emailContent = formatEmailContent(filteredData);
      const response = await sendEmail(emailContent);
      res.status(200).json({ message: "Email sent: " + response });
    }
    else {
      res.status(200).json({
        message: hasAvailableSlots ? "No new availability since last email" : "No available slots"
      });
    }

  } catch (error) {
    console.error('Error checking courts:', error);
    res.status(500).json({ error: 'Failed to check courts and send email' });
  }
}

function hasNewAvailabilityAfterLastEmailData(currentData: TimeSlot[][], lastEmailData: TimeSlot[][]): boolean {
  if (!lastEmailData || lastEmailData.length === 0) return true;

  console.log("yo pots", JSON.stringify(currentData, null, 2), JSON.stringify(lastEmailData, null, 2));

  for (let dayIndex = 0; dayIndex < currentData.length; dayIndex++) {
    const currentDaySlots = currentData[dayIndex];
    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() + dayIndex);

    const lastDaySlots = lastEmailData[dayIndex];

    if (!lastDaySlots) return true;

    for (const currentCourt of currentDaySlots) {
      const courtNumber = parseInt(currentCourt.court.replace(/\D/g, ''));
      const lastCourt = lastDaySlots.find((court: TimeSlot) => parseInt(court.court) === courtNumber);

      if (currentCourt.available.length > 0 && !lastCourt) return true;

      // Check for new time slots
      const newTimeSlots = currentCourt.available.filter(
        time => !lastCourt?.available.includes(time)
      );

      if (newTimeSlots.length > 0) return true;
    }
  }

  return false;
}

function formatEmailContent(data: TimeSlot[][]): EmailContent {
  const bookingLink = 'https://usta.courtreserve.com/Online/Reservations/Index/10243';

  let htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          h1 { color: #2c5282; margin-bottom: 20px; }
          .booking-link { margin-top: 30px; }
          .booking-link a { color: #4299e1; text-decoration: none; }
          .booking-link a:hover { text-decoration: underline; }
          .day-section { margin-bottom: 30px; }
          .day-header { color: #2d3748; font-size: 20px; margin-bottom: 10px; }
          .court-slot { margin-left: 20px; margin-bottom: 5px; }
          .court-number { font-weight: bold; color: #4a5568; }
          .time-slots { color: #718096; }
        </style>
      </head>
      <body>
        <h1>Available Court Times</h1>
  `;

  let textContent = 'Available Court Times:\n\n';

  data.forEach((daySlots: TimeSlot[], index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    const dayLabel = date.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });

    const availableSlots = daySlots.filter(slot => slot.available && slot.available.length > 0);
    if (availableSlots.length > 0) {
      htmlContent += `
        <div class="day-section">
          <h2 class="day-header">${dayLabel}</h2>
      `;

      textContent += `${dayLabel}:\n`;

      availableSlots.forEach(slot => {
        htmlContent += `
          <div class="court-slot">
            <span class="court-number">${slot.court}:</span>
            <span class="time-slots">${slot.available.join(', ')}</span>
          </div>
        `;

        textContent += `  Court ${slot.court}: ${slot.available.join(', ')}\n`;
      });

      htmlContent += `</div>`;
      textContent += '\n';
    }
  });

  // Add booking link at the end
  htmlContent += `
        <div class="booking-link">
          <a href="${bookingLink}">Book here</a>
        </div>
      </body>
    </html>
  `;

  textContent += `\nBook a court here: ${bookingLink}`;

  return {
    html: htmlContent,
    text: textContent
  };
}

async function sendEmail(emailContent: EmailContent) {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "potluck.mittal@gmail.com",
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const today = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const mailOptions = {
    from: "potluck.mittal@gmail.com",
    to: "potluck.mittal@gmail.com, summer.than@gmail.com, azy@google.com, drschafran@gmail.com, J@ckaren.as, johnnyhwin@gmail.com",
    subject: `McCarren Tennis Courts Availability Update - ${today}`,
    text: emailContent.text,
    html: emailContent.html
  };

  let returnInfo = "";
  await new Promise((resolve, reject) => {
    // send mail
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error("Error sending email: ", err);
        returnInfo = "Error sending email: " + err;;
        reject(err);
      } else {
        console.log(info);
        returnInfo = "" + info.response;
        resolve(info);
      }
    });
  });
  return returnInfo;
}