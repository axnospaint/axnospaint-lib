// @description 案C: モバイルUI（トップバー + ボトムシート）
// トップバー: 現在色スウォッチ / 現在ペン名 / 太さスライダー
// ボトムシート: タブで既存ツールウィンドウ（ペン/色作成/レイヤー/補助）を
//               画面下部に再配置表示する（axpm-in-sheet クラス付与方式）
//
// 表示は mobile.css の @media (max-width: 599px) に閉じており、
// PC表示にはレイアウト上の影響を一切与えない。

// css適用
import '../css/mobile.css';

// シートタブ（data-sheettab属性 → ウィンドウid）
const SHEET_WINDOW_IDS = ['axp_pen', 'axp_makecolor', 'axp_layer', 'axp_tool', 'axp_filter'];

export class MobileSystem {
    constructor(axpObj) {
        this.axpObj = axpObj;
        // 現在シート内に表示しているウィンドウid（null: 非表示）
        this.currentSheetWindowId = null;
    }
    // イベント受付開始（全ツールウィンドウの生成後に呼び出すこと）
    startEvent() {
        this.setupTopbarColor();
        this.setupTopbarPenName();
        this.setupTopbarPenSize();
        this.setupSheetTabs();
    }
    // モバイルレイアウトが有効か（mobile.cssのメディアクエリと同期）
    isMobileLayout() {
        return window.matchMedia('(max-width: 599px)').matches;
    }
    // ------------------------------------------------------------------
    // トップバー：現在色（メインカラー）
    // ------------------------------------------------------------------
    setupTopbarColor() {
        const swatch = document.getElementById('axp_mobile_button_color');
        const mainColorElement = document.getElementById('axp_makecolor_div_mainColor');
        if (!swatch || !mainColorElement) return;
        const sync = () => {
            swatch.style.backgroundColor = this.axpObj.colorMakerSystem?.maincolor || '#000000';
        };
        new MutationObserver(sync).observe(mainColorElement, { attributes: true, attributeFilter: ['style'] });
        sync();
        // タップで色作成タブを開く
        swatch.addEventListener('click', () => {
            this.openSheetTab('axp_makecolor');
        });
    }
    // ------------------------------------------------------------------
    // トップバー：現在ペン名
    // ------------------------------------------------------------------
    setupTopbarPenName() {
        const penButton = document.getElementById('axp_mobile_button_pen');
        const penNameLabel = document.getElementById('axp_mobile_span_penName');
        const penNameSource = document.getElementById('axp_pen_span_penName');
        if (!penButton || !penNameLabel || !penNameSource) return;
        const sync = () => {
            penNameLabel.textContent = penNameSource.textContent;
        };
        new MutationObserver(sync).observe(penNameSource, { childList: true, characterData: true, subtree: true });
        sync();
        // タップでペンタブを開く
        penButton.addEventListener('click', () => {
            this.openSheetTab('axp_pen');
        });
    }
    // ------------------------------------------------------------------
    // トップバー：ペンの太さ（既存スライダーと双方向バインド）
    // ------------------------------------------------------------------
    setupTopbarPenSize() {
        const mobileRange = document.getElementById('axp_mobile_range_penSize');
        const mobileValue = document.getElementById('axp_mobile_span_penSize');
        const penSizeForm = document.getElementById('axp_pen_form_penSize');
        if (!mobileRange || !mobileValue || !penSizeForm) return;
        const penSizeRange = penSizeForm.volume;
        const penSizeOutput = penSizeForm.result;
        // レンジスケール（index方式）は既存スライダーの属性をそのまま踏襲
        mobileRange.min = penSizeRange.min;
        mobileRange.max = penSizeRange.max;
        mobileRange.step = penSizeRange.step || 1;
        const sync = () => {
            mobileRange.value = penSizeRange.value;
            mobileValue.textContent = penSizeOutput.value;
        };
        // トップバー操作 → 既存スライダーへ反映（既存のinputリスナーが本処理を実行）
        mobileRange.addEventListener('input', () => {
            penSizeRange.value = mobileRange.value;
            penSizeRange.dispatchEvent(new Event('input', { bubbles: true }));
        });
        // 既存スライダーの表示値（output）変化を監視して追従
        new MutationObserver(sync).observe(penSizeOutput, { childList: true, characterData: true, subtree: true });
        sync();
    }
    // ------------------------------------------------------------------
    // ボトムシート：タブ切替とウィンドウ再配置
    // ------------------------------------------------------------------
    setupSheetTabs() {
        const tabs = document.querySelectorAll('#axp_mobile_sheet .axpm-sheet__tab');
        for (const tab of tabs) {
            tab.addEventListener('click', () => {
                const windowId = tab.dataset.sheettab;
                // 全体非表示（axpc_window_hidden）中はアクティブタブの再タップでも
                // 「閉じる」ではなく復帰経路（openSheetTab）に入れる。
                // ここでcloseSheetに分岐するとhiddenのまま最小化され復帰不能になるため
                const windowElement = document.getElementById(windowId);
                const isHidden = windowElement?.classList.contains('axpc_window_hidden') ?? false;
                if (this.currentSheetWindowId === windowId && !isHidden) {
                    // 同じタブの再タップで閉じる
                    this.closeSheet();
                } else {
                    this.openSheetTab(windowId);
                }
            });
        }
        // ハンドルタップでシートを閉じる
        const handle = document.getElementById('axp_mobile_sheet_handle');
        handle?.addEventListener('click', () => {
            this.closeSheet();
        });
    }
    // 指定ウィンドウをシート内に表示する
    openSheetTab(windowId) {
        // モバイルレイアウト以外では通常のウィンドウ開閉に副作用を出さない
        if (!this.isMobileLayout()) return;
        if (!SHEET_WINDOW_IDS.includes(windowId)) return;
        const windowElement = document.getElementById(windowId);
        if (!windowElement) return;
        // 全体非表示中はまず全体表示に復帰させる
        this.restoreFromAllHidden(windowElement);
        // 表示中の他ウィンドウをシートから外す
        for (const otherId of SHEET_WINDOW_IDS) {
            if (otherId === windowId) continue;
            const other = document.getElementById(otherId);
            if (other?.classList.contains('axpm-in-sheet')) {
                other.classList.remove('axpm-in-sheet');
                this.axpObj.dragWindow.minimize(otherId);
                this.axpObj.launcher.minimizeButton(otherId);
            }
        }
        // 対象ウィンドウをシート内に表示
        windowElement.classList.add('axpm-in-sheet');
        this.axpObj.dragWindow.unminimize(windowId);
        this.axpObj.launcher.unminimizeButton(windowId);
        this.currentSheetWindowId = windowId;
        this.syncTabState();
    }
    // 全体非表示（axpc_window_hidden）中なら、ランチャーの一括ボタン経由で
    // 全体表示に復帰させる（dock.jsのtoggleWindowと同一の復帰経路。
    // hidden解除・一括ボタンのアイコン状態・設定値の整合を保つため）
    restoreFromAllHidden(windowElement) {
        if (!windowElement.classList.contains('axpc_window_hidden')) return;
        const allButton = document.querySelector('.axpc_launcher_allButton');
        if (allButton?.classList.contains('axpc_launcher_minimize')) {
            allButton.click();
        }
    }
    // シートを閉じる（表示中ウィンドウを最小化）
    closeSheet() {
        if (this.currentSheetWindowId) {
            const windowElement = document.getElementById(this.currentSheetWindowId);
            if (windowElement) {
                windowElement.classList.remove('axpm-in-sheet');
                this.axpObj.dragWindow.minimize(this.currentSheetWindowId);
                this.axpObj.launcher.minimizeButton(this.currentSheetWindowId);
            }
            this.currentSheetWindowId = null;
        }
        this.syncTabState();
    }
    // タブの点灯状態を現在の表示に同期
    syncTabState() {
        const tabs = document.querySelectorAll('#axp_mobile_sheet .axpm-sheet__tab');
        for (const tab of tabs) {
            const isActive = tab.dataset.sheettab === this.currentSheetWindowId;
            tab.dataset.active = isActive ? 'true' : 'false';
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        }
    }
}
