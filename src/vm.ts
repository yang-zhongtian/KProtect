import { Header, Opcode } from './constant'
import { unzlibSync } from 'fflate'

class VMStack {
    private stack: any[][] = [[]]

    push(value: any) {
        if (this.stack.length === 0) throw 'STACK_UNDERFLOW'
        this.stack[this.stack.length - 1].push(value)
    }

    pop() {
        if (this.stack.length === 0) throw 'STACK_UNDERFLOW'
        return this.stack[this.stack.length - 1].pop()
    }

}

export default class VM {
    private readonly bytecode: Uint8Array
    private readonly strings: string[]
    private readonly dependencies = [window, console]
    private readonly vmStack: VMStack
    // private readonly tracebackStack: Stack<Function>
    private readonly localVariables: any[]
    private programCounter: number

    constructor(bytecode: string, strings: string[]) {
        this.bytecode = this.decodeBytecode(bytecode)

        this.strings = strings
        this.vmStack = new VMStack()
        this.localVariables = []

        // this.tracebackStack = new Stack()
        // this.tracebackStack.push(() => {
        //     // if we call this function from main context then we just exit
        //     this.programCounter = this.bytecode.length + 1
        //     // this.programCounter = +inf
        // })
        this.programCounter = 0
    }

    private decodeBytecode(bytecode: string): Uint8Array {
        let decoded
        if (typeof window !== 'undefined') {
            decoded = atob(bytecode)
        } else {
            decoded = Buffer.from(bytecode, 'base64').toString('ascii')
        }
        const intArr = new Uint8Array(decoded.length)
        for (let i = 0; i < decoded.length; i++) {
            intArr[i] = decoded.charCodeAt(i)
        }
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

        switch (header) {
            // defines where our value is coming from, either we're directly loading in a value
            // popping from stack,
            // or we're fetching it from local variable
            case Header.LOAD_STRING:
                const stringPointer = this.byteArrayToLong(this.load8ByteArray())
                return this.strings[stringPointer]

            case Header.LOAD_NUMBER:
                return this.byteArrayToLong(this.load8ByteArray())

            case Header.POP_STACK:
                return this.vmStack.pop()

            case Header.FETCH_VARIABLE:
                const variable = this.bytecode[this.programCounter++]
                return this.localVariables[variable]

            case Header.FETCH_DEPENDENCY:
                const depPointer = this.bytecode[this.programCounter++]
                return this.dependencies[depPointer]

            case Header.LOAD_UNDEFINED:
                return undefined

            case Header.LOAD_ARRAY:
                return []

            case Header.LOAD_OBJECT:
                return {}

        }
    }

    private jmpToBlock(location: number) {
        if (location === undefined) throw 'ILLEGAL_JMP'
        this.programCounter = location
    }

    private executeOpcode(opcode: Opcode) {
        let arg$1, arg$2, arg$3
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
            case Opcode.NEG:
                arg$1 = this.vmStack.pop()
                this.vmStack.push(!arg$1)
                break
            case Opcode.STORE:
                arg$1 = this.getValue()
                this.localVariables[arg$1] = this.getValue()
                break
            case Opcode.GET_PROPERTY:
                arg$2 = this.vmStack.pop()
                arg$1 = this.vmStack.pop()
                this.vmStack.push(arg$1[arg$2])
                break
            case Opcode.SET_PROPERTY:
                throw 'UNFINISHED'
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
            case Opcode.CALL:
                arg$2 = this.vmStack.pop()
                arg$1 = this.vmStack.pop()
                this.vmStack.push(arg$1(...arg$2))
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
            case Opcode.LESS_THAN_EQUAL:
                arg$2 = this.vmStack.pop()
                arg$1 = this.vmStack.pop()
                this.vmStack.push(arg$1 <= arg$2)
                break
            case Opcode.STRICT_EQUAL:
                arg$2 = this.vmStack.pop()
                arg$1 = this.vmStack.pop()
                this.vmStack.push(arg$1 === arg$2)
                break
            case Opcode.STRICT_NOT_EQUAL:
                arg$2 = this.vmStack.pop()
                arg$1 = this.vmStack.pop()
                this.vmStack.push(arg$1 !== arg$2)
                break
            case Opcode.GREATER_THAN:
                arg$2 = this.vmStack.pop()
                arg$1 = this.vmStack.pop()
                this.vmStack.push(arg$1 > arg$2)
                break
            case Opcode.GREATER_THAN_EQUAL:
                arg$2 = this.vmStack.pop()
                arg$1 = this.vmStack.pop()
                this.vmStack.push(arg$1 >= arg$2)
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
            case Opcode.AND:
                arg$2 = this.vmStack.pop()
                arg$1 = this.vmStack.pop()
                this.vmStack.push(arg$1 && arg$2)
                break
            case Opcode.OR:
                throw 'UNFINISHED'
            case Opcode.BITWISE_AND:
                throw 'UNFINISHED'
            case Opcode.BITWISE_OR:
                throw 'UNFINISHED'
            case Opcode.BITWISE_XOR:
                throw 'UNFINISHED'
            case Opcode.BITWISE_LEFT_SHIFT:
                throw 'UNFINISHED'
            case Opcode.BITWISE_RIGHT_SHIFT:
                throw 'UNFINISHED'
            case Opcode.BITWISE_UNSIGNED_RIGHT_SHIFT:
                throw 'UNFINISHED'
            case Opcode.PUSH:
                this.vmStack.push(this.getValue())
                break
            case Opcode.POP:
                arg$1 = this.getValue()
                arg$2 = this.vmStack.pop()
                if (arg$1 !== undefined) this.localVariables[arg$1] = arg$2
                break
            case Opcode.INIT_CONSTRUCTOR:
                arg$2 = this.vmStack.pop()
                arg$1 = this.vmStack.pop()
                this.vmStack.push(new arg$1(arg$2))
                break
            case Opcode.INIT_ARRAY:
                arg$1 = this.vmStack.pop()
                this.vmStack.push([arg$1])
                break
            case Opcode.VOID:
                throw 'UNFINISHED'
            case Opcode.THROW:
                throw 'UNFINISHED'
            case Opcode.DELETE:
                throw 'UNFINISHED'
            case Opcode.APPLY:
                arg$3 = this.vmStack.pop()
                arg$2 = this.vmStack.pop()
                arg$1 = this.vmStack.pop()
                this.vmStack.push(arg$1.apply(arg$2, arg$3))
                break
            case Opcode.CALL_MEMBER_EXPRESSION:
                arg$3 = this.vmStack.pop()
                arg$2 = this.vmStack.pop()
                arg$1 = this.vmStack.pop()
                this.vmStack.push(arg$1[arg$2](...arg$3))
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
