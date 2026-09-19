import { expect, test } from '@playwright/test';

const email = process.env.E2E_EMAIL ?? 'admin@codeteak.com';
const password = process.env.E2E_PASSWORD ?? '';

test.describe('WH-501 product flows', () => {
  test.skip(
    !password,
    'Set E2E_PASSWORD (and optional E2E_EMAIL) to run against a live API.',
  );

  test('login → daily work surface → chat → meetings join affordance', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/\/($|daily-work|chat|meetings)/);

    await page.goto('/daily-work');
    await expect(
      page
        .getByRole('heading', { name: /daily work/i })
        .or(page.getByText(/notebook|today/i))
        .first(),
    ).toBeVisible();

    await page.goto('/chat');
    await expect(page.getByText(/direct|channels|messages|chat/i).first()).toBeVisible();

    await page.goto('/meetings');
    await expect(
      page
        .getByRole('heading', { name: /meetings/i })
        .or(page.getByText(/meet|schedule/i))
        .first(),
    ).toBeVisible();
  });

  test('locked → open → write → submit path is represented on daily work', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.goto('/daily-work');

    const locked = page.getByText(/not open yet|opens at|locked/i);
    const open = page.getByRole('textbox').or(page.locator('[contenteditable="true"]'));
    const submitted = page.getByText(/submitted|show less|view/i);

    await expect(locked.or(open).or(submitted).first()).toBeVisible({ timeout: 15_000 });
  });
});
