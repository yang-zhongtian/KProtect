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
        this.exitToPreviousContext = [() => {
                // if we call this function from main context then we just exit
                this.programCounter = this.bytecode.length + 1;
                // this.programCounter = +inf
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
            case 1 /* Header.LOAD_NUMBER */:
                return this.byteArrayToLong(this.load8ByteArray());
            case 2 /* Header.POP_STACK */:
                return this.stack.pop();
            case 3 /* Header.FETCH_VARIABLE */:
                const variable = this.bytecode[this.programCounter++];
                return this.localVariables[variable];
            case 4 /* Header.FETCH_DEPENDENCY */:
                const depPointer = this.bytecode[this.programCounter++];
                return this.dependencies[depPointer];
            case 5 /* Header.LOAD_UNDEFINED */:
                return undefined;
            case 6 /* Header.LOAD_ARRAY */:
                return [];
            case 7 /* Header.LOAD_OBJECT */:
                return {};
        }
    }
    jmpToBlock(location) {
        const pc = this.programCounter;
        this.exitToPreviousContext.unshift(() => {
            this.programCounter = pc;
        });
        // console.log('JMP', label)
        this.programCounter = location;
    }
    initOpcodeHandlers() {
        this.opcodeHandlers[0 /* Opcode.ADD */] = () => {
            // in int array
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            this.stack.push(arg$1 + arg$2);
        };
        this.opcodeHandlers[1 /* Opcode.SUB */] = () => {
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            this.stack.push(arg$1 - arg$2);
        };
        this.opcodeHandlers[2 /* Opcode.MUL */] = () => {
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            this.stack.push(arg$1 * arg$2);
        };
        this.opcodeHandlers[3 /* Opcode.DIV */] = () => {
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            this.stack.push(arg$1 / arg$2);
        };
        this.opcodeHandlers[4 /* Opcode.MOD */] = () => {
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            this.stack.push(arg$1 % arg$2);
        };
        this.opcodeHandlers[5 /* Opcode.NEG */] = () => {
            const arg$1 = this.stack.pop();
            this.stack.push(!arg$1);
        };
        this.opcodeHandlers[6 /* Opcode.STORE */] = () => {
            const dst = this.getValue();
            this.localVariables[dst] = this.getValue();
        };
        this.opcodeHandlers[7 /* Opcode.GET_PROPERTY */] = () => {
            const property = this.stack.pop();
            const base = this.stack.pop();
            this.stack.push(base[property]);
        };
        this.opcodeHandlers[8 /* Opcode.SET_PROPERTY */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[9 /* Opcode.EXISTS */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[10 /* Opcode.DELETE_PROPERTY */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[11 /* Opcode.IN */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[12 /* Opcode.INSTANCE_OF */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[13 /* Opcode.TYPEOF */] = () => {
            const expression = this.stack.pop();
            this.stack.push(typeof expression);
        };
        this.opcodeHandlers[14 /* Opcode.CALL */] = () => {
            const argArr = this.stack.pop();
            const fn = this.stack.pop();
            this.stack.push(fn.call(this, ...argArr));
        };
        this.opcodeHandlers[15 /* Opcode.EQUAL */] = () => {
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            // noinspection EqualityComparisonWithCoercionJS
            this.stack.push(arg$1 == arg$2);
        };
        this.opcodeHandlers[16 /* Opcode.NOT_EQUAL */] = () => {
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            // noinspection EqualityComparisonWithCoercionJS
            this.stack.push(arg$1 != arg$2);
        };
        this.opcodeHandlers[17 /* Opcode.LESS_THAN */] = () => {
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            this.stack.push(arg$1 < arg$2);
        };
        this.opcodeHandlers[18 /* Opcode.LESS_THAN_EQUAL */] = () => {
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            this.stack.push(arg$1 <= arg$2);
        };
        this.opcodeHandlers[19 /* Opcode.STRICT_EQUAL */] = () => {
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            this.stack.push(arg$1 === arg$2);
        };
        this.opcodeHandlers[20 /* Opcode.STRICT_NOT_EQUAL */] = () => {
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            this.stack.push(arg$1 !== arg$2);
        };
        this.opcodeHandlers[21 /* Opcode.GREATER_THAN */] = () => {
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            this.stack.push(arg$1 > arg$2);
        };
        this.opcodeHandlers[22 /* Opcode.GREATER_THAN_EQUAL */] = () => {
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            this.stack.push(arg$1 >= arg$2);
        };
        this.opcodeHandlers[23 /* Opcode.JMP_IF_ELSE */] = () => {
            const label$2 = this.stack.pop();
            const label$1 = this.stack.pop();
            const expression = this.stack.pop();
            let location;
            if (expression) {
                location = this.lookUpTable[label$1];
            }
            else if (label$2 !== undefined) {
                location = this.lookUpTable[label$2];
            }
            else {
                return;
            }
            if (location === undefined)
                throw 'ILLEGAL_JMP';
            this.jmpToBlock(location);
        };
        this.opcodeHandlers[24 /* Opcode.AND */] = () => {
            const arg$2 = this.stack.pop();
            const arg$1 = this.stack.pop();
            this.stack.push(arg$1 && arg$2);
        };
        this.opcodeHandlers[25 /* Opcode.OR */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[26 /* Opcode.NOT */] = () => {
            const expression = this.stack.pop();
            this.stack.push(!expression);
        };
        this.opcodeHandlers[27 /* Opcode.BITWISE_AND */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[28 /* Opcode.BITWISE_OR */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[29 /* Opcode.BITWISE_XOR */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[30 /* Opcode.BITWISE_LEFT_SHIFT */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[31 /* Opcode.BITWISE_RIGHT_SHIFT */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[32 /* Opcode.BITWISE_UNSIGNED_RIGHT_SHIFT */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[33 /* Opcode.PUSH */] = () => {
            this.stack.push(this.getValue());
        };
        this.opcodeHandlers[34 /* Opcode.POP */] = () => {
            const dst = this.getValue();
            this.localVariables[dst] = this.stack.pop();
        };
        this.opcodeHandlers[35 /* Opcode.INIT_CONSTRUCTOR */] = () => {
            const val = this.stack.pop();
            const c = this.stack.pop();
            this.stack.push(new c(val));
        };
        this.opcodeHandlers[36 /* Opcode.INIT_ARRAY */] = () => {
            const v = this.stack.pop();
            this.stack.push([v]);
        };
        this.opcodeHandlers[37 /* Opcode.EXIT */] = () => {
            this.exitToPreviousContext[0]();
            this.exitToPreviousContext.shift();
        };
        this.opcodeHandlers[38 /* Opcode.VOID */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[39 /* Opcode.THROW */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[40 /* Opcode.DELETE */] = () => {
            throw 'UNFINISHED';
        };
        this.opcodeHandlers[41 /* Opcode.APPLY */] = () => {
            const args = this.stack.pop();
            const obj = this.stack.pop();
            const fn = this.stack.pop();
            this.stack.push(fn.apply(obj, args));
        };
        this.opcodeHandlers[42 /* Opcode.CALL_MEMBER_EXPRESSION */] = () => {
            const args = this.stack.pop();
            const property = this.stack.pop();
            const obj = this.stack.pop();
            this.stack.push(obj[property].call(this, ...args));
        };
    }
    start() {
        while (this.programCounter < this.bytecode.length) {
            // console.log(this.exitToPreviousContext)
            const count = this.programCounter++;
            // console.log(count)
            const opcode = this.bytecode[count];
            console.warn(`EXECUTING: ${opcode}`);
            const handler = this.opcodeHandlers[opcode];
            if (handler === undefined) {
                // console.log(this.decodedBytecode.slice(count-45, count+1))
                // console.log(opcode, count)
                throw 'UNKNOWN_OPCODE';
            }
            // console.log(this.programCounter)
            handler();
        }
    }
}
