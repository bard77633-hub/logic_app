(function() {
    'use strict';

    // --- DOM要素の取得 ---
    const palette = document.getElementById('palette');
    const canvas = document.getElementById('canvas');
    const wireLayer = document.getElementById('wire-layer');
    const toolButtons = document.querySelectorAll('#palette .tool-button');
    const componentButtons = document.querySelectorAll('#palette .component-button');
    const resetButton = document.getElementById('reset-button');

    // --- アプリケーションの状態 ---
    let state = {
        components: [], // { id, type, x, y, value, element }
        wires: [],      // { id, fromId, fromTerminal, toId, toTerminal, element }
        currentTool: 'POINTER', // POINTER, WIRE, DELETE
        nextId: 0,
        wireDrag: null,   // { fromId, fromTerminal, fromElement, tempLine }
        dragState: null,  // { component, offsetX, offsetY }
        canvasOffset: { left: 0, top: 0 }
    };

    // --- 初期化 ---
    function initialize() {
        bindEvents();
        updateCanvasOffset();
        console.log("論理回路シミュレータが初期化されました。");
    }

    // --- イベントバインディング ---
    function bindEvents() {
        // ツール選択
        toolButtons.forEach(button => {
            button.addEventListener('click', selectTool);
        });

        // コンポーネント追加ボタン
        componentButtons.forEach(button => {
            button.addEventListener('click', selectComponentToAdd);
        });

        // リセット
        resetButton.addEventListener('click', resetCanvas);

        // キャンバスへの操作 (マウスとタッチの両対応)
        canvas.addEventListener('mousedown', handleInteractionStart);
        canvas.addEventListener('touchstart', handleInteractionStart, { passive: false });

        document.addEventListener('mousemove', handleInteractionMove);
        document.addEventListener('touchmove', handleInteractionMove, { passive: false });

        document.addEventListener('mouseup', handleInteractionEnd);
        document.addEventListener('touchend', handleInteractionEnd);

        // ウィンドウリサイズ時にオフセットを再計算
        window.addEventListener('resize', updateCanvasOffset);
    }

    // --- ツール切り替え ---
    function selectTool(e) {
        const selectedTool = e.currentTarget.dataset.tool;
        if (selectedTool) {
            state.currentTool = selectedTool;
            
            toolButtons.forEach(btn => btn.classList.remove('active'));
            componentButtons.forEach(btn => btn.classList.remove('active'));
            
            e.currentTarget.classList.add('active');
        }
    }

    // --- コンポーネント追加モード ---
    function selectComponentToAdd(e) {
        const type = e.currentTarget.dataset.type;
        state.currentTool = `ADD_${type}`;
        
        toolButtons.forEach(btn => btn.classList.remove('active'));
        componentButtons.forEach(btn => btn.classList.remove('active'));
        
        e.currentTarget.classList.add('active');
    }

    // --- 全リセット ---
    function resetCanvas() {
        if (confirm('本当にすべての回路をリセットしますか？')) {
            state.components = [];
            state.wires = [];
            state.nextId = 0;
            canvas.innerHTML = '';
            wireLayer.innerHTML = '';
        }
    }

    // --- キャンバスのオフセット更新 ---
    function updateCanvasOffset() {
        const rect = canvas.getBoundingClientRect();
        state.canvasOffset = { left: rect.left, top: rect.top };
    }

    // --- 座標取得ユーティリティ ---
    function getCoords(e) {
        let x, y;
        if (e.changedTouches) { // タッチイベント
            x = e.changedTouches[0].clientX;
            y = e.changedTouches[0].clientY;
        } else { // マウスイベント
            x = e.clientX;
            y = e.clientY;
        }
        return {
            x: x - state.canvasOffset.left,
            y: y - state.canvasOffset.top
        };
    }

    // --- 操作開始 (MouseDown / TouchStart) ---
    function handleInteractionStart(e) {
        e.preventDefault();
        const coords = getCoords(e);
        const target = e.target;
        
        const targetComponent = target.closest('.component');
        const targetTerminal = target.closest('.terminal');

        // ツールに応じた処理
        switch (state.currentTool) {
            case 'POINTER':
                if (targetTerminal) {
                    return;
                }
                if (targetComponent) {
                    if (targetComponent.dataset.type === 'INPUT') {
                        // INPUTのトグル
                        toggleInput(targetComponent);
                    } else {
                        // コンポーネントのドラッグ開始
                        startDrag(targetComponent, coords);
                    }
                }
                break;
            
            case 'WIRE':
                if (targetTerminal) {
                    startWire(targetTerminal);
                }
                break;

            case 'DELETE':
                if (targetTerminal) {
                    deleteWiresConnectedTo(targetTerminal);
                } else if (targetComponent) {
                    deleteComponent(targetComponent.dataset.id);
                }
                break;

            default:
                if (state.currentTool.startsWith('ADD_')) {
                    const type = state.currentTool.split('_')[1];
                    createComponent(type, coords.x, coords.y);
                    document.getElementById('tool-pointer').click();
                }
                break;
        }
    }

    // --- 操作中 (MouseMove / TouchMove) ---
    function handleInteractionMove(e) {
        // === 修正点 (1/3): ドラッグ中・結線中はスクロールを禁止 ===
        // INPUTのクリック操作がmoveイベントでキャンセルされるのを防ぐ
        if (state.dragState || state.wireDrag) {
            e.preventDefault();
        }

        if (state.dragState) {
            const coords = getCoords(e);
            const comp = state.dragState.component;
            
            let newX = coords.x - state.dragState.offsetX;
            let newY = coords.y - state.dragState.offsetY;
            
            newX = Math.round(newX / 20) * 20;
            newY = Math.round(newY / 20) * 20;

            comp.element.style.transform = `translate(${newX}px, ${newY}px)`;
            comp.x = newX;
            comp.y = newY;

            updateWires(comp.id);
        }

        if (state.wireDrag) {
            const coords = getCoords(e);
            state.wireDrag.tempLine.setAttribute('x2', coords.x);
            state.wireDrag.tempLine.setAttribute('y2', coords.y);
        }
    }

    // --- 操作終了 (MouseUp / TouchEnd) ---
    function handleInteractionEnd(e) {
        if (state.dragState) {
            state.dragState = null;
        }

        if (state.wireDrag) {
            const coords = getCoords(e);
            const endTarget = document.elementFromPoint(
                coords.x + state.canvasOffset.left, 
                coords.y + state.canvasOffset.top
            );
            const endTerminal = endTarget ? endTarget.closest('.terminal') : null;

            if (endTerminal) {
                createWire(endTerminal);
            }
            
            wireLayer.removeChild(state.wireDrag.tempLine);
            state.wireDrag = null;
        }
    }

    // --- コンポーネント作成 ---
    function createComponent(type, x, y) {
        const id = state.nextId++;
        const element = document.createElement('div');
        element.classList.add('component', type);
        element.dataset.id = id;
        element.dataset.type = type;

        x = Math.round(x / 20) * 20;
        y = Math.round(y / 20) * 20;
        
        element.style.transform = `translate(${x}px, ${y}px)`;

        const label = document.createElement('span');
        label.classList.add('label');
        label.textContent = type;
        element.appendChild(label);
        
        addTerminals(element, type);

        const component = {
            id: id,
            type: type,
            x: x,
            y: y,
            value: (type === 'INPUT') ? 0 : null, // INPUTはデフォルトOFF
            element: element
        };

        state.components.push(component);
        canvas.appendChild(element);
    }

    // --- 端子の追加 ---
    function addTerminals(element, type) {
        if (type !== 'INPUT') {
            const in0 = document.createElement('div');
            in0.classList.add('terminal', 'in-0');
            in0.dataset.terminalId = 'in-0';
            element.appendChild(in0);
            
            if (type === 'AND' || type === 'OR') {
                const in1 = document.createElement('div');
                in1.classList.add('terminal', 'in-1');
                in1.dataset.terminalId = 'in-1';
                element.appendChild(in1);
            }
        }
        if (type !== 'OUTPUT') {
            const out0 = document.createElement('div');
            out0.classList.add('terminal', 'out');
            out0.dataset.terminalId = 'out-0';
            element.appendChild(out0);
        }
    }

    // --- コンポーネントのドラッグ開始 ---
    function startDrag(element, coords) {
        const id = parseInt(element.dataset.id);
        const component = findComponent(id);
        
        const offsetX = coords.x - component.x;
        const offsetY = coords.y - component.y;

        state.dragState = { component, offsetX, offsetY };
    }

    // --- INPUTのトグル ---
    function toggleInput(element) {
        const id = parseInt(element.dataset.id);
        const component = findComponent(id);
        if (component && component.type === 'INPUT') {
            component.value = (component.value === 0) ? 1 : 0; // 0と1をトグル
            element.classList.toggle('on', component.value === 1);
            
            simulate();
        }
    }

    // --- コンポーネント削除 ---
    function deleteComponent(id) {
        id = parseInt(id);
        const comp = findComponent(id);
        if (comp) canvas.removeChild(comp.element);

        state.components = state.components.filter(c => c.id !== id);

        const wiresToRemove = state.wires.filter(w => w.fromId === id || w.toId === id);
        wiresToRemove.forEach(w => deleteWire(w.id));
        
        simulate();
    }
    
    // --- ワイヤー削除 ---
    function deleteWire(id) {
        id = parseInt(id);
        const wire = findWire(id);
        if (wire) {
            if (wire.element && wire.element.parentNode) {
                wireLayer.removeChild(wire.element);
            }
            state.wires = state.wires.filter(w => w.id !== id);
        }
    }
    
    function deleteWiresConnectedTo(terminalElement) {
        const componentElement = terminalElement.closest('.component');
        if (!componentElement) return;
        
        const compId = parseInt(componentElement.dataset.id);
        const terminalId = terminalElement.dataset.terminalId;

        let wiresToRemove;
        if (terminalId.startsWith('in-')) {
            wiresToRemove = state.wires.filter(w => w.toId === compId && w.toTerminal === terminalId);
        } else {
            wiresToRemove = state.wires.filter(w => w.fromId === compId && w.fromTerminal === terminalId);
        }
        
        wiresToRemove.forEach(w => deleteWire(w.id));
        simulate();
    }

    // --- 結線開始 ---
    function startWire(terminalElement) {
        const componentElement = terminalElement.closest('.component');
        if (!componentElement) return;
        
        const fromId = parseInt(componentElement.dataset.id);
        const fromTerminal = terminalElement.dataset.terminalId;
        
        if (!fromTerminal.startsWith('out-')) return;
        
        const coords = getTerminalCoords(terminalElement);
        
        const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tempLine.setAttribute('x1', coords.x);
        tempLine.setAttribute('y1', coords.y);
        tempLine.setAttribute('x2', coords.x);
        tempLine.setAttribute('y2', coords.y);
        tempLine.classList.add('wire-dragging');
        wireLayer.appendChild(tempLine);

        state.wireDrag = { fromId, fromTerminal, tempLine };
    }



    // --- 結線作成 ---
    function createWire(toTerminalElement) {
        const componentElement = toTerminalElement.closest('.component');
        if (!componentElement) return;

        const toId = parseInt(componentElement.dataset.id);
        const toTerminal = toTerminalElement.dataset.terminalId;
        
        const { fromId, fromTerminal } = state.wireDrag;

        if (!toTerminal.startsWith('in-')) return;
        if (fromId === toId) return;
        
        const existingWire = state.wires.find(w => w.toId === toId && w.toTerminal === toTerminal);
        if (existingWire) {
            deleteWire(existingWire.id);
        }

        const id = state.nextId++;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('wire');
        line.dataset.id = id;
        
        const wire = {
            id,
            fromId,
            fromTerminal,
            toId,
            toTerminal,
            element: line
        };

        state.wires.push(wire);
        wireLayer.appendChild(line);
        
        updateWireElement(wire);
        
        simulate();
    }
    
    // --- ワイヤーの描画更新 ---
    function updateWires(componentId) {
        state.wires.forEach(wire => {
            if (wire.fromId === componentId || wire.toId === componentId) {
                updateWireElement(wire);
            }
        });
    }
    
    function updateWireElement(wire) {
        const fromComp = findComponent(wire.fromId);
        const toComp = findComponent(wire.toId);

        if (fromComp && toComp) {
            const fromTerminal = fromComp.element.querySelector(`[data-terminal-id="${wire.fromTerminal}"]`);
            const toTerminal = toComp.element.querySelector(`[data-terminal-id="${wire.toTerminal}"]`);
            
            if (fromTerminal && toTerminal) {
                const startCoords = getTerminalCoords(fromTerminal);
                const endCoords = getTerminalCoords(toTerminal);
                
                wire.element.setAttribute('x1', startCoords.x);
                wire.element.setAttribute('y1', startCoords.y);
                wire.element.setAttribute('x2', endCoords.x);
                wire.element.setAttribute('y2', endCoords.y);
            }
        }
    }

    // --- 端子の絶対座標を取得 ---
    function getTerminalCoords(terminalElement) {
        const rect = terminalElement.getBoundingClientRect();
        return {
            x: (rect.left + rect.right) / 2 - state.canvasOffset.left,
            y: (rect.top + rect.bottom) / 2 - state.canvasOffset.top
        };
    }

    // --- ヘルパー関数 ---
    function findComponent(id) {
        return state.components.find(c => c.id === id);
    }
    function findWire(id) {
        return state.wires.find(w => w.id === id);
    }
    
    // -------------------------------------
    // --- 🚀 シミュレーションロジック 🚀 ---
    // -------------------------------------
    function simulate() {
        const MAX_ITERATIONS = 50; 
        let iterations = 0;
        let changed = true;
        
        state.components.forEach(comp => {
            if (comp.type !== 'INPUT') {
                comp.value = null; // 未計算状態
            }
        });

        while (changed && iterations < MAX_ITERATIONS) {
            changed = false;
            iterations++;

            state.components.forEach(comp => {
                if (comp.type === 'INPUT') return;

                const newValue = calculateComponentValue(comp);
                
                if (comp.value !== newValue) {
                    comp.value = newValue;
                    changed = true;
                }
            });
        }
        
        if (iterations === MAX_ITERATIONS) {
            console.warn("シミュレーションが安定しませんでした。回路にループがある可能性があります。");
        }

        updateDOM();
    }
    
    // --- 各コンポーネントの値の計算 ---
    function calculateComponentValue(comp) {
        // 入力値を取得
        const inputs = getComponentInputs(comp);
        
        // === 修正点 (2/3): 入力が null (未接続・未計算) の場合の処理 ===
        switch (comp.type) {
            case 'AND':
                // 入力が一つでも null なら、出力も null
                if (inputs['in-0'] === null || inputs['in-1'] === null) {
                    return null;
                }
                return (inputs['in-0'] === 1 && inputs['in-1'] === 1) ? 1 : 0;
            
            case 'OR':
                // 入力が一つでも null なら、出力も null
                if (inputs['in-0'] === null || inputs['in-1'] === null) {
                    return null;
                }
                return (inputs['in-0'] === 1 || inputs['in-1'] === 1) ? 1 : 0;
            
            case 'NOT':
                // 入力が null なら、出力も null
                if (inputs['in-0'] === null) {
                    return null;
                }
                return (inputs['in-0'] === 1) ? 0 : 1;
            
            case 'OUTPUT':
                // 入力が null なら、出力も null (0ではない)
                if (inputs['in-0'] === null) {
                    return null;
                }
                return inputs['in-0'];
            
            default:
                return null;
        }
    }

    // --- コンポーネントへの入力値を取得する ---
    function getComponentInputs(comp) {
        let inputs = {
            'in-0': null,
            'in-1': null
        };

        const inputWires = state.wires.filter(w => w.toId === comp.id);

        inputWires.forEach(wire => {
            const sourceComponent = findComponent(wire.fromId);
            if (sourceComponent) {
                inputs[wire.toTerminal] = sourceComponent.value;
            }
        });

        // === 修正点 (3/3): 未接続(null)を 0 に変換する処理を削除 ===
        // これがNOT回路が未接続でONになる原因だった
        
        return inputs;
    }

    // --- シミュレーション結果をDOMに反映 ---
    function updateDOM() {
        // コンポーネント (OUTPUT) のON/OFF
        state.components.forEach(comp => {
            if (comp.type === 'OUTPUT') {
                // comp.value が 1 の時だけ 'on' になる (null や 0 では 'on' にならない)
                comp.element.classList.toggle('on', comp.value === 1);
            }
        });

        // ワイヤーのON/OFF
        state.wires.forEach(wire => {
            const sourceComponent = findComponent(wire.fromId);
            // 接続元の value が 1 の時だけ 'on' になる
            if (sourceComponent && sourceComponent.value === 1) {
                wire.element.classList.add('on');
            } else {
                wire.element.classList.remove('on');
            }
        });
    }

    // --- アプリケーション実行 ---
    initialize();

})();
