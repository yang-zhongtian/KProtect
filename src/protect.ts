import path from 'path'
import {readFileSync, writeFileSync} from 'fs'
import Compiler from './compiler.js'
import BytecodeCompiler from './assembler.js'

const workingDir = path.resolve(path.resolve(), 'protect')
const src = readFileSync(path.resolve(workingDir, 'src.js')).toString()
const compiler = new Compiler(src)
const il = compiler.compile()
const bytecodeCompiler = new BytecodeCompiler(il)
const vmArguments = bytecodeCompiler.compile()
const result = JSON.stringify(vmArguments)
writeFileSync(path.resolve(workingDir, 'bundle.json'), result)
// console.log(JSON.stringify(il, null, 2))
