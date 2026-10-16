async (page) => {
  if (!page.url().startsWith('http://127.0.0.1:5174/')) throw new Error('Use an isolated local preview on port 5174.');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const nav = (name) => page.getByRole('navigation', { name: 'Tools' }).getByRole('button', { name, exact: true });
  const unique = String(Date.now());
  const name = `Synthetic study ${unique}`;
  await nav('Ohm’s').click();
  await page.locator('#ohms').getByRole('button', { name: 'Try example' }).click();
  assert((await page.locator('#ohms-result').innerText()).includes('2,300 W'), 'Ohm example');
  assert((await page.locator('#ohms-result').innerText()).includes('R = V ÷ I'), 'Worked formula is shown');
  await page.locator('#ohms').getByRole('button', { name: 'Save worksheet', exact: true }).click();
  await page.getByLabel('Worksheet name', { exact: true }).fill(name);
  await page.locator('#save-notes').fill('Synthetic test only <script>not HTML</script>');
  await page.getByRole('button', { name: 'Save new worksheet', exact: true }).click();
  await page.getByRole('heading', { name, exact: true }).waitFor();
  await nav('Ohm’s').click(); await page.locator('#ohm-v').fill('240');
  assert(await page.locator('[data-save="ohms"]').isDisabled(), 'Stale result cannot be saved');
  await page.locator('#ohms').getByRole('button', { name: 'Calculate', exact: true }).click();
  assert((await page.locator('#ohms-result').innerText()).includes('2,400 W'), 'Edited input recalculates');
  await page.locator('#ohms').getByRole('button', { name: 'Save worksheet', exact: true }).click();
  await page.locator('#save-name').fill(`${name} second`);
  await page.getByRole('button', { name: 'Save new worksheet', exact: true }).click();
  await page.getByRole('heading', { name: `${name} second`, exact: true }).waitFor();
  const original = page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
  await original.getByRole('button', { name: 'Open & recalculate' }).click();
  assert(await page.locator('#ohm-v').inputValue() === '230', 'First worksheet was not overwritten by second save');
  await page.locator('#ohm-v').fill('250'); await page.locator('#ohms').getByRole('button', { name: 'Calculate', exact: true }).click();
  await page.locator('[data-save="ohms"]').click(); await page.locator('#save-update').click();
  await page.getByRole('heading', { name, exact: true }).waitFor();
  assert(await page.getByRole('heading', { name, exact: true }).count() === 1, 'Update is idempotent');
  await nav('V-drop').click(); await page.locator('#vdrop').getByRole('button', { name: 'Try example' }).click();
  assert((await page.locator('#vdrop-result').innerText()).includes('3.6 V'), 'Voltage-drop UI field mapping');
  await page.locator('#vd-solve').selectOption('length'); await page.locator('#vd-vd').fill('3.6');
  await page.locator('#vdrop').getByRole('button', { name: 'Calculate', exact: true }).click();
  assert((await page.locator('#vdrop-result').innerText()).includes('20 m'), 'Voltage-drop inverse UI');
  await nav('3-phase').click(); await page.locator('#three').getByRole('button', { name: 'Try example' }).click();
  await page.locator('#tp-connection').selectOption('delta'); await page.locator('#three').getByRole('button', { name: 'Calculate', exact: true }).click();
  assert((await page.locator('#three-result').innerText()).includes('phase 400 V'), 'Delta phase voltage');
  await page.locator('#tp-pf').fill('1.2'); await page.locator('#three').getByRole('button', { name: 'Calculate', exact: true }).click();
  assert((await page.locator('#three-result').innerText()).includes('between 0 and 1'), 'Invalid PF rejected');
  await nav('Cable').click(); await page.locator('[data-example="conduit"]').click();
  assert((await page.locator('#conduit-result').innerText()).includes('12.5%'), 'Conduit example');
  await page.locator('.cf-d').first().fill('-5'); await page.getByRole('button', { name: 'Calculate fill', exact: true }).click();
  assert((await page.locator('#conduit-result').innerText()).includes('positive overall diameter'), 'Invalid cable is not ignored');
  await page.locator('[data-example="derate"]').click();
  assert((await page.locator('#derate-result').innerText()).includes('23.04 A'), 'Derating example');
  await nav('Convert').click(); await page.locator('#conv-group').selectOption('current');
  await page.locator('#conv-from').selectOption('mA'); await page.locator('#conv-to').selectOption('A'); await page.locator('#conv-value').fill('30');
  await page.locator('#convert').getByRole('button', { name: 'Convert', exact: true }).click();
  assert((await page.locator('#convert-result').innerText()).includes('0.03 A'), 'Unit converter');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of ['Ohm’s', 'V-drop', '3-phase', 'Cable', 'Convert', 'Saved', 'Reference']) {
      await nav(name).click();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflows at ${width}px`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await nav('Saved').click(); await page.locator('#saved-search').fill(unique);
  assert(await page.locator('article').count() === 2, 'Both synthetic worksheets remain');
  await page.reload(); await nav('Saved').click(); await page.locator('#saved-search').fill(unique);
  assert(await page.locator('article').count() === 2, 'Worksheets persist after reload');
  const restored = { id: `synthetic-restore-${unique}`, tool: 'ohms', name: 'Synthetic restored example', notes: 'Synthetic only', updated: new Date().toISOString(), inputs: { 'ohm-v': '12', 'ohm-i': '2', 'ohm-r': '', 'ohm-p': '' } };
  const payload = { name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, records: [restored] })) };
  await page.locator('#saved-file').setInputFiles(payload);
  await page.waitForFunction(() => document.getElementById('saved-status').textContent.includes('1 worksheets restored'));
  await page.locator('#saved-file').setInputFiles(payload);
  await page.waitForFunction(() => document.getElementById('saved-status').textContent.includes('0 worksheets restored; 1 already present'));
  const downloading = page.waitForEvent('download'); await page.locator('#saved-export').click();
  assert((await downloading).suggestedFilename() === 'sparkit-worksheets.json', 'Backup export is downloadable');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await page.context().setOffline(true);
  try {
    await page.reload(); await nav('Saved').click(); await page.locator('#saved-search').fill(unique);
    assert(await page.locator('article').count() === 2, 'Worksheets available offline');
    await nav('Convert').click(); await page.locator('#conv-value').fill('1000');
    await page.locator('#convert').getByRole('button', { name: 'Convert', exact: true }).click();
    assert((await page.locator('#convert-result').innerText()).includes('1 m'), 'Calculator runs after offline reload');
  } finally { await page.context().setOffline(false); }
  await nav('Ohm’s').click(); await page.locator('[data-example="ohms"]').click();
  await page.screenshot({ path: 'output/playwright/sparkit-mobile.png', fullPage: true });
  assert(errors.length === 0, `Browser exceptions: ${errors.join(', ')}`);
  console.log('PASS: working, calculators, new/update, persistence, export/restore, responsive layouts and offline reload');
}
