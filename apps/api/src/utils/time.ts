export function companyNow(timezone = 'Asia/Kolkata'): Date {
  return new Date(
    new Date().toLocaleString('en-US', {
      timeZone: timezone,
    }),
  );
}
