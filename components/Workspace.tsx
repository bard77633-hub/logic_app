import React, { useRef, useMemo, useCallback } from 'react';
import { ComponentNode } from './ComponentNode';
import { COMPONENT_CONFIG, PALETTE_WIDTH } from '../constants';
import type { LogicComponent, Wire, DraggingWire, Point, ActiveTool, ComponentType } from '../types';

interface WorkspaceProps {
    components: LogicComponent[];
    wires: Wire[];
    componentStates: Record<string, boolean>;
    wireStates: Record<string, boolean>;
    onComponentMove: (id: string, position: Point) => void;
    onToggleInput: (id: string) => void;
    onWireStart: (startComponentId: string, startPos: Point) => void;
    onWireMove: (currentPos: Point) => void;
    onWireEnd: (endComponentId: string | null, endTerminalIndex: number | null) => void;
    draggingWire: DraggingWire | null;
    activeTool: ActiveTool;
    onDeleteComponent: (id: string) => void;
    onDeleteWire: (id: string) => void;
    onAddComponent: (type: ComponentType, position: Point) => void;
    pendingComponentType: ComponentType | null;
}

const WirePath: React.FC<{ d: string; state: boolean, activeTool: ActiveTool, onClick: () => void; }> = ({ d, state, activeTool, onClick }) => {
    const isDeleteMode = activeTool === 'delete';
    return (
      <path
        d={d}
        onClick={isDeleteMode ? onClick : undefined}
        className={`fill-none transition-all 
            ${state ? 'stroke-red-500 stroke-[4]' : 'stroke-gray-700 stroke-[3]'}
            ${isDeleteMode ? 'pointer-events-stroke cursor-pointer hover:stroke-red-700' : ''}
        `}
      />
    );
}

export const Workspace: React.FC<WorkspaceProps> = ({
    components,
    wires,
    componentStates,
    wireStates,
    onComponentMove,
    onToggleInput,
    onWireStart,
    onWireMove,
    onWireEnd,
    draggingWire,
    activeTool,
    onDeleteComponent,
    onDeleteWire,
    onAddComponent,
    pendingComponentType,
}) => {
    const workspaceRef = useRef<HTMLDivElement>(null);

    const getTerminalPosition = (component: LogicComponent, type: 'in' | 'out', index: number): Point => {
        const config = COMPONENT_CONFIG[component.type];
        const terminals = type === 'in' ? config.inputs : config.outputs;
        const terminal = terminals[index];
        const x = component.position.x + (type === 'out' ? config.width : 0);
        const y = component.position.y + terminal.y;
        return { x, y };
    };

    const wirePaths = useMemo(() => {
        return wires.map(wire => {
            const fromComponent = components.find(c => c.id === wire.fromComponentId);
            const toComponent = components.find(c => c.id === wire.toComponentId);
            if (!fromComponent || !toComponent) return null;

            const startPos = getTerminalPosition(fromComponent, 'out', 0);
            const endPos = getTerminalPosition(toComponent, 'in', wire.toTerminalIndex);
            
            const d = `M ${startPos.x} ${startPos.y} C ${startPos.x + 50} ${startPos.y}, ${endPos.x - 50} ${endPos.y}, ${endPos.x} ${endPos.y}`;
            return <WirePath key={wire.id} d={d} state={wireStates[wire.id] || false} activeTool={activeTool} onClick={() => onDeleteWire(wire.id)}/>;
        }).filter(Boolean);
    }, [wires, components, wireStates, activeTool, onDeleteWire]);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (draggingWire && workspaceRef.current) {
            const rect = workspaceRef.current.getBoundingClientRect();
            onWireMove({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            });
        }
    };

    const handleMouseUp = () => {
        if (draggingWire) {
            onWireEnd(null, null);
        }
    };

    const handleWorkspaceClick = useCallback((e: React.MouseEvent) => {
        if (pendingComponentType && workspaceRef.current) {
            const rect = workspaceRef.current.getBoundingClientRect();
            onAddComponent(pendingComponentType, {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
        }
    }, [pendingComponentType, onAddComponent]);
    
    const getWorkspaceCursor = () => {
        if (pendingComponentType) return 'copy';
        if (activeTool === 'delete') return 'crosshair';
        return 'default';
    };

    return (
        <main
            ref={workspaceRef}
            className={`absolute top-0 right-0 bottom-0 bg-white`}
            style={{ 
                left: `${PALETTE_WIDTH}px`,
                width: `calc(100% - ${PALETTE_WIDTH}px)`,
                backgroundImage: 'linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                cursor: getWorkspaceCursor(),
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onClick={handleWorkspaceClick}
        >
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                {wirePaths}
                {draggingWire && (
                    <path
                        d={`M ${draggingWire.startPos.x} ${draggingWire.startPos.y} L ${draggingWire.currentPos.x} ${draggingWire.currentPos.y}`}
                        className="stroke-blue-500 stroke-[3] stroke-dasharray-[5,5]"
                    />
                )}
            </svg>

            {components.map(component => (
                <ComponentNode
                    key={component.id}
                    component={component}
                    state={componentStates[component.id] || false}
                    workspaceRef={workspaceRef}
                    onMove={onComponentMove}
                    onToggle={onToggleInput}
                    onWireStart={onWireStart}
                    onWireEnd={onWireEnd}
                    activeTool={activeTool}
                    onDelete={onDeleteComponent}
                />
            ))}
        </main>
    );
};
