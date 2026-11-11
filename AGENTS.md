<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep ongoing timer drafts in user-scoped browser storage and their transitions in `src/lib/task-timing.ts`; this preserves paused time across navigation without treating unfinished tasks as completed reports.
- Complete timed tasks with their stable UUID and an ignore-duplicate insert; this makes repeated clicks and uncertain network retries safe.
- Enforce work-location cardinality with a unique user index and shared onboarding validation; replace assignments atomically with an upsert so location changes cannot leave partial assignments.
- Store location review results in a separate reviewer-only event table populated by database triggers; employees must never receive mismatch flags through attendance reads or RPCs.
- Use authenticated, bounded Google Places searches for personal location selection and browser Maps Embed for map previews; device GPS is captured only after an explicit attendance-action prompt.
