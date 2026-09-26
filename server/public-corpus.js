import { localEmbedding, embed } from './engine.js';
const root =
  'https://international.canada.ca/en/global-affairs/corporate/transparency/briefing-documents/briefing-books/';
// Short exact excerpts checked against the official published pages on 2026-09-26.
// These are proactive publications, not invented ATI request numbers.
const sources = [
  [
    '2026-06-foreign-affairs',
    'Foreign affairs onboarding · February 2026',
    'This note surveys your role as Deputy Minister of Foreign Affairs and situates it within a geopolitical environment',
  ],
  [
    '2026-06-development',
    'Development onboarding · February 2026',
    'International assistance is a key component of the Government of Canada’s wider foreign policy toolkit',
  ],
  [
    '2026-06-trade',
    'Trade onboarding · February 2026',
    'International trade and investment are top priorities for the Government.',
  ],
  [
    '2025-05-foreign-affairs',
    'Foreign affairs briefing · May 2025',
    'The conduct of diplomatic and consular relations on behalf of Canada;',
  ],
  [
    '2025-05-international-trade',
    'Trade briefing · May 2025',
    'Supporting Canadian companies and growing the Canadian economy through international trade is at the core of the portfolio’s mandate.',
  ],
  [
    '2025-05-international-development',
    'Development briefing · May 2025',
    'It supports the social and economic development of developing countries, humanitarian response, peace and security, and governance.',
  ],
  [
    '2025-03-international-trade',
    'Trade briefing · March 2025',
    'Export diversification and economic security will be important areas of focus as Canada pursues greater economic resiliency and growth.',
  ],
  [
    '2024-07-dma-international-development',
    'Associate deputy minister briefing · July 2024',
    "This note surveys key geostrategic trends and how they affect Canada's international engagement.",
  ],
  [
    '2023-07-international-development',
    'Development briefing · July 2023',
    'Canada’s international assistance is a critical component of Canada’s wider international objectives and toolkit.',
  ],
  [
    '2022-10-uss-foreign-affairs',
    'Foreign affairs briefing · October 2022',
    'Several inter-related geostrategic trends, observed over a number of years but accelerating in recent months, have been impacting Canada’s foreign policy.',
  ],
  [
    '2022-10-dmt-international-trade',
    'Trade briefing · October 2022',
    'First, there has been a sharpening of great power competition, with an increasing security element.',
  ],
  [
    '2021-10-foreign-affairs',
    'Foreign affairs briefing · October 2021',
    'As Minister of Foreign Affairs, you are responsible for defining, advancing and representing Canada’s interests and values abroad.',
  ],
  [
    '2021-10-international-development',
    'Development briefing · October 2021',
    'Poverty and inequality, violence and fragility matter for Canadian stability and prosperity.',
  ],
  [
    '2021-10-international-trade',
    'Trade briefing · October 2021',
    'The flow of goods, services, capital, technology and people is critical to Canada’s growth and improved living standards.',
  ],
  [
    '2021-01-foreign-affairs',
    'Foreign affairs briefing · January 2021',
    'while also demonstrating the critical importance of international cooperation.',
  ],
  [
    '2019-11-international-development',
    'Development briefing · November 2019',
    'While the last three decades saw dramatic reductions in global poverty, not everyone has benefitted equally.',
  ],
];
export const publicCorpus = sources.map(([slug, title, text]) => ({
  id: `public-${slug}`,
  requestRef: `PD-GAC-${slug}`,
  title,
  text,
  sourceUrl: root + slug,
  treatment: 'released',
  category: null,
  synthetic: false,
  sourceType: 'proactive_publication',
  verifiedAt: '2026-09-26',
}));
export async function importPublicCorpus(store, { live = false } = {}) {
  let count = 0;
  for (const item of publicCorpus) {
    if (await store.get(item.id)) continue;
    const e = live
      ? await embed(item.text)
      : { values: localEmbedding(item.text), model: 'local-hashed-words-v1' };
    const c = {
      ...item,
      embedding: e.values,
      embeddingModel: e.model,
      addedAt: new Date().toISOString(),
    };
    await store.put('corpus', c);
    await store.vector(c.id, e.values, e.model);
    count++;
  }
  return count;
}
