export default function MailboxScene() {
  return (
    <div className="space-y-4 text-slate-200">
      <p className="text-base leading-7 text-slate-300">
        The mailbox overlay is a gateway to the global guestbook. It will later show posts, allow writing new entries, and support deletion of your own messages.
      </p>
      <div className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-5 text-sm text-slate-200">
        <p className="font-semibold text-slate-100">Placeholder features</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-400">
          <li>Latest guestbook entries</li>
          <li>Write new messages subject to limits</li>
          <li>Author-only deletion controls</li>
        </ul>
      </div>
    </div>
  );
}
