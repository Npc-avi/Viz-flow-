'use client';

import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { CanvasRouteNode } from '@/lib/types/graph';
import { Box } from 'lucide-react';

function DomainContainerNodeComponent({ data }: NodeProps<CanvasRouteNode>) {
  const domainColor = (data.domainColor as string) || '#38bdf8';
  const containerWidth = (data.containerWidth as number) || 880;
  const containerHeight = (data.containerHeight as number) || 300;
  const endpointCount = (data.endpointCount as number) || 0;
  const domainName = (data.domainName as string) || 'Subsystem';

  return (
    <div
      style={{
        width: containerWidth,
        height: containerHeight,
        borderColor: `${domainColor}60`,
        backgroundColor: `${domainColor}08`,
        boxShadow: `0 16px 40px -8px ${domainColor}20`,
      }}
      className="pointer-events-none rounded-3xl border-2 border-dashed relative select-none transition-all duration-300"
    >
      {/* Top Banner / Domain Badge */}
      <div className="absolute top-4 left-6 flex items-center gap-2">
        <div
          style={{ backgroundColor: `${domainColor}20`, borderColor: `${domainColor}50` }}
          className="px-3 py-1 rounded-xl border flex items-center gap-2 backdrop-blur-md shadow-sm"
        >
          <Box style={{ color: domainColor }} className="w-3.5 h-3.5" />
          <span
            style={{ color: domainColor }}
            className="text-xs font-bold tracking-wide uppercase font-mono"
          >
            {domainName}
          </span>
          <span className="text-[10px] text-slate-400 font-mono bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800">
            {endpointCount} Endpoint{endpointCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(DomainContainerNodeComponent);
