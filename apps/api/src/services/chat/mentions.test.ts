import { describe, expect, it } from 'vitest';
import { mentionedUserIds } from './mentions';

const members = [
  {
    id: '1',
    name: 'Alfayad Rahman',
    email: 'a@codeteak.com',
    avatar: null,
    designation: 'Frontend Developer',
    department: 'Engineering',
    role: 'EMPLOYEE' as const,
    status: 'ACTIVE' as const,
    lastSeenAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Rahul',
    email: 'r@codeteak.com',
    avatar: null,
    designation: 'Backend Developer',
    department: 'Engineering',
    role: 'EMPLOYEE' as const,
    status: 'ACTIVE' as const,
    lastSeenAt: null,
    createdAt: new Date().toISOString(),
  },
];

describe('mentionedUserIds', () => {
  it('matches a first name mention', () => {
    expect(mentionedUserIds('@Alfayad can you check this?', members)).toEqual(['1']);
  });

  it('matches a full name mention', () => {
    expect(mentionedUserIds('Please review @Alfayad Rahman', members)).toEqual(['1']);
  });

  it('does not match a partial token', () => {
    expect(mentionedUserIds('email rahul@codeteak.com', members)).toEqual([]);
  });

  it('can mention more than one person', () => {
    expect(mentionedUserIds('@Alfayad and @Rahul please look', members)).toEqual([
      '1',
      '2',
    ]);
  });
});
