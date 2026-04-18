// Determine service type ("Sunday" | "Monday" | "Other") for an attendance record.
// Uses stored serviceType field if present; otherwise derives from the date's day of week.
export const getServiceType = (record) => {
  if (record?.serviceType) return record.serviceType;
  if (!record?.date) return "Other";
  const day = new Date(record.date + "T00:00:00").getDay();
  if (day === 0) return "Sunday";
  if (day === 1) return "Monday";
  return "Other";
};

// Infer service type from a date string (YYYY-MM-DD), defaulting to the nearest of Sunday/Monday.
export const inferServiceTypeFromDate = (dateStr) => {
  if (!dateStr) return "Sunday";
  const day = new Date(dateStr + "T00:00:00").getDay();
  if (day === 0) return "Sunday";
  if (day === 1) return "Monday";
  // Non Sun/Mon: default to Sunday (user can override)
  return "Sunday";
};
