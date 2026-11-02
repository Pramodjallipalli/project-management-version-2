export const METHODOLOGY = {
  SCRUM: 'SCRUM',
  KANBAN: 'KANBAN',
};

export const METHODOLOGY_META = {
  SCRUM: {
    id: 'SCRUM',
    name: 'Scrum',
    tagline: 'Sprint-based planning and delivery',
    description: 'Sprint planning, time-boxed iterations, sprint backlogs, and burndown progress tracking.',
    bullets: [
      'Sprint planning and time-boxed iterations',
      'Product backlog and sprint backlog',
      'Sprint-based progress tracking',
    ],
    boardTabId: 'scrum',
    boardLabel: 'Scrum Board',
  },
  KANBAN: {
    id: 'KANBAN',
    name: 'Kanban',
    tagline: 'Continuous workflow without mandatory sprints',
    description: 'Continuous flow of work, visual work-in-progress, and real-time cycle-time throughput.',
    bullets: [
      'Continuous flow of work',
      'Work-in-progress visibility',
      'No mandatory cycle planning',
    ],
    boardTabId: 'kanban',
    boardLabel: 'Kanban Board',
  },
};

export function getProjectMethodology(project) {
  if (!project) return METHODOLOGY.SCRUM;
  const meth = (project.methodology || '').toUpperCase().trim();
  if (meth === METHODOLOGY.KANBAN) return METHODOLOGY.KANBAN;
  return METHODOLOGY.SCRUM;
}

export function isScrumProject(project) {
  return getProjectMethodology(project) === METHODOLOGY.SCRUM;
}

export function isKanbanProject(project) {
  return getProjectMethodology(project) === METHODOLOGY.KANBAN;
}

export function getIterationTerm(projectOrMethodology, { plural = false, lower = false } = {}) {
  const meth = typeof projectOrMethodology === 'string'
    ? (projectOrMethodology.toUpperCase().trim() === 'KANBAN' ? 'KANBAN' : 'SCRUM')
    : getProjectMethodology(projectOrMethodology);

  const isKanban = meth === METHODOLOGY.KANBAN;
  let term = isKanban
    ? (plural ? 'Cycles' : 'Cycle')
    : (plural ? 'Sprints' : 'Sprint');

  return lower ? term.toLowerCase() : term;
}

export function getProjectTabs(projectOrMethodology, { isIntern = false } = {}) {
  const meth = typeof projectOrMethodology === 'string'
    ? (projectOrMethodology.toUpperCase().trim() === 'KANBAN' ? 'KANBAN' : 'SCRUM')
    : getProjectMethodology(projectOrMethodology);

  const tabs = meth === METHODOLOGY.KANBAN
    ? [
        { id: 'overview', label: 'Overview' },
        { id: 'roadmap', label: 'Roadmap' },
        { id: 'backlog', label: 'Backlog' },
        { id: 'kanban', label: 'Kanban Board' },
        { id: 'action-items', label: 'Action Items' },
        { id: 'bugs', label: 'Bugs' },
        { id: 'approvals', label: 'Approvals' },
      ]
    : [
        { id: 'overview', label: 'Overview' },
        { id: 'roadmap', label: 'Roadmap' },
        { id: 'sprint', label: 'Sprint Workspace' },
        { id: 'backlog', label: 'Backlog' },
        { id: 'scrum', label: 'Scrum Board' },
        { id: 'action-items', label: 'Action Items' },
        { id: 'bugs', label: 'Bugs' },
        { id: 'approvals', label: 'Approvals' },
      ];

  if (isIntern) {
    return tabs.filter((t) => t.id !== 'approvals');
  }

  return tabs;
}
