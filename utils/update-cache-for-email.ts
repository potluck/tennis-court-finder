import { sql } from '@vercel/postgres';

export async function updateCacheForEmail(id: number) {
  try {
    const {rows} = await sql`
      UPDATE court_lists 
      SET for_email = true
      WHERE id = ${id}
      RETURNING *
    `; // Returning * shows the data that we just inserted

    // console.log("rows: ", rows);

    return rows;

  } catch (error) {
    console.error('Cache error:', error);
    throw error;
  }
} 