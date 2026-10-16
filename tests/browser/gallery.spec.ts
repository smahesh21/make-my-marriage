import { expect, test } from "@playwright/test";
import { photoFixtures } from "../fixtures/photos";
import { galleryHarness, gate, openUploader } from "./gallery-harness";

for (const role of ["ADMIN", "MANAGER"] as const) {
  test(`${role}: upload, reload, filter, download and confirmed deletion`, async ({
    page,
  }) => {
    const state = await galleryHarness(page, role);
    await expect(page.locator(".workspace-topbar")).toContainText(
      `${role} workspace`,
    );
    const dialog = await openUploader(page);
    await dialog
      .getByLabel("Assign to wedding event (optional)")
      .selectOption("aaaaaaaaaaaaaaaaaaaaaaaa");
    await dialog
      .getByLabel("Choose photo files")
      .setInputFiles(photoFixtures().valid);
    await dialog
      .getByRole("button", { name: "Upload photos", exact: true })
      .click();
    await expect(dialog.getByText("1 of 1 saved to gallery")).toBeVisible();
    await dialog
      .getByRole("button", { name: "Done / View in gallery" })
      .click();
    await page.reload();
    await page
      .getByRole("button", { name: "Wedding Memories", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "No photos in this collection yet" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "QA Ceremony", exact: true })
      .click();
    await page.getByRole("button", { name: "View memory.png" }).click();
    await expect(
      page.getByRole("dialog").getByRole("img", { name: "memory.png" }),
    ).toHaveJSProperty("naturalWidth", 1);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download original" }).click();
    expect((await download).suggestedFilename()).toBe("memory.png");
    await page.getByRole("button", { name: "Delete this photo" }).click();
    await page.getByRole("button", { name: "Keep photo" }).click();
    expect(state.deletions).toBe(0);
    await page.getByRole("button", { name: "Delete this photo" }).click();
    state.deleteFailures = 1;
    await page
      .getByRole("button", { name: "Delete photo", exact: true })
      .click();
    await expect(
      page.getByRole("alertdialog").getByRole("alert"),
    ).toContainText("Synthetic failure");
    expect(state.photos).toHaveLength(1);
    await page
      .getByRole("button", { name: "Delete photo", exact: true })
      .click();
    await expect(
      page.getByText("Photo deleted.", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "View memory.png" }),
    ).toHaveCount(0);
    expect(state.photos).toHaveLength(0);
    expect(state.unexpected).toEqual([]);
  });
}

test("rejects actual oversized, empty, unsupported and MIME/extension mismatch files before network", async ({
  page,
}) => {
  const state = await galleryHarness(page);
  const dialog = await openUploader(page);
  const fixtures = photoFixtures();
  await dialog
    .getByLabel("Choose photo files")
    .setInputFiles([
      fixtures.oversized,
      fixtures.empty,
      fixtures.mismatch,
      fixtures.unsupported,
    ]);
  await expect(dialog.getByRole("alert")).toHaveCount(4);
  await expect(
    dialog.getByRole("button", { name: "Upload photos", exact: true }),
  ).toHaveCount(0);
  expect(state.reservations).toBe(0);
  expect(state.puts).toBe(0);
  expect(state.unexpected).toEqual([]);
});

test("shows progress/finalization and retries confirmation without reuploading or duplicating", async ({
  page,
}) => {
  const state = await galleryHarness(page);
  const dialog = await openUploader(page);
  state.putGate = gate();
  state.confirmGate = gate();
  state.confirmationFailures = 1;
  await dialog
    .getByLabel("Choose photo files")
    .setInputFiles(photoFixtures().valid);
  await dialog
    .getByRole("button", { name: "Upload photos", exact: true })
    .click();
  await expect(
    dialog.getByRole("progressbar", { name: "Upload progress for memory.png" }),
  ).toBeVisible();
  state.putGate.release();
  await expect(dialog.getByText(/Finalizing/)).toBeVisible();
  await expect(dialog.getByRole("progressbar")).toHaveAttribute("value", "100");
  state.confirmGate.release();
  await expect(dialog.getByRole("alert")).toContainText("Synthetic failure");
  await dialog.getByRole("button", { name: "Retry memory.png" }).click();
  await expect(dialog.getByText("1 of 1 saved to gallery")).toBeVisible();
  expect([
    state.puts,
    state.reservations,
    state.confirmations,
    state.photos.length,
  ]).toEqual([1, 1, 2, 1]);
});

