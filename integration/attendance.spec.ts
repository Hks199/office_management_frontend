import { test, expect, type Page } from '@playwright/test';

test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
});
const storage = 'https://frontend-fixture.s3.ap-south-1.amazonaws.com/';
test('shows the GPS popup immediately on every attendance attempt before requesting location', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera', 'geolocation']);
  await context.setGeolocation({ latitude: 22.57, longitude: 88.36, accuracy: 5 });
  await page.addInitScript(() => {
    const state = window as unknown as { gpsRequestCount: number };
    state.gpsRequestCount = 0;
    const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    navigator.geolocation.getCurrentPosition = (...args) => {
      state.gpsRequestCount++;
      original(...args);
    };
  });
  await login(page);
  const mark = page.getByRole('dialog', { name: 'Mark attendance', exact: true });
  await mark.getByRole('button', { name: 'Check in', exact: true }).click();
  const popup = page.getByRole('dialog', { name: 'Turn on GPS', exact: true });
  await expect(popup).toBeVisible();
  await expect(
    popup.getByRole('button', { name: 'Enable GPS and continue', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { gpsRequestCount: number }).gpsRequestCount),
  ).toBe(0);
  await popup.screenshot({ path: 'artifacts/gps-popup-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    popup.getByRole('button', { name: 'Enable GPS and continue', exact: true }),
  ).toBeInViewport();
  await popup.screenshot({ path: 'artifacts/gps-popup-mobile.png' });
  await popup.getByRole('button', { name: 'Enable GPS and continue', exact: true }).click();
  await expect(mark.getByRole('button', { name: 'Capture photo', exact: true })).toBeEnabled();
  expect(
    await page.evaluate(() => (window as unknown as { gpsRequestCount: number }).gpsRequestCount),
  ).toBe(1);
  await mark.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Mark attendance', exact: true }).click();
  await mark.getByRole('button', { name: 'Check in', exact: true }).click();
  await expect(popup).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { gpsRequestCount: number }).gpsRequestCount),
  ).toBe(1);
  await popup.getByRole('button', { name: 'Cancel', exact: true }).click();
});
async function login(page: Page, email = 'fixture4@frontend-test.invalid') {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  const response = page.waitForResponse((response) => response.url().endsWith('/auth/login'));
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const payload = (await (await response).json()) as { data: { accessToken: string } };
  await page.getByRole('link', { name: 'Attendance', exact: true }).click();
  await page.getByRole('button', { name: 'Mark attendance', exact: true }).click();
  return payload.data.accessToken;
}
async function startAttendance(page: Page, action: 'Check in' | 'Check out') {
  await page
    .getByRole('dialog', { name: 'Mark attendance' })
    .getByRole('button', { name: action, exact: true })
    .click();
  const popup = page.getByRole('dialog', { name: 'Turn on GPS', exact: true });
  await expect(popup).toBeVisible();
  await popup.getByRole('button', { name: 'Enable GPS and continue', exact: true }).click();
}
async function capture(page: Page) {
  const modal = page.getByRole('dialog', { name: 'Mark attendance' });
  await expect(modal.getByRole('button', { name: 'Capture photo', exact: true })).toBeEnabled();
  await modal.getByRole('button', { name: 'Capture photo', exact: true }).click();
  await expect(modal.getByAltText('Your captured attendance photo')).toBeVisible();
}

