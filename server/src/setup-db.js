import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import User from './models/User.js';
import Lead from './models/Lead.js';
import Call from './models/Call.js';
import Meeting from './models/Meeting.js';
import Activity from './models/Activity.js';
import Settings from './models/Settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/leadengine';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Essam Admin';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@mobarezlead.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'MobarezAdmin@2103';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '';

const ADMIN_PERMISSIONS = {
  leads: true,
  calls: true,
  reports: true,
  analytics: true,
  settings: true,
  users: true,
  import_data: true,
  auto_dial: true,
  calendar: true,
  templates: true,
  data_collection: true,
};

async function ensureCollection(Model) {
  try {
    await Model.createCollection();
  } catch (err) {
    if (err?.codeName !== 'NamespaceExists') {
      throw err;
    }
  }
}

async function setupDatabase() {
  await mongoose.connect(MONGODB_URI, {
    serverApi: { version: '1', strict: true, deprecationErrors: true },
  });
  console.log('Connected to MongoDB');

  const models = [User, Lead, Call, Meeting, Activity, Settings];

  for (const Model of models) {
    await ensureCollection(Model);
  }

  await Promise.all(models.map((Model) => Model.syncIndexes()));

  await Settings.findOneAndUpdate(
    { _key: 'main' },
    { _key: 'main' },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let adminUser = await User.findOne({ email: ADMIN_EMAIL });
  if (!adminUser) {
    adminUser = new User({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      phone: ADMIN_PHONE,
      role: 'admin',
      password: ADMIN_PASSWORD,
      isActive: true,
      permissions: ADMIN_PERMISSIONS,
    });
  } else {
    adminUser.name = ADMIN_NAME;
    adminUser.phone = ADMIN_PHONE;
    adminUser.role = 'admin';
    adminUser.isActive = true;
    adminUser.permissions = ADMIN_PERMISSIONS;
    adminUser.password = ADMIN_PASSWORD;
  }
  await adminUser.save();

  console.log('Collections ready: users, leads, calls, meetings, activities, settings');
  console.log(`Admin email: ${ADMIN_EMAIL}`);
  console.log(`Admin password: ${ADMIN_PASSWORD}`);
  await mongoose.disconnect();
}

setupDatabase().catch((err) => {
  console.error('Database setup failed:', err.message);
  process.exit(1);
});
