// tailwind.js
//import HSScrollspy from '../../node_modules/@preline/scrollspy/index.js';
//import { HSScrollspy } from 'preline';


export default function tailwindScript() {
    const lightModeButton = document.getElementById('light-mode');
    const darkModeButton = document.getElementById('dark-mode');
    const systemModeButton = document.getElementById('system-mode');

    const setMode = (mode) => {
        document.documentElement.classList.remove('light', 'dark');

        if (mode === 'dark') {
            document.documentElement.classList.add('dark');
        } else if (mode === 'light') {
            document.documentElement.classList.add('light');
        }

        //localStorage.setItem('color-mode', mode);
    };

    lightModeButton.addEventListener('click', () => setMode('light'));
    darkModeButton.addEventListener('click', () => setMode('dark'));
    systemModeButton.addEventListener('click', () => {
        //localStorage.removeItem('color-mode');
        const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        setMode(systemPreference);
    });

    // 初期モードの設定
    const savedMode = localStorage.getItem('color-mode');
    if (savedMode) {
        setMode(savedMode);
    } else {
        const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        setMode(systemPreference);
    }

    // const el = HSScrollspy.getInstance('[data-hs-scrollspy="#scrollspy-1"]', true);

    // console.log(el);
    // const collapse = HSCollapse.getInstance('[data-hs-collapse="#navbar-collapse-basic"]', true);

    // el.element.on('beforeScroll', (instance) => {
    //     return new Promise((res) => {
    //         if (collapse.element.el.classList.contains('open')) {
    //             collapse.element.hide();
    //             HSStaticMethods.afterTransition(collapse.element.content, () => res(true));
    //         } else {
    //             res(true);
    //         }
    //     });
    // });
}