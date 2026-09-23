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
  await page.route('**/api/shell/bootstrap', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          userId: 1,
          identity: 'linked',
          sidebarAccess: null,
          roster: null,
          unreadCount: 0,
        },
      }),
    });
  });
  await page.route('**/api/floating-notes**', async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.searchParams.get('view') === 'share-options') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            users: [
              { userId: 2, firstName: 'Accounts', lastName: '1', email: 'accounts1@humphriesandparks.co.uk' },
              { userId: 3, firstName: 'Admin', lastName: '1', email: 'admin1@humphriesandparks.co.uk' },
            ],
            sharedUserIds: [2],
          },
        }),
      });
      return;
    }
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [2] }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            noteId: 501,
            userId: 1,
            title: 'Shared handover',
            description: '<img src="x" onerror="window.__floatingNotesXss=true"><b>Shared workshop handover</b>',
            isGlobal: false,
            isShared: true,
            sharedUserCount: 1,
          },
          {
            noteId: 502,
            userId: 1,
            title: 'Private reminder',
            description: 'Only visible to its owner',
            isGlobal: false,
            isShared: false,
            sharedUserCount: 0,
          },
        ],
      }),
    });
  });
  await page.route('**/api/ai/guide-sessions', async (route) => {
    const method = route.request().method();
    if (method === 'PATCH') {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: body.id,
            title: body.title,
            updatedAt: '2026-08-25T10:00:00Z',
          },
        }),
      });
      return;
    }
    if (method !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 901,
          title: 'Who can access News Feed?',
          createdAt: '2026-08-24T15:35:00Z',
          updatedAt: '2026-08-24T15:35:30Z',
        }],
      }),
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
  const sharedNoteTab = page.getByRole('tab', { name: 'Shared handover, shared note' });
  const privateNoteTab = page.getByRole('tab', { name: 'Private reminder' });
  await expect(sharedNoteTab).toBeVisible();
  await expect(sharedNoteTab).toHaveCSS('height', '32px');
  await expect(sharedNoteTab.locator('svg')).toHaveCount(1);
  await expect(privateNoteTab.locator('svg')).toHaveCount(0);
  const sharedNoteDescription = page.locator('#floating-note-description');
  await expect(sharedNoteDescription).toContainText('Shared workshop handover');
  await expect(sharedNoteDescription.locator('img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__floatingNotesXss)).toBeUndefined();

  const shareButton = page.getByRole('button', { name: 'Share', exact: true });
  await expect(shareButton).toBeEnabled();
  await shareButton.click();
  const shareDialog = page.getByRole('dialog', { name: 'Share note' });
  const accountsRow = shareDialog.getByText('Accounts 1', { exact: true }).locator('xpath=..');
  const adminRow = shareDialog.getByText('Admin 1', { exact: true }).locator('xpath=..');
  await expect(shareDialog).toBeVisible();
  // The list is a plain user list now — no "People / Changes save automatically"
  // heading, no intro copy, no per-row email line.
  await expect(shareDialog.getByText('People', { exact: true })).toHaveCount(0);
  await expect(shareDialog).not.toContainText('Changes save automatically');
  await expect(shareDialog).not.toContainText('Select the colleagues who can view this note.');
  await expect(shareDialog).not.toContainText('accounts1@humphriesandparks.co.uk');
  await expect(adminRow).toHaveText('Admin 1');
  const peopleLayout = await accountsRow.evaluate((row) => {
    const section = row.parentElement?.parentElement;
    const unselectedRow = row.nextElementSibling;
    return {
      height: row.getBoundingClientRect().height,
      display: window.getComputedStyle(row).display,
      marginBottom: window.getComputedStyle(row).marginBottom,
      rowBackground: window.getComputedStyle(row).backgroundColor,
      unselectedRowBackground: unselectedRow ? window.getComputedStyle(unselectedRow).backgroundColor : '',
      sectionBackground: section ? window.getComputedStyle(section).backgroundColor : '',
    };
  });
  // Exactly 44px — the --control-height floor, and a compliant touch target
  // because the whole full-width label is the hit area.
  expect(peopleLayout.height).toBe(44);
  // Guards the specificity trap: `html.staff-scope label { display: block }`
  // outranks a single-class module selector, so the row must stay flex.
  expect(peopleLayout.display).toBe('flex');
  expect(peopleLayout.marginBottom).toBe('0px');
  expect(peopleLayout.unselectedRowBackground).toBe(peopleLayout.sectionBackground);
  expect(peopleLayout.rowBackground).not.toBe(peopleLayout.sectionBackground);
  const accountsCheckbox = shareDialog.getByRole('checkbox', { name: 'Share note with Accounts 1' });
  const rowCentres = await accountsCheckbox.evaluate((checkbox) => {
    const row = checkbox.closest('label');
    const name = checkbox.nextElementSibling;
    const checkboxRect = checkbox.getBoundingClientRect();
    const nameRect = name.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    return {
      checkbox: checkboxRect.top + checkboxRect.height / 2,
      name: nameRect.top + nameRect.height / 2,
      row: rowRect.top + rowRect.height / 2,
      checkboxInset: checkboxRect.left - rowRect.left,
      sameLine: Math.abs(
        (checkboxRect.top + checkboxRect.height / 2) - (nameRect.top + nameRect.height / 2)
      ) <= 1,
    };
  });
  expect(Math.abs(rowCentres.checkbox - rowCentres.row)).toBeLessThanOrEqual(1);
  expect(Math.abs(rowCentres.name - rowCentres.row)).toBeLessThanOrEqual(1);
  expect(rowCentres.sameLine).toBe(true);
  expect(Math.round(rowCentres.checkboxInset)).toBe(10);
  // Park the pointer away from the list first. The rows are 44px now, so the
  // cursor can already be sitting on the checkbox after the Share click — and
  // hovering a spot the mouse is already on fires no mouseover, so the
  // tooltip would never open.
  await page.mouse.move(0, 0);
  await accountsCheckbox.hover();
  const shareTooltip = page.locator('.app-global-tooltip');
  await expect(shareTooltip).toContainText('Share note with Accounts 1');
  await expect(shareTooltip).toHaveClass(/is-visible/);
  const tooltipLayers = await Promise.all([
    shareTooltip.evaluate((element) => Number(window.getComputedStyle(element).zIndex)),
    shareDialog.evaluate((element) => Number(window.getComputedStyle(element).zIndex)),
  ]);
  expect(tooltipLayers[0]).toBeGreaterThan(tooltipLayers[1]);
  await shareDialog.getByRole('button', { name: 'Close' }).click();

  const helpTab = page.getByRole('tab', { name: 'Open App Guide help' });
  await helpTab.click();

  const helpTabSizing = await helpTab.evaluate((element) => ({
    interactionHeight: element.getBoundingClientRect().height,
    backgroundColor: window.getComputedStyle(element).backgroundColor,
  }));
  expect(helpTabSizing.interactionHeight).toBe(32);
  expect(helpTabSizing.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');

  const chatLog = page.getByRole('log', { name: 'Chat messages' });
  await expect(chatLog).toContainText('How to Create a Job Card');
  await expect(chatLog).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(chatLog).toHaveCSS('border-top-style', 'none');

  const floatingPanel = page
    .getByRole('tablist', { name: 'Floating note tabs' })
    .locator('xpath=ancestor::section[1]');
  const helpPanel = chatLog.locator('xpath=..');
  const input = page.getByRole('textbox', { name: 'Type your question' });
  // The conversation title is a real text box at rest, not a heading that turns
  // into one on click. Both states must match a canonical bare .app-input.
  const titleInput = page.getByRole('textbox', { name: 'Conversation title' });
  const historyButton = page.getByRole('button', { name: 'Open chat history' });

  await expect(titleInput).toBeVisible();
  await expect(titleInput).toHaveValue('Who can access News Feed?');

  const readCanonicalInputStyle = (focused) => page.evaluate(async (shouldFocus) => {
    const reference = document.createElement('input');
    reference.className = 'app-input';
    reference.setAttribute('aria-label', 'Canonical input reference');
    reference.style.position = 'fixed';
    reference.style.left = '-10000px';
    document.body.appendChild(reference);
    if (shouldFocus) reference.focus();
    await new Promise((resolve) => window.setTimeout(resolve, 220));
    const computed = window.getComputedStyle(reference);
    const result = {
      height: computed.height,
      minHeight: computed.minHeight,
      padding: computed.padding,
      borderRadius: computed.borderRadius,
      backgroundColor: computed.backgroundColor,
      color: computed.color,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      boxShadow: computed.boxShadow,
    };
    reference.remove();
    return result;
  }, focused);

  const readInputStyle = () => titleInput.evaluate((element) => {
    const computed = window.getComputedStyle(element);
    return {
      height: computed.height,
      minHeight: computed.minHeight,
      padding: computed.padding,
      borderRadius: computed.borderRadius,
      backgroundColor: computed.backgroundColor,
      color: computed.color,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      boxShadow: computed.boxShadow,
    };
  });

  // Resting state — this is what used to be a bare bold heading with a
  // transparent background and no field treatment at all.
  expect(await readInputStyle()).toEqual(await readCanonicalInputStyle(false));

  const canonicalFocusedInputStyle = await readCanonicalInputStyle(true);
  await titleInput.click();
  await expect(titleInput).toBeFocused();
  await expect.poll(() => titleInput.evaluate((element) => window.getComputedStyle(element).backgroundColor))
    .toBe(canonicalFocusedInputStyle.backgroundColor);
  expect(await readInputStyle()).toEqual(canonicalFocusedInputStyle);

  // Escape reverts the draft without saving; Enter commits it.
  await titleInput.fill('Discarded title');
  await titleInput.press('Escape');
  await expect(titleInput).toHaveValue('Who can access News Feed?');

  await titleInput.fill('News Feed access');
  await titleInput.press('Enter');
  await expect(titleInput).toHaveValue('News Feed access');

  // Exactly 10px between the toolbar controls and the chat area. Guards the
  // specificity trap too: `html.staff-scope * { padding: 0 }` ties with a bare
  // module class and wins on order, so the bar's padding must be set through a
  // two-class selector or this drops back to the 4px flex gap alone.
  const toolbarGaps = await titleInput.evaluate((element) => {
    const bar = element.closest('div').parentElement;
    const chat = bar.nextElementSibling;
    const rect = (node) => node.getBoundingClientRect();
    const buttons = Array.from(bar.querySelectorAll('button'));
    return {
      titleBox: Math.round(rect(chat).top - rect(element).bottom),
      historyButton: Math.round(rect(chat).top - rect(buttons[0]).bottom),
      newButton: Math.round(rect(chat).top - rect(buttons[buttons.length - 1]).bottom),
    };
  });
  expect(toolbarGaps).toEqual({ titleBox: 10, historyButton: 10, newButton: 10 });

  await historyButton.click();
  const historyDialog = page.getByRole('dialog', { name: 'Chat history' });
  const historyPopup = historyDialog.locator('.popup-card');
  await expect(historyDialog).toBeVisible();
  await expect(historyPopup).toBeVisible();
  await expect(floatingPanel).toBeAttached();
  const [floatingLayer, historyLayer] = await Promise.all([
    notesButton.locator('xpath=..').evaluate((element) => Number(window.getComputedStyle(element).zIndex)),
    historyDialog.evaluate((element) => Number(window.getComputedStyle(element).zIndex)),
  ]);
  expect(historyLayer).toBeGreaterThan(floatingLayer);
  await expect(historyPopup).toContainText('News Feed access');
  await expect(historyPopup).toContainText('1 conversation');
  await expect(historyPopup).not.toContainText('Open, review, or remove a saved conversation.');
  await expect(historyPopup).not.toContainText('Newest first');
  await expect(historyPopup.getByRole('searchbox', { name: 'Search conversations' })).toBeVisible();
  const historyDeleteButton = historyPopup.getByRole('button', { name: 'Delete News Feed access chat' });
  await expect(historyDeleteButton).toBeVisible();
  const deleteRightInset = await historyDeleteButton.evaluate((button) => {
    const buttonRect = button.getBoundingClientRect();
    const rowRect = button.parentElement.getBoundingClientRect();
    return Math.round(rowRect.right - buttonRect.right);
  });
  expect(deleteRightInset).toBe(5);
  await historyPopup.getByRole('searchbox', { name: 'Search conversations' }).fill('missing conversation');
  await expect(historyPopup).toContainText('No matching conversations');
  await historyPopup.getByRole('button', { name: 'Clear search' }).click();
  await expect(historyPopup).toContainText('News Feed access');
  await historyPopup.getByRole('button', { name: 'Close' }).click();

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
    await expect(titleInput).toBeVisible();
    await expect(historyButton).toHaveCSS('width', '44px');
    await expect(historyButton).toHaveCSS('height', '44px');

    await historyButton.click();
    await expect(historyDialog).toBeVisible();
    await expect(historyPopup).toBeVisible();
    await expect(historyPopup.getByRole('button', { name: 'Delete News Feed access chat' })).toHaveCSS('width', '44px');
    await expect(historyPopup.getByRole('button', { name: 'Delete News Feed access chat' })).toHaveCSS('height', '44px');

    const historyContainment = await historyPopup.evaluate((popupElement) => {
      const popup = popupElement.getBoundingClientRect();
      return {
        inside: popup.left >= -1 && popup.right <= window.innerWidth + 1 &&
          popup.top >= -1 && popup.bottom <= window.innerHeight + 1,
        width: popup.width,
        horizontalOverflow: popupElement.scrollWidth - popupElement.clientWidth,
        verticalOverflow: popupElement.scrollHeight - popupElement.clientHeight,
      };
    });

    expect(historyContainment.inside).toBe(true);
    expect(historyContainment.width).toBeLessThanOrEqual(520);
    expect(historyContainment.horizontalOverflow).toBeLessThanOrEqual(1);
    expect(historyContainment.verticalOverflow).toBeLessThanOrEqual(1);
    await historyPopup.getByRole('button', { name: 'Close' }).click();

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

  await chatLog.focus();
  const scrollability = await chatLog.evaluate((element) => {
    element.scrollTop = 0;
    const maximumScroll = element.scrollHeight - element.clientHeight;
    element.scrollTop = maximumScroll;
    return {
      maximumScroll,
      scrollTop: element.scrollTop,
      overflowY: window.getComputedStyle(element).overflowY,
    };
  });

  expect(scrollability.overflowY).toBe('auto');
  expect(scrollability.maximumScroll).toBeGreaterThan(0);
  expect(scrollability.scrollTop).toBeGreaterThan(0);
});
