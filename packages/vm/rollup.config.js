import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import babel from '@rollup/plugin-babel'
import terser from '@rollup/plugin-terser'
import typescript from '@rollup/plugin-typescript'

const formats = ['es', 'commonjs', 'umd']

export default formats.map(format => ({
        input: 'src/vm.ts',
        output: {
            file: `dist/vm.${format}.js`,
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
            babel({babelHelpers: 'bundled'}),
            terser({mangle: {properties: true}}),
        ],
    })
)
