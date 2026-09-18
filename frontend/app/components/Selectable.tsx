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
  variant = "background",
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
  variant?: "background" | "underline";
}) {
  const isSelected = selectedIds.has(id);
  const isHovered = mode === "select" && hoveredId === id;
  const showAccent = isSelected || isHovered;

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
        variant === "background" && isHovered && !isSelected
          ? { backgroundColor: "var(--accent-soft)" }
          : undefined
      }
      className={`rounded transition-colors ${
        mode === "select" ? "cursor-pointer" : "cursor-default"
      } ${
        variant === "background"
          ? isSelected
            ? "bg-(--accent-soft) ring-1 ring-inset ring-(--accent)"
            : ""
          : showAccent
            ? "underline decoration-(--accent) decoration-2 underline-offset-4"
            : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
