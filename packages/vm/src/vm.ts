import { Header, Opcode } from '@kprotect/compiler'
import { unzlibSync } from 'fflate'
import { toUint8Array } from 'js-base64'

interface Context {
  stack: any[]
  variables: any[]
  parameters: any[]
  tracebackPC?: number
}

class VMStack {
  private context: Context[] = []

  constructor() {
    this.context.push({
      stack: [],
      variables: [],
      parameters: []
    })
  }

  printStack() {
    console.log(this.context[this.context.length - 1].stack)
  }

  push(value: any) {
    if (this.context.length === 0) throw 'STACK_UNDERFLOW'
    this.context[this.context.length - 1].stack.push(value)
  }

  pop() {
    if (this.context.length === 0) throw 'STACK_UNDERFLOW'
    return this.context[this.context.length - 1].stack.pop()
  }

  pushFrame(parameters: any[], tracebackPC: number) {
    this.context.push({
      stack: [],
      variables: [],
      parameters,
      tracebackPC
    })
  }

  popFrame() {
    return this.context.pop()
  }

  get(index: number) {
    return this.context[this.context.length - 1].variables[index]
  }

  set(index: number, value: any) {
    this.context[this.context.length - 1].variables[index] = value
  }

  getParameter(index: number) {
    return this.context[this.context.length - 1].parameters[index]
  }
}

export default class VM {
  private readonly bytecode: Uint8Array
  private readonly strings: string[]
  private readonly dependencies: any[]
  private readonly vmStack: VMStack
  // private readonly tracebackStack: Stack<Function>
  private programCounter: number

