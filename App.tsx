import React, { useState, useCallback, useEffect } from 'react';
import { Palette } from './components/Palette';
import { Workspace } from './components/Workspace';
import type { LogicComponent, Wire, ComponentType, DraggingWire, Point, ActiveTool } from './types';

const initialComponents: LogicComponent[] = [
  { id: 'input_1', type: 'INPUT', position: { x: 100, y: 100 }, state: false },
  { id: 'input_2', type: 'INPUT', position: { x: 100, y: 200 }, state: false },
  { id: 'and_1', type: 'AND', position: { x: 250, y: 150 }, state: false },
  { id: 'output_1', type: 'OUTPUT', position: { x: 450, y: 145 }, state: false },
];

const initialWires: Wire[] = [
  { id: 'wire_1', fromComponentId: 'input_1', toComponentId: 'and_1', toTerminalIndex: 0 },
  { id: 'wire_2', fromComponentId: 'input_2', toComponentId: 'and_1', toTerminalIndex: 1 },
  { id: 'wire_3', fromComponentId: 'and_1', toComponentId: 'output_1', toTerminalIndex: 0 },
];

const initialComponentStates = Object.fromEntries(initialComponents.map(c => [c.id, c.state]));


const App: React.FC = () => {
    const [components, setComponents] = useState<LogicComponent[]>(initialComponents);
    const [wires, setWires] = useState<Wire[]>(initialWires);
    const [componentStates, setComponentStates] = useState<Record<string, boolean>>(initialComponentStates);
    const [wireStates, setWireStates] = useState<Record<string, boolean>>({});
    const [draggingWire, setDraggingWire] = useState<DraggingWire | null>(null);
    const [activeTool, setActiveTool] = useState<ActiveTool>('select');
    const [pendingComponentType, setPendingComponentType] = useState<ComponentType | null>(null);

    const handleSelectComponentType = useCallback((type: ComponentType | null) => {
        setPendingComponentType(prev => prev === type ? null : type);
        if (type) {
            setActiveTool('select');
        }
    }, []);

    const handleAddComponent = useCallback((type: ComponentType, position: Point) => {
        const newComponent: LogicComponent = {
            id: `comp_${Date.now()}`,
            type,
            position,
            state: false,
        };
        setComponents(prev => [...prev, newComponent]);
        setComponentStates(prev => ({ ...prev, [newComponent.id]: false }));
        setPendingComponentType(null);
    }, []);

    const handleReset = useCallback(() => {
        setComponents([]);
        setWires([]);
        setComponentStates({});
        setWireStates({});
        setPendingComponentType(null);
    }, []);

    const handleDeleteComponent = useCallback((id: string) => {
        setComponents(prev => prev.filter(c => c.id !== id));
        setWires(prev => prev.filter(w => w.fromComponentId !== id && w.toComponentId !== id));
    }, []);

    const handleDeleteWire = useCallback((id: string) => {
        setWires(prev => prev.filter(w => w.id !== id));
    }, []);

    const handleComponentMove = useCallback((id: string, position: Point) => {
        setComponents(prev => prev.map(c => c.id === id ? { ...c, position } : c));
    }, []);
    
    const handleSelectTool = useCallback((tool: ActiveTool) => {
        setActiveTool(tool);
        setPendingComponentType(null);
    }, []);

    const handleToggleInput = useCallback((id: string) => {
        setComponentStates(prev => ({...prev, [id]: !prev[id]}));
    }, []);

    const handleWireStart = useCallback((startComponentId: string, startPos: Point) => {
        setDraggingWire({ startComponentId, startPos, currentPos: startPos });
    }, []);
    
    const handleWireMove = useCallback((currentPos: Point) => {
        if (draggingWire) {
            setDraggingWire(prev => prev ? { ...prev, currentPos } : null);
        }
    }, [draggingWire]);

    const handleWireEnd = useCallback((endComponentId: string | null, endTerminalIndex: number | null) => {
        if (draggingWire && endComponentId !== null && endTerminalIndex !== null) {
            const fromId = draggingWire.startComponentId;
            const toId = endComponentId;

            if (fromId === toId) {
                setDraggingWire(null);
                return;
            }

            const isOccupied = wires.some(w => w.toComponentId === toId && w.toTerminalIndex === endTerminalIndex);
            if(isOccupied) {
                setDraggingWire(null);
                return;
            }

            const newWire: Wire = {
                id: `wire_${Date.now()}`,
                fromComponentId: fromId,
                toComponentId: toId,
                toTerminalIndex: endTerminalIndex,
            };
            setWires(prev => [...prev, newWire]);
        }
        setDraggingWire(null);
    }, [draggingWire, wires]);
    
    useEffect(() => {
        const newComponentStates: Record<string, boolean> = { ...componentStates };
        const newWireStates: Record<string, boolean> = {};

        const maxIterations = components.length + 5;

        for (let i = 0; i < maxIterations; i++) {
            let changed = false;
            components.forEach(comp => {
                if (comp.type === 'INPUT') return;

                const getInputState = (terminalIndex: number): boolean => {
                    const wire = wires.find(w => w.toComponentId === comp.id && w.toTerminalIndex === terminalIndex);
                    if (!wire) return false;
                    return newComponentStates[wire.fromComponentId] || false;
                };

                let newState = false;
                switch (comp.type) {
                    case 'AND':
                        newState = getInputState(0) && getInputState(1);
                        break;
                    case 'OR':
                        newState = getInputState(0) || getInputState(1);
                        break;
                    case 'NOT':
                        newState = !getInputState(0);
                        break;
                    case 'OUTPUT':
                        newState = getInputState(0);
                        break;
                }
                
                if (newComponentStates[comp.id] !== newState) {
                    newComponentStates[comp.id] = newState;
                    changed = true;
                }
            });
            if (!changed && i > 0) break;
        }
        
        wires.forEach(wire => {
            newWireStates[wire.id] = newComponentStates[wire.fromComponentId] || false;
        });

        if (JSON.stringify(componentStates) !== JSON.stringify(newComponentStates)) {
            setComponentStates(newComponentStates);
        }
        if (JSON.stringify(wireStates) !== JSON.stringify(newWireStates)) {
            setWireStates(newWireStates);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [components, wires, JSON.stringify(Object.fromEntries(Object.entries(componentStates).filter(([key]) => components.find(c => c.id === key && c.type === 'INPUT'))))]);

    return (
        <div className="w-screen h-screen bg-gray-100 font-sans select-none">
            <Palette 
              onSelectComponentType={handleSelectComponentType}
              pendingComponentType={pendingComponentType}
              onReset={handleReset} 
              activeTool={activeTool}
              onSelectTool={handleSelectTool}
            />
            <Workspace
                components={components}
                wires={wires}
                componentStates={componentStates}
                wireStates={wireStates}
                onComponentMove={handleComponentMove}
                onToggleInput={handleToggleInput}
                onWireStart={handleWireStart}
                onWireMove={handleWireMove}
                onWireEnd={handleWireEnd}
                draggingWire={draggingWire}
                activeTool={activeTool}
                onDeleteComponent={handleDeleteComponent}
                onDeleteWire={handleDeleteWire}
                onAddComponent={handleAddComponent}
                pendingComponentType={pendingComponentType}
            />
        </div>
    );
};

export default App;