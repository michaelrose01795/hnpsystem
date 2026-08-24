// file location: e2e/visual/floating-notes-help.spec.js
// Verifies that the Floating Notes HELP chat remains contained while resized.

// Playwright's project configuration and existing E2E suite use CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { test, expect } = require('@playwright/test');

const LONG_GUIDE_ANSWER = `**How to Create a Job Card**
**1** Navigate to Job Cards from the sidebar.
**2** Click the 'New Job Card' or 'Create' button at the top of the page.
**3** Select or create the customer — search by name, email, or phone.
**4** Select or create the vehicle — search by registration plate or VIN.
**5** Enter the work description detailing what needs to be done.
**6** Set the Priority (Low, Normal, High, Urgent) and Booking Date.
**7** Assign the job to a technician if known at this stage.
**8** Add any initial notes in the Notes tab.
**9** Save the job card. A job number is assigned automatically.
**10** The job card is now in Pending status and visible in Next Jobs.
*This action requires the Admin Manager, Service Manager, Workshop Manager, and Aftersales Manager role.*`;

test('HELP chat stays inside the floating card at supported sizes', async ({ page }) => {
  await page.route('**/api/ai/guide-sessions', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 901, title: 'How do I use News Feed?' }] }),
    });
  });
  await page.route('**/api/ai/guide-messages?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 1, role: 'user', content: 'How do I use News Feed?', createdAt: '2026-08-24T15:35:00Z' },
          {
            id: 2,
            role: 'assistant',
            content: LONG_GUIDE_ANSWER,
            createdAt: '2026-08-24T15:35:30Z',
            sources: [
              { id: 'news-feed', title: 'News Feed', route: '/newsfeed' },
              { id: 'job-card', title: 'How to Create a Job Card', route: '/job-cards/create' },
            ],
          },
        ],
      }),
    });
  });

  await page.goto('/newsfeed');
  const notesButton = page.getByRole('button', { name: 'Open Notes' });
  await expect(notesButton).toBeVisible();
  await notesButton.click();
  await page.getByRole('tab', { name: 'Open App Guide help' }).click();

  const chatLog = page.getByRole('log', { name: 'Chat messages' });
  await expect(chatLog).toContainText('How to Create a Job Card');

  const floatingPanel = page
    .getByRole('tablist', { name: 'Floating note tabs' })
    .locator('xpath=ancestor::section[1]');
  const helpPanel = chatLog.locator('xpath=..');
  const input = page.getByRole('textbox', { name: 'Type your question' });
  const sessionSelect = page.getByLabel('Select chat session');
  const deleteButton = page.getByRole('button', { name: 'Delete session' });

  for (const size of [
    { width: 260, height: 220 },
    { width: 320, height: 260 },
    { width: 460, height: 360 },
    { width: 720, height: 620 },
  ]) {
    await floatingPanel.evaluate((element, nextSize) => {
      element.style.left = '80px';
      element.style.top = '40px';
      element.style.width = `${nextSize.width}px`;
      element.style.height = `${nextSize.height}px`;
    }, size);

    await expect(input).toBeVisible();
    await expect(sessionSelect).toBeVisible();
    await expect(deleteButton).toHaveCSS('width', '44px');
    await expect(deleteButton).toHaveCSS('height', '44px');

    const containment = await helpPanel.evaluate((element) => {
      const root = element.getBoundingClientRect();
      const textbox = element.querySelector('textarea')?.getBoundingClientRect();
      const toolbar = element.firstElementChild?.getBoundingClientRect();
      return {
        horizontalOverflow: element.scrollWidth - element.clientWidth,
        verticalOverflow: element.scrollHeight - element.clientHeight,
        textboxInside:
          Boolean(textbox) && textbox.left >= root.left - 1 && textbox.right <= root.right + 1 &&
          textbox.top >= root.top - 1 && textbox.bottom <= root.bottom + 1,
        toolbarInside:
          Boolean(toolbar) && toolbar.left >= root.left - 1 && toolbar.right <= root.right + 1 &&
          toolbar.top >= root.top - 1 && toolbar.bottom <= root.bottom + 1,
      };
    });

    expect(containment.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(containment.verticalOverflow).toBeLessThanOrEqual(1);
    expect(containment.textboxInside).toBe(true);
    expect(containment.toolbarInside).toBe(true);
  }
});
