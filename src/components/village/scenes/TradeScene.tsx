export default function TradeScene() {
  return (
    <div className="space-y-4 text-slate-200">
      <p className="text-base leading-7 text-slate-300">
        The trade overlay is the entry point for the 1:1 adult exchange system. It will later use trade codes, validation, and transaction-safe ownership transfer.
      </p>
      <div className="rounded-3xl border border-slate-700/80 bg-slate-900/80 p-5 text-sm text-slate-200">
        <p className="font-semibold text-slate-100">Trade placeholder</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-400">
          <li>Create and lock a trade offer with a code</li>
          <li>Accept another player’s trade code</li>
          <li>Complete exchange in a transactional flow</li>
        </ul>
      </div>
    </div>
  );
}
