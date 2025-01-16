import { sql } from '@vercel/postgres';
import { NextApiRequest, NextApiResponse } from 'next';

// TODO: Turn this into a util function - doesn't need to be over the wire
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get the last 5 days' dates in the required format
    const dates = Array.from({ length: 5 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      return date.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });
    });

    // I don't know why I had to do this brute force, but it wasn't working with the date_for IN clause
    const { rows } = await sql`
      WITH RankedEntries AS (
        SELECT 
          *,
          ROW_NUMBER() OVER (PARTITION BY date_for ORDER BY created_at DESC) as rn
        FROM court_lists
        WHERE (date_for = ${dates[0]} OR date_for = ${dates[1]} OR date_for = ${dates[2]} OR date_for = ${dates[3]} OR date_for = ${dates[4]})
        AND for_email = true
      )
      SELECT * FROM RankedEntries
      WHERE rn = 1
      ORDER BY right(date_for, 2) asc
    `;

    const formattedRows = rows.map(row => ({
      id: row.id,
      date_for: row.date_for,
      court_list: JSON.parse(row.court_list.replace(/\\/g, '')),
      created_at: row.created_at
    }));

    res.status(200).json(formattedRows);

  } catch (error) {
    console.error('Error fetching last email entries:', error);
    res.status(500).json({ error: 'Failed to fetch last email entries' });
  }
} 