import { NextApiRequest, NextApiResponse } from 'next';
import nodemailer, { SentMessageInfo } from "nodemailer";

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
    const responses = await Promise.all([
      fetch('https://tennis-court-finder-two.vercel.app/api/courts?daysLater=0'),
      fetch('https://tennis-court-finder-two.vercel.app/api/courts?daysLater=1'),
      fetch('https://tennis-court-finder-two.vercel.app/api/courts?daysLater=2'),
      fetch('https://tennis-court-finder-two.vercel.app/api/courts?daysLater=3'),
      fetch('https://tennis-court-finder-two.vercel.app/api/courts?daysLater=4')
    ]);
    
    const data = await Promise.all(responses.map(res => res.json()));
    console.log("Fetched data pots");
    
    // Check if there are any available slots
    const hasAvailableSlots = (data as TimeSlot[][]).some((daySlots: TimeSlot[]) => 
      daySlots.some(slot => slot.available && slot.available.length > 0)
    );

    if (hasAvailableSlots) {
      // Create email content
      const emailContent = formatEmailContent(data);
      console.log("sending email pots");
      const response = await sendEmail(emailContent);
      // console.log("Yo pots - got slots, ", data);
      res.status(200).json({ message: "Email sent: " + response });
    }

  } catch (error) {
    console.error('Error checking courts:', error);
  }
}


function formatEmailContent(data: TimeSlot[][]): EmailContent {
  let htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          h1 { color: #2c5282; margin-bottom: 20px; }
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
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });

    const availableSlots = daySlots.filter(slot => slot.available && slot.available.length > 0);
    if (availableSlots.length > 0) {
      // Add HTML content
      htmlContent += `
        <div class="day-section">
          <h2 class="day-header">${dayLabel}</h2>
      `;
      
      // Add text content
      textContent += `${dayLabel}:\n`;
      
      availableSlots.forEach(slot => {
        // Add HTML version
        htmlContent += `
          <div class="court-slot">
            <span class="court-number">Court ${slot.court}:</span>
            <span class="time-slots">${slot.available.join(', ')}</span>
          </div>
        `;
        
        // Add text version
        textContent += `  Court ${slot.court}: ${slot.available.join(', ')}\n`;
      });
      
      htmlContent += `</div>`;
      textContent += '\n';
    }
  });

  htmlContent += `
      </body>
    </html>
  `;

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

  const mailOptions = {
    from: "potluck.mittal@gmail.com",
    to: "potluck.mittal@gmail.com, summer.than@gmail.com",
    subject: "McCarren Tennis Courts Availablity",
    text: emailContent.text,
    html: emailContent.html
  };
  console.log("transporter, you ready?");
  await transporter.sendMail(mailOptions, (error: Error | null, info: SentMessageInfo) => {
    if (error) {
      console.error("Error sending email: ", error);
      return error.toString();
    } else {
      console.log("Email sent: ", info.response);
      return info.response.toString();
    }
  });
}