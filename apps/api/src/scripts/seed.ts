import bcrypt from 'bcryptjs';
import { DEFAULT_COMPANY_SETTINGS, ROLES, USER_STATUS } from '@teakflow/shared';
import { connectDatabase, sequelize } from '../config/database';
import { COMPANY_SETTINGS_ID, CompanySettings } from '../models/companySettings';
import { User } from '../models/user';
import { syncModels } from '../models/index';
import { addUserToPublicChannels, ensureDefaultChannels } from '../services/chat/index';
import { nextCompanyId } from '../services/users/companyId';
import { Shop } from '../models/shop';
import { DIRECTORY_SHOPS } from '../services/sales/directory';

const ADMIN_EMAIL = 'admin@codeteak.com';
const ADMIN_PASSWORD = 'password@1234';

async function upsertPerson(input: {
  email: string;
  name: string;
  designation: string;
  department: string;
  role: (typeof ROLES)[keyof typeof ROLES];
  managerId?: string | null;
  headedDepartments?: string[];
  extraDesignations?: string[];
}) {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const [user, created] = await User.findOrCreate({
    where: { email: input.email },
    defaults: {
      name: input.name,
      email: input.email,
      passwordHash,
      designation: input.designation,
      department: input.department,
      role: input.role,
      status: USER_STATUS.ACTIVE,
      managerId: input.managerId ?? null,
      headedDepartments: input.headedDepartments ?? [],
      extraDesignations: input.extraDesignations ?? [],
      companyId: input.role === ROLES.ADMIN ? null : await nextCompanyId(),
    },
  });
  user.name = input.name;
  user.passwordHash = passwordHash;
  user.role = input.role;
  user.status = USER_STATUS.ACTIVE;
  user.designation = input.designation;
  user.department = input.department;
  user.managerId = input.managerId ?? null;
  user.headedDepartments = (input.headedDepartments ?? []) as User['headedDepartments'];
  user.extraDesignations = (input.extraDesignations ?? []) as User['extraDesignations'];
  if (user.role === ROLES.ADMIN) {
    user.companyId = null;
  } else if (!user.companyId) {
    user.companyId = await nextCompanyId();
  }
  await user.save();
  if (created) {
    await addUserToPublicChannels(user.id);
  }
  return user;
}

async function seed() {
  const connected = await connectDatabase();
  if (!connected) {
    throw new Error('Could not connect to Supabase. Check DATABASE_URL in .env.');
  }

  await syncModels();

  const admin = await upsertPerson({
    email: ADMIN_EMAIL,
    name: 'Codeteak Admin',
    designation: 'Administrator',
    department: 'Operations',
    role: ROLES.ADMIN,
  });
  console.log(`Seeded admin ${ADMIN_EMAIL}`);

  await CompanySettings.findOrCreate({
    where: { id: COMPANY_SETTINGS_ID },
    defaults: {
      id: COMPANY_SETTINGS_ID,
      companyName: DEFAULT_COMPANY_SETTINGS.companyName,
      timezone: DEFAULT_COMPANY_SETTINGS.timezone,
      dailyWorkStartTime: DEFAULT_COMPANY_SETTINGS.dailyWork.startTime,
      dailyWorkEndTime: DEFAULT_COMPANY_SETTINGS.dailyWork.endTime,
      dailyWorkMinCharacters: DEFAULT_COMPANY_SETTINGS.dailyWork.minCharacters,
      dailyWorkMaxCharacters: DEFAULT_COMPANY_SETTINGS.dailyWork.maxCharacters,
      dailyWorkAllowLateSubmission: DEFAULT_COMPANY_SETTINGS.dailyWork.allowLateSubmission,
      dailyWorkReminderEnabled: DEFAULT_COMPANY_SETTINGS.dailyWork.reminderEnabled,
      dailyWorkReminderTime: DEFAULT_COMPANY_SETTINGS.dailyWork.reminderTime,
    },
  });
  console.log('Seeded company daily-work window');

  await ensureDefaultChannels(admin.id);
  console.log('Seeded default chat channels');

  const manager = await upsertPerson({
    email: 'nisha@codeteak.com',
    name: 'Nisha Manager',
    designation: 'Project Manager',
    department: 'Engineering',
    role: ROLES.MANAGER,
    headedDepartments: ['Engineering', 'Sales'],
    extraDesignations: ['Sales Manager'],
  });
  const lead = await upsertPerson({
    email: 'asha@codeteak.com',
    name: 'Asha Lead',
    designation: 'Frontend Lead',
    department: 'Engineering',
    role: ROLES.LEAD,
    managerId: manager.id,
    extraDesignations: ['Assistant Manager'],
  });
  await upsertPerson({
    email: 'rahul@codeteak.com',
    name: 'Rahul Engineer',
    designation: 'Frontend Developer',
    department: 'Engineering',
    role: ROLES.EMPLOYEE,
    managerId: lead.id,
  });
  await upsertPerson({
    email: 'dev@codeteak.com',
    name: 'Dev Backend',
    designation: 'Backend Developer',
    department: 'Engineering',
    role: ROLES.EMPLOYEE,
    managerId: lead.id,
  });
  await upsertPerson({
    email: 'meera@codeteak.com',
    name: 'Meera Sales',
    designation: 'Sales Executive',
    department: 'Sales',
    role: ROLES.EMPLOYEE,
    managerId: manager.id,
  });
  await upsertPerson({
    email: 'arjun@codeteak.com',
    name: 'Arjun Sales',
    designation: 'Inside Sales Executive',
    department: 'Sales',
    role: ROLES.EMPLOYEE,
    managerId: manager.id,
  });

  const designLead = await upsertPerson({
    email: 'kira@codeteak.com',
    name: 'Kira Design',
    designation: 'Design Lead',
    department: 'Design',
    role: ROLES.LEAD,
    managerId: manager.id,
  });
  await upsertPerson({
    email: 'lena@codeteak.com',
    name: 'Lena Designer',
    designation: 'UI/UX Designer',
    department: 'Design',
    role: ROLES.EMPLOYEE,
    managerId: designLead.id,
  });

  const qaLead = await upsertPerson({
    email: 'omar@codeteak.com',
    name: 'Omar QA',
    designation: 'QA Lead',
    department: 'QA',
    role: ROLES.LEAD,
    managerId: manager.id,
  });
  await upsertPerson({
    email: 'priya@codeteak.com',
    name: 'Priya QA',
    designation: 'QA Engineer',
    department: 'QA',
    role: ROLES.EMPLOYEE,
    managerId: qaLead.id,
  });

  await upsertPerson({
    email: 'sam@codeteak.com',
    name: 'Sam Product',
    designation: 'Product Manager',
    department: 'Product',
    role: ROLES.EMPLOYEE,
    managerId: manager.id,
  });
  await upsertPerson({
    email: 'ops@codeteak.com',
    name: 'Ops Support',
    designation: 'DevOps Engineer',
    department: 'Operations',
    role: ROLES.EMPLOYEE,
    managerId: manager.id,
  });
  console.log(
    'Seeded demo company tree (Engineering, Design, QA, Product, Operations, Sales). Password: password@1234',
  );

  for (const shop of DIRECTORY_SHOPS) {
    await Shop.findOrCreate({
      where: { shopId: shop.shopId },
      defaults: shop,
    });
  }
  console.log(`Seeded ${DIRECTORY_SHOPS.length} directory shops`);
}

try {
  await seed();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sequelize?.close();
  process.exit(process.exitCode ?? 0);
}
