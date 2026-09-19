import { describe, expect, it } from 'vitest';
import {
  createMeetingSchema,
  createUserSchema,
  updateDailyWorkWindowSchema,
} from '@teakflow/shared';

describe('createUserSchema', () => {
  const valid = {
    name: 'Priya Rao',
    email: 'priya@codeteak.com',
    password: 'password@1234',
    designation: 'Backend Lead' as const,
    department: 'Engineering' as const,
    role: 'EMPLOYEE' as const,
  };

  it('accepts admin, manager, and employee roles', () => {
    expect(createUserSchema.parse({ ...valid, role: 'ADMIN' }).role).toBe('ADMIN');
    expect(createUserSchema.parse({ ...valid, role: 'LEAD' }).role).toBe('LEAD');
    expect(createUserSchema.parse({ ...valid, role: 'EMPLOYEE' }).role).toBe('EMPLOYEE');
  });

  it('rejects a role that is not in the product', () => {
    expect(() => createUserSchema.parse({ ...valid, role: 'SUPERADMIN' })).toThrow();
  });

  it('accepts listed job titles', () => {
    expect(
      createUserSchema.parse({ ...valid, designation: 'Project Manager' }).designation,
    ).toBe('Project Manager');
  });

  it('rejects an unknown job title', () => {
    expect(() => createUserSchema.parse({ ...valid, designation: 'Intern' })).toThrow();
  });

  it('accepts an optional profile photo URL', () => {
    expect(
      createUserSchema.parse({
        ...valid,
        avatar: 'https://res.cloudinary.com/demo/image/upload/v1/avatars/a.jpg',
      }).avatar,
    ).toBe('https://res.cloudinary.com/demo/image/upload/v1/avatars/a.jpg');
    expect(createUserSchema.parse({ ...valid, avatar: null }).avatar).toBeNull();
    expect(createUserSchema.parse(valid).avatar).toBeUndefined();
  });
});

describe('updateDailyWorkWindowSchema', () => {
  const valid = {
    startTime: '18:00',
    endTime: '23:59',
    minCharacters: 50,
    maxCharacters: 1000,
    allowLateSubmission: true,
    reminderEnabled: true,
    reminderTime: '21:00',
    timezone: 'Asia/Kolkata',
  };

  it('accepts a valid window', () => {
    expect(updateDailyWorkWindowSchema.parse(valid).startTime).toBe('18:00');
  });

  it('strips seconds from time inputs', () => {
    const parsed = updateDailyWorkWindowSchema.parse({
      ...valid,
      startTime: '18:00:30',
      endTime: '23:59:59',
    });
    expect(parsed.startTime).toBe('18:00');
    expect(parsed.endTime).toBe('23:59');
  });

  it('rejects a start time after the end time', () => {
    const parsed = updateDailyWorkWindowSchema.safeParse({
      ...valid,
      startTime: '22:00',
      endTime: '18:00',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects a minimum at or above the maximum', () => {
    const parsed = updateDailyWorkWindowSchema.safeParse({
      ...valid,
      minCharacters: 1000,
      maxCharacters: 50,
    });
    expect(parsed.success).toBe(false);
  });
});

describe('createMeetingSchema', () => {
  const valid = {
    title: 'Frontend Discussion',
    participantUserIds: ['11111111-1111-4111-8111-111111111111'],
    startTime: '2026-09-18T10:30:00.000Z',
    endTime: '2026-09-18T11:30:00.000Z',
  };

  it('merges duplicate participant ids', () => {
    const parsed = createMeetingSchema.parse({
      ...valid,
      participantIds: ['11111111-1111-4111-8111-111111111111'],
    });
    expect(parsed.participantUserIds).toEqual(['11111111-1111-4111-8111-111111111111']);
  });

  it('rejects an end time before start', () => {
    const parsed = createMeetingSchema.safeParse({
      ...valid,
      endTime: '2026-09-18T09:30:00.000Z',
    });
    expect(parsed.success).toBe(false);
  });
});
