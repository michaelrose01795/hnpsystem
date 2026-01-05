// file location: src/components/scrollAPI/ScrollArea.js
import React from "react";

const baseScrollStyles = {
  overflowY: "auto",
  overflowX: "hidden",
  scrollbarWidth: "thin",
  WebkitOverflowScrolling: "touch",
  position: "relative",
  width: "100%",
};

export default function ScrollArea({
  children,
  height = "100%",
  minHeight,
  maxHeight,
  padding = 0,
  style = {},
  className = "",
  ...rest
}) {
  const resolvedMaxHeight = maxHeight || height;

  return (
    <div
      className={className}
      style={{
        ...baseScrollStyles,
        padding,
        minHeight,
        maxHeight: resolvedMaxHeight,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
