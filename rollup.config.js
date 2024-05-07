import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'
import babel from '@rollup/plugin-babel'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'

const formats = ['iife', 'es', 'umd']

export default formats.map(format => ({
        input: 'src/vm.ts',
        output: {
            file: `dist/vm${format === 'iife' ? '' : `.${format}`}.js`,
            format: format,
            name: 'VM',
            sourcemap: true,
        },
        plugins: [
            typescript({
                declaration: false,
                tsconfig: false,
                allowSyntheticDefaultImports: true
            }),
            commonjs(),
            resolve(),
            json(),
            babel({babelHelpers: 'bundled'}),
            terser({mangle: {properties: true}}),
        ],
    })
)
