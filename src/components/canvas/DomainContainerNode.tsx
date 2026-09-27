'use client';

import React, { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import { CanvasRouteNode } from '@/lib/types/graph';
import { Box } from 'lucide-react';

// Domain container has zero DOM rendering on the main canvas (no boxes/outlines on canvas nodes)
// but provides the cluster geometry and bounding outlay for the bottom-right MiniMap.
function DomainContainerNodeComponent() {
  return null;
}

export default memo(DomainContainerNodeComponent);
