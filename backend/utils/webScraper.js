const axios = require('axios');
const cheerio = require('cheerio');

const extractTextFromURL = async (url) => {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      },
      timeout: 15000
    });
    const $ = cheerio.load(data);
    
    // Remove purely decorative or non-content elements
    $('script, style, nav, footer, header, .sidebar, .menu, #comments, .ads, .social-share, svg, noscript').remove();
    
    // Custom logic to preserve table structures and lists
    $('table').each((i, el) => {
      let tableText = '\n[Table Start]\n';
      $(el).find('tr').each((trIdx, tr) => {
        const cells = [];
        $(tr).find('th, td').each((tdIdx, td) => {
          cells.push($(td).text().trim());
        });
        tableText += cells.join(' | ') + '\n';
      });
      tableText += '[Table End]\n';
      $(el).replaceWith(tableText);
    });

    $('ul, ol').each((i, el) => {
      let listText = '\n';
      $(el).find('li').each((liIdx, li) => {
        listText += `• ${$(li).text().trim()}\n`;
      });
      $(el).replaceWith(listText);
    });

    // Target main content area but be more inclusive
    const mainSelectors = ['main', 'article', '.content', '#content', '.page-body', '.body-content'];
    let contentFound = false;
    let extractedText = '';

    for (const selector of mainSelectors) {
      if ($(selector).length > 0) {
        const candidateText = $(selector).text().trim();
        if (candidateText.length > 120) {
          extractedText = candidateText;
          contentFound = true;
          break;
        }
      }
    }

    if (!contentFound) {
      extractedText = $('body').text();
    }
    
    // Advanced cleaning while preserving structural markers
    return extractedText
      .replace(/[\t\r]/g, ' ')
      .replace(/\n\s*\n/g, '\n\n') // Preserve paragraph breaks
      .replace(/[ ]{2,}/g, ' ')
      .trim();
  } catch (error) {
    console.error(`URL extraction failed for ${url}:`, error.message);
    throw error;
  }
};

const discoverLinks = async (baseUrl) => {
  try {
    console.log(`[Crawler] Discovering links from: ${baseUrl}`);
    const { data } = await axios.get(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    const $ = cheerio.load(data);
    const links = new Set();
    const urlObj = new URL(baseUrl);
    const domain = urlObj.hostname;

    $('a').each((i, el) => {
      let href = $(el).attr('href');
      if (!href) return;

      try {
        // Handle relative URLs
        const absoluteUrl = new URL(href, baseUrl).href;
        const targetUrlObj = new URL(absoluteUrl);

        // Only include links from the same domain and starting with the same base path
        if (targetUrlObj.hostname === domain && absoluteUrl.startsWith(baseUrl)) {
          // Remove fragments and trailing slashes for normalization
          const normalized = absoluteUrl.split('#')[0].replace(/\/$/, '');
          if (normalized !== baseUrl.replace(/\/$/, '')) {
            links.add(normalized);
          }
        }
      } catch (e) {
        // Skip invalid URLs
      }
    });

    console.log(`[Crawler] Found ${links.size} relevant internal links`);
    return Array.from(links);
  } catch (error) {
    console.error('[Crawler] Discovery failed:', error.message);
    return [];
  }
};

module.exports = { extractTextFromURL, discoverLinks };
