import Disassembler from './disassembler'

const disassemble = (bytecode: string, strings: string[]) => {
  const worker = new Disassembler(bytecode, strings)
  return worker.start()
}

export { disassemble }
