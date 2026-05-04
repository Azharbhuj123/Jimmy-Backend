const allowedTransitions = {
  unassigned: ['assigned', 'failed'],
  assigned: ['en_route', 'unassigned', 'failed'],
  en_route: ['completed', 'failed', 'unassigned'],
  completed: [],
  failed: [],
};

const isStatusTransitionAllowed = (from, to) => {
  if (from === to) return true;
  const allowed = allowedTransitions[from];
  if (!allowed) return false;
  return allowed.includes(to);
};

module.exports = {
  isStatusTransitionAllowed,
  allowedTransitions,
};
