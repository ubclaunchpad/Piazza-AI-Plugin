const { plugins } = require("./webpack.config.cjs");

module.exports = {
    content:[
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}