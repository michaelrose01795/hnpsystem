// Existing-customer lookup regression coverage for shared create flows.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { test, expect, waitForAppReady } = require('../helpers/fixtures.js');

const CUSTOMER_SEARCH_ROUTE = '**/rest/v1/customers*';

const miaBrown = {
  id: '11111111-1111-4111-8111-111111111111',
  firstname: 'Mia',
  lastname: 'Brown',
  email: 'mia.brown@example.test',
  mobile: '07123456789',
  telephone: '01234567890',
  address: '1 Test Street',
  postcode: 'TE1 1ST',
  contact_preference: 'email',
  created_at: '2026-08-05T12:00:00.000Z',
  updated_at: '2026-08-05T12:00:00.000Z',
};

const darcyVine = {
  ...miaBrown,
  id: '22222222-2222-4222-8222-222222222222',
  firstname: 'Darcy',
  lastname: 'Vine',
  email: 'darcy.vine@example.test',
};

const openExistingCustomerPopup = async (page) => {
  // The default auth fixture uses an admin account whose page-access profile
  // cannot open /new-job. Authenticate as the workshop controller used by the
  // create-job flow so PageAccessGuard does not redirect during assertions.
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(async () => {
    const { csrfToken } = await fetch('/api/auth/csrf').then((response) => response.json());
    await fetch('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, userId: '45', callbackUrl: '/newsfeed' }),
      redirect: 'follow',
    });
  });
  await page.goto('/newsfeed');
  await waitForAppReady(page);
  await expect(page.locator('a[href="/profile"]')).toContainText(/Controller|CI Test User/);
  const acceptCookies = page.getByRole('button', { name: 'Accept All', exact: true });
  if (await acceptCookies.isVisible().catch(() => false)) await acceptCookies.click();

  await page.goto('/new-job');
  await waitForAppReady(page);
  await page.getByRole('button', { name: 'Existing Customer', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Existing customer' });
  await expect(dialog).toBeVisible();
  return dialog;
};

test.describe('Existing customer popup', () => {
  test.describe.configure({ timeout: 60_000 });

  test('shows results inside the popup and enables Add Customer after selection', async ({ page }) => {
    const dialog = await openExistingCustomerPopup(page);

    await page.route(CUSTOMER_SEARCH_ROUTE, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'content-range': '0-0/*' },
        body: JSON.stringify([miaBrown]),
      });
    });

    await dialog.getByPlaceholder('Search by name, email, or mobile').fill('Mia Brown');

    await expect(dialog.getByRole('status', { name: 'Searching customers' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Add Customer', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'New Customer', exact: true })).toHaveCount(0);

    const listbox = dialog.getByRole('listbox', { name: 'Customer search results' });
    const option = listbox.getByRole('option', { name: /Mia Brown/ });
    await expect(option).toBeVisible();

    const [dialogBox, listboxBox] = await Promise.all([
      dialog.boundingBox(),
      listbox.boundingBox(),
    ]);
    expect(dialogBox).not.toBeNull();
    expect(listboxBox).not.toBeNull();
    expect(listboxBox.y).toBeGreaterThanOrEqual(dialogBox.y);
    expect(listboxBox.y + listboxBox.height).toBeLessThanOrEqual(dialogBox.y + dialogBox.height);

    await option.click();
    await expect(dialog.getByText('Name:')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Add Customer', exact: true })).toBeEnabled();
  });

  test('offers New Customer only after a completed search has no matches', async ({ page }) => {
    const dialog = await openExistingCustomerPopup(page);

    await page.route(CUSTOMER_SEARCH_ROUTE, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    await dialog.getByPlaceholder('Search by name, email, or mobile').fill('Nobody Here');

    await expect(dialog.getByRole('status', { name: 'Searching customers' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'New Customer', exact: true })).toHaveCount(0);

    await expect(dialog.getByText('No existing customers found.')).toBeVisible();
    const createButton = dialog.getByRole('button', { name: 'New Customer', exact: true });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    const newCustomerDialog = page.getByRole('dialog', { name: 'New customer' });
    await expect(newCustomerDialog).toBeVisible();
    await expect(newCustomerDialog.getByPlaceholder('Enter first name')).toHaveValue('Nobody');
    await expect(newCustomerDialog.getByPlaceholder('Enter last name')).toHaveValue('Here');
  });

  test('shows a search error without offering New Customer', async ({ page }) => {
    const dialog = await openExistingCustomerPopup(page);

    await page.route(CUSTOMER_SEARCH_ROUTE, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Customer search failed' }),
      });
    });

    await dialog.getByPlaceholder('Search by name, email, or mobile').fill('Mia Brown');

    await expect(dialog.getByText('Unable to search customers. Please try again.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Add Customer', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'New Customer', exact: true })).toHaveCount(0);
  });

  test('keeps the newest results when an older search finishes later', async ({ page }) => {
    const dialog = await openExistingCustomerPopup(page);

    await page.route(CUSTOMER_SEARCH_ROUTE, async (route) => {
      const decodedUrl = decodeURIComponent(route.request().url());
      const isOlderMiaSearch = decodedUrl.includes('Mia') || decodedUrl.includes('mia');
      await new Promise((resolve) => setTimeout(resolve, isOlderMiaSearch ? 700 : 100));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([isOlderMiaSearch ? miaBrown : darcyVine]),
      });
    });

    const searchInput = dialog.getByPlaceholder('Search by name, email, or mobile');
    await searchInput.fill('Mia Brown');
    await page.waitForTimeout(300);
    await searchInput.fill('Darcy Vine');

    const listbox = dialog.getByRole('listbox', { name: 'Customer search results' });
    await expect(listbox.getByRole('option', { name: /Darcy Vine/ })).toBeVisible();
    await page.waitForTimeout(800);
    await expect(listbox.getByRole('option', { name: /Darcy Vine/ })).toBeVisible();
    await expect(listbox.getByRole('option', { name: /Mia Brown/ })).toHaveCount(0);
  });
});
