import {Header, Opcode} from './constant'
import {inflateRaw} from 'pako'

class Stack<T> {
    private stack: T[]

    constructor() {
        this.stack = []
    }

    push(element: T): void {
        this.stack.push(element)
    }

    pop(): T | undefined {
        return this.stack.pop()
    }

    top(): T | undefined {
        return this.stack.at(-1)
    }

    isEmpty(): boolean {
        return this.stack.length === 0
    }

    size(): number {
        return this.stack.length
    }
}

export default class VM {
    private readonly bytecode: Uint8Array
    private readonly strings: string[]
    private readonly dependencies = [window, console]
    private readonly lookUpTable: { [index: string]: number }
    private readonly opcodeHandlers: Function[]
    private readonly stack: Stack<any>
    private readonly tracebackStack: Stack<Function>
    private readonly blockLabelStack: Stack<string>
    private readonly localVariables: any[]
    private programCounter: number

    constructor(bytecode: string, strings: string[], lookUpTable: { [index: string]: number }) {
        this.bytecode = this.decodeBytecode(bytecode)

        this.strings = strings
        this.opcodeHandlers = []
        this.stack = new Stack()
        this.localVariables = []
        this.lookUpTable = lookUpTable

        this.tracebackStack = new Stack()
        this.tracebackStack.push(() => {
            // if we call this function from main context then we just exit
            this.programCounter = this.bytecode.length + 1
            // this.programCounter = +inf
        })
        this.blockLabelStack = new Stack()
        this.programCounter = 0
        this.initOpcodeHandlers()
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
        return inflateRaw(intArr)
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
                return this.stack.pop()

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

    private jmpToBlock(label: string, traceback: number | undefined) {
        const location = this.lookUpTable[label]
        if (location === undefined) throw 'ILLEGAL_JMP'
        if (traceback !== undefined) {
            this.tracebackStack.push(() => {
                this.programCounter = traceback
            })
        }
        this.blockLabelStack.push(label)
        this.programCounter = location
    }

    private initOpcodeHandlers() {
        this.opcodeHandlers[Opcode.ADD] = () => {
            // in int array
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 + arg$2)
        }
        this.opcodeHandlers[Opcode.SUB] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 - arg$2)
        }
        this.opcodeHandlers[Opcode.MUL] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 * arg$2)
        }
        this.opcodeHandlers[Opcode.DIV] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 / arg$2)
        }
        this.opcodeHandlers[Opcode.MOD] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 % arg$2)
        }
        this.opcodeHandlers[Opcode.NEG] = () => {
            const arg$1 = this.stack.pop()

            this.stack.push(!arg$1)
        }
        this.opcodeHandlers[Opcode.STORE] = () => {
            const dst = this.getValue()

            this.localVariables[dst] = this.getValue()
        }
        this.opcodeHandlers[Opcode.GET_PROPERTY] = () => {
            const property = this.stack.pop()
            const base = this.stack.pop()

            this.stack.push(base[property])
        }
        this.opcodeHandlers[Opcode.SET_PROPERTY] = () => {
            const property = this.stack.pop()
            const base = this.stack.pop()
            const value = this.stack.pop()

            base[property] = value
        }
        this.opcodeHandlers[Opcode.EXISTS] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.DELETE] = () => {
            const property = this.stack.pop()
            const base = this.stack.pop()

            delete base[property]
        }
        this.opcodeHandlers[Opcode.IN] = () => {
            const property = this.stack.pop()
            const base = this.stack.pop()

            this.stack.push(property in base)
        }
        this.opcodeHandlers[Opcode.INSTANCE_OF] = () => {
            const constructor = this.stack.pop()
            const base = this.stack.pop()

            this.stack.push(base instanceof constructor)
        }
        this.opcodeHandlers[Opcode.TYPEOF] = () => {
            const expression = this.stack.pop()

            this.stack.push(typeof expression)
        }
        this.opcodeHandlers[Opcode.CALL] = () => {
            const argArr = this.stack.pop()
            const fn = this.stack.pop()

            this.stack.push(fn(...argArr))
        }
        this.opcodeHandlers[Opcode.EQUAL] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            // noinspection EqualityComparisonWithCoercionJS
            this.stack.push(arg$1 == arg$2)
        }
        this.opcodeHandlers[Opcode.NOT_EQUAL] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            // noinspection EqualityComparisonWithCoercionJS
            this.stack.push(arg$1 != arg$2)
        }
        this.opcodeHandlers[Opcode.LESS_THAN] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 < arg$2)
        }
        this.opcodeHandlers[Opcode.LESS_THAN_EQUAL] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 <= arg$2)
        }
        this.opcodeHandlers[Opcode.STRICT_EQUAL] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 === arg$2)
        }
        this.opcodeHandlers[Opcode.STRICT_NOT_EQUAL] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 !== arg$2)
        }
        this.opcodeHandlers[Opcode.GREATER_THAN] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 > arg$2)
        }
        this.opcodeHandlers[Opcode.GREATER_THAN_EQUAL] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 >= arg$2)
        }
        this.opcodeHandlers[Opcode.JMP] = () => {
            const label = this.stack.pop()

            this.jmpToBlock(label, this.programCounter)
        }
        this.opcodeHandlers[Opcode.JMP_IF_ELSE] = () => {
            const label$2 = this.stack.pop()
            const label$1 = this.stack.pop()
            const expression = this.stack.pop()

            if (expression) {
                this.jmpToBlock(label$1, this.programCounter)
            } else if (label$2 !== undefined) {
                this.jmpToBlock(label$2, this.programCounter)
            }
        }
        this.opcodeHandlers[Opcode.JMP_NO_TRACEBACK] = () => {
            const label = this.stack.pop()

            this.jmpToBlock(label, undefined)
        }
        this.opcodeHandlers[Opcode.LOOP] = () => {
            const label = this.blockLabelStack.top()
            if (!label) throw 'LOOP_LABEL_NOT_FOUND'

            this.jmpToBlock(label, undefined)
        }
        this.opcodeHandlers[Opcode.AND] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 && arg$2)
        }
        this.opcodeHandlers[Opcode.OR] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 || arg$2)
        }
        this.opcodeHandlers[Opcode.BITWISE_AND] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 & arg$2)
        }
        this.opcodeHandlers[Opcode.BITWISE_OR] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 | arg$2)
        }
        this.opcodeHandlers[Opcode.BITWISE_XOR] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 ^ arg$2)
        }
        this.opcodeHandlers[Opcode.BITWISE_LEFT_SHIFT] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 << arg$2)
        }
        this.opcodeHandlers[Opcode.BITWISE_RIGHT_SHIFT] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 >> arg$2)
        }
        this.opcodeHandlers[Opcode.BITWISE_UNSIGNED_RIGHT_SHIFT] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 >>> arg$2)
        }
        this.opcodeHandlers[Opcode.PUSH] = () => {
            this.stack.push(this.getValue())
        }
        this.opcodeHandlers[Opcode.POP] = () => {
            const dst = this.getValue()
            const data = this.stack.pop()

            if (dst !== undefined) {
                this.localVariables[dst] = data
            }
        }
        this.opcodeHandlers[Opcode.INIT_CONSTRUCTOR] = () => {
            const val = this.stack.pop()
            const c = this.stack.pop()

            this.stack.push(new c(val))
        }
        this.opcodeHandlers[Opcode.INIT_ARRAY] = () => {
            const v = this.stack.pop()

            this.stack.push([v])
        }
        this.opcodeHandlers[Opcode.EXIT] = () => {
            const func = this.tracebackStack.pop()
            if (func === undefined) throw 'EMPTY_TRACEBACK'
            func()
        }
        this.opcodeHandlers[Opcode.EXIT_IF] = () => {
            const expression = this.stack.pop()
            if (expression) {
                this.opcodeHandlers[Opcode.EXIT]()
            }
        }
        this.opcodeHandlers[Opcode.VOID] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.THROW] = () => {
            throw this.stack.pop()
        }

        this.opcodeHandlers[Opcode.APPLY] = () => {
            const args = this.stack.pop()
            const obj = this.stack.pop()
            const fn = this.stack.pop()

            this.stack.push(fn.apply(obj, args))
        }

        this.opcodeHandlers[Opcode.CALL_MEMBER_EXPRESSION] = () => {
            const args = this.stack.pop()
            const property = this.stack.pop()
            const obj = this.stack.pop()

            this.stack.push(obj[property](...args))
        }

    }

    start() {
        while (this.programCounter < this.bytecode.length) {
            const count = this.programCounter++
            // console.log(count)
            const opcode = this.bytecode[count]
            // console.warn(`EXECUTING: ${opcode}`)
            // console.log(JSON.stringify(this.stack))
            const handler = this.opcodeHandlers[opcode]

            if (handler === undefined) {
                // console.log(this.decodedBytecode.slice(count-45, count+1))
                // console.log(opcode, count)
                throw 'UNKNOWN_OPCODE'
            }
            // console.log(this.programCounter)
            handler()
        }
    }
}
