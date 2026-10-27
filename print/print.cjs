const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [src, out] of [['handout.built.html', 'IFRS-Visitor-Guide.pdf'], ['sign.html', 'IFRS-QR-Sign.pdf']]) {
    await p.goto('file://' + process.cwd() + '/' + src, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.pdf({ path: out, format: 'Letter', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    console.log('wrote', out);
  }
  await b.close();
})();
