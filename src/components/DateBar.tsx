"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

type DateBarGroup = {
  dateKey: string;
  label: string;
};

type DateBarProps = {
  ariaLabel: string;
  children: ReactNode;
  groups: DateBarGroup[];
  todayKey: string;
  todayLabel: string;
};

export function DateBar({ ariaLabel, children, groups, todayKey, todayLabel }: DateBarProps) {
  const hasToday = groups.some((group) => group.dateKey === todayKey);
  const [selectedKey, setSelectedKey] = useState(
    hasToday ? todayKey : groups[0]?.dateKey,
  );

  // Render every day's group but reveal only the one whose data-date-key
  // matches the selected pill. Toggling `hidden` (rather than unmounting) keeps
  // the uncontrolled prediction inputs mounted so typed values survive a day
  // switch.
  const childArray = Children.toArray(children).filter(isValidElement) as ReactElement<{
    "data-date-key"?: string;
    hidden?: boolean;
  }>[];

  return (
    <>
      <nav aria-label={ariaLabel} className="date-bar">
        {groups.map((group) => {
          const isSelected = group.dateKey === selectedKey;
          const isToday = group.dateKey === todayKey;
          return (
            <button
              aria-label={isToday ? `${group.label} (${todayLabel})` : undefined}
              aria-pressed={isSelected}
              className="date-bar-pill"
              data-today={isToday ? "" : undefined}
              key={group.dateKey}
              onClick={() => setSelectedKey(group.dateKey)}
              type="button"
            >
              {group.label}
            </button>
          );
        })}
      </nav>
      {childArray.map((child) =>
        cloneElement(child, {
          hidden: child.props["data-date-key"] !== selectedKey,
        }),
      )}
    </>
  );
}
