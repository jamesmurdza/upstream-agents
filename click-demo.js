const puppeteer = require('puppeteer-core');

async function clickDemo() {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium',
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Go to Wikipedia
    console.log('1. Navigating to Wikipedia...');
    await page.goto('https://en.wikipedia.org', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: 'step1-wikipedia-home.png' });
    console.log('   Screenshot saved: step1-wikipedia-home.png');

    // Type in the search box
    console.log('2. Typing "Artificial Intelligence" in search box...');
    await page.type('input[name="search"]', 'Artificial Intelligence');
    await page.screenshot({ path: 'step2-typed-search.png' });
    console.log('   Screenshot saved: step2-typed-search.png');

    // Press Enter to search (instead of clicking button)
    console.log('3. Pressing Enter to search...');
    await page.keyboard.press('Enter');

    // Wait for the page to load
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });

    await page.screenshot({ path: 'step3-search-results.png', fullPage: false });
    console.log('   Screenshot saved: step3-search-results.png');
    console.log('   Current URL:', page.url());

    await browser.close();
    console.log('Done!');
}

clickDemo().catch(console.error);
