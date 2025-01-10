import { sql } from '@vercel/postgres';

export async function getCache(targetDate: Date) {
  try {
    const dateFor = targetDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const {rows} = await sql`
      SELECT * FROM court_lists 
      WHERE date_for = ${dateFor}
      AND created_at > ${fiveMinutesAgo.toISOString()}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (rows.length > 0) {
      return {
        courtList: JSON.parse(rows[0].court_list.replace(/\\/g, '')),
        id: rows[0].id
      };
    }
    return null;

  } catch (error) {
    console.error('Cache error:', error);
    return null;
  }
} 