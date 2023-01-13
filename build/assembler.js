import { deflateRaw } from 'pako';
export default class BytecodeCompiler {
    constructor(ir) {
        this.il = ir;
        this.strings = [];
        this.bytecode = new Uint8Array();
        this.lookUpTable = {};
    }
    longToByteArray(long) {
        const byteArray = [];
        for (let i = 0; i < 8; i++) {
            const byte = long & 0xff;
            long = (long - byte) / 256;
            byteArray.push(byte);
        }
        return byteArray;
    }
    compileInstructionArgument(arg) {
        const header = arg.type;
        switch (header) {
            case 5 /* Header.LOAD_UNDEFINED */:
                return [header];
            case 7 /* Header.LOAD_OBJECT */:
                return [header];
            case 6 /* Header.LOAD_ARRAY */:
                return [header];
            case 0 /* Header.LOAD_STRING */:
                this.strings.push(arg.value);
                const stringPointer = this.longToByteArray(this.strings.length - 1);
                return [header, ...stringPointer];
            case 1 /* Header.LOAD_NUMBER */:
                return [header, ...this.longToByteArray(arg.value)];
            case 2 /* Header.POP_STACK */:
                return [];
            case 3 /* Header.FETCH_VARIABLE */:
                return [header, arg.value];
            case 4 /* Header.FETCH_DEPENDENCY */:
                return [header, arg.value];
        }
    }
    compileBlock(block, bytes) {
        block.instructions.forEach(instruction => {
            const opcode = instruction.opcode;
            if (opcode === undefined)
                throw 'UNHANDLED_OPCODE';
            if (opcode === 23 /* Opcode.JMP_IF_ELSE */) {
                // need to implement a jmp look up table
                // console.log("JMP_IF", instruction.args[0])
                // console.log(bytes.length)
                // we need to put a placeholder of 9 bytes beforehand, so we can replace it later onwards when we add in the jmp locations
                for (let i = 0; i < 2; i++) {
                    bytes.push(33 /* Opcode.PUSH */);
                    console.log(instruction.args[i]);
                    bytes.push(...this.compileInstructionArgument({
                        type: instruction.args[i].type,
                        value: instruction.args[i].value
                    }));
                }
                bytes.push(opcode);
            }
            else {
                bytes.push(opcode);
                instruction.args.forEach(command => {
                    bytes.push(...this.compileInstructionArgument(command));
                });
            }
        });
    }
    compile() {
        const bytes = [];
        for (const [label, block] of Object.entries(this.il)) {
            console.log(`Segment ${label}: ${bytes.length}`);
            this.lookUpTable[label] = bytes.length;
            this.compileBlock(block, bytes);
            bytes.push(37 /* Opcode.EXIT */);
        }
        this.bytecode = Uint8Array.from(bytes);
        const buffer = deflateRaw(this.bytecode);
        return {
            bytecode: Buffer.from(buffer).toString('base64'),
            strings: this.strings,
            lookUpTable: this.lookUpTable
        };
    }
}
