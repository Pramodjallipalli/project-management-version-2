import test from 'node:test';
import assert from 'node:assert/strict';
import { getProjectTabs, METHODOLOGY } from '../utils/methodology.js';

test('DAILOQA Bug Management & QA Retest Portal — Project Workspace Tabs Suite', async (t) => {
  await t.test('1. Scrum workspace tab order places Bugs immediately after Action Items', () => {
    const tabs = getProjectTabs(METHODOLOGY.SCRUM);
    const tabIds = tabs.map((t) => t.id);

    const expectedOrder = [
      'overview',
      'roadmap',
      'sprint',
      'backlog',
      'scrum',
      'action-items',
      'bugs',
      'approvals',
    ];

    assert.deepEqual(
      tabIds,
      expectedOrder,
      'Scrum workspace must contain all 8 tabs with Bugs immediately after Action Items and before Approvals'
    );

    const bugsIndex = tabIds.indexOf('bugs');
    const actionItemsIndex = tabIds.indexOf('action-items');
    const approvalsIndex = tabIds.indexOf('approvals');

    assert.equal(bugsIndex, actionItemsIndex + 1, 'Bugs tab must directly follow Action Items');
    assert.equal(bugsIndex, approvalsIndex - 1, 'Bugs tab must directly precede Approvals');
  });

  await t.test('2. Kanban workspace tab order places Bugs immediately after Action Items', () => {
    const tabs = getProjectTabs(METHODOLOGY.KANBAN);
    const tabIds = tabs.map((t) => t.id);

    const expectedOrder = [
      'overview',
      'roadmap',
      'backlog',
      'kanban',
      'action-items',
      'bugs',
      'approvals',
    ];

    assert.deepEqual(
      tabIds,
      expectedOrder,
      'Kanban workspace must contain all 7 tabs with Bugs immediately after Action Items and before Approvals'
    );

    const bugsIndex = tabIds.indexOf('bugs');
    const actionItemsIndex = tabIds.indexOf('action-items');
    const approvalsIndex = tabIds.indexOf('approvals');

    assert.equal(bugsIndex, actionItemsIndex + 1, 'Bugs tab must directly follow Action Items');
    assert.equal(bugsIndex, approvalsIndex - 1, 'Bugs tab must directly precede Approvals');
  });

  await t.test('3. Intern filtering excludes Approvals but preserves Bugs tab for reporting/viewing defects', () => {
    const internScrumTabs = getProjectTabs(METHODOLOGY.SCRUM, { isIntern: true });
    const internScrumIds = internScrumTabs.map((t) => t.id);

    assert.ok(internScrumIds.includes('bugs'), 'Interns must have access to Bugs tab');
    assert.ok(!internScrumIds.includes('approvals'), 'Interns must be restricted from Approvals tab');

    const internKanbanTabs = getProjectTabs(METHODOLOGY.KANBAN, { isIntern: true });
    const internKanbanIds = internKanbanTabs.map((t) => t.id);

    assert.ok(internKanbanIds.includes('bugs'), 'Interns must have access to Bugs tab in Kanban');
    assert.ok(!internKanbanIds.includes('approvals'), 'Interns must be restricted from Approvals tab in Kanban');
  });
});
