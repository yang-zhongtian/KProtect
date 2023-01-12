import { Dependency } from './constant';
import { inflateRaw } from 'pako';
export default class VM {
    constructor(bytecode, strings, lookUpTable) {
        this.bytecode = this.decodeBytecode(bytecode);
        this.strings = strings;
        this.dependencies = Dependency.map(value => value !== 'window' ? value : globalThis);
        this.opcodeHandlers = [];
        this.stack = [];
        this.localVariables = [];
        this.lookUpTable = lookUpTable;
        this.exitToPreviousContext = [(vm) => {
                // if we call this function from main context then we just exit
                vm.programCounter = vm.bytecode.length + 1;
                // vm.programCounter = +inf
            }];
        this.programCounter = 0;
        this.initOpcodeHandlers();
    }
    decodeBytecode(bytecode) {
        let decoded;
        if (typeof window !== 'undefined') {
            decoded = atob(bytecode);
        }
        else {
            decoded = Buffer.from(bytecode, 'base64').toString('ascii');
        }
        const intArr = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
            intArr[i] = decoded.charCodeAt(i);
        }
        return inflateRaw(intArr);
    }
    byteArrayToLong(byteArray) {
        byteArray.reverse();
        return byteArray.reduce((previous, current) => previous * 256 + current);
    }
    load8ByteArray() {
        const byteArray = [];
        for (let i = 0; i < 8; i++) {
            byteArray.push(this.bytecode[this.programCounter++]);
        }
        return Uint8Array.from(byteArray);
    }
    getValue() {
        const header = this.bytecode[this.programCounter++];
        switch (header) {
            // defines where our value is coming from, either we're directly loading in a value
            // popping from stack,
            // or we're fetching it from local variable
            case 0 /* Header.LOAD_STRING */:
                const stringPointer = this.byteArrayToLong(this.load8ByteArray());
                return this.strings[stringPointer];
            case 6 /* Header.LOAD_ARRAY */:
                return [];
            case 7 /* Header.LOAD_OBJECT */:
                return {};
            case 1 /* Header.LOAD_NUMBER */:
                return this.byteArrayToLong(this.load8ByteArray());
            case 2 /* Header.POP_STACK */:
                return this.stack.pop();
            case 4 /* Header.FETCH_DEPENDENCY */:
                const depPointer = this.bytecode[this.programCounter++];
                return this.dependencies[depPointer];
            case 3 /* Header.FETCH_VARIABLE */:
                const variable = this.bytecode[this.programCounter++];
                return this.localVariables[variable];
        }
    }
    initOpcodeHandlers() {
        this.opcodeHandlers[0 /* Opcode.ADD */] = (vm) => {
            // in int array
            const arg$2 = vm.stack.pop();
            const arg$1 = vm.stack.pop();
            vm.stack.push(arg$1 + arg$2);
        };
        this.opcodeHandlers[1 /* Opcode.SUB */] = (vm) => {
            const arg$2 = vm.stack.pop();
            const arg$1 = vm.stack.pop();
            vm.stack.push(arg$1 - arg$2);
        };
        this.opcodeHandlers[2 /* Opcode.MUL */] = (vm) => {
            const arg$2 = vm.stack.pop();
            const arg$1 = vm.stack.pop();
            vm.stack.push(arg$1 * arg$2);
        };
        this.opcodeHandlers[3 /* Opcode.DIV */] = (vm) => {
            const arg$2 = vm.stack.pop();
            const arg$1 = vm.stack.pop();
            vm.stack.push(arg$1 / arg$2);
        };
        this.opcodeHandlers[4 /* Opcode.MOD */] = (vm) => {
            const arg$2 = vm.stack.pop();
            const arg$1 = vm.stack.pop();
            vm.stack.push(arg$1 % arg$2);
        };
        this.opcodeHandlers[5 /* Opcode.NEG */] = (vm) => {
            const arg$1 = vm.stack.pop();
            vm.stack.push(!arg$1);
        };
        this.opcodeHandlers[14 /* Opcode.EQUAL */] = (vm) => {
            const arg$2 = vm.stack.pop();
            const arg$1 = vm.stack.pop();
            // noinspection EqualityComparisonWithCoercionJS
            vm.stack.push(arg$1 == arg$2);
        };
        this.opcodeHandlers[6 /* Opcode.STORE */] = (vm) => {
            const dst = vm.getValue();
            vm.localVariables[dst] = vm.getValue();
        };
        this.opcodeHandlers[7 /* Opcode.GET_PROPERTY */] = (vm) => {
            const property = vm.stack.pop();
            const base = vm.stack.pop();
            vm.stack.push(base[property]);
        };
        this.opcodeHandlers[13 /* Opcode.CALL */] = (vm) => {
            const argArr = vm.stack.pop();
            const fn = vm.stack.pop();
            vm.stack.push(fn.call(this, ...argArr));
        };
        this.opcodeHandlers[24 /* Opcode.PUSH */] = (vm) => {
            vm.stack.push(vm.getValue());
        };
        this.opcodeHandlers[25 /* Opcode.POP */] = (vm) => {
            const dst = vm.getValue();
            vm.localVariables[dst] = vm.stack.pop();
        };
        this.opcodeHandlers[26 /* Opcode.INIT_CONSTRUCTOR */] = (vm) => {
            const val = vm.stack.pop();
            const c = vm.stack.pop();
            vm.stack.push(new c(val));
        };
        this.opcodeHandlers[19 /* Opcode.STRICT_NOT_EQUAL */] = (vm) => {
            const arg$2 = vm.stack.pop();
            const arg$1 = vm.stack.pop();
            vm.stack.push(arg$1 !== arg$2);
        };
        this.opcodeHandlers[27 /* Opcode.INIT_ARRAY */] = (vm) => {
            const v = vm.stack.pop();
            vm.stack.push([v]);
        };
        this.opcodeHandlers[23 /* Opcode.NOT */] = (vm) => {
            const expression = vm.stack.pop();
            vm.stack.push(!expression);
        };
        this.opcodeHandlers[12 /* Opcode.TYPEOF */] = (vm) => {
            const expression = vm.stack.pop();
            vm.stack.push(typeof expression);
        };
        this.opcodeHandlers[22 /* Opcode.JMP_IF */] = (vm) => {
            const label = vm.stack.pop();
            const expression = vm.stack.pop();
            if (expression) {
                // JMP to specified location
                // we keep a breakpoint to this
                const pc = vm.programCounter;
                vm.exitToPreviousContext.unshift((vm) => {
                    vm.programCounter = pc;
                });
                const location = vm.lookUpTable[label];
                if (location === undefined)
                    throw 'ILLEGAL JMP';
                // console.log('JMP', label)
                vm.programCounter = location;
            }
        };
        this.opcodeHandlers[28 /* Opcode.EXIT */] = (vm) => {
            vm.exitToPreviousContext[0](vm);
            vm.exitToPreviousContext.shift();
        };
        this.opcodeHandlers[35 /* Opcode.AND */] = (vm) => {
            const arg$2 = vm.stack.pop();
            const arg$1 = vm.stack.pop();
            vm.stack.push(arg$1 && arg$2);
        };
        this.opcodeHandlers[36 /* Opcode.APPLY */] = (vm) => {
            const args = vm.stack.pop();
            const obj = vm.stack.pop();
            const fn = vm.stack.pop();
            vm.stack.push(fn.apply(obj, args));
        };
        this.opcodeHandlers[37 /* Opcode.CALL_MEMBER_EXPRESSION */] = (vm) => {
            const args = vm.stack.pop();
            const property = vm.stack.pop();
            const obj = vm.stack.pop();
            vm.stack.push(obj[property].call(this, ...args));
        };
    }
    getInstructionHandler(opcode) {
        return this.opcodeHandlers[opcode];
    }
    start() {
        while (this.programCounter < this.bytecode.length) {
            // console.log(this.exitToPreviousContext)
            const count = this.programCounter++;
            // console.log(count)
            const opcode = this.bytecode[count];
            // console.log(`EXECUTING: ${opcode}`)
            const handler = this.getInstructionHandler(opcode);
            if (handler === undefined) {
                // console.log(vm.decodedBytecode.slice(count-45, count+1))
                // console.log(opcode, count)
                throw 'UNKNOWN_OPCODE';
            }
            // console.log(this.programCounter)
            handler(this);
        }
    }
}