test("retries a failed storage PUT, and accepts separately selected duplicate content", async ({
  page,
}) => {
  const state = await galleryHarness(page);
  state.putFailures = 1;
  const dialog = await openUploader(page);
  const fixtures = photoFixtures();
  await dialog
    .getByLabel("Choose photo files")
    .setInputFiles([fixtures.valid, fixtures.duplicate]);
  await dialog
    .getByRole("button", { name: "Upload photos", exact: true })
    .click();
  await expect(dialog.getByText("1 of 2 saved to gallery")).toBeVisible();
  await dialog.getByRole("button", { name: "Retry memory.png" }).click();
  await expect(dialog.getByText("2 of 2 saved to gallery")).toBeVisible();
  expect([state.reservations, state.puts, state.photos.length]).toEqual([
    2, 3, 2,
  ]);
});

test("discards in-flight uploads without confirming or showing a saved photo", async ({
  page,
}) => {
  const state = await galleryHarness(page);
  state.putGate = gate();
  const dialog = await openUploader(page);
  await dialog
    .getByLabel("Choose photo files")
    .setInputFiles(photoFixtures().valid);
  await dialog
    .getByRole("button", { name: "Upload photos", exact: true })
    .click();
  await expect.poll(() => state.puts).toBe(1);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.getByRole("button", { name: "Keep uploading" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.getByRole("button", { name: "Discard unsaved photos" }).click();
  state.putGate.release();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A place for every wedding memory" }),
  ).toBeVisible();
  expect(state.confirmations).toBe(0);
});

test("rejects corrupt image publication, then removes the bad selection safely", async ({
  page,
}) => {
  const state = await galleryHarness(page);
  const dialog = await openUploader(page);
  await dialog
    .getByLabel("Choose photo files")
    .setInputFiles(photoFixtures().corrupt);
  await dialog
    .getByRole("button", { name: "Upload photos", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Synthetic failure");
  expect(state.photos).toHaveLength(0);
  await dialog.getByRole("button", { name: "Remove corrupt.png" }).click();
  await expect(dialog.getByText("Queue (0 photos)")).toBeVisible();
});

test("gallery load failure can be retried, and expired sessions can recover", async ({
  page,
}) => {
  const state = await galleryHarness(page);
  state.listFailures = 1;
  await page.reload();
  await expect(page.locator(".photo-error")).toContainText("Synthetic failure");
  await page
    .getByRole("button", { name: "Refresh gallery", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A place for every wedding memory" }),
  ).toBeVisible();
  state.signedIn = false;
  const dialog = await openUploader(page);
  await dialog
    .getByLabel("Choose photo files")
    .setInputFiles(photoFixtures().valid);
  await dialog
    .getByRole("button", { name: "Upload photos", exact: true })
    .click();
  await expect(
    dialog.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(state.reservations).toBe(0);
  state.signedIn = true;
  await dialog
    .getByRole("button", { name: "Upload photos", exact: true })
    .click();
  await expect(dialog.getByText("1 of 1 saved to gallery")).toBeVisible();
});

test("missing staging upload retries the bytes, not just confirmation", async ({
  page,
}) => {
  const state = await galleryHarness(page);
  state.missingUploads = 1;
  const dialog = await openUploader(page);
  await dialog
    .getByLabel("Choose photo files")
    .setInputFiles(photoFixtures().valid);
  await dialog
    .getByRole("button", { name: "Upload photos", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Retry memory.png" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Retry memory.png" }).click();
  await expect(dialog.getByText("1 of 1 saved to gallery")).toBeVisible();
  expect([
    state.reservations,
    state.puts,
    state.confirmations,
    state.photos.length,
  ]).toEqual([1, 2, 2, 1]);
});

test("network interruption displays recovery without replaying mutations", async ({
  page,
}) => {
  const state = await galleryHarness(page);
  state.listNetworkFailures = 1;
  await page.reload();
  await expect(page.locator(".photo-error")).toContainText("Unable to connect");
  await page
    .getByRole("button", { name: "Refresh gallery", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A place for every wedding memory" }),
  ).toBeVisible();
  expect(
    state.reservations + state.puts + state.confirmations + state.deletions,
  ).toBe(0);
});

test("desktop columns do not overlap, and mobile controls fit the viewport", async ({
  page,
}) => {
  await galleryHarness(page);
  await expect(
    page.getByText("A calm place for the details that matter.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  const sidebar = await page
    .getByRole("complementary", { name: "Wedding workspace navigation" })
    .boundingBox();
  const content = await page.locator(".workspace-main").boundingBox();
  expect(sidebar).not.toBeNull();
  expect(content!.x).toBeGreaterThanOrEqual(sidebar!.x + sidebar!.width - 1);
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = await openUploader(page);
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
