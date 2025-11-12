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
            
            // 既存の選択状態を解除
            toolButtons.forEach(btn => btn.classList.remove('active'));
            componentButtons.forEach(btn => btn.classList.remove('active'));
            
            // クリックしたボタンをアクティブに
            e.currentTarget.classList.add('active');
        }
    }

    // --- コンポーネント追加モード ---
    function selectComponentToAdd(e) {
        const type = e.currentTarget.dataset.type;
        state.currentTool = `ADD_${type}`;
        
        // 既存の選択状態を解除
        toolButtons.forEach(btn => btn.classList.remove('active'));
        componentButtons.forEach(btn => btn.classList.remove('active'));
        
        // クリックしたボタンをアクティブに
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
        // キャンバスの左上隅からの相対座標に変換
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
        
        // === 変更点: クリック対象のコンポーネントを正しく取得 ===
        const targetComponent = target.closest('.component');
        const targetTerminal = target.closest('.terminal');

        // ツールに応じた処理
        switch (state.currentTool) {
            case 'POINTER':
                if (targetTerminal) {
                    // 端子をクリックしてもドラッグしない (結線ツールと誤認しないように)
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
                    // 結線開始
                    startWire(targetTerminal);
                }
                break;

            case 'DELETE':
                if (targetTerminal) {
                    // 端子に接続されているワイヤーを削除
                    deleteWiresConnectedTo(targetTerminal);
                } else if (targetComponent) {
                    // コンポーネント削除
                    deleteComponent(targetComponent.dataset.id);
                }
                break;

            default:
                // コンポーネント追加モード (ADD_TYPE)
                if (state.currentTool.startsWith('ADD_')) {
                    const type = state.currentTool.split('_')[1];
                    createComponent(type, coords.x, coords.y);
                    // 追加後は選択ツールに戻る
                    document.getElementById('tool-pointer').click();
                }
                break;
        }
    }

    // --- 操作中 (MouseMove / TouchMove) ---
    function handleInteractionMove(e) {
        if (state.dragState) {
            e.preventDefault();
            const coords = getCoords(e);
            const comp = state.dragState.component;
            
            // 新しい位置を計算
            let newX = coords.x - state.dragState.offsetX;
            let newY = coords.y - state.dragState.offsetY;
            
            // グリッドにスナップ (20pxごと)
            newX = Math.round(newX / 20) * 20;
            newY = Math.round(newY / 20) * 20;

            comp.element.style.transform = `translate(${newX}px, ${newY}px)`;
            comp.x = newX;
            comp.y = newY;

            // 接続されているワイヤーも更新
            updateWires(comp.id);
        }

        if (state.wireDrag) {
            e.preventDefault();
            const coords = getCoords(e);
            // 仮線の終点を更新
            state.wireDrag.tempLine.setAttribute('x2', coords.x);
            state.wireDrag.tempLine.setAttribute('y2', coords.y);
        }
    }

    // --- 操作終了 (MouseUp / TouchEnd) ---
    function handleInteractionEnd(e) {
        // ドラッグ終了
        if (state.dragState) {
            state.dragState = null;
        }

        // 結線終了
        if (state.wireDrag) {
            // === 変更点: イベント終了時のターゲットを正しく取得 ===
            // mouseup/touchendではe.targetが期待通りに動作しないことがある
            // 代わりに、その瞬間のポインタ位置にある要素をチェックする
            const coords = getCoords(e);
            const endTarget = document.elementFromPoint(
                coords.x + state.canvasOffset.left, 
                coords.y + state.canvasOffset.top
            );
            const endTerminal = endTarget ? endTarget.closest('.terminal') : null;

            if (endTerminal) {
                // 端子の上で終了した場合、ワイヤーを作成
                createWire(endTerminal);
            }
            
            // 仮線を削除
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

        // グリッドにスナップ
        x = Math.round(x / 20) * 20;
        y = Math.round(y / 20) * 20;
        
        element.style.transform = `translate(${x}px, ${y}px)`;

        // ラベル
        const label = document.createElement('span');
        label.classList.add('label');
        label.textContent = type;
        element.appendChild(label);
        
        // 端子 (Terminal) の追加
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
        
        // クリック位置とコンポーネント左上のオフセットを計算
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
            
            // === 変更点: ラベルのテキストは変更しない ===
            // element.querySelector('.label').textContent = `INPUT: ${component.value}`; // この行を削除
            
            // シミュレーション実行
            simulate();
        }
    }

    // --- コンポーネント削除 ---
    function deleteComponent(id) {
        id = parseInt(id);
        // 1. コンポーネントをDOMから削除
        const comp = findComponent(id);
        if (comp) canvas.removeChild(comp.element);

        // 2. state.componentsから削除
        state.components = state.components.filter(c => c.id !== id);

        // 3. 関連するワイヤーを削除
        const wiresToRemove = state.wires.filter(w => w.fromId === id || w.toId === id);
        wiresToRemove.forEach(w => deleteWire(w.id));
        
        // 再シミュレーション
        simulate();
    }
    
    // --- ワイヤー削除 ---
    function deleteWire(id) {
        id = parseInt(id);
        const wire = findWire(id);
        if (wire) {
            // DOMから削除
            if (wire.element && wire.element.parentNode) { // 存在確認
                wireLayer.removeChild(wire.element);
            }
            // state.wiresから削除
            state.wires = state.wires.filter(w => w.id !== id);
        }
    }
    
    function deleteWiresConnectedTo(terminalElement) {
        const componentElement = terminalElement.closest('.component');
        if (!componentElement) return; // コンポーネントが見つからない場合は終了
        
        const compId = parseInt(componentElement.dataset.id);
        const terminalId = terminalElement.dataset.terminalId;

        let wiresToRemove;
        if (terminalId.startsWith('in-')) {
            // 入力端子に接続されているワイヤー
            wiresToRemove = state.wires.filter(w => w.toId === compId && w.toTerminal === terminalId);
        } else {
            // 出力端子に接続されているワイヤー
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
        
        // 出力端子からのみ結線開始できる
        if (!fromTerminal.startsWith('out-')) return;
        
        const coords = getTerminalCoords(terminalElement);
        
        // 仮線(SVG)の作成
        const tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        tempLine.setAttribute('x1', coords.x);
        tempLine.setAttribute('y1', coords.y);
        tempLine.setAttribute('x2', coords.x); // 最初は同じ位置
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

        // 入力端子にのみ接続できる
        if (!toTerminal.startsWith('in-')) return;
        
        // 自分自身には接続できない
        if (fromId === toId) return;
        
        // 既に入力端子に接続がある場合は、古いワイヤーを削除
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
        
        // ワイヤーの位置を更新
        updateWireElement(wire);
        
        // シミュレーション実行
        simulate();
    }
    
    // --- ワイヤーの描画更新 ---
    function updateWires(componentId) {
        // 指定されたコンポーネントIDに関連するすべてのワイヤーを更新
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
        const MAX_ITERATIONS = 50; // 無限ループ防止
        let iterations = 0;
        let changed = true;
        
        // 1. INPUT以外の全コンポーネントの値をリセット
        state.components.forEach(comp => {
            if (comp.type !== 'INPUT') {
                comp.value = null; // 未計算状態
            }
        });

        // 2. 値が安定するまで計算を繰り返す
        while (changed && iterations < MAX_ITERATIONS) {
            changed = false;
            iterations++;

            state.components.forEach(comp => {
                if (comp.type === 'INPUT') return; // INPUTは計算しない

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

        // 3. 計算結果をDOM（見た目）に反映
        updateDOM();
    }
    
    // --- 各コンポーネントの値の計算 ---
    function calculateComponentValue(comp) {
        // 入力値を取得
        const inputs = getComponentInputs(comp);
        
        switch (comp.type) {
            case 'AND':
                // 両方の入力が1なら1、そうでなければ0。未接続(null)は0として扱う
                return (inputs['in-0'] === 1 && inputs['in-1'] === 1) ? 1 : 0;
            case 'OR':
                // どちらかの入力が1なら1、そうでなければ0
                return (inputs['in-0'] === 1 || inputs['in-1'] === 1) ? 1 : 0;
            case 'NOT':
                // 入力が1なら0、0なら1
                return (inputs['in-0'] === 1) ? 0 : 1;
            case 'OUTPUT':
                // 入力をそのまま出力
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

        // このコンポーネント(comp)に接続されているワイヤーを探す
        const inputWires = state.wires.filter(w => w.toId === comp.id);

        inputWires.forEach(wire => {
            // ワイヤーの入力元コンポーネントを探す
            const sourceComponent = findComponent(wire.fromId);
            if (sourceComponent) {
                // 入力端子ID (in-0 or in-1) に、入力元コンポーネントの値を設定
                inputs[wire.toTerminal] = sourceComponent.value;
            }
        });

        // 接続されていない入力は 0 (OFF) として扱う
        if (inputs['in-0'] === null) inputs['in-0'] = 0;
        if (inputs['in-1'] === null) inputs['in-1'] = 0;
        
        return inputs;
    }

    // --- シミュレーション結果をDOMに反映 ---
    function updateDOM() {
        // 1. コンポーネント (OUTPUT) のON/OFF
        state.components.forEach(comp => {
            if (comp.type === 'OUTPUT') {
                comp.element.classList.toggle('on', comp.value === 1);
            }
        });

        // 2. ワイヤーのON/OFF
        state.wires.forEach(wire => {
            const sourceComponent = findComponent(wire.fromId);
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
