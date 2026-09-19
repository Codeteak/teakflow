import type { PublicUser } from '@teakflow/shared';

export function mentionedUserIds(content: string, members: PublicUser[]): string[] {
  const ids = new Set<string>();
  for (const member of members) {
    const first = member.name.split(/\s+/)[0] ?? member.name;
    const patterns = [
      new RegExp(`(^|\\s)@${escapeRegExp(member.name)}(?=$|\\s|[.,!?])`, 'i'),
      new RegExp(`(^|\\s)@${escapeRegExp(first)}(?=$|\\s|[.,!?])`, 'i'),
    ];
    if (patterns.some((pattern) => pattern.test(content))) {
      ids.add(member.id);
    }
  }
  return [...ids];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
