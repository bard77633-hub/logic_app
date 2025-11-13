import React, { useState, useCallback, useRef } from 'react';
import { COMPONENT_CONFIG, PALETTE_WIDTH } from '../constants';
import type { LogicComponent, Point, ActiveTool } from '../types';

interface ComponentNodeProps {
    component: LogicComponent;
    state: boolean;
    workspaceRef: React.RefObject<HTMLDivElement>;
    onMove: (id: string, position: Point) => void;
    onToggle: (id: string) => void;
    onWireStart: (startComponentId: string, startPos: Point) => void;
    onWireEnd: (endComponentId: string | null, endTerminalIndex: number | null) => void;
    activeTool: ActiveTool;
    onDelete: (id: string) => void;
}

const Terminal: React.FC<{ onMouseDown?: () => void; onMouseUp?: () => void, className: string, style?: React.CSSProperties }> = ({ onMouseDown, onMouseUp, className, style }) => (
    <div
        onMouseDown={(e) => { e.stopPropagation(); onMouseDown?.(); }}
        onMouseUp={(e) => { e.stopPropagation(); onMouseUp?.(); }}
        className={`absolute w-4 h-4 bg-white border-2 border-gray-700 rounded-full z-30 cursor-crosshair hover:bg-blue-200 ${className}`}
        style={style}
    />
);

const ANDShape: React.FC = () => (
    <div className="absolute inset-0 bg-white border-2 border-gray-700" style={{ borderRadius: '5px 25px 25px 5px' }}></div>
);

const ORShape: React.FC = () => (
    <svg viewBox="0 0 80 50" className="absolute w-full h-full">
        <path d="M2,2 Q 35,25 2,48 L 40,48 Q 80,25 40,2 Z" className="fill-white stroke-gray-700" strokeWidth="2" />
    </svg>
);

const NOTShape: React.FC = () => (
    <svg viewBox="0 0 80 50" className="absolute w-full h-full overflow-visible">
        <polygon points="5,2 50,25 5,48" className="fill-white stroke-gray-700" strokeWidth="2" />
    </svg>
);


export const ComponentNode: React.FC<ComponentNodeProps> = ({ component, state, workspaceRef, onMove, onToggle, onWireStart, onWireEnd, activeTool, onDelete }) => {
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const config = COMPONENT_CONFIG[component.type];

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (activeTool !== 'select') return;

        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - component.position.x - PALETTE_WIDTH,
            y: e.clientY - component.position.y,
        };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            if (workspaceRef.current) {
                const newX = moveEvent.clientX - dragOffset.current.x - PALETTE_WIDTH;
                const newY = moveEvent.clientY - dragOffset.current.y;
                onMove(component.id, { x: newX, y: newY });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [component.id, component.position, onMove, workspaceRef, activeTool]);

    const handleClick = () => {
        if (activeTool === 'delete') {
            onDelete(component.id);
            return;
        }
        if (component.type === 'INPUT') {
            onToggle(component.id);
        }
    };
    
    const getTerminalPosition = (type: 'in' | 'out', index: number): Point => {
        const terminals = type === 'in' ? config.inputs : config.outputs;
        const terminal = terminals[index];
        const x = component.position.x + (type === 'out' ? config.width : 0);
        const y = component.position.y + terminal.y;
        return { x, y };
    };
    
    const baseClasses = "absolute flex items-center justify-center font-bold text-sm select-none z-20";
    let typeClasses = "";
    let children: React.ReactNode = <div className="z-10">{component.type}</div>;

    switch (component.type) {
        case 'INPUT':
            typeClasses = `cursor-pointer ${state ? 'bg-red-500 text-white shadow-lg shadow-red-500/50' : 'bg-gray-300 text-gray-800'} border-2 border-gray-700 rounded-md`;
            children = <div className="z-10">{state ? 'ON' : 'OFF'}</div>;
            break;
        case 'OUTPUT':
            typeClasses = `rounded-full ${state ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-gray-300'} border-2 border-gray-700`;
            children = <div className="z-10">OUT</div>;
            break;
        case 'AND':
        case 'OR':
        case 'NOT':
             typeClasses = "bg-transparent";
             if(component.type === 'NOT') {
                children = <div className="z-10" style={{position: 'absolute', left: '15px'}}>NOT</div>
             }
             break;
    }

    const renderShape = () => {
        switch (component.type) {
            case 'AND': return <ANDShape />;
            case 'OR': return <ORShape />;
            case 'NOT': return <NOTShape />;
            default: return null;
        }
    }

    const getCursor = () => {
        if (activeTool === 'delete') return 'crosshair';
        if (isDragging) return 'grabbing';
        if (component.type === 'INPUT') return 'pointer';
        return 'grab';
    }


    return (
        <div
            className={`${baseClasses} ${typeClasses}`}
            style={{
                left: component.position.x,
                top: component.position.y,
                width: config.width,
                height: config.height,
                cursor: getCursor(),
            }}
            onMouseDown={handleMouseDown}
            onClick={handleClick}
        >
            {renderShape()}
            {children}

            {config.inputs.map((terminal, i) => (
                <Terminal 
                    key={`in-${i}`}
                    onMouseUp={() => onWireEnd(component.id, i)}
                    className="left-[-10px]"
                    style={{ top: `${terminal.y}px`, transform: 'translateY(-50%)' }} 
                />
            ))}

            {config.outputs.map((terminal, i) => (
                <Terminal
                    key={`out-${i}`}
                    onMouseDown={() => {
                        if (activeTool === 'select') {
                            onWireStart(component.id, getTerminalPosition('out', i))
                        }
                    }}
                    className="right-[-10px]"
                    style={{ top: `${terminal.y}px`, transform: 'translateY(-50%)' }}
                />
            ))}
        </div>
    );
};