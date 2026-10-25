export const workspacePages = [
  {
    slug: 'daily-reports',
    title: 'Daily sales reports',
    description: 'Record contact visits, submit photo evidence and review your daily activity.',
    permission: 'reports:read',
    needs: ['leads:read', 'leads:receive_assignment'],
  },
  {
    slug: 'insights',
    title: 'Reports & insights',
    description: 'Daily summaries, verified targets and scoped performance reports.',
    permission: '',
    needs: [] as string[],
  },
  {
    slug: 'commercial',
    title: 'Commercial settings',
    description: 'Lead workflows and contact duplicate rules.',
    permission: 'settings:manage',
    needs: [] as string[],
  },
  {
    slug: 'operations',
    title: 'Operations',
    description: 'Observed server health and background job queues.',
    permission: 'settings:manage',
    needs: [] as string[],
  },
];
