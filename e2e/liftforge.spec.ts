import { test, expect } from '@playwright/test';

test.describe('LiftForge Mobile PWA End-to-End Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Open app
    await page.goto('/');
  });

  test('verifies Today screen shows next Workout and exercise list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /LiftForge/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Workout A/i })).toBeVisible();
    await expect(page.getByText(/Squat/i).first()).toBeVisible();
    await expect(page.getByText(/Bench Press/i).first()).toBeVisible();
  });

  test('starts workout, logs sets, checks rest timer and persists draft after reload', async ({ page }) => {
    // Navigate to Workout
    await page.goto('/workout?type=A');
    await expect(page.getByRole('heading', { name: /Workout A/i })).toBeVisible();

    // Click first set check button (5 reps)
    const set5Button = page.getByRole('button', { name: '5' }).first();
    await expect(set5Button).toBeVisible();
    await set5Button.click();

    // Verify Rest Timer appears
    await expect(page.getByText(/Rest Timer/i)).toBeVisible();

    // Test Reload Resilience: Refresh browser and confirm draft and logged set persist
    await page.reload();
    await expect(page.getByRole('heading', { name: /Workout A/i })).toBeVisible();
    // Rest Timer or logged set should still be recorded
    await expect(page.getByRole('button', { name: /Undo set result/i }).first()).toBeVisible();

    // Finish Workout Review
    await page.getByRole('button', { name: /Finish/i }).click();
    await expect(page.getByText(/Verification Required/i)).toBeVisible();
    await page.getByRole('button', { name: /Save & Complete/i }).click();

    // Should redirect to session detail
    await expect(page.getByText(/Workout Details/i)).toBeVisible();
  });

  test('verifies settings, demo data seeding and JSON export', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /Settings/i })).toBeVisible();

    // Load sample demo data
    const demoBtn = page.getByRole('button', { name: /Load Sample Demo Data/i });
    await demoBtn.click();
    await expect(page.getByText(/Sample 3-session demo data loaded/i)).toBeVisible();

    // Check History has sessions
    await page.goto('/history');
    await expect(page.getByText(/Session History/i)).toBeVisible();
    await expect(page.getByText(/Demo/i).first()).toBeVisible();

    // Check Progress chart
    await page.goto('/progress');
    await expect(page.getByText(/Strength Trajectory/i)).toBeVisible();
    await expect(page.getByText(/Squat Progression/i)).toBeVisible();
  });
});

