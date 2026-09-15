export const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};
export const addDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};
