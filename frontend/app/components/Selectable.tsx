"use client";

export function Selectable({
  id,
  selectedIds,
  onToggle,
  className = "",
  children,
  as: Tag = "div",
}: {
  id: string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  className?: string;
  children: React.ReactNode;
  as?: "div" | "li";
}) {
  const isSelected = selectedIds.has(id);

  return (
    <Tag
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onToggle(id);
      }}
      className={`cursor-pointer rounded transition-colors hover:bg-[var(--accent-soft)] ${
        isSelected
          ? "bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent)] hover:bg-[var(--accent-soft)]"
          : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
