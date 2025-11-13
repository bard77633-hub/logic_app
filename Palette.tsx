import React from 'react';
import type { ComponentType, ActiveTool } from '../types';

interface PaletteProps {
    onSelectComponentType: (type: ComponentType | null) => void;
    pendingComponentType: ComponentType | null;
    onReset: () => void;
    activeTool: ActiveTool;
    onSelectTool: (tool: ActiveTool) => void;
}

const componentTypes: ComponentType[] = ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT'];

const ToolButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`block w-full text-left p-3 mb-2 rounded-md transition-colors ${
            isActive ? 'bg-blue-600 font-bold' : 'bg-gray-700 hover:bg-gray-600'
        }`}
    >
        {label}
    </button>
);

export const Palette: React.FC<PaletteProps> = ({ onSelectComponentType, pendingComponentType, onReset, activeTool, onSelectTool }) => {
    return (
        <aside className="fixed top-0 left-0 w-[180px] h-full bg-gray-800 text-white p-3 box-border z-50 flex flex-col">
            <div>
                <h2 className="text-xl font-bold mb-2 text-center border-b border-gray-600 pb-2">Tools</h2>
                <ToolButton label="Select/Move" isActive={activeTool === 'select' && !pendingComponentType} onClick={() => onSelectTool('select')} />
                <ToolButton label="Delete" isActive={activeTool === 'delete'} onClick={() => onSelectTool('delete')} />
            </div>
            <div className="flex-grow mt-4">
                <h2 className="text-xl font-bold mb-2 text-center border-b border-gray-600 pb-2">Gates</h2>
                {componentTypes.map(type => (
                    <button
                        key={type}
                        onClick={() => onSelectComponentType(type)}
                        className={`block w-full text-left p-3 mb-2 rounded-md transition-colors ${
                            pendingComponentType === type
                                ? 'bg-blue-600 font-bold'
                                : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                    >
                        {type}
                    </button>
                ))}
            </div>
            <button
                onClick={onReset}
                className="block w-full p-3 bg-red-700 hover:bg-red-600 rounded-md transition-colors"
            >
                Reset
            </button>
        </aside>
    );
};