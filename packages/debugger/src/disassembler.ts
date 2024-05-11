import { Header, Opcode } from '@kprotect/compiler'
import { unzlibSync } from 'fflate'
import { toUint8Array } from 'js-base64'

export default class Disassembler {
  private readonly bytecode: Uint8Array
  private readonly strings: string[]
  private readonly dependencies = ['window', 'console']
  private programCounter: number

  constructor(bytecode: string, strings: string[]) {
    this.bytecode = this.decodeBytecode(bytecode)
    this.strings = strings
    this.programCounter = 0
  }

  private decodeBytecode(bytecode: string): Uint8Array {
    const intArr = toUint8Array(bytecode)
    return unzlibSync(intArr)
  }

  private byteArrayToLong(byteArray: Uint8Array): number {
    byteArray.reverse()
    return byteArray.reduce((previous, current) => previous * 256 + current)
  }

  private load8ByteArray(): Uint8Array {
    const byteArray = []
    for (let i = 0; i < 8; i++) {
      byteArray.push(this.bytecode[this.programCounter++])
    }
    return Uint8Array.from(byteArray)
  }

  private getValue(withType = true) {
    const header = this.bytecode[this.programCounter++]

    switch (header) {
      // defines where our value is coming from, either we're directly loading in a value
      // popping from stack,
      // or we're fetching it from local variable
      case Header.LOAD_STRING:
        const stringPointer = this.byteArrayToLong(this.load8ByteArray())
        if (!withType) {
          return this.strings[stringPointer]
        }
        return `STRING(${JSON.stringify(this.strings[stringPointer])})`

      case Header.LOAD_NUMBER:
        if (!withType) {
          return this.byteArrayToLong(this.load8ByteArray())
        }
        return `NUMBER(${this.byteArrayToLong(this.load8ByteArray())})`

      case Header.POP_STACK:
        return 'POP_STACK'

      case Header.FETCH_VARIABLE:
        const variable = this.bytecode[this.programCounter++]
        return `FETCH_VARIABLE var[${variable}]`

      case Header.FETCH_DEPENDENCY:
        const depPointer = this.bytecode[this.programCounter++]
        return `FETCH_DEPENDENCY ${this.dependencies[depPointer]}`

      case Header.LOAD_UNDEFINED:
        if (!withType) {
          return undefined
        }
        return `undefined`

      case Header.LOAD_ARRAY:
        if (!withType) {
          return []
        }
        return `LIST([])`

      case Header.LOAD_OBJECT:
        if (!withType) {
          return {}
        }
        return `OBJECT({})`

      default:
        throw new Error(`Unknown header: ${header}`)
    }
  }

  private disassemble() {
    const opcode = this.bytecode[this.programCounter++]
    let varLoc: any, value: any

    switch (opcode) {
      case Opcode.ADD:
        console.log('ADD')
        break
      case Opcode.SUB:
        console.log('SUB')
        break
      case Opcode.MUL:
        console.log('MUL')
        break
      case Opcode.DIV:
        console.log('DIV')
        break
      case Opcode.MOD:
        console.log('MOD')
        break
      case Opcode.NEG:
        console.log('NEG')
        break
      case Opcode.STORE:
        varLoc = this.getValue(false)
        value = this.getValue()
        console.log(`STORE ${value} => var[${varLoc}]`)
        break
      case Opcode.GET_PROPERTY:
        console.log('GET_PROPERTY')
        break
      case Opcode.SET_PROPERTY:
        console.log('SET_PROPERTY')
        break
      case Opcode.EXISTS:
        console.log('EXISTS')
        break
      case Opcode.DELETE_PROPERTY:
        console.log('DELETE_PROPERTY')
        break
      case Opcode.IN:
        console.log('IN')
        break
      case Opcode.INSTANCE_OF:
        console.log('INSTANCE_OF')
        break
      case Opcode.TYPEOF:
        console.log('TYPEOF')
        break
      case Opcode.APPLY:
        console.log('APPLY')
        break
      case Opcode.EQUAL:
        console.log('EQUAL')
        break
      case Opcode.NOT_EQUAL:
        console.log('NOT_EQUAL')
        break
      case Opcode.LESS_THAN:
        console.log('LESS_THAN')
        break
      case Opcode.GREATER_THAN:
        console.log('GREATER_THAN')
        break
      case Opcode.JMP:
        console.log('JMP')
        break
      case Opcode.JZ:
        console.log('JZ')
        break
      case Opcode.ADDR_STUB:
        console.log('ADDR_STUB')
        break
      case Opcode.AND:
        console.log('AND')
        break
      case Opcode.OR:
        console.log('OR')
        break
      case Opcode.BITWISE_AND:
        console.log('BITWISE_AND')
        break
      case Opcode.BITWISE_OR:
        console.log('BITWISE_OR')
        break
      case Opcode.BITWISE_XOR:
        console.log('BITWISE_XOR')
        break
      case Opcode.BITWISE_LEFT_SHIFT:
        console.log('BITWISE_LEFT_SHIFT')
        break
      case Opcode.BITWISE_RIGHT_SHIFT:
        console.log('BITWISE_RIGHT_SHIFT')
        break
      case Opcode.BITWISE_UNSIGNED_RIGHT_SHIFT:
        console.log('BITWISE_UNSIGNED_RIGHT_SHIFT')
        break
      case Opcode.PUSH:
        console.log('PUSH', this.getValue())
        break
      case Opcode.POP:
        varLoc = this.getValue(false)
        if (varLoc === undefined) {
          console.log('POP')
          break
        }
        console.log(`POP => var[${varLoc}]`)
        break
      case Opcode.INIT_CONSTRUCTOR:
        console.log('INIT_CONSTRUCTOR')
        break
      case Opcode.INIT_ARRAY:
        console.log('INIT_ARRAY')
        break
      case Opcode.VOID:
        console.log('VOID')
        break
      case Opcode.THROW:
        console.log('THROW')
        break
      case Opcode.DELETE:
        console.log('DELETE')
        break
      case Opcode.PUSH_STACK_FRAME:
        console.log('PUSH_STACK_FRAME')
        break
      case Opcode.POP_STACK_FRAME:
        console.log('POP_STACK_FRAME')
        break
      default:
        throw new Error(`Unknown opcode: ${opcode}`)
    }
  }

  start() {
    console.log(this.bytecode)
    while (this.programCounter < this.bytecode.length) {
      this.disassemble()
    }
  }
}
