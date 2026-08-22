import Link from "next/link";

type FilterableAccount = {
  id: string;
  platform: string;
  username: string | null;
  displayName: string | null;
};

/**
 * Account picker for pages that aggregate across a workspace's posts
 * (Analytics, Strategy). "All accounts" pools every account together —
 * once a workspace has more than one platform connected (Phase 3 X/
 * Instagram), blending their performance together stops being meaningful,
 * so pages that need per-account numbers link here with `?accountId=`.
 */
export function AccountFilterBar({
  accounts,
  basePath,
  selectedAccountId,
}: {
  accounts: FilterableAccount[];
  basePath: string;
  selectedAccountId?: string;
}) {
  if (accounts.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-2">
      <Link
        href={basePath}
        className={`rounded-md px-3 py-1.5 text-sm ${
          !selectedAccountId ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
        }`}
      >
        All accounts
      </Link>
      {accounts.map((account) => (
        <Link
          key={account.id}
          href={`${basePath}?accountId=${account.id}`}
          className={`rounded-md px-3 py-1.5 text-sm ${
            selectedAccountId === account.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {account.username ? `@${account.username}` : (account.displayName ?? account.id)}
          <span className="ml-1 opacity-70">({account.platform})</span>
        </Link>
      ))}
    </div>
  );
}
