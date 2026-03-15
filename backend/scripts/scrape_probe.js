require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');

async function probe(url) {
  const { data } = await axios.get(url, {
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  const $ = cheerio.load(data);
  const rawBodyText = $('body').text().replace(/\s+/g, ' ').trim();
  $('script, style, nav, footer, header').remove();
  const cleanedText = $('body').text().replace(/\s+/g, ' ').trim();

  console.log('url:', url);
  console.log('title:', $('title').text());
  console.log('html_len:', data.length);
  console.log('raw_body_len:', rawBodyText.length);
  console.log('cleaned_body_len:', cleanedText.length);
  console.log('raw_sample:', rawBodyText.slice(0, 220));
  console.log('---');
}

async function main() {
  await probe('https://vignan.ac.in');
  await probe('https://www.vignan.ac.in');
  await probe('https://www.vignan.ac.in/ug.php');
  await probe('https://www.vignan.ac.in/lateralentry.php');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
