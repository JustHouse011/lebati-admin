export const knowledge = [
  {
    id: 'portal-navigation', title: 'Portal navigation', text: 'Use the workspace switcher before opening a dashboard, Cases & Appeals, Restrictions, Reports or Geographic Risk Intelligence. Geographic drill-down goes from province to district or metro, municipality and covered town. Filters and exports reflect the selected programme and reporting period.',
  },
  {
    id: 'workspace-access', title: 'Assistant reporting access', text: 'Global Administrators can request authorised aggregates across workspaces. Institutional administrators are limited to their configured programmes. Agents only see aggregate reporting for assigned programme and area combinations and can retrieve assigned case summaries.',
  },
  {
    id: 'case-review', title: 'Case evidence and human review', text: 'Confirm the policy reference, transaction date, merchant classification, amount, provenance and relevant context before recording a decision. Keep conflicting evidence visible. Route matters without enough evidence to human review. Merchant categories and unusual spending are indicators, not findings.',
  },
  {
    id: 'restriction-lifecycle', title: 'Restriction lifecycle', text: 'The portal records Open, Temporarily Restricted, Restricted, Under Review and Reopened. Decisions require policy reference, evidence, a reason, an authorised decision maker, effective date, next review date and an appeal route. The assistant cannot change records or restrict funds.',
  },
  {
    id: 'financial-wellness', title: 'Financial wellness and referrals', text: 'A reviewer can record a budget planning, financial education or independent case review referral. Record the reason, accountable team and outcome. A referral is an offer of support, not an adverse finding.',
  },
  {
    id: 'interpretation', title: 'NSFAS and SASSA reporting', text: 'Gambling spend is a monetary total. Prevalence is distinct affected participants divided by the monitored cohort. Risk events per 1,000 count flagged transactions relative to distinct monitored people. Merchant volume, rates and prevalence answer different questions. Fictional aggregate figures have no institutional endorsement.',
  },
] as const
