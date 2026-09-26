import { randomUUID, createHash } from 'node:crypto';
import { auditHash } from './audit.js';
import { importPublicCorpus } from './public-corpus.js';
import { localClassify, integrity, localEmbedding, renderRedacted } from './engine.js';
export const demoDocument = `CANADA BORDER SERVICES AGENCY
Access to Information · Internal briefing note

Border services modernization
Program update and implementation considerations

DATE: September 14, 2026
FILE: CBSA / MOD-2026-084
PREPARED FOR: Director, Operational Programs

1. PURPOSE

This briefing summarizes the progress of the border services modernization program and outlines considerations for the next phase of implementation.

2. PROGRAM OVERVIEW

The program aims to improve traveller processing, increase service accessibility, and reduce administrative burden at participating ports of entry. The pilot includes digital intake, staff training, and improvements to public information.

The pilot achieved an average processing-time reduction of 18%. These aggregate results are intended for public reporting. The current implementation budget is $2.4 million.

3. IMPLEMENTATION CONSIDERATIONS

We recommend extending the pilot to three additional regional offices before a national rollout, subject to a readiness assessment and ministerial approval.

The implementation team has raised questions about the sequencing of training and the availability of bilingual support. Public-facing service standards will remain unchanged during the pilot.

4. CONTACT AND PERSONNEL

Employee name: Alex Morgan
Personal contact: alex.morgan@example.net
Private telephone: 613-555-0184
The only officer leading the Northern Region pilot received the 2025 Northstar service award and can be identified in the contact directory.

5. LEGAL AND OPERATIONAL CONSIDERATIONS

Privileged legal advice: Counsel considers that the proposed data-sharing arrangement requires a revised agreement before implementation.

Investigation strategy: Investigators will compare selected inspection logs with undisclosed referral patterns in the active file.

6. NEXT STEPS

The program team will publish a progress update following the completion of the pilot. Aggregate performance measures and public service commitments will be included in that update.

END OF RECORD
Synthetic demonstration document. All people, figures, and request references are fictional.`;

export async function seed(store) {
  await importPublicCorpus(store);
  if ((await store.all('request')).length) return;
  const excerpts = [
    'We recommend extending the pilot to three additional regional offices before a national rollout, subject to a readiness assessment and ministerial approval.',
    'The pilot achieved an average processing-time reduction of 18%.',
    'Public-facing service standards will remain unchanged during the pilot.',
    'The current implementation budget is $2.4 million.',
    'Aggregate performance measures and public service commitments will be included in that update.',
    'The program aims to improve traveller processing and increase service accessibility.',
    'The implementation team has raised questions about training.',
    'We recommend a phased implementation following the readiness assessment.',
    'The public consultation period will run for thirty days.',
    'The annual report includes aggregate program performance.',
    'The program team will publish a progress update.',
    'Service accessibility remains a priority for regional offices.',
    'The project includes digital intake and staff training.',
    'The department published public information about the pilot.',
    'The rollout timeline is subject to a readiness assessment.',
    'Funding for the pilot was approved in the public budget.',
  ];
  for (const [i, text] of excerpts.entries()) {
    const c = {
      id: `corpus-demo-${i}`,
      requestRef: `A-2025-${String(4521 + i).padStart(5, '0')}`,
      title: i === 0 ? 'Regional pilot recommendations' : 'Program release excerpt',
      text,
      treatment: 'released',
      category: null,
      sourceUrl: null,
      synthetic: true,
      embedding: localEmbedding(text),
      embeddingModel: 'local-hashed-words-v1',
      addedAt: new Date().toISOString(),
    };
    await store.put('corpus', c);
    await store.vector(c.id, c.embedding, c.embeddingModel);
  }
  const titles = [
    'Border services modernization',
    'Infrastructure investment briefing',
    'Travel and hospitality expenses',
    'Digital services procurement',
    'Regional staffing overview',
    'Climate adaptation program',
    'Public consultation findings',
    'Service accessibility report',
    'Program evaluation summary',
  ];
  const departments = [
    'Canada Border Services Agency',
    'Infrastructure Canada',
    'Treasury Board Secretariat',
    'Shared Services Canada',
    'Canada Border Services Agency',
    'Environment and Climate Change Canada',
    'Transport Canada',
    'Employment and Social Development Canada',
    'Canadian Heritage',
  ];
  for (let i = 0; i < titles.length; i++) {
    const created = new Date(Date.now() - (i === 4 ? 34 : 4 + i * 2) * 86400000),
      id = `A-2026-${String(841 + i).padStart(5, '0')}`;
    const text =
      i === 0
        ? demoDocument
        : `${departments[i].toUpperCase()}\n${titles[i]}\n\nThis is a synthetic demonstration record for ${id}.\n\nThe department published public information about the pilot.\nThe current implementation budget is $2.4 million.\n\n${i % 2 === 0 ? 'Employee name: Jamie Chen\nPersonal contact: jamie.chen@example.net' : 'We recommend a phased implementation following the readiness assessment.'}\n\nPublic-facing service standards will remain unchanged during the pilot.\n`;
    let spans = localClassify(text),
      check = await integrity(text, spans, await store.all('corpus'), store);
    const released = i >= 6;
    if (released) {
      spans = spans.map((s) => ({
        ...s,
        decision: 'approved',
        reviewNote: 'Reviewed for synthetic demo.',
      }));
      check.leaks = check.leaks.map((f) => ({
        ...f,
        resolved: true,
        note: 'Reviewed for synthetic demo.',
      }));
      check.conflicts = check.conflicts.map((f) => ({
        ...f,
        resolved: true,
        note: 'Contextual difference assessed in synthetic demo.',
      }));
    }
    const request = {
      id,
      title: titles[i],
      department: departments[i],
      description: `Records relating to ${titles[i].toLowerCase()}.`,
      requesterId: 'demo-requester',
      createdAt: created.toISOString(),
      dueAt: new Date(created.getTime() + 30 * 86400000).toISOString(),
      status: released ? 'released' : 'in_review',
      synthetic: true,
      priority: i === 4 ? 'high' : 'normal',
      documents: [
        {
          id: randomUUID(),
          name: `${titles[i].toLowerCase().replaceAll(' ', '-')}.txt`,
          text,
          pages: 1,
          spans,
          integrity: check,
          engine: 'Local pattern rules',
          warnings: ['Synthetic demo. Pattern-based suggestions require full officer review.'],
          attested: released,
          createdAt: created.toISOString(),
        },
      ],
      releasedAt: released ? new Date(Date.now() - (i - 5) * 86400000).toISOString() : null,
    };
    if (released)
      request.release = {
        documents: request.documents.map((d) => ({
          id: d.id,
          name: d.name,
          pages: d.pages,
          text: renderRedacted(d.text, d.spans),
          sections: [
            ...new Set(d.spans.filter((s) => s.decision !== 'dismissed').map((s) => s.category)),
          ],
        })),
      };
    await store.put('request', request);
  }
  const event = {
    id: randomUUID(),
    sequence: 1,
    requestId: null,
    action: 'Workspace initialized',
    detail:
      'Nine synthetic requests and sixteen synthetic release excerpts are available for demonstration.',
    actor: 'System',
    at: new Date().toISOString(),
    previousHash: 'genesis',
  };
  event.hash = auditHash(event);
  await store.put('audit', event);
}
