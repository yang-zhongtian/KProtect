import commonjs from '@rollup/plugin-commonjs'
import {nodeResolve} from '@rollup/plugin-node-resolve'
import json from '@rollup/plugin-json'
import {babel} from '@rollup/plugin-babel'
import terser from '@rollup/plugin-terser'

const formats = ['iife', 'es', 'umd']

export default formats.map(format => ({
        input: 'build/vm.js',
        output: {
            file: `dist/vm${format === 'iife' ? '' : `.${format}`}.js`,
            format: format,
            name: 'VM'
        },
        plugins: [
            commonjs(),
            nodeResolve(),
            json(),
            babel({babelHelpers: 'bundled'}),
            terser(),
        ],
    })
)