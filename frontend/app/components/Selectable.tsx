"use client";

export function Selectable({
  id,
  selectedIds,
  onToggle,
  mode,
  hoveredId,
  onHover,
  className = "",
  children,
  as: Tag = "div",
}: {
  id: string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  mode: "select" | "edit";
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  className?: string;
  children: React.ReactNode;
  as?: "div" | "li";
}) {
  const isSelected = selectedIds.has(id);
  const isHovered = hoveredId === id;
  const hoverColor = mode === "edit" ? "var(--edit-soft)" : "var(--accent-soft)";

  return (
    <Tag
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        if (mode === "select") onToggle(id);
      }}
      onMouseOver={(e: React.MouseEvent) => {
        e.stopPropagation();
        onHover(id);
      }}
      onMouseOut={(e: React.MouseEvent) => {
        e.stopPropagation();
        onHover(null);
      }}
      style={
        isSelected
          ? undefined
          : isHovered
            ? { backgroundColor: hoverColor }
            : undefined
      }
      className={`rounded transition-colors ${
        mode === "select" ? "cursor-pointer" : "cursor-default"
      } ${
        isSelected
          ? "bg-(--accent-soft) ring-1 ring-inset ring-(--accent)"
          : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
