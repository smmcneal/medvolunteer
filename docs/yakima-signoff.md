# Yakima Free Clinic — Go-Live Sign-Off Playbook
*How to identify the right person at Yakima, what they're approving, how to ask, and how to record it. Pairs with `docs/yakima-production-cutover.md` (Step 7).*

The goal is a clear, documented "yes, go live" from someone at the clinic with the authority to give it — so the cutover isn't blocked on ambiguity and there's a record if questions come up later.

---

## 1. Who should sign off

You need **one person with authority over the volunteer program and the clinic's operational decisions** — someone who can commit the organization, not just an enthusiastic user. Sign-off means they accept that the app becomes the clinic's real system of record for volunteers (real names, contact info, credentials, hours).

Likely roles, best first:
- **Executive Director / Clinic Director** — clearest authority; usually the right signer at a small free clinic.
- **Volunteer Services / Program Manager** — owns the day-to-day and is often delegated to approve.
- **Medical Director or Board chair** — only if the clinic is volunteer-run or the ED routes you there.

If your current champion (whoever you demoed to) isn't one of these, they're still your way in — ask them who signs off, or to bring that person into the loop.

## 2. How to confirm the contact (before sending anything)
1. Start from your existing relationship: identify who at Yakima you've been talking to and their exact title.
2. Ask that person one question: *"Who needs to approve making this the clinic's live volunteer system — you, or someone above you?"* That single question surfaces the real signer fast.
3. Capture, for the signer: **full name, title, email, phone**. Record it in the cutover doc / Notion so it's not lost.

## 3. What they're actually approving (the acceptance checklist)
Keep the ask concrete. This is the "definition of done" they're signing off on — share it with the email so approval is informed, not blind:

- **Scope** — volunteer applications, onboarding/pipeline, scheduling & shift sign-up, hour tracking/approval, credentials, learning modules, and messaging, delivered as an admin dashboard plus a volunteer mobile (PWA) app.
- **Go-live readiness** — the smoke-test items in the cutover runbook (logins, invite links, PWA install/offline, push, geofence clock-in/out) pass on the production URL.
- **Data & privacy** — the clinic's real volunteer data will live in the production database; access is restricted to designated clinic admins; the clinic is responsible for who it grants admin access to. (Not a HIPAA/patient system — volunteer records only. Flag if they expect otherwise.)
- **Admin ownership** — the named clinic admin(s) who will hold the keys after handoff.
- **Support & expectations** — what you'll provide post-launch (bug fixes, a support contact, response expectations) and any training/walkthrough you'll run.
- **Domain** — a heads-up that the public address (`yakima.envolv.app`) is being finalized and may follow shortly after go-live.

## 4. Outreach draft (email)
Short, so it actually gets read. Fill the brackets. Attach or paste the Section 3 checklist.

> **Subject:** Yakima Free Clinic volunteer app — ready for your go-ahead
>
> Hi [Contact first name],
>
> The volunteer management system for Yakima Free Clinic is built and tested, and I'd like your sign-off to switch it on as the clinic's live system.
>
> Quick version of what it does and what "go live" means is below — it covers volunteer applications, onboarding, scheduling, hour tracking, and messaging, through an admin dashboard for your staff and a mobile app for volunteers.
>
> Two small asks:
> 1. Could we do a 20-minute walkthrough this week so you and [admin name(s)] see it end to end?
> 2. After that, a reply confirming you're good to go live is all I need to flip it on.
>
> If you're not the right person to approve this, just point me to who is and I'll follow up with them.
>
> Thanks,
> [Your name]
> [phone] · [email]

**If you already know they're the signer and want to skip the meeting,** swap asks 1–2 for:

> Everything's ready on our end. If the summary below looks right, just reply "approved to go live" and I'll schedule the switch-over. Happy to walk you or your team through it first if you'd prefer.

## 5. How to capture the confirmation
- **Email reply is enough** for a small-clinic engagement — a clear "approved to go live" from the signer, kept on file. Save it (PDF/print) into the project record.
- **If you want something more formal,** turn Section 3 into a one-page "Go-Live Acceptance" with a signature/date line and have them sign (a DocuSign/e-sign connector can route it) — worth it if the clinic is process-heavy or a board is involved.
- **Record it** in `docs/yakima-production-cutover.md` (Step 7) and/or Notion: signer name, date, and where the approval lives. Then proceed to the Step 4-B env flip and smoke test.

---

### Notes
- Line up the contact **now**; do the actual sign-off **after** the production smoke test passes, so you're asking them to approve something they can see working.
- Sign-off does **not** depend on the `yakima.envolv.app` domain — you can go live on the current production URL and attach the domain later.
