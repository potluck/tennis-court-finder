import { sql } from '@vercel/postgres';

export async function setCache(courts: { court: number; available: string[]; }[], targetDate: Date, forEmail: boolean) {
  try {
    // Convert the courts array to a JSON string and escape any double quotes
    const courtsJson = JSON.stringify(courts).replace(/"/g, '\\"');
    const dateFor = targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const {rows} = await sql`
      INSERT INTO court_lists (court_list, date_for, for_email) 
      VALUES (${courtsJson}, ${dateFor}, ${forEmail})
      RETURNING *
    `; // Returning * shows the data that we just inserted

    // console.log("rows: ", rows);

    return rows;

  } catch (error) {
    console.error('Cache error:', error);
    throw error;
  }
} 