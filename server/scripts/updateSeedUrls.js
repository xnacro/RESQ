// Update seed RSS item URLs to live working regional news links
import pool from '../config/db.js'

async function updateUrls() {
  try {
    await pool.query(
      "UPDATE news.rss_items SET url = 'https://nenow.in/north-east-news/assam/assam-flood-situation-worsens-in-barak-valley.html' WHERE id = 34"
    )
    await pool.query(
      "UPDATE news.rss_items SET url = 'https://theshillongtimes.com/2026/08/29/12-people-from-assam-untraced-in-nepal-flash-flood-cm-sarma/' WHERE id = 33"
    )
    await pool.query(
      "UPDATE news.rss_items SET url = 'https://www.sentinelassam.com/north-east-india-news/assam-news/assam-flood-situation-remains-grim' WHERE id = 32"
    )
    await pool.query(
      "UPDATE news.rss_items SET url = 'https://guwahatiplus.com/guwahati/waterlogging-and-traffic-snarls-in-guwahati' WHERE id = 35"
    )
    console.log('Successfully updated seed URLs to live regional news links')
  } catch (err) {
    console.error('Error updating URLs:', err)
  } finally {
    await pool.end()
  }
}

updateUrls()
