import {Dependency, Header, Opcode} from './constant'
import {inflateRaw} from 'pako'

export default class VM {
    private readonly bytecode: Uint8Array
    private readonly strings: string[]
    private readonly dependencies: any[]
    private readonly lookUpTable: { [index: string]: number }
    private readonly opcodeHandlers: any[]
    private readonly stack: any[]
    private readonly localVariables: any[]
    private readonly exitToPreviousContext: Function[]
    private programCounter: number

    constructor(bytecode: string, strings: string[], lookUpTable: { [index: string]: number }) {
        this.bytecode = this.decodeBytecode(bytecode)

        this.strings = strings
        this.dependencies = Dependency.map(value => value !== 'window' ? value : globalThis)
        this.opcodeHandlers = []
        this.stack = []
        this.localVariables = []
        this.lookUpTable = lookUpTable

        this.exitToPreviousContext = [() => {
            // if we call this function from main context then we just exit
            this.programCounter = this.bytecode.length + 1
            // this.programCounter = +inf
        }]
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

    private jmpToBlock(location: number) {
        const pc = this.programCounter

        this.exitToPreviousContext.push(() => {
            this.programCounter = pc
        })
        // console.log('JMP', label)
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
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.EXISTS] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.DELETE_PROPERTY] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.IN] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.INSTANCE_OF] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.TYPEOF] = () => {
            const expression = this.stack.pop()

            this.stack.push(typeof expression)
        }
        this.opcodeHandlers[Opcode.CALL] = () => {
            const argArr = this.stack.pop()
            const fn = this.stack.pop()

            this.stack.push(fn.call(this, ...argArr))
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
        this.opcodeHandlers[Opcode.JMP_IF_ELSE] = () => {
            const label$2 = this.stack.pop()
            const label$1 = this.stack.pop()
            const expression = this.stack.pop()

            let location: number
            if (expression) {
                location = this.lookUpTable[label$1]
            } else if (label$2 !== undefined) {
                location = this.lookUpTable[label$2]
            } else {
                return
            }
            if (location === undefined) throw 'ILLEGAL_JMP'
            this.jmpToBlock(location)
        }
        this.opcodeHandlers[Opcode.AND] = () => {
            const arg$2 = this.stack.pop()
            const arg$1 = this.stack.pop()

            this.stack.push(arg$1 && arg$2)
        }
        this.opcodeHandlers[Opcode.OR] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.NOT] = () => {
            const expression = this.stack.pop()

            this.stack.push(!expression)
        }
        this.opcodeHandlers[Opcode.BITWISE_AND] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.BITWISE_OR] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.BITWISE_XOR] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.BITWISE_LEFT_SHIFT] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.BITWISE_RIGHT_SHIFT] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.BITWISE_UNSIGNED_RIGHT_SHIFT] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.PUSH] = () => {
            this.stack.push(this.getValue())
        }
        this.opcodeHandlers[Opcode.POP] = () => {
            const dst = this.getValue()

            this.localVariables[dst] = this.stack.pop()
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
            const func = this.exitToPreviousContext.pop()
            if (func === undefined) throw 'EMPTY_TRACEBACK'
            func()
        }
        this.opcodeHandlers[Opcode.VOID] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.THROW] = () => {
            throw 'UNFINISHED'
        }
        this.opcodeHandlers[Opcode.DELETE] = () => {
            throw 'UNFINISHED'
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

            this.stack.push(obj[property].call(this, ...args))
        }

    }

    start() {
        while (this.programCounter < this.bytecode.length) {
            // console.log(this.exitToPreviousContext)
            const count = this.programCounter++
            // console.log(count)
            const opcode = this.bytecode[count]
            console.warn(`EXECUTING: ${opcode}`)
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