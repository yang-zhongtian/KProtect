import Compiler from './compiler'
import BytecodeCompiler from './assembler'

const protect = (source: string) => {
  const compiler = new Compiler(source)
  const ir = compiler.compile()
  const bytecodeCompiler = new BytecodeCompiler(ir)
  return bytecodeCompiler.compile()
}

export { protect }
export { Header, Opcode } from './constant'
