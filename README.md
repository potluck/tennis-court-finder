# Tennis Court Finder

A web application designed to find and display available tennis court time slots at NTC and send email notifications about availability. The primary goal is to make it easier for users to see upcoming available times without manually checking the booking website repeatedly.

## Table of Contents
- [Technical Architecture](#technical-architecture)
- [Key Features](#key-features)
- [Setup Instructions](#setup-instructions)
- [API Documentation](#api-documentation)
- [Data Flow](#data-flow)
- [Environment Variables](#environment-variables)
- [Future Improvements](#future-improvements)

## Technical Architecture

The project is built using the Next.js framework, providing a hybrid approach with both frontend rendering and backend API routes.

### Frontend
- Developed with React, TypeScript, and styled using Tailwind CSS
- Fetches available court data from the project's own API routes
- Presents data in a user-friendly table format
- Includes a toggle to filter out shorter (30-minute) time slots

### Backend (API Routes)
- Implemented using Next.js API routes in TypeScript
- `/api/courts`: Fetches raw reservation data from the external CourtReserve API, processes it to identify available time slots, and formats the results
- `/api/last-email-entries`: Fetches the most recent entries from the Vercel Postgres database that were used for sending email notifications
- `/api/check-courts-and-send-email`: Orchestrates the email notification process by comparing current availability with previously notified data

### Data Storage
- Vercel Postgres is used as the database
- Stores records of fetched court availability
- Tracks which availability sets have already triggered an email notification
- Potentially caches historical data

### External Dependencies
- **CourtReserve API**: Interacts with `usta.courtreserve.com` to retrieve the raw reservation schedule
- **Nodemailer**: Used for sending email notifications via a configured email service (Gmail)
- **jsdom**: Used for parsing HTML

## Key Features

- Displays available tennis court times for the next 5 days
- Fetches real-time availability from the external booking system
- Provides a filter toggle on the frontend to show/hide 30-minute time slots
- Compares current availability with previously notified availability
- Sends email notifications to a predefined list of recipients when new court times become available
- Uses a database to track sent email notifications

## Setup Instructions

### Prerequisites
- Node.js (v18 or later recommended)
- npm, yarn, or pnpm (pnpm recommended)
- A Vercel account (optional, for deployment and Vercel Postgres)
- A Gmail account configured to allow app passwords (for sending emails)

### Installation

1. Clone the Repository:
```bash
git clone <repository-url>
cd tennis-court-finder
```

2. Install Dependencies:
```bash
pnpm install
```

3. Set up Environment Variables:
Create a `.env.local` file in the root directory with:
```env
DATABASE_URL=postgres://user:password@host:port/database
GMAIL_APP_PASSWORD=your_gmail_app_password
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

4. Database Setup:
The project expects a Vercel Postgres database with a table named `court_lists`:
```sql
CREATE TABLE court_lists (
    id SERIAL PRIMARY KEY,
    court_list JSONB NOT NULL,
    date_for VARCHAR(255) NOT NULL,
    for_email BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

5. Run Locally:
```bash
pnpm dev
```

6. Build for Production:
```bash
pnpm build
```

## API Documentation

### GET /api/courts
Fetches available court time slots for a specified number of days in the future.

**Query Parameters:**
- `daysLater`: (Optional) Integer (0-4) representing days from today. Defaults to 0.
- `forEmail`: (Optional) String ("true" or "false"). Used internally by email logic.

**Response:**
```json
[
  {
    "court": "Court #1",
    "available": ["8:00 AM to 9:00 AM", "10:30 AM to 11:30 AM"]
  },
  {
    "court": "Court #2",
    "available": []
  }
]
```

### GET /api/check-courts-and-send-email
Designed to be triggered periodically. Checks for new availability and sends an email if found.

**Response Examples:**
```json
{ "message": "Email sent: <email-info>" }
{ "message": "No new availability since last email" }
{ "message": "No available slots" }
```

### GET /api/last-email-entries
Fetches the latest database entries marked as used for sending an email.

**Response:**
```json
[
  {
    "id": 1,
    "date_for": "Tuesday, Oct 26",
    "court_list": [...],
    "created_at": "2023-10-26T10:00:00.000Z"
  }
]
```

## Data Flow

### Frontend Data Flow
```mermaid
graph LR
    A[User Browser] --> B[Next.js Frontend]
    B --> C[GET /api/courts]
    C --> D[External CourtReserve API]
    D --> C
    C --> B
    B --> A[Displays Data]
```

### Backend/Notification Data Flow
```mermaid
graph LR
    E[External Cron Trigger] --> F[GET /api/check-courts-and-send-email]
    F --> G[/api/courts Logic]
    F --> H[/api/last-email-entries Logic]
    G --> I[Processed Availability Data]
    H --> J[Last Notified Data]
    I --> K{Compare Data?}
    J --> K
    K -- New Availability Found --> L[Format Email Content]
    L --> M[Send Email]
    M --> N[Email Recipients]
    K -- No New Availability --> O[Log/Report]
    I --> P[Database]
```

## Environment Variables

Required environment variables:
- `DATABASE_URL`: Vercel Postgres connection string
- `GMAIL_APP_PASSWORD`: Gmail app password for sending emails
- `NEXT_PUBLIC_BASE_URL`: Base URL of the deployed application

## Future Improvements

- Complete caching logic implementation
- Refactor API logic into reusable utility functions
- Implement robust error handling and logging
- Move hardcoded values to environment variables
- Add user preferences for notifications
- Support multiple locations
- Break down frontend into smaller components
- Add unit and integration tests
- Integrate with Vercel Cron Jobs
- Improve database schema design
