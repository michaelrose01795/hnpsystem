import { useCallback, useEffect, useState } from "react";

export default function usePersonalWidgets({
  widgets = [],
  onSaveWidgets,
  onUpdateWidget,
  onRemoveWidget,
  onAddWidget,
} = {}) {
  const [localWidgets, setLocalWidgets] = useState(widgets);

  useEffect(() => {
    setLocalWidgets(widgets);
  }, [widgets]);

  const applyWidgetChange = useCallback((id, changes) => {
    setLocalWidgets((current) =>
      current.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              ...changes,
            }
          : widget
      )
    );
  }, []);

  const persistWidget = useCallback(
    async (id, changes) => {
      const previous = localWidgets;
      applyWidgetChange(id, changes);
      try {
        await onUpdateWidget?.(id, changes);
      } catch (error) {
        setLocalWidgets(previous);
        throw error;
      }
    },
    [applyWidgetChange, localWidgets, onUpdateWidget]
  );

  const persistLayout = useCallback(
    async (nextWidgets) => {
      const previous = localWidgets;
      setLocalWidgets(nextWidgets);
      try {
        await onSaveWidgets?.(nextWidgets);
      } catch (error) {
        setLocalWidgets(previous);
        throw error;
      }
    },
    [localWidgets, onSaveWidgets]
  );

  return {
    widgets: localWidgets,
    setWidgets: setLocalWidgets,
    applyWidgetChange,
    persistWidget,
    persistLayout,
    addWidget: onAddWidget,
    removeWidget: onRemoveWidget,
  };
}
