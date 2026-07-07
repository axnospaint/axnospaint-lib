// @description 案C: サイドドック + クイックバー (PC)
// 左ドック: 主要ペン6種 + ペンツールウィンドウ開閉 + Undo/Redo
// 右ドック: ツールウィンドウ開閉 (レイヤー/色作成/パレット/補助/フィルタ) + 設定タブ
// クイックバー: 下部中央 (現在色 / 太さ / Undo / Redo / 表示リセット)
//
// 既存のウィンドウシステム・TASK機構に乗るだけの薄いレイヤー。
// ペン切替やUndo/Redoは axpc_FUNC + data-function で既存TASKを呼び出す。

// css適用
import '../css/dock.css';

// ドックから開閉できるツールウィンドウ (ボタンid → ウィンドウid)
const WINDOW_BUTTONS = [
    ['axp_dock_button_pentool', 'axp_pen', '@WINDOW.PEN_TOOL'],
    ['axp_dock_button_layer', 'axp_layer', '@WINDOW.LAYER'],
    ['axp_dock_button_color', 'axp_makecolor', '@WINDOW.COLOR'],
    ['axp_dock_button_palette', 'axp_palette', '@WINDOW.SWATCHES'],
    ['axp_dock_button_subtool', 'axp_tool', '@WINDOW.MISC'],
    ['axp_dock_button_filter', 'axp_filter', '@WINDOW.FILTER'],
];

