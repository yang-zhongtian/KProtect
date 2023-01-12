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
    private exitToPreviousContext: any[]
    private programCounter: number

    constructor(bytecode: string, strings: string[], lookUpTable: { [index: string]: number }) {
        this.bytecode = this.decodeBytecode(bytecode)

        this.strings = strings
        this.dependencies = Dependency.map(value => value !== 'window' ? value : globalThis)
        this.opcodeHandlers = []
        this.stack = []
        this.localVariables = []
        this.lookUpTable = lookUpTable

        this.exitToPreviousContext = [(vm: VM) => {
            // if we call this function from main context then we just exit
            vm.programCounter = vm.bytecode.length + 1
            // vm.programCounter = +inf
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

            case Header.LOAD_ARRAY:
                return []

            case Header.LOAD_OBJECT:
                return {}

            case Header.LOAD_NUMBER:
                return this.byteArrayToLong(this.load8ByteArray())

            case Header.POP_STACK:
                const val = this.stack[this.stack.length]
                this.stack.length -= 1
                return val

            case Header.FETCH_DEPENDENCY:
                const depPointer = this.bytecode[this.programCounter++]
                return this.dependencies[depPointer]

            case Header.FETCH_VARIABLE:
                const variable = this.bytecode[this.programCounter++]
                return this.localVariables[variable]
        }
    }

    private initOpcodeHandlers() {
        this.opcodeHandlers[Opcode.ADD] = (vm: VM) => {
            // in int array
            const arg$1 = vm.stack[vm.stack.length - 2]
            const arg$2 = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = arg$1 + arg$2
        }
        this.opcodeHandlers[Opcode.SUB] = (vm: VM) => {
            const arg$1 = vm.stack[vm.stack.length - 2]
            const arg$2 = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = arg$1 - arg$2
        }
        this.opcodeHandlers[Opcode.MUL] = (vm: VM) => {
            const arg$1 = vm.stack[vm.stack.length - 2]
            const arg$2 = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = arg$1 * arg$2
        }
        this.opcodeHandlers[Opcode.DIV] = (vm: VM) => {
            const arg$1 = vm.stack[vm.stack.length - 2]
            const arg$2 = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = arg$1 / arg$2

        }
        this.opcodeHandlers[Opcode.MOD] = (vm: VM) => {
            const arg$1 = vm.stack[vm.stack.length - 2]
            const arg$2 = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = arg$1 % arg$2
        }

        this.opcodeHandlers[Opcode.NEG] = (vm: VM) => {
            const arg$1 = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = !arg$1
        }
        this.opcodeHandlers[Opcode.EQUAL] = (vm: VM) => {
            const arg$1 = vm.stack[vm.stack.length - 2]
            const arg$2 = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = arg$1 == arg$2
        }
        this.opcodeHandlers[Opcode.STORE] = (vm: VM) => {
            const dst = vm.getValue()
            vm.localVariables[dst] = vm.getValue()
        }
        this.opcodeHandlers[Opcode.GET_PROPERTY] = (vm: VM) => {
            const base = vm.stack[vm.stack.length - 2]
            const property = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = base[property]
        }
        this.opcodeHandlers[Opcode.CALL] = (vm: VM) => {
            const fn = vm.stack[vm.stack.length - 2]
            const argArr = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = fn(...argArr)
        }
        this.opcodeHandlers[Opcode.PUSH] = (vm: VM) => {
            vm.stack[vm.stack.length] = vm.getValue()
        }
        this.opcodeHandlers[Opcode.POP] = (vm: VM) => {
            const dst = vm.getValue()
            vm.localVariables[dst] = vm.stack.pop()
        }
        this.opcodeHandlers[Opcode.INIT_CONSTRUCTOR] = (vm: VM) => {
            const c = vm.stack[vm.stack.length - 2]
            const val = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = new c(val)
        }
        this.opcodeHandlers[Opcode.STRICT_NOT_EQUAL] = (vm: VM) => {
            const base = vm.stack[vm.stack.length - 2]
            const property = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = base !== property
        }
        this.opcodeHandlers[Opcode.INIT_ARRAY] = (vm: VM) => {
            const v = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = [v]
        }
        this.opcodeHandlers[Opcode.NOT] = (vm: VM) => {
            const expression = vm.stack[vm.stack.length - 1]
            vm.stack[vm.stack.length] = !expression
        }
        this.opcodeHandlers[Opcode.TYPEOF] = (vm: VM) => {
            const expression = vm.stack[vm.stack.length - 1]
            vm.stack[vm.stack.length] = typeof expression
        }
        this.opcodeHandlers[Opcode.JMP_IF] = (vm: VM) => {
            const expression = vm.stack[vm.stack.length - 2]
            const label = vm.stack[vm.stack.length - 1]

            if (expression) {
                // JMP to specified location
                // we keep a breakpoint to this

                const pc = vm.programCounter

                vm.exitToPreviousContext.unshift((vm: VM) => {
                    vm.programCounter = pc
                })

                const location: any = vm.lookUpTable[label]

                if (location === undefined) throw 'ILLEGAL JMP'

                // console.log('JMP', label)
                vm.programCounter = location
            }
            // vm.stack[vm.stack.length] = typeof expression
        }

        this.opcodeHandlers[Opcode.EXIT] = (vm: VM) => {
            vm.exitToPreviousContext[0](vm)

            vm.exitToPreviousContext.shift()
        }
        this.opcodeHandlers[Opcode.AND] = (vm: VM) => {
            const arg$1 = vm.stack[vm.stack.length - 2]
            const arg$2 = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = arg$1 && arg$2
        }

        this.opcodeHandlers[Opcode.APPLY] = (vm: VM) => {
            const fn = vm.stack[vm.stack.length - 3]
            const obj = vm.stack[vm.stack.length - 2]
            const args = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = fn.apply(obj, args)
        }
        this.opcodeHandlers[Opcode.CALL_MEMBER_EXPRESSION] = (vm: VM) => {
            const obj = vm.stack[vm.stack.length - 3]
            const property = vm.stack[vm.stack.length - 2]
            const args = vm.stack[vm.stack.length - 1]

            vm.stack[vm.stack.length] = obj[property].call(this, ...args)
        }


    }


    private getInstructionHandler(opcode: Opcode): Function {
        return this.opcodeHandlers[opcode]
    }

    start() {
        while (this.programCounter < this.bytecode.length) {
            console.log(this.exitToPreviousContext)
            const count = this.programCounter++
            // console.log(count)
            const opcode = this.bytecode[count]
            // console.log(`EXECUTING: ${opcode}`)
            const handler = this.getInstructionHandler(opcode)

            if (handler === undefined) {
                // console.log(vm.decodedBytecode.slice(count-45, count+1))
                // console.log(opcode, count)
                throw 'UNKNOWN_OPCODE'
            }
            // console.log(this.programCounter)
            handler(this)
        }
    }
}
