/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // クラスベースのダークモードを使用
  content: [
    "./src/**/*.{html,js}",
    //'node_modules/preline/dist/*.js',
    //"./node_modules/flowbite/**/*.js"
  ],
  theme: {
    extend: {},
  },
  plugins: [
    //require('@tailwindcss/forms'),
    //require('preline/plugin')
    //require('@preline/scrollspy/index.js')
    //require('flowbite/plugin')
  ],
}

