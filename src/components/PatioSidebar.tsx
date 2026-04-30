'use client';

import type { Patio } from '@/lib/patios/types';

type Props = {
  patios: Patio[];
  activeId: string | null;
  drawMode: boolean;
  onSetActive: (id: string | null) => void;
  onToggleDraw: () => void;
  onDelete: (id: string) => void;
};

export function PatioSidebar({
  patios,
  activeId,
  drawMode,
  onSetActive,
  onToggleDraw,
  onDelete,
}: Props) {
  return (
    <aside className="flex h-full w-72 flex-col gap-3 border-l border-neutral-200 bg-white/95 p-4 backdrop-blur">
      <h2 className="text-base font-semibold">Patios</h2>
      <button
        onClick={onToggleDraw}
        className={
          drawMode
            ? 'rounded bg-red-100 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-200'
            : 'rounded bg-yellow-400 px-3 py-2 text-sm font-medium text-black hover:bg-yellow-500'
        }
      >
        {drawMode ? 'Cancel drawing' : 'Draw a new patio'}
      </button>
      {patios.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No patios yet. Click <em>Draw a new patio</em>, click points on the map, then double-click to finish.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto">
          {patios.map((p) => (
            <li
              key={p.id}
              className={
                activeId === p.id
                  ? 'flex items-center justify-between rounded bg-yellow-100 px-2 py-1 text-sm'
                  : 'flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-neutral-100'
              }
            >
              <button
                className="flex-1 truncate text-left"
                onClick={() => onSetActive(p.id)}
                aria-pressed={activeId === p.id}
              >
                {p.name}
              </button>
              <button
                onClick={() => onDelete(p.id)}
                aria-label={`Delete ${p.name}`}
                className="ml-2 text-xs text-neutral-500 hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto text-[10px] leading-snug text-neutral-400">
        Buildings: 3D Massing, City of Toronto. Contains information licensed under the Open Government Licence – Toronto.
      </p>
    </aside>
  );
}
