import { Instruction, InstructionArgument } from './compiler'
import { Header, Opcode } from './constant'

export interface VirtualMachineArguments {
  bytecode: number[]
  strings: string[]
}

export interface LookUpTable {
  [Label: number]: number;
}

export default class BytecodeCompiler {
  private readonly ir: Instruction[]
  private readonly strings: string[]
  bytecode: Uint8Array
  lookUpTable: LookUpTable

  constructor(ir: Instruction[]) {
    this.ir = ir
    this.strings = []
    this.bytecode = undefined
    this.lookUpTable = {}
  }

  private longToByteArray(long: number) {
    const byteArray = []
    for (let i = 0; i < 8; i++) {
      const byte = long & 0xff
      long = (long - byte) / 256
      byteArray.push(byte)
    }
    return byteArray
  }

  private compileInstructionArgument(arg: InstructionArgument): number[] {
    const header = arg.type
    switch (header) {
      case Header.LOAD_UNDEFINED:
        return [header]
      case Header.LOAD_OBJECT:
        return [header]
      case Header.LOAD_STRING:
        let stringPointer
        if (!this.strings.includes(arg.value)) {
          this.strings.push(arg.value)
          stringPointer = this.longToByteArray(this.strings.length - 1)
        } else {
          stringPointer = this.longToByteArray(this.strings.indexOf(arg.value))
        }
        return [header, ...stringPointer]
      case Header.LOAD_NUMBER:
        return [header, ...this.longToByteArray(arg.value)]
      case Header.POP_STACK:
        return []
      case Header.FETCH_VARIABLE:
        return [header, arg.value]
      case Header.FETCH_DEPENDENCY:
        return [header, arg.value]
      case Header.FETCH_PARAMETER:
        return [header, arg.value]
      case Header.DYN_ADDR:
        return [header, arg.value, ...new Array<number>(7).fill(0)]
    }
  }

  private compileBlock(block: Instruction[], bytes: number[]) {
    block.forEach(instruction => {
      const opcode = instruction.opcode
      if (opcode === undefined) throw 'UNHANDLED_OPCODE'

      if (opcode === Opcode.ADDR_STUB) {
        if (instruction.args[0].type !== Header.DYN_ADDR) throw 'UNEXPECTED_HEADER'
        this.lookUpTable[instruction.args[0].value] = bytes.length
        return
      }

      bytes.push(opcode)
      instruction.args.forEach(command => {
        const compiledInstruction = this.compileInstructionArgument(command)
        bytes.push(...compiledInstruction)
      })
    })
  }

  compile(): { bytecode: Uint8Array; strings: string[] } {
    const bytes: number[] = []
    this.compileBlock(this.ir, bytes)
    for (let index = 0; index < bytes.length; index++) {
      if (bytes[index] === Header.DYN_ADDR) {
        let addr = this.lookUpTable[bytes[index + 1]]
        if (addr === undefined) throw 'DYNAMIC_ADDRESS_NOT_FOUND'
        bytes[index] = Header.LOAD_NUMBER
        bytes.splice(index + 1, 8, ...this.longToByteArray(addr))
        index += 8
      }
    }

    this.bytecode = Uint8Array.from(bytes)
    // console.dir(JSON.stringify(bytes))

    return {
      bytecode: this.bytecode,
      strings: this.strings
    }
  }

}
