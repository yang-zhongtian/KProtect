import commonjs from '@rollup/plugin-commonjs'
import resolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import svelte from 'rollup-plugin-svelte';
import babel from "@rollup/plugin-babel";
import terser from "@rollup/plugin-terser";
import json from "@rollup/plugin-json";

export default {
    input: 'src/debugger.ts',
    output: {
        file: 'dist/bundle.js',
        format: 'iife',
        sourcemap: true,
    },
    plugins: [
        typescript({
            declaration: false,
            tsconfig: false,
            allowSyntheticDefaultImports: true
        }),
        svelte({
            emitCss: false,
        }),
        commonjs(),
        json(),
        resolve({
            browser: true,
            exportConditions: ['svelte'],
            extensions: ['.svelte']
        }),
        babel({babelHelpers: 'bundled'}),
        terser({mangle: {properties: true}}),
    ],
}
