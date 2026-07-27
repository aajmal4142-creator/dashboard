# Pilot checklist — customer satisfaction

Use with a seeded or real org. Do not enable Stripe LIVE until `docs/LAUNCH_DECISIONS.md` is signed and `CLEARESG_WS0_SIGNED_OFF=1`.

## Journey

- [ ] Sign up / sign in (or DEV bypass locally)
- [ ] Complete onboarding baseline
- [ ] Enter datapoints; attach evidence (OCR marked skipped)
- [ ] Approve/reject a datapoint (`/api/app/datapoints/approve`)
- [ ] Assign a datapoint with due date
- [ ] Send internal data request (`/dashboard/requests`)
- [ ] Invite one supplier; submit `/s/[token]`
- [ ] Open auditor trail for a datapoint (`/api/app/auditor/[id]`)
- [ ] Publish report only after `CLEARESG_DISCLAIMER_REVIEWED=1` in production
- [ ] Open living report `/r/[token]` — evidence hashes visible
- [ ] Download `/api/app/export`
- [ ] Consultant: invite pre-branded client
- [ ] Generate questionnaire export (`/dashboard/questionnaires`)
- [ ] Check `/api/app/telemetry` for hoursToFirstReport (may be null until events recorded)

## Satisfaction

- [ ] Completed without a support ticket
- [ ] Would-pay-again / renewal intent noted
