import { NextApiRequest, NextApiResponse } from 'next';
import nodemailer from "nodemailer";

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
    // const responses = await Promise.all([
    //   fetch('https://tennis-court-finder-two.vercel.app/api/courts?daysLater=0'),
    //   fetch('https://tennis-court-finder-two.vercel.app/api/courts?daysLater=1'),
    //   fetch('https://tennis-court-finder-two.vercel.app/api/courts?daysLater=2'),
    //   fetch('https://tennis-court-finder-two.vercel.app/api/courts?daysLater=3'),
    //   fetch('https://tennis-court-finder-two.vercel.app/api/courts?daysLater=4')
    // ]);
    
    // const data = await Promise.all(responses.map(res => res.json()));
    const data = {
      "0": [
        { court: "1", available: ["8:00 AM", "9:00 AM", "10:00 AM"] },
        { court: "2", available: ["2:00 PM", "3:00 PM"] }
      ],
      "1": [
        { court: "3", available: ["11:00 AM", "12:00 PM"] }
      ],
      "2": [
        { court: "1", available: ["4:00 PM", "5:00 PM"] },
        { court: "4", available: ["9:00 AM"] }
      ],
      "3": [],
      "4": [
        { court: "2", available: ["1:00 PM", "2:00 PM", "3:00 PM"] }
      ]
    }
    console.log("Fetched data pots");
    
    // Since we now have actual data, we can uncomment and fix the hasAvailableSlots check
    const hasAvailableSlots = Object.values(data).some(daySlots => 
      daySlots.length > 0
    );

    if (hasAvailableSlots) {
      // Convert object to array format before passing to formatEmailContent
      const dataArray = Object.values(data);
      const emailContent = formatEmailContent(dataArray);
      console.log("sending email pots");
      const response = await sendEmail(emailContent);
      console.log("sent email pots " + response);
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
    subject: "McCarren Tennis Courts Availablity Update",
    text: emailContent.text,
    html: emailContent.html
  };
  console.log("transporter, you ready?");

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
            returnInfo = "sent email pots!!!!!3" + info.response;
            resolve(info);
        }
    });
  });
  return returnInfo;
}