test('captures camera evidence, uploads privately, and persists current GPS for check-in and checkout', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera', 'geolocation']);
  await context.setGeolocation({ latitude: 22.572645, longitude: 88.363892, accuracy: 8 });
  const token = await login(page, 'manager@frontend-test.invalid');
  const uploads: string[] = [];
  await page.route(storage, async (route) => {
    const headers = route.request().headers();
    expect(headers.authorization).toBeUndefined();
    expect(headers.cookie).toBeUndefined();
    expect(headers['content-type']).toContain('multipart/form-data');
    const body = route.request().postDataBuffer()!;
    expect(body.includes(Buffer.from('filename="attendance-photo.jpg"'))).toBe(true);
    expect(body.includes(Buffer.from([255, 216, 255]))).toBe(true);
    uploads.push(body.toString('latin1'));
    await route.fulfill({
      status: 204,
      headers: { 'access-control-allow-origin': 'http://localhost:5183' },
    });
  });
  const modal = page.getByRole('dialog', { name: 'Mark attendance' });
  await expect(modal.getByRole('button', { name: 'Check out', exact: true })).toHaveCount(0);
  await expect(modal.getByRole('combobox')).toHaveCount(0);
  await expect(modal.getByRole('region', { name: 'Camera photo' })).toHaveCount(0);
  await startAttendance(page, 'Check in');
  await expect(
    modal.getByRole('region', { name: 'GPS location' }).getByRole('status'),
  ).toContainText('Latitude 22.572645');
  await capture(page);
  // GPS changes after the initial permission step must be reflected in the saved record.
  await context.setGeolocation({ latitude: 22.573, longitude: 88.364, accuracy: 6 });
  const checkIn = page.waitForResponse((response) =>
    response.url().endsWith('/attendance/check-in'),
  );
  await modal.getByRole('button', { name: 'Confirm check in', exact: true }).click();
  const marked = await checkIn;
  expect(marked.status()).toBe(201);
  const record = (await marked.json()) as {
    data: {
      _id: string;
      checkInPhotoFileId: string;
      checkInCapturedAt: string;
      checkInLocation: unknown;
    };
  };
  expect(record.data.checkInLocation).toEqual({
    latitude: 22.573,
    longitude: 88.364,
    accuracyMeters: 6,
  });
  expect(record.data.checkInPhotoFileId).toMatch(/^[a-f0-9]{24}$/);
  expect(Date.parse(record.data.checkInCapturedAt)).toBeLessThanOrEqual(Date.now());
  await expect(modal).not.toBeVisible();
  const headers = { Authorization: 'Bearer ' + token };
  const saved = (await (await page.request.get('/api/v1/attendance/me', { headers })).json()) as {
    data: { _id: string; checkInLocation: unknown }[];
  };
  expect(saved.data.find((entry) => entry._id === record.data._id)?.checkInLocation).toEqual(
    record.data.checkInLocation,
  );
  expect(
    (
      await page.request.get('/api/v1/attendance/' + record.data._id + '/photos/check-in', {
        headers,
      })
    ).status(),
  ).toBe(200);

  await page.getByRole('button', { name: 'Mark attendance', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Check in', exact: true })).toHaveCount(0);
  await startAttendance(page, 'Check out');
  await capture(page);
  const checkOut = page.waitForResponse((response) =>
    response.url().endsWith('/attendance/check-out'),
  );
  await modal.getByRole('button', { name: 'Confirm check out', exact: true }).click();
  expect((await checkOut).status()).toBe(200);
  const completed = (await (await checkOut).json()) as {
    data: { status: string; checkOutPhotoFileId: string; checkOutLocation: unknown };
  };
  expect(completed.data.status).toBe('COMPLETED');
  expect(completed.data.checkOutPhotoFileId).not.toBe(record.data.checkInPhotoFileId);
  expect(completed.data.checkOutLocation).toEqual(record.data.checkInLocation);
  expect(uploads).toHaveLength(2);
  await expect(modal).not.toBeVisible();
  await page.getByRole('button', { name: 'Mark attendance', exact: true }).click();
  await expect(modal.getByRole('status')).toHaveText('You have completed attendance for today.');
  await expect(modal.getByRole('button', { name: /^Check (in|out)$/ })).toHaveCount(0);
});

test('requires GPS before requesting camera permission and blocks incomplete attendance', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 22.57, longitude: 88.36, accuracy: 5 });
  await page.addInitScript(() => {
    const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    let first = true;
    navigator.geolocation.getCurrentPosition = (success, failure, options) => {
      if (first) {
        first = false;
        failure?.({
          code: 1,
          message: 'Denied',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      } else original(success, failure, options);
    };
    const state = window as unknown as { attendanceCameraRequests: number };
    state.attendanceCameraRequests = 0;
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: () => {
        state.attendanceCameraRequests++;
        return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
      },
    });
  });
  let submitted = false;
  page.on('request', (request) => {
    if (/\/attendance\/check-in$/.test(request.url())) submitted = true;
  });
  await login(page);
  const modal = page.getByRole('dialog', { name: 'Mark attendance' });
  await startAttendance(page, 'Check in');
  await expect(
    page.getByRole('dialog', { name: 'Turn on GPS', exact: true }).getByRole('alert'),
  ).toContainText('Location permission was denied');
  expect(
    await page.evaluate(
      () => (window as unknown as { attendanceCameraRequests: number }).attendanceCameraRequests,
    ),
  ).toBe(0);
  await expect(modal.getByRole('region', { name: 'Camera photo' })).toHaveCount(0);
  await page
    .getByRole('dialog', { name: 'Turn on GPS', exact: true })
    .getByRole('button', { name: 'Enable GPS and continue', exact: true })
    .click();
  await expect(
    modal.getByRole('region', { name: 'Camera photo' }).getByRole('alert'),
  ).toContainText('Camera permission was denied');
  expect(
    await page.evaluate(
      () => (window as unknown as { attendanceCameraRequests: number }).attendanceCameraRequests,
    ),
  ).toBe(1);
  await expect(modal.getByRole('button', { name: 'Confirm check in', exact: true })).toBeDisabled();
  expect(submitted).toBe(false);
});

test('turns the camera off when the attendance dialog closes', async ({ page, context }) => {
  await context.grantPermissions(['camera', 'geolocation']);
  await context.setGeolocation({ latitude: 22.57, longitude: 88.36, accuracy: 5 });
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const state = window as unknown as { attendanceTestStream?: MediaStream };
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      state.attendanceTestStream = await original(constraints);
      return state.attendanceTestStream;
    };
  });
  await login(page);
  const modal = page.getByRole('dialog', { name: 'Mark attendance' });
  await startAttendance(page, 'Check in');
  await expect(modal.getByRole('button', { name: 'Capture photo', exact: true })).toBeEnabled();
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(
    await page.evaluate(() =>
      (window as unknown as { attendanceTestStream: MediaStream }).attendanceTestStream
        .getTracks()
        .every((track) => track.readyState === 'ended'),
    ),
  ).toBe(true);
});

