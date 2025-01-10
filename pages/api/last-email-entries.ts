import { sql } from '@vercel/postgres';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get the last 5 days' dates in the required format
    const dates = Array.from({ length: 5 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    });

    // Query to get the most recent entry for each date where for_email is true
    const { rows } = await sql`
      WITH RankedEntries AS (
        SELECT 
          *,
          ROW_NUMBER() OVER (PARTITION BY date_for ORDER BY created_at DESC) as rn
        FROM court_lists
        WHERE date_for = ANY(ARRAY[${dates.map(d => `'${d}'`).join(',')}]::text[])
        AND for_email = true
      )
      SELECT * FROM RankedEntries
      WHERE rn = 1
      ORDER BY created_at DESC;
    `;

    // Transform the data to be more readable
    const formattedRows = rows.map(row => ({
      id: row.id,
      dateFor: row.date_for,
      courtList: JSON.parse(row.court_list.replace(/\\/g, '')),
      createdAt: row.created_at
    }));

    res.status(200).json(formattedRows);

  } catch (error) {
    console.error('Error fetching last email entries:', error);
    res.status(500).json({ error: 'Failed to fetch last email entries' });
  }
} 