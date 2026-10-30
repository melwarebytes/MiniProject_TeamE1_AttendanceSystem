// Session times are institution wall time (IST), independent of the API host TZ.
function sessionInstant(session) {
  return new Date(`${new Date(session.date).toISOString().slice(0, 10)}T${session.startTime}:00+05:30`);
}
function eligibleForSession(enrollment, session) {
  const at = sessionInstant(session);
  // Legacy/seed enrolments without periods cover their complete semester.
  return (
    !enrollment.periods?.length ||
    enrollment.periods.some((p) => new Date(p.startsAt) <= at && (!p.endsAt || at < new Date(p.endsAt)))
  );
}
module.exports = { sessionInstant, eligibleForSession };