test('keeps prompting while GPS is off and checks again after returning from settings', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera', 'geolocation']);
  await context.setGeolocation({ latitude: 22.57, longitude: 88.36, accuracy: 5 });
  await page.addInitScript(() => {
    const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    let attempts = 0;
    navigator.geolocation.getCurrentPosition = (success, failure, options) => {
      attempts++;
      if (attempts <= 2) {
        failure?.({
          code: 2,
          message: 'Device GPS is off',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      } else original(success, failure, options);
    };
  });
  await login(page);
  const modal = page.getByRole('dialog', { name: 'Mark attendance' });
  await startAttendance(page, 'Check in');
  await expect(
    page.getByRole('dialog', { name: 'Turn on GPS', exact: true }).getByRole('alert'),
  ).toContainText('Turn on device location services');
  await expect(
    page
      .getByRole('dialog', { name: 'Turn on GPS', exact: true })
      .getByRole('heading', { name: 'Turn on GPS to continue', exact: true }),
  ).toBeVisible();
  await expect(modal.getByRole('region', { name: 'Camera photo' })).toHaveCount(0);
  await expect(modal.getByRole('button', { name: 'Confirm check in', exact: true })).toHaveCount(0);
  await page
    .getByRole('dialog', { name: 'Turn on GPS', exact: true })
    .getByRole('button', { name: 'Enable GPS and continue', exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog', { name: 'Turn on GPS', exact: true })
      .getByRole('heading', { name: 'Turn on GPS to continue', exact: true }),
  ).toBeVisible();
  await expect(modal.getByRole('region', { name: 'Camera photo' })).toHaveCount(0);
  await page
    .getByRole('dialog', { name: 'Turn on GPS', exact: true })
    .getByText('How to enable GPS', { exact: true })
    .click();
  await expect(
    page
      .getByRole('dialog', { name: 'Turn on GPS', exact: true })
      .getByText('Open your device settings and turn on Location / Location Services.', {
        exact: true,
      }),
  ).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    modal.getByRole('region', { name: 'GPS location' }).getByRole('status'),
  ).toContainText('GPS ready');
  await capture(page);
  await expect(modal.getByRole('button', { name: 'Confirm check in', exact: true })).toBeEnabled();
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('requires GPS again if location becomes unavailable while confirming attendance', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['camera', 'geolocation']);
  await context.setGeolocation({ latitude: 22.57, longitude: 88.36, accuracy: 5 });
  await page.addInitScript(() => {
    const original = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    let attempts = 0;
    navigator.geolocation.getCurrentPosition = (success, failure, options) => {
      attempts++;
      if (attempts === 2)
        failure?.({
          code: 2,
          message: 'Device GPS is off',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      else original(success, failure, options);
    };
  });
  let uploaded = false;
  page.on('request', (request) => {
    if (request.url().endsWith('/files/upload-intents')) uploaded = true;
  });
  await login(page);
  const modal = page.getByRole('dialog', { name: 'Mark attendance' });
  await startAttendance(page, 'Check in');
  await capture(page);
  await modal.getByRole('button', { name: 'Confirm check in', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Turn on GPS', exact: true })
      .getByRole('heading', { name: 'Turn on GPS to continue', exact: true }),
  ).toBeVisible();
  await expect(modal.getByRole('region', { name: 'Camera photo' })).toHaveCount(0);
  expect(uploaded).toBe(false);
  await expect(modal.getByRole('button', { name: 'Confirm check in', exact: true })).toHaveCount(0);
  await page
    .getByRole('dialog', { name: 'Turn on GPS', exact: true })
    .getByRole('button', { name: 'Enable GPS and continue', exact: true })
    .click();
  await capture(page);
  await expect(modal.getByRole('button', { name: 'Confirm check in', exact: true })).toBeEnabled();
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
});

test('does not offer attendance actions when the current backend status cannot be loaded', async ({
  page,
}) => {
  await page.route('**/api/v1/attendance/me/status', (route) =>
    route.fulfill({
      status: 503,
      json: {
        success: false,
        message: 'Attendance status is unavailable',
        error: { code: 'UNAVAILABLE' },
      },
    }),
  );
  await login(page);
  const modal = page.getByRole('dialog', { name: 'Mark attendance' });
  await expect(modal.getByRole('alert')).toContainText(
    'The server could not complete your request. Please try again.',
  );
  await expect(modal.getByRole('button', { name: /^Check (in|out)$/ })).toHaveCount(0);
  await page.unroute('**/api/v1/attendance/me/status');
  await modal.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Check in', exact: true })).toBeEnabled();
});
