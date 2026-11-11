import { test } from '@playwright/test';

test('take screenshots of all LiftForge mobile screens', async ({ page }) => {
  // 1. Today Screen
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/01-today-screen.png' });

  // 2. Active Workout Screen
  await page.goto('/workout?type=A');
  await page.waitForLoadState('networkidle');
  // Complete one set to trigger Rest Timer
  const set5Button = page.getByRole('button', { name: '5' }).first();
  await set5Button.click();
  await page.screenshot({ path: 'screenshots/02-active-workout.png' });

  // 3. Settings Screen with Demo data seeded
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Load Sample Demo Data/i }).click();
  await page.screenshot({ path: 'screenshots/03-settings-screen.png' });

  // 4. History Screen
  await page.goto('/history');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/04-history-screen.png' });

  // 5. Progress Analytics Screen
  await page.goto('/progress');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'screenshots/05-progress-charts.png' });
});
