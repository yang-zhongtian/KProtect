import { rollup } from 'rollup'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import babel from '@rollup/plugin-babel'
import replace from '@rollup/plugin-replace'
import obfuscator from 'rollup-plugin-obfuscator'
import terser from '@rollup/plugin-terser'
import { join } from 'path'


const embed = async (bytecode: Uint8Array, strings: string[]) => {
  const bundle = await rollup({
    input: join(__dirname, 'vm.js'),
    plugins: [
      replace({
        preventAssignment: true,
        values: {
          __BYTECODE_ARRAY__: JSON.stringify(Array.from(bytecode)),
          __STRINGS_ARRAY__: JSON.stringify(strings)
        }
      }),
      obfuscator({
        options: {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.4,
          renameGlobals: true,
          renameProperties: true
        }
      }),
      commonjs(),
      resolve(),
      babel({babelHelpers: 'bundled'}),
      terser()
    ]
  })

  const {output} = await bundle.generate({
    name: 'VM',
    format: 'iife'
  })

  const codes = output[0].code

  await bundle.close()

  return codes
}

export { embed  }
