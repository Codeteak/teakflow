import type { DailyWorkTodayState } from '@teakflow/shared';

export type WindowPhase = 'BEFORE' | 'IN' | 'AFTER';

export type ClockParts = {
  workDate: string;
  hour: number;
  minute: number;
  second: number;
  seconds: number;
};

export function clockParts(now: Date, timezone: string): ClockParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  const hour = Number(values.hour);
  const minute = Number(values.minute);
  const second = Number(values.second);

  return {
    workDate: `${values.year}-${values.month}-${values.day}`,
    hour,
    minute,
    second,
    seconds: hour * 3600 + minute * 60 + second,
  };
}

export function timeToSeconds(time: string, second = 0) {
  const [hourText = '0', minuteText = '0'] = time.split(':');
  return Number(hourText) * 3600 + Number(minuteText) * 60 + second;
}

export function windowPhase(
  now: Date,
  timezone: string,
  startTime: string,
  endTime: string,
): WindowPhase {
  const { seconds } = clockParts(now, timezone);
  const start = timeToSeconds(startTime);
  const end = timeToSeconds(endTime, 59);

  if (seconds < start) {
    return 'BEFORE';
  }
  if (seconds > end) {
    return 'AFTER';
  }
  return 'IN';
}

export function resolveTodayState(input: {
  now: Date;
  timezone: string;
  startTime: string;
  endTime: string;
  allowLateSubmission: boolean;
  submitted: boolean;
}): DailyWorkTodayState {
  // Own notebook stays editable for the whole work date after submit.
  // Past dates are locked in the UI because only "today" uses this state.
  if (input.submitted) {
    return 'SUBMITTED_EDITABLE';
  }

  const phase = windowPhase(input.now, input.timezone, input.startTime, input.endTime);
  if (phase === 'BEFORE') {
    return 'LOCKED';
  }
  if (phase === 'IN') {
    return 'OPEN';
  }
  return input.allowLateSubmission ? 'LATE_AVAILABLE' : 'MISSED';
}

/** Submitted content for today's work date may still be updated. */
export function canEditSubmittedContent(submitted: boolean) {
  return submitted;
}
