
import { ComponentType } from './types';

export const PALETTE_WIDTH = 180;

export const COMPONENT_CONFIG: Record<ComponentType, { 
    width: number; 
    height: number; 
    inputs: {y: number}[]; 
    outputs: {y: number}[];
}> = {
  INPUT: { width: 60, height: 50, inputs: [], outputs: [{y: 25}] },
  OUTPUT: { width: 60, height: 60, inputs: [{y: 30}], outputs: [] },
  AND: { width: 80, height: 50, inputs: [{y: 15}, {y: 35}], outputs: [{y: 25}] },
  OR: { width: 80, height: 50, inputs: [{y: 15}, {y: 35}], outputs: [{y: 25}] },
  NOT: { width: 80, height: 50, inputs: [{y: 25}], outputs: [{y: 25}] },
};
