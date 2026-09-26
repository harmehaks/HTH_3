export const categories = [
  {
    id: 'personal',
    name: 'Personal information',
    section: '19(1)',
    color: '#6a6ac7',
    kind: 'Mandatory exemption',
    summary:
      'Potential personal information. Review the Privacy Act definition, consent, public availability and permitted disclosure exceptions under subsection 19(2).',
  },
  {
    id: 'advice',
    name: 'Advice & recommendations',
    section: '21(1)(a)',
    color: '#c18a39',
    kind: 'Discretionary exemption',
    summary:
      'Potential internal advice or recommendations. Verify the 20-year limit, subsection 21(2) exceptions and whether discretion should favour disclosure.',
  },
  {
    id: 'international',
    name: 'International affairs',
    section: '15(1)',
    color: '#4989a7',
    kind: 'Discretionary exemption',
    summary:
      'Disclosure must reasonably be expected to injure international affairs, defence or protected activities. Confirm an evidence-based injury assessment and exercise discretion.',
  },
  {
    id: 'enforcement',
    name: 'Law enforcement',
    section: '16(1)(c)',
    color: '#b57373',
    kind: 'Discretionary exemption',
    summary:
      'Potential injury to enforcement of law or conduct of a lawful investigation. Confirm a specific reasonably expected injury and exercise discretion.',
  },
  {
    id: 'privilege',
    name: 'Solicitor-client privilege',
    section: '23',
    color: '#9a68a4',
    kind: 'Discretionary exemption',
    summary:
      'Potential solicitor-client or litigation privilege. Verify the privileged relationship, confidential nature, waiver and exercise of discretion.',
  },
  {
    id: 'cabinet',
    name: 'Cabinet confidences',
    section: '69(1)',
    color: '#687d58',
    kind: 'Exclusion',
    summary:
      'Potential Cabinet confidence excluded from Part 1. Confirm the applicable record class and the age and discussion-paper exceptions under subsection 69(3).',
  },
].map((c) => ({
  ...c,
  url: `https://laws-lois.justice.gc.ca/eng/acts/A-1/section-${c.section.split('(')[0]}.html`,
}));
export const category = (id) => categories.find((c) => c.id === id);
