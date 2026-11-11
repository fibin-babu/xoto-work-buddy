export const attendanceColumns = "id,user_id,work_date,clock_in,clock_out,created_at,in_lat,in_lng,in_accuracy,out_lat,out_lng,out_accuracy" as const;
export type LocationAction = "clock_in" | "break_start" | "break_end" | "clock_out";
export const locationActionLabel: Record<LocationAction, string> = {
  clock_in: "Clock in", break_start: "Start break", break_end: "End break", clock_out: "Clock out",
};
export function canReviewLocation(admin: boolean, leadsPerson: boolean, isSelf: boolean) {
  return admin || (leadsPerson && !isSelf);
}