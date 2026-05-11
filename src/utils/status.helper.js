const allowedTransitions = {
  unassigned: ['assigned', 'failed'],
  assigned: ['en_route', 'unassigned', 'failed'],
  en_route: ['arrived', 'picked_up', 'failed', 'unassigned'],
  arrived: ['picked_up', 'failed', 'en_route'],
  picked_up: ['delivered', 'failed'],
  delivered: ['completed', 'failed'],
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
