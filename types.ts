
export type ComponentType = 'INPUT' | 'OUTPUT' | 'AND' | 'OR' | 'NOT';

export type ActiveTool = 'select' | 'delete';

export interface LogicComponent {
  id: string;
  type: ComponentType;
  position: { x: number; y: number };
  state: boolean;
}

export interface Wire {
  id:string;
  fromComponentId: string;
  toComponentId: string;
  toTerminalIndex: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface DraggingWire {
  startComponentId: string;
  startPos: Point;
  currentPos: Point;
}