export class DockSystem {
    constructor(axpObj) {
        this.axpObj = axpObj;
    }
    // イベント受付開始（全ツールウィンドウの生成後に呼び出すこと）
    startEvent() {
        this.setupWindowButtons();
        this.setupPenSelectionSync();
        this.setupQuickbarColor();
        this.setupQuickbarPenSize();
        this.setupQuickbarZoom();
        this.setupConfigButton();
    }
    // ------------------------------------------------------------------
    // ウィンドウ開閉ボタン（右ドック＋左ドックのペンツールボタン）
    // ------------------------------------------------------------------
    setupWindowButtons() {
        for (const [buttonId, windowId, nameKey] of WINDOW_BUTTONS) {
            const button = document.getElementById(buttonId);
            const windowElement = document.getElementById(windowId);
            if (!button || !windowElement) continue;
            // ガイドメッセージ（既存ランチャーボタンと同一文言）
            const name = this.axpObj._(nameKey);
            button.dataset.msg = `${name}ウィンドウを開閉します。`;
            button.setAttribute('aria-label', name);
            // クリックで開閉
            button.addEventListener('click', () => {
                this.toggleWindow(windowId);
            });
            // 開閉状態をボタンの点灯状態に同期（ランチャー等、他経路での開閉にも追従）
            const sync = () => {
                const isOpen =
                    !windowElement.classList.contains('axpc_window_minimize') &&
                    !windowElement.classList.contains('axpc_window_hidden');
                button.dataset.active = isOpen ? 'true' : 'false';
            };
            new MutationObserver(sync).observe(windowElement, { attributes: true, attributeFilter: ['class'] });
            sync();
        }
    }
    // ツールウィンドウの開閉（既存ランチャーの個別ボタンと同じ挙動）
    toggleWindow(windowId) {
        const windowElement = document.getElementById(windowId);
        if (!windowElement) return;
        // 全体非表示（axpc_window_hidden）中は、まずランチャーの一括ボタンと同じ経路で
        // 全体表示に復帰する（hiddenクラスの解除と一括ボタンの状態を整合させるため）
        if (windowElement.classList.contains('axpc_window_hidden')) {
            const allButton = document.querySelector('.axpc_launcher_allButton');
            if (allButton?.classList.contains('axpc_launcher_minimize')) {
                allButton.click();
            }
            // 復帰後、対象ウィンドウが最小化されていなければ表示状態になっているため
            // ここで終了する（「表示したい」というユーザー意図に合わせ、閉じない）
            if (!windowElement.classList.contains('axpc_window_minimize')) {
                return;
            }
        }
        const isMinimized = windowElement.classList.contains('axpc_window_minimize');
        if (isMinimized) {
            // オープン
            this.axpObj.dragWindow.unminimize(windowId);
            this.axpObj.launcher.unminimizeButton(windowId);
            this.axpObj.configSystem.deleteConfig('WDMIN_' + windowId);
            // 単一ウィンドウモードなら、他のウィンドウを最小化
            if (document.getElementById('axp_config_checkbox_singleWindowMode')?.checked) {
                for (const [, otherId] of WINDOW_BUTTONS) {
                    if (otherId === windowId) continue;
                    const other = document.getElementById(otherId);
                    if (other && !other.classList.contains('axpc_window_minimize')) {
                        this.axpObj.dragWindow.minimize(otherId);
                        this.axpObj.launcher.minimizeButton(otherId);
                        this.axpObj.configSystem.saveConfig('WDMIN_' + otherId, true);
                    }
                }
            }
        } else {
            // 最小化
            this.axpObj.dragWindow.minimize(windowId);
            this.axpObj.launcher.minimizeButton(windowId);
            this.axpObj.configSystem.saveConfig('WDMIN_' + windowId, true);
        }
    }
    // ------------------------------------------------------------------
    // 左ドック：ペン選択状態の同期
    // ------------------------------------------------------------------
    setupPenSelectionSync() {
        const penSystem = this.axpObj.penSystem;
        if (!penSystem) return;
        const syncSelection = () => {
            const currentMode = penSystem.pen_mode;
            const buttons = document.querySelectorAll('#axp_dock_left [data-penmode]');
            for (const item of buttons) {
                item.dataset.selected = (item.dataset.penmode === currentMode) ? 'true' : 'false';
            }
        };
        // ペン切替の中心経路 changePenMode をフックして同期（切替経路が多岐に渡るため）
        const original = penSystem.changePenMode.bind(penSystem);
        penSystem.changePenMode = (mode) => {
            original(mode);
            syncSelection();
        };
        syncSelection();
    }
    // ------------------------------------------------------------------
    // クイックバー：現在色（メインカラー）
    // ------------------------------------------------------------------
    setupQuickbarColor() {
        const swatch = document.getElementById('axp_quickbar_button_color');
        const hexLabel = document.getElementById('axp_quickbar_span_hex');
        const mainColorElement = document.getElementById('axp_makecolor_div_mainColor');
        if (!swatch || !hexLabel || !mainColorElement) return;
        const sync = () => {
            const colorcode = this.axpObj.colorMakerSystem?.maincolor || '#000000';
            swatch.style.backgroundColor = colorcode;
            hexLabel.textContent = colorcode.toUpperCase();
        };
        // メインカラー表示要素のstyle変化を監視（色変更のすべての経路をカバー）
        new MutationObserver(sync).observe(mainColorElement, { attributes: true, attributeFilter: ['style'] });
        sync();
        // スウォッチクリックで色作成ウィンドウを開く（最小化・全体非表示のどちらからも復帰）
        swatch.addEventListener('click', () => {
            const makecolor = document.getElementById('axp_makecolor');
            if (makecolor && (
                makecolor.classList.contains('axpc_window_minimize') ||
                makecolor.classList.contains('axpc_window_hidden')
            )) {
                this.toggleWindow('axp_makecolor');
            }
        });
    }
    // ------------------------------------------------------------------
    // クイックバー：ペンの太さ（既存スライダーと双方向バインド）
    // ------------------------------------------------------------------
    setupQuickbarPenSize() {
        const quickRange = document.getElementById('axp_quickbar_range_penSize');
        const quickValue = document.getElementById('axp_quickbar_span_penSize');
        const penSizeForm = document.getElementById('axp_pen_form_penSize');
        if (!quickRange || !quickValue || !penSizeForm) return;
        const penSizeRange = penSizeForm.volume;
        const penSizeOutput = penSizeForm.result;
        // レンジスケール（index方式）は既存スライダーの属性をそのまま踏襲
        quickRange.min = penSizeRange.min;
        quickRange.max = penSizeRange.max;
        quickRange.step = penSizeRange.step || 1;
        const sync = () => {
            quickRange.value = penSizeRange.value;
            quickValue.textContent = penSizeOutput.value;
        };
        // クイックバー操作 → 既存スライダーへ反映（既存のinputリスナーが本処理を実行）
        quickRange.addEventListener('input', () => {
            penSizeRange.value = quickRange.value;
            penSizeRange.dispatchEvent(new Event('input', { bubbles: true }));
        });
        // 既存スライダーの表示値（output）変化を監視して追従
        // ※ output.value への代入はテキストノード変化としてDOMに現れるため監視可能
        new MutationObserver(sync).observe(penSizeOutput, { childList: true, characterData: true, subtree: true });
        sync();
    }
    // ------------------------------------------------------------------
    // クイックバー：表示倍率
    // ------------------------------------------------------------------
    setupQuickbarZoom() {
        const zoomButton = document.getElementById('axp_quickbar_button_zoom');
        if (!zoomButton) return;
        const syncZoom = () => {
            zoomButton.textContent = `${Math.round(this.axpObj.scale)}%`;
        };
        // 表示更新の中心経路 refreshCanvas をフックして倍率表示を追従
        const original = this.axpObj.refreshCanvas.bind(this.axpObj);
        this.axpObj.refreshCanvas = (...args) => {
            original(...args);
            syncZoom();
        };
        syncZoom();
    }
    // ------------------------------------------------------------------
    // 右ドック：設定タブへの遷移
    // ------------------------------------------------------------------
    setupConfigButton() {
        const configButton = document.getElementById('axp_dock_button_config');
        if (!configButton) return;
        configButton.addEventListener('click', () => {
            this.axpObj.selectTab('1');
        });
    }
}
