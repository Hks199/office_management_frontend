// Isolated integration fixture server. Never reads the backend's .env or application database.
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
const backend = resolve(process.env.SUNVIKA_BACKEND_PATH || '../office_management_backend');
const requireBackend = createRequire(join(backend, 'package.json'));
const { register } = await import(
  pathToFileURL(join(backend, 'node_modules/tsx/dist/esm/api/index.mjs')).href
);
register({ tsconfig: join(backend, 'tsconfig.json') });
const source = (path) => import(pathToFileURL(join(backend, 'src', path)).href);
const { MongoMemoryReplSet } = requireBackend('mongodb-memory-server');
const mongoose = requireBackend('mongoose');
let replica, server, commercialWorker;
async function stop() {
  await commercialWorker?.stop();
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  await mongoose.disconnect();
  await replica?.stop();
}
process.once('SIGINT', () => void stop().finally(() => process.exit(0)));
process.once('SIGTERM', () => void stop().finally(() => process.exit(0)));
try {
  console.log('Starting temporary MongoDB replica set…');
  replica = await MongoMemoryReplSet.create({
    binary: { version: process.env.FRONTEND_TEST_MONGO_VERSION || '8.2.3' },
    replSet: { count: 1 },
  });
  const uri = replica.getUri(`frontend_integration_${randomBytes(6).toString('hex')}`);
  if (!uri.startsWith('mongodb://127.0.0.1:'))
    throw new Error('Temporary database is not loopback-only.');
  const { loadConfig } = await source('config/env.ts');
  const config = loadConfig({
    NODE_ENV: 'test',
    MONGODB_URI: uri,
    LOG_LEVEL: 'silent',
    JWT_SECRET: randomBytes(48).toString('base64url'),
    TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    CORS_ORIGINS: 'http://localhost:5173,http://localhost:5183',
    CREDENTIAL_UI_ORIGIN: 'http://localhost:5183',
    AWS_REGION: 'ap-south-1',
    S3_BUCKET: 'frontend-fixture',
  });
  config.rateLimitMax = 100000;
  const { createLogger } = await source('config/logger.ts');
  const logger = createLogger(config);
  const { connectDatabase } = await source('config/database.ts');
  await connectDatabase(config, logger);
  console.log('Temporary database connected; preparing isolated fixtures…');
  for (const [path, name] of [
    ['modules/auth/identity-indexes.ts', 'createIdentityIndexes'],
    ['modules/hierarchy/organization-indexes.ts', 'createOrganizationIndexes'],
    ['modules/attendance/attendance-indexes.ts', 'createAttendanceIndexes'],
    ['modules/leads/commercial-indexes.ts', 'createCommercialIndexes'],
    ['modules/reports/report-indexes.ts', 'createReportIndexes'],
    ['modules/targets/target-indexes.ts', 'createTargetIndexes'],
    ['modules/dashboards/dashboard-indexes.ts', 'createDashboardIndexes'],
  ])
    await (await source(path))[name]();
  const { bootstrapMd } = await source('modules/auth/bootstrap.service.ts');
  const md = await bootstrapMd(
    {
      employeeCode: 'TEST-MD',
      firstName: 'Integration',
      lastName: 'Manager',
      email: 'manager@frontend-test.invalid',
      mobileNumber: '+919000000001',
    },
    config.tokenEncryptionKey,
  );
  const { UserModel } = await source('modules/users/user.model.ts');
  const { RoleModel } = await source('modules/roles/role.model.ts');
  const { hashPassword } = await source('shared/utils/crypto.ts');
  // Test-only credentials; fixtures never enter the production bundle or an application database.
  const passwordHash = await hashPassword('Frontend integration passphrase 2026!');
  await UserModel.updateOne({ _id: md }, { $set: { passwordHash } });
  const { StateModel, DistrictModel } = await source('modules/locations/location.model.ts');
  const state = await StateModel.create({ name: 'Integration State', code: 'TEST', createdBy: md });
  const district = await DistrictModel.create({
    name: 'Integration District',
    code: 'TEST',
    stateId: state._id,
    createdBy: md,
  });
  const { BranchModel } = await source('modules/branches/branch.model.ts');
  const branch = await BranchModel.create({
    branchName: 'Integration Branch',
    branchCode: 'TEST',
    address: 'Isolated integration office',
    contactNumber: '+919000000002',
    stateId: state._id,
    districtId: district._id,
    createdBy: md,
  });
  async function employee(code, number, branchId = branch._id, reportingManagerId = md) {
    const role = await RoleModel.findOne({ code });
    return UserModel.create({
      employeeCode: `TEST-${number}`,
      firstName: code === 'TC' ? 'Caller' : 'Sales',
      lastName: `Fixture ${number}`,
      email: `fixture${number}@frontend-test.invalid`,
      mobileNumber: `+91900000000${number}`,
      passwordHash,
      roleId: role._id,
      branchId,
      reportingManagerId,
      createdBy: md,
      dateOfJoining: new Date('2026-01-01'),
    });
  }
  const caller = await employee('TC', 3);
  const sales = await employee('SEX', 4);
  const recipient = await employee('SEX', 5);
  await employee('BH', 6);
  const initialBdo = await employee('BDO', 7);
  await UserModel.updateOne({ _id: initialBdo._id }, { $set: { branchId: null } });
  const initialMh = await employee('MH', 8);
  await UserModel.updateOne({ _id: initialMh._id }, { $set: { branchId: null } });
  const receivingDistrict = await DistrictModel.create({
    name: 'Destination District',
    code: 'DEST',
    stateId: state._id,
    createdBy: md,
  });
  const receivingBranch = await BranchModel.create({
    branchName: 'Destination Branch',
    branchCode: 'DEST',
    address: 'Destination district office',
    contactNumber: '+919000000020',
    stateId: state._id,
    districtId: receivingDistrict._id,
    createdBy: md,
  });
  const receivingHead = await employee('BH', 10, receivingBranch._id, initialMh._id);
  await BranchModel.updateOne(
    { _id: receivingBranch._id },
    { $set: { branchHeadId: receivingHead._id } },
  );
  await employee('SEX', 11, receivingBranch._id, receivingHead._id);
  await employee('SEX', 12, receivingBranch._id, receivingHead._id);
  const { RolePolicyModel } = await source('modules/roles/role-policy.model.ts');
  const creatorRole = await RoleModel.create({
    name: 'Integration Creator',
    code: 'TEST_CREATOR',
    createdBy: md,
  });
  const targetRole = await RoleModel.create({
    name: 'Integration Target',
    code: 'TEST_TARGET',
    createdBy: md,
  });
  await RolePolicyModel.create({
    creatorRoleId: creatorRole._id,
    targetRoleId: targetRole._id,
    allowedManagerRoleIds: [creatorRole._id],
    branchRule: 'SAME_BRANCH',
    isActive: true,
    createdBy: md,
    creatorRoleRevision: 0,
    targetRoleRevision: 0,
  });
  const {
    LeadModel,
    LeadEventModel,
    ProposalModel,
    CustomerModel,
    AssignmentModel,
    ReferenceModel,
  } = await source('modules/leads/commercial.models.ts');
  await ReferenceModel.insertMany([
    { category: 'PAYMENT_MODE', code: 'BANK', label: 'Integration bank transfer', createdBy: md },
    {
      category: 'PANEL_BRAND',
      code: 'TEST_BRAND',
      label: 'Integration panel brand',
      createdBy: md,
    },
    {
      category: 'PANEL_TECHNOLOGY',
      code: 'TEST_TECH',
      label: 'Integration panel technology',
      createdBy: md,
    },
    { category: 'LEAD_SOURCE', code: 'WEB', label: 'Integration website enquiry', createdBy: md },
  ]);
  const lead = await LeadModel.create({
    leadCode: 'TEST-LEAD',
    customerName: 'Integration Lead',
    mobileNumber: '+919000000006',
    siteAddress: 'Integration contact site',
    stateId: state._id,
    districtId: district._id,
    branchId: branch._id,
    requiredCapacityKw: '5.00',
    ratePerKw: '40000.00',
    estimatedProjectValue: '200000.00',
    paymentMode: 'BANK',
    panelBrand: 'TEST',
    panelTechnology: 'TEST',
    leadSource: 'WEB',
    workflowVersion: 1,
    createdBy: md,
    assignedTo: sales._id,
    assignedBy: md,
  });
  const reportingSales = await employee('SEX', 9);
  await LeadModel.create({
    ...lead.toObject(),
    _id: new mongoose.Types.ObjectId(),
    leadCode: 'DAILY-REPORT-LEAD',
    customerName: 'Daily Reporting Contact',
    mobileNumber: '+919000000008',
    assignedTo: reportingSales._id,
    status: 'SITE_VISIT_SCHEDULED',
  });
  await LeadEventModel.create({
    leadId: lead._id,
    toStatus: 'NEW',
    actorId: md,
    workflowVersion: 1,
    leadRevision: 0,
  });
  await ProposalModel.create({
    leadId: lead._id,
    proposedTo: recipient._id,
    proposedBy: md,
    leadRevision: 0,
    reason: 'Integration proposal',
    expiresAt: new Date(Date.now() + 86400000),
  });
  const customer = await CustomerModel.create({
    customerName: 'Integration Contact',
    mobileNumber: '+919000000007',
    siteAddress: 'Integration contact site',
    stateId: state._id,
    districtId: district._id,
    branchId: branch._id,
    dedupeKey: 'test-contact',
    importId: new mongoose.Types.ObjectId(),
    importRow: 1,
    createdBy: md,
    assignedTo: caller._id,
    assignedBy: md,
    assignedAt: new Date(),
  });
  await CustomerModel.create({
    ...customer.toObject(),
    _id: new mongoose.Types.ObjectId(),
    customerName: 'Branch Routing Contact',
    mobileNumber: '+919000000022',
    siteAddress: 'Site served by Destination Branch',
    dedupeKey: 'branch-routing-contact',
    importRow: 2,
  });
  await AssignmentModel.create({
    entityId: customer._id,
    entityType: 'CUSTOMER',
    assignedTo: caller._id,
    assignedBy: md,
    reason: 'Integration assignment',
    entityRevision: 0,
  });
  const { businessDate } = await source('shared/utils/business-date.ts');
  const day = businessDate();
  const now = new Date();
  const { ReportModel } = await source('modules/reports/report.model.ts');
  await ReportModel.create({
    kind: 'CALL',
    employeeId: caller._id,
    branchId: branch._id,
    customerId: customer._id,
    businessDate: day,
    idempotencyKey: 'integration-call-key',
    requestHash: 'integration-hash',
    customerName: 'Integration Contact',
    customerMobile: '+919000000007',
    siteAddress: 'Integration contact site',
    callStartedAt: new Date(now.getTime() - 120000),
    callEndedAt: new Date(now.getTime() - 60000),
    callDurationSeconds: 60,
    callOutcome: 'CONNECTED',
    status: 'SUBMITTED',
    reviewStatus: 'APPROVED',
  });
  const { TargetModel } = await source('modules/targets/target.model.ts');
  await TargetModel.create({
    employeeId: caller._id,
    branchId: branch._id,
    targetType: 'CALLS_COMPLETED',
    targetValue: '5.00',
    periodType: 'CUSTOM',
    startDate: new Date(`${day}T00:00:00+05:30`),
    endDate: new Date(Date.parse(`${day}T00:00:00+05:30`) + 7 * 86400000),
    assignedBy: md,
  });
  const { AttendanceModel } = await source('modules/attendance/attendance.model.ts');
  const { defaultAttendancePolicy } = await source('modules/attendance/attendance-policy.ts');
  const { FileModel } = await source('modules/files/file.model.ts');
  const attendanceId = new mongoose.Types.ObjectId();
  const photoId = new mongoose.Types.ObjectId();
  await AttendanceModel.create({
    _id: attendanceId,
    employeeId: caller._id,
    branchId: branch._id,
    attendanceDate: day,
    checkInAt: now,
    effectiveCheckInAt: now,
    checkInCapturedAt: now,
    checkInPhotoFileId: photoId,
    checkInLocation: { latitude: 22, longitude: 88, accuracyMeters: 10 },
    policySnapshot: defaultAttendancePolicy,
    lateArrival: false,
  });
  await FileModel.create({
    _id: photoId,
    ownerId: caller._id,
    purpose: 'ATTENDANCE_CHECK_IN',
    bucket: 'integration',
    objectKey: 'integration-photo',
    contentType: 'image/png',
    size: 68,
    checksumSHA256: 'test-checksum',
    versionId: 'integration-version',
    status: 'ATTACHED',
    attendanceId,
    expiresAt: new Date(Date.now() + 86400000),
  });
  const { createApp } = await source('app.ts');
  const photoStorage = {
    download: async () => 'https://frontend-fixture.s3.ap-south-1.amazonaws.com/evidence.png',
    // Browser tests intercept this test-only destination; no AWS connection is made.
    upload: async (photo) => ({
      url: 'https://frontend-fixture.s3.ap-south-1.amazonaws.com/',
      fields: {
        key: photo.objectKey,
        'Content-Type': photo.contentType,
        'x-amz-checksum-sha256': photo.checksumSHA256,
      },
    }),
    verify: async () => 'integration-captured-version',
    remove: async () => {
      throw new Error('Cleanup is outside this fixture.');
    },
  };
  // Test-only S3 replacement stores the exact uploaded bytes and checks the real upload intent.
  const importBlobs = new Map();
  const importIntents = new Map();
  const commercialStorage = {
    ...photoStorage,
    upload: async (file) => {
      importIntents.set(file.objectKey, file);
      return photoStorage.upload(file);
    },
    verifyCsv: async (file) => {
      const body = importBlobs.get(file.objectKey);
      if (
        !body ||
        body.length !== file.size ||
        createHash('sha256').update(body).digest('base64') !== file.checksumSHA256
      )
        throw new Error('Fixture import integrity check failed');
      return 'integration-import-version';
    },
    open: async (file) => Readable.from([importBlobs.get(file.objectKey)]),
    write: async () => {
      throw new Error('Exports are outside this fixture.');
    },
  };
  const app = createApp(config, {
    logger,
    isDatabaseReady: async () => true,
    photoStorage,
    commercialStorage,
  });
  const express = requireBackend('express');
  const fixture = express();
  fixture.post(
    '/__test/import-storage',
    express.raw({ type: 'application/octet-stream', limit: '20mb' }),
    (req, res) => {
      const key = req.get('X-Fixture-Object-Key');
      if (!key || !importIntents.has(key)) return res.sendStatus(400);
      importBlobs.set(key, req.body);
      return res.sendStatus(204);
    },
  );
  fixture.use(app);
  const { ImportWorker } = await source('modules/csv-imports/import.worker.ts');
  const importWorker = new ImportWorker(commercialStorage);
  const { CommercialJobsWorker } = await source('jobs/commercial-jobs-worker.ts');
  commercialWorker = new CommercialJobsWorker(100, logger, async () =>
    Number(await importWorker.runOne()),
  );
  commercialWorker.start();
  server = fixture.listen(3101, '127.0.0.1', () =>
    console.log('Isolated backend fixture ready on 127.0.0.1:3101'),
  );
} catch (error) {
  console.error(
    'Integration fixture failed:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  await stop();
  process.exitCode = 1;
}
