import Disassembler from './disassembler'

const disassemble = (bytecode: Uint8Array, strings: string[]) => {
  const worker = new Disassembler(bytecode, strings)
  return worker.start()
}

export { disassemble }
