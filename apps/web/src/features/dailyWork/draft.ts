export function draftKey(workDate: string) {
  return `teakflow-daily-work-draft:${workDate}`;
}

export function readDraft(workDate: string) {
  try {
    return window.localStorage.getItem(draftKey(workDate)) ?? '';
  } catch {
    return '';
  }
}

export function writeDraft(workDate: string, content: string) {
  try {
    window.localStorage.setItem(draftKey(workDate), content);
  } catch {
    return;
  }
}

export function clearDraft(workDate: string) {
  try {
    window.localStorage.removeItem(draftKey(workDate));
  } catch {
    return;
  }
}

export function planKey(workDate: string) {
  return `teakflow-daily-plan:${workDate}`;
}

export function readPlan(workDate: string) {
  try {
    return window.localStorage.getItem(planKey(workDate)) ?? '';
  } catch {
    return '';
  }
}

export function writePlan(workDate: string, content: string) {
  try {
    if (!content.trim()) {
      window.localStorage.removeItem(planKey(workDate));
      return;
    }
    window.localStorage.setItem(planKey(workDate), content);
  } catch {
    return;
  }
}

export function listPlanDates() {
  const dates = new Set<string>();
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith('teakflow-daily-plan:')) {
        continue;
      }
      if (window.localStorage.getItem(key)?.trim()) {
        dates.add(key.slice('teakflow-daily-plan:'.length));
      }
    }
  } catch {
    return dates;
  }
  return dates;
}