  constructor(localWindow: Window, bytecode: string, strings: string[]) {
    this.bytecode = this.decodeBytecode(bytecode)
    this.strings = strings
    this.dependencies = [localWindow, console]
    this.vmStack = new VMStack()
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

  private getValue() {
    const header = this.bytecode[this.programCounter++]
    let ptr: any

    switch (header) {
      // defines where our value is coming from, either we're directly loading in a value
      // popping from stack,
      // or we're fetching it from local variable
      case Header.LOAD_STRING:
        ptr = this.byteArrayToLong(this.load8ByteArray())
        return this.strings[ptr]

      case Header.LOAD_NUMBER:
        return this.byteArrayToLong(this.load8ByteArray())

      case Header.POP_STACK:
        return this.vmStack.pop()

      case Header.FETCH_VARIABLE:
        ptr = this.bytecode[this.programCounter++]
        return this.vmStack.get(ptr)

      case Header.FETCH_DEPENDENCY:
        ptr = this.bytecode[this.programCounter++]
        return this.dependencies[ptr]

      case Header.FETCH_PARAMETER:
        ptr = this.bytecode[this.programCounter++]
        return this.vmStack.getParameter(ptr)

      case Header.LOAD_UNDEFINED:
        return undefined

      case Header.LOAD_OBJECT:
        return {}

    }
  }

  private jmpToBlock(location: number) {
    if (location === undefined) throw 'ILLEGAL_JMP'
    this.programCounter = location
  }

  private executeOpcode(opcode: Opcode) {
    let arg$1: any, arg$2: any, arg$3: any
    switch (opcode) {
      case Opcode.ADD:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1 + arg$2)
        break
      case Opcode.SUB:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1 - arg$2)
        break
      case Opcode.MUL:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1 * arg$2)
        break
      case Opcode.DIV:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1 / arg$2)
        break
      case Opcode.MOD:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1 % arg$2)
        break
      case Opcode.NOT:
        arg$1 = this.vmStack.pop()
        this.vmStack.push(!arg$1)
        break
      case Opcode.POS:
        arg$1 = this.vmStack.pop()
        this.vmStack.push(+arg$1)
        break
      case Opcode.NEG:
        arg$1 = this.vmStack.pop()
        this.vmStack.push(-arg$1)
        break
      case Opcode.BITWISE_NOT:
        arg$1 = this.vmStack.pop()
        this.vmStack.push(~arg$1)
        break
      case Opcode.STORE:
        arg$1 = this.getValue()
        this.vmStack.set(arg$1, this.getValue())
        break
      case Opcode.GET_PROPERTY:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1[arg$2])
        break
      case Opcode.SET_PROPERTY:
        arg$3 = this.getValue()
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        arg$1[arg$2] = arg$3
        break
      case Opcode.EXISTS:
        throw 'UNFINISHED'
      case Opcode.DELETE_PROPERTY:
        throw 'UNFINISHED'
      case Opcode.IN:
        throw 'UNFINISHED'
      case Opcode.INSTANCE_OF:
        throw 'UNFINISHED'
      case Opcode.TYPEOF:
        arg$1 = this.vmStack.pop()
        this.vmStack.push(typeof arg$1)
        break
      case Opcode.APPLY:
        arg$3 = this.vmStack.pop() // arguments
        arg$2 = this.vmStack.pop() // this
        arg$1 = this.vmStack.pop() // function
        const res = arg$1.apply(arg$2, arg$3)
        this.vmStack.push(res)
        break
      case Opcode.EQUAL:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        // noinspection EqualityComparisonWithCoercionJS
        this.vmStack.push(arg$1 == arg$2)
        break
      case Opcode.NOT_EQUAL:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        // noinspection EqualityComparisonWithCoercionJS
        this.vmStack.push(arg$1 != arg$2)
        break
      case Opcode.LESS_THAN:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1 < arg$2)
        break
      case Opcode.GREATER_THAN:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1 > arg$2)
        break
      case Opcode.JMP:
        arg$1 = this.vmStack.pop()
        this.jmpToBlock(arg$1)
        break
      case Opcode.JZ:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        if (!arg$1) this.jmpToBlock(arg$2)
        break
      case Opcode.BITWISE_AND:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1 & arg$2)
        break
      case Opcode.BITWISE_OR:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1 | arg$2)
        break
      case Opcode.BITWISE_XOR:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1 ^ arg$2)
        break
      case Opcode.BITWISE_LEFT_SHIFT:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1 << arg$2)
        break
      case Opcode.BITWISE_RIGHT_SHIFT:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1 >> arg$2)
        break
      case Opcode.BITWISE_UNSIGNED_RIGHT_SHIFT:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(arg$1 >>> arg$2)
        break
      case Opcode.PUSH:
        this.vmStack.push(this.getValue())
        break
      case Opcode.POP:
        arg$1 = this.getValue()
        arg$2 = this.vmStack.pop()
        if (arg$1 !== undefined) {
          this.vmStack.set(arg$1, arg$2)
        }
        break
      case Opcode.INIT_CONSTRUCTOR:
        arg$2 = this.vmStack.pop()
        arg$1 = this.vmStack.pop()
        this.vmStack.push(new arg$1(arg$2))
        break
      case Opcode.BUILD_ARRAY:
        arg$1 = this.getValue()
        const arr = []
        for (let i = 0; i < arg$1; i++) {
          arr.unshift(this.vmStack.pop())
        }
        this.vmStack.push(arr)
        break
      case Opcode.VOID:
        throw 'UNFINISHED'
      case Opcode.THROW:
        arg$1 = this.vmStack.pop()
        throw arg$1
      case Opcode.DELETE:
        throw 'UNFINISHED'
      case Opcode.PUSH_STACK_FRAME:
        arg$1 = this.getValue()
        this.vmStack.pushFrame(arg$1, this.programCounter)
        break
      case Opcode.POP_STACK_FRAME:
        arg$1 = this.vmStack.popFrame()
        this.programCounter = arg$1.tracebackPC + 11 // PUSH LOAD_NUMBER 8_BYTE_ADDR NEXT_OPCODE
        this.vmStack.push(arg$1.stack.pop())
        break
      default:
        console.warn(opcode, this.programCounter)
        throw 'UNKNOWN_OPCODE'
    }
  }

  start() {
    while (this.programCounter < this.bytecode.length) {
      const count = this.programCounter++
      // console.log(count)
      const opcode = this.bytecode[count]
      // console.warn(`EXECUTING: ${opcode}`)
      // console.log(JSON.stringify(this.stack))
      this.executeOpcode(opcode)
    }
  }
}
