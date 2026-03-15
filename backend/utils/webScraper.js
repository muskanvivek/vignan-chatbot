const axios = require('axios');
const cheerio = require('cheerio');

const extractTextFromURL = async (url) => {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });
    const $ = cheerio.load(data);
    
    // Remove unnecessary elements
    $('script, style, nav, footer, header, .sidebar, .menu, #comments, .ads, .social-share').remove();
    
    // Target meaningful content
    const selectors = [
      'main', 'article', '.content', '#content', 
      '.post-content', '.entry-content', '.page-content',
      '.td-post-content', '.post-text', '.body-text',
      '.mw-parser-output' // For wiki-style pages
    ];
    
    let text = '';
    
    // Try each selector
    for (const selector of selectors) {
      if ($(selector).length > 0) {
        $(selector).each((i, el) => {
          text += $(el).text() + '\n';
        });
        if (text.length > 200) break; // If we found good content, stop
      }
    }
    
    // Fallback to body if nothing specific found
    if (text.trim().length < 100) {
      text = $('body').text();
    }
    
    // Aggressive cleaning
    return text
      .replace(/[\t\r]/g, ' ')
      .replace(/\n\s*\n/g, '\n\n') // Keep double newlines for chunking
      .replace(/\s{2,}/g, ' ')
      .trim();
  } catch (error) {
    console.error('URL extraction failed:', error.message);
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
