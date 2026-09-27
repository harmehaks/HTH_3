# Air Canada scenario: manual test checklist

Upload `air-canada-personnel-fictional.txt` or its PDF version, not this answer key. All content is invented. This is a personnel-privacy exercise, not a legal ruling about Air Canada or whether a particular statute applies to its records. The app's statutory labels are its existing review taxonomy; do not treat a suggestion as a determination of legal applicability.

Start with TXT for predictable line boundaries. The PDF is a two-page upload/extraction test; wrapped lines can change how local rules select spans. When manually redacting PDF text, copy the passage from the app's viewer rather than assuming its extracted line breaks match the TXT file.

## What the local demo should highlight

The existing local rules identify email addresses, fictional telephone numbers, the invalid SIN-format placeholders, and lines beginning `Employee name:` or `Private address:`. They also identify the two labelled advice lines and the labelled fictional lawyer-client communication. Some suggestions will have confidence below 85% and require additional attention. Every suggestion still needs human review.

The exact number of baseline suggestions is recorded in `air-canada-personnel-local-check.json`. A live Gemini pass can return different spans; evaluate coverage, not an assumed fixed count.

## Sensitive details that require full-record review

Local rules will not reliably detect the following. Withhold them manually in this privacy exercise, or inspect how a configured Gemini pass handles them:

| Item | Search for in the document |
| --- | --- |
| Employee identifiers and role-linked identity | `TEST-AC-0001`, `TEST-AC-0002`, the coordinator's exact assignment |
| Birth dates | `1993-04-16`, `1989-11-03` |
| Passport identifier | `TEST-PASSPORT-0001` |
| Salary and bonus | `CAD 74,250`, `CAD 2,800`, `CAD 68,900` |
| Banking and payroll routing | `TEST-BANK-ACCOUNT-0001`, `TEST-BANK-ACCOUNT-0002`, `TEST-ROUTING-0001` |
| Household and dependent identity | spouse relationship, dependent name/birth date, school and classroom |
| Medical and accommodation details | migraine, clinician recommendation, appointment date, medical case identifier |
| Individual performance details | assessment score, missed deadlines, dispute and coaching plan |
| Individual leave details | family-care leave and private household note |
| Remaining identity in prose | every reference that can link the record to an individual, not only labelled names |

For a broad manual selection, copy the entire sensitive paragraph or line exactly as shown in the viewer. Do not overlap an existing redaction. The invalid SIN appears twice: use the occurrence selector if manually editing repeated text.

## The mosaic test

On the initial candidate, the local contextual tester should flag this exact sentence:

> The only employee assigned to the fictional Aurora access pilot at the mock Toronto station received the 2026 Lantern training award and can be identified in the scenario's staff directory.

Withhold that sentence and the following directory-link explanation. Check that fresh integrity results no longer contain that specific clue. Review the remaining role and assignment details too; a clean local check is not proof that all identifying context is gone.

The local tester flags contextual risk without reconstructing an actual name; its reconstruction result is `untested`. A configured Gemini tester may propose a guess. Neither result is a measured accuracy claim.

## Keep these details readable

- The fictional pilot's purpose.
- Aggregate participation: 52 employees.
- Aggregate completion rate: 94%.
- Processing-time improvement: 18%.
- Next review: October 2026.
- The deliberately public `training-demo@example.invalid` mailbox, after dismissing its suggestion with a reason such as: "Synthetic contact intentionally designated public in this fixture."

This mailbox is a deliberate false-positive test. An email-shaped string should not automatically be hidden solely because it matches a pattern.

## Finish and check the downloads

1. Decide every suggestion, then add manual redactions for the remaining sensitive passages.
2. Review the refreshed integrity findings. Similarity findings are contextual prompts, not automatic instructions to disclose.
3. Read the entire record and confirm the full-document attestation.
4. Approve release, switch to the requester portal and download PDF and TXT.
5. Search both downloads for the withheld names, dates, test identifiers, addresses, medical details and salary amounts. They should be absent if you withheld them.
6. Confirm that the 52 / 94% / 18% results and the intentionally disclosed public mailbox remain readable.

For a shorter first test, use only sections 1, 2 and 5. Do not upload the answer key alongside the record: it repeats sensitive terms and the identifying clue, which changes what the tester sees.
