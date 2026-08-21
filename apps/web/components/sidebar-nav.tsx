import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/content", label: "Content" },
  { href: "/ideas", label: "Ideas" },
  { href: "/trends", label: "Trends" },
  { href: "/analytics", label: "Analytics" },
  { href: "/strategy", label: "Strategy" },
  { href: "/settings/persona", label: "Settings" },
];

export function SidebarNav() {
  return (
    <aside className="w-56 shrink-0 border-r border-border bg-muted/40 p-4">
      <div className="mb-6 px-2 text-sm font-semibold">Social Growth OS</div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
