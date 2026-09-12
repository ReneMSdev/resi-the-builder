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
      className={`cursor-pointer rounded transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
        isSelected
          ? "bg-blue-100 ring-1 ring-inset ring-blue-400 hover:bg-blue-100 dark:bg-blue-950 dark:ring-blue-600 dark:hover:bg-blue-950"
          : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
