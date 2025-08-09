import { test, expect } from '@playwright/test';

test('app loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('フォト三択：ほんとかフェイクか')).toBeVisible();
});


