import { sql } from '@vercel/postgres';
import { NextApiResponse, NextApiRequest } from 'next';
 
export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse,
) {
  const daysToAdd = request.query.daysToAdd as string;
  if (!daysToAdd) throw new Error('Missing daysToAdd');
  const courts = request.query.courts as string;
  if (!courts) throw new Error('Missing courts');
  // let pairToReturn = -1;

  try {
    const {rows} = await sql`SELECT * FROM court_lists cl;`;
    // let currTurn = null;
    // let maxPair = -1;

    console.log("rows pots: ", rows);

    console.log("courts pots: ", courts);

    await sql`INSERT INTO court_lists (court_list, date_for, for_email) VALUES (${courts}, '2025-01-08', false)`;

    return response.status(200).json({rows});

  } catch (error) {
    return response.status(500).json({ error });
  }
  
}