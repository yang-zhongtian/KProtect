import { Header, Opcode } from '@kprotect/compiler'
import { unzlibSync } from 'fflate'
import { toUint8Array } from 'js-base64'

export default class Disassembler {
  private readonly bytecode: Uint8Array
  private readonly strings: string[]
  private readonly dependencies = ['window', 'console']
  private programCounter: number
  private result: string

  constructor(bytecode: string, strings: string[]) {
    this.bytecode = this.decodeBytecode(bytecode)
    this.strings = strings
    this.programCounter = 0
    this.result = ''
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
    let ptr: any

    switch (header) {
      // defines where our value is coming from, either we're directly loading in a value
      // popping from stack,
      // or we're fetching it from local variable
      case Header.LOAD_STRING:
        ptr = this.byteArrayToLong(this.load8ByteArray())
        if (!withType) {
          return this.strings[ptr]
        }
        return `STRING(${JSON.stringify(this.strings[ptr])})`

      case Header.LOAD_NUMBER:
        if (!withType) {
          return this.byteArrayToLong(this.load8ByteArray())
        }
        return `NUMBER(${this.byteArrayToLong(this.load8ByteArray())})`

      case Header.POP_STACK:
        return 'POP_STACK'

      case Header.FETCH_VARIABLE:
        ptr = this.bytecode[this.programCounter++]
        return `FETCH_VARIABLE var[${ptr}]`

      case Header.FETCH_DEPENDENCY:
        ptr = this.bytecode[this.programCounter++]
        return `FETCH_DEPENDENCY ${this.dependencies[ptr]}`

      case Header.FETCH_PARAMETER:

      case Header.LOAD_UNDEFINED:
        if (!withType) {
          return undefined
        }
        return `undefined`

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
        this.log('ADD')
        break
      case Opcode.SUB:
        this.log('SUB')
        break
      case Opcode.MUL:
        this.log('MUL')
        break
      case Opcode.DIV:
        this.log('DIV')
        break
      case Opcode.MOD:
        this.log('MOD')
        break
      case Opcode.NOT:
        this.log('NOT')
        break
      case Opcode.POS:
        this.log('POS')
        break
      case Opcode.NEG:
        this.log('NEG')
        break
      case Opcode.BITWISE_NOT:
        this.log('BITWISE_NOT')
        break
      case Opcode.STORE:
        varLoc = this.getValue(false)
        value = this.getValue()
        this.log(`STORE ${value} => var[${varLoc}]`)
        break
      case Opcode.GET_PROPERTY:
        this.log('GET_PROPERTY')
        break
      case Opcode.SET_PROPERTY:
        value = this.getValue()
        this.log(`SET_PROPERTY ${value}`)
        break
      case Opcode.EXISTS:
        this.log('EXISTS')
        break
      case Opcode.DELETE_PROPERTY:
        this.log('DELETE_PROPERTY')
        break
      case Opcode.IN:
        this.log('IN')
        break
      case Opcode.INSTANCE_OF:
        this.log('INSTANCE_OF')
        break
      case Opcode.TYPEOF:
        this.log('TYPEOF')
        break
      case Opcode.APPLY:
        this.log('APPLY')
        break
      case Opcode.EQUAL:
        this.log('EQUAL')
        break
      case Opcode.NOT_EQUAL:
        this.log('NOT_EQUAL')
        break
      case Opcode.LESS_THAN:
        this.log('LESS_THAN')
        break
      case Opcode.GREATER_THAN:
        this.log('GREATER_THAN')
        break
      case Opcode.JMP:
        this.log('JMP')
        break
      case Opcode.JZ:
        this.log('JZ')
        break
      case Opcode.ADDR_STUB:
        this.log('ADDR_STUB')
        break
      case Opcode.AND:
        this.log('AND')
        break
      case Opcode.OR:
        this.log('OR')
        break
      case Opcode.BITWISE_AND:
        this.log('BITWISE_AND')
        break
      case Opcode.BITWISE_OR:
        this.log('BITWISE_OR')
        break
      case Opcode.BITWISE_XOR:
        this.log('BITWISE_XOR')
        break
      case Opcode.BITWISE_LEFT_SHIFT:
        this.log('BITWISE_LEFT_SHIFT')
        break
      case Opcode.BITWISE_RIGHT_SHIFT:
        this.log('BITWISE_RIGHT_SHIFT')
        break
      case Opcode.BITWISE_UNSIGNED_RIGHT_SHIFT:
        this.log('BITWISE_UNSIGNED_RIGHT_SHIFT')
        break
      case Opcode.PUSH:
        this.log(`PUSH ${this.getValue()}`)
        break
      case Opcode.POP:
        varLoc = this.getValue(false)
        if (varLoc === undefined) {
          this.log('POP')
          break
        }
        this.log(`POP => var[${varLoc}]`)
        break
      case Opcode.INIT_CONSTRUCTOR:
        this.log('INIT_CONSTRUCTOR')
        break
      case Opcode.BUILD_ARRAY:
        value = this.getValue(false)
        this.log(`BUILD_ARRAY ${value}`)
        break
      case Opcode.VOID:
        this.log('VOID')
        break
      case Opcode.THROW:
        this.log('THROW')
        break
      case Opcode.DELETE:
        this.log('DELETE')
        break
      case Opcode.PUSH_STACK_FRAME:
        value = this.getValue()
        this.log(`PUSH_STACK_FRAME ${value}`)
        break
      case Opcode.POP_STACK_FRAME:
        this.log('POP_STACK_FRAME')
        break
      default:
        throw new Error(`Unknown opcode: ${opcode}`)
    }
  }

  private log(message: string) {
    this.result += `${message}\n`
  }

  start() {
    this.result = ''
    while (this.programCounter < this.bytecode.length) {
      this.disassemble()
    }
    return this.result
  }
}
