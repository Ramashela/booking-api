import { google } from 'googleapis';

export default async function handler(req, res) {
  // Allow requests from your Netlify site
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { date, time, name, email, phone, doctor, reason } = req.body;

  // Connect to Google Sheets
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const sheetId = process.env.SHEET_ID;

  // Read existing bookings
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Bookings!A:D',
  });

  const rows = existing.data.values || [];

  // Check for double booking
  const conflict = rows.find(r => r[1] === date && r[2] === time);
  if (conflict) {
    return res.status(409).json({ 
      available: false, 
      message: 'That slot is taken. Please choose another time.' 
    });
  }

  // Generate reference number
  const ref = 'MC-' + Math.floor(100000 + Math.random() * 900000);

  // Write new booking to Google Sheets
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Bookings!A:H',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[ref, date, time, name, email, phone, doctor, reason]]
    }
  });

  // Trigger Zapier Webhook
  await fetch(process.env.ZAPIER_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref, date, time, name, email, phone, doctor, reason })
  });

  return res.status(200).json({ available: true, ref });
}